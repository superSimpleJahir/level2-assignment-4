import { BookingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildMeta } from "../../utils/pagination";

// A technician cannot be double booked while a job is in one of these states
export const SLOT_BLOCKING_STATUSES: BookingStatus[] = ["ACCEPTED", "PAID", "IN_PROGRESS"];

export const bookingInclude = {
  service: { select: { id: true, title: true, price: true, durationMinutes: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  technician: {
    select: { id: true, headline: true, city: true, user: { select: { id: true, name: true, phone: true } } },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amount: true, currency: true, paidAt: true },
  },
  review: { select: { id: true, rating: true, comment: true } },
} satisfies Prisma.BookingInclude;

const toMinutes = (date: Date) => date.getUTCHours() * 60 + date.getUTCMinutes();
const hhmmToMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

// True when the technician has no booking overlapping [start, end)
export const isSlotFree = async (technicianId: string, start: Date, end: Date, ignoreBookingId?: string) => {
  const clash = await prisma.booking.findFirst({
    where: {
      technicianId,
      status: { in: SLOT_BLOCKING_STATUSES },
      scheduledAt: { lt: end },
      endsAt: { gt: start },
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
    },
    select: { id: true },
  });
  return !clash;
};

const create = async (
  customerId: string,
  input: { serviceId: string; scheduledAt: Date; address: string; notes?: string },
) => {
  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { technician: { include: { user: { select: { status: true } }, availability: true } } },
  });

  if (!service || !service.isActive || service.technician.user.status !== "ACTIVE") {
    throw ApiError.notFound("This service is not available for booking");
  }

  const start = input.scheduledAt;
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

  // Job must fit inside one of the technician's weekly slots (times are in UTC)
  const day = start.getUTCDay();
  const sameDay = start.getUTCDate() === end.getUTCDate();
  const fitsAvailability =
    sameDay &&
    service.technician.availability.some(
      (slot) =>
        slot.dayOfWeek === day &&
        hhmmToMinutes(slot.startTime) <= toMinutes(start) &&
        hhmmToMinutes(slot.endTime) >= toMinutes(end),
    );

  if (!fitsAvailability) {
    throw ApiError.badRequest("The technician is not available at the selected time", {
      hint: "Check the technician's availability slots and pick a time that fits the whole job duration",
      durationMinutes: service.durationMinutes,
    });
  }

  if (!(await isSlotFree(service.technicianId, start, end))) {
    throw ApiError.conflict("The technician already has a job at this time. Please choose another slot.");
  }

  return prisma.booking.create({
    data: {
      customerId,
      technicianId: service.technicianId,
      serviceId: service.id,
      scheduledAt: start,
      endsAt: end,
      address: input.address,
      notes: input.notes,
      totalAmount: service.price,
    },
    include: bookingInclude,
  });
};

const listForUser = async (
  user: { id: string; role: Role },
  query: { status?: BookingStatus; page: number; limit: number },
) => {
  let ownerFilter: Prisma.BookingWhereInput = {};
  if (user.role === "CUSTOMER") {
    ownerFilter = { customerId: user.id };
  } else if (user.role === "TECHNICIAN") {
    ownerFilter = { technician: { userId: user.id } };
  }

  const where: Prisma.BookingWhereInput = { ...ownerFilter, ...(query.status ? { status: query.status } : {}) };

  const [total, data] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { scheduledAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { data, meta: buildMeta(query.page, query.limit, total) };
};

const getById = async (user: { id: string; role: Role }, id: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { ...bookingInclude, technician: { select: { ...bookingInclude.technician.select, userId: true } } },
  });
  if (!booking) throw ApiError.notFound("Booking not found");

  const isOwner = booking.customerId === user.id;
  const isAssignedTechnician = booking.technician.userId === user.id;
  if (user.role !== "ADMIN" && !isOwner && !isAssignedTechnician) {
    // Hide that the booking exists at all
    throw ApiError.notFound("Booking not found");
  }

  return booking;
};

const cancel = async (customerId: string, id: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== customerId) throw ApiError.notFound("Booking not found");

  if (!["REQUESTED", "ACCEPTED"].includes(booking.status)) {
    throw ApiError.badRequest(`A booking that is ${booking.status} cannot be cancelled`);
  }

  return prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: bookingInclude,
  });
};

// ---------------- Technician side ----------------

// Which status can follow which. PAID is only reachable through Stripe,
// so a technician can never start a job that has not been paid for.
const TECHNICIAN_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  REQUESTED: ["ACCEPTED", "DECLINED"],
  PAID: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
};

const updateByTechnician = async (
  technicianUserId: string,
  id: string,
  input: { status: BookingStatus; declineReason?: string },
) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { technician: { select: { userId: true } } },
  });
  if (!booking || booking.technician.userId !== technicianUserId) throw ApiError.notFound("Booking not found");

  const allowed = TECHNICIAN_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw ApiError.badRequest(`Cannot change a booking from ${booking.status} to ${input.status}`, {
      currentStatus: booking.status,
      allowedNext: allowed,
    });
  }

  // Accepting reserves the slot, so make sure nothing else took it meanwhile
  if (input.status === "ACCEPTED" && !(await isSlotFree(booking.technicianId, booking.scheduledAt, booking.endsAt, booking.id))) {
    throw ApiError.conflict("You already have another accepted job overlapping this time");
  }

  return prisma.booking.update({
    where: { id },
    data: {
      status: input.status,
      declineReason: input.status === "DECLINED" ? input.declineReason : undefined,
    },
    include: bookingInclude,
  });
};

export const bookingService = { create, listForUser, getById, cancel, updateByTechnician };
