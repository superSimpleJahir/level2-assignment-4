import { BookingStatus, PaymentStatus, Prisma, Role, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildMeta } from "../../utils/pagination";
import { bookingInclude } from "../bookings/booking.service";
import { publicUserSelect } from "../auth/auth.service";

const listUsers = async (q: { role?: Role; status?: UserStatus; search?: string; page: number; limit: number }) => {
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { email: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, data] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
};

const updateUserStatus = async (adminId: string, userId: string, status: UserStatus) => {
  if (adminId === userId) throw ApiError.badRequest("You cannot change your own account status");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "ADMIN") throw ApiError.forbidden("Admin accounts cannot be banned");

  return prisma.user.update({ where: { id: userId }, data: { status }, select: publicUserSelect });
};

const listBookings = async (q: {
  status?: BookingStatus;
  customerId?: string;
  technicianId?: string;
  page: number;
  limit: number;
}) => {
  const where: Prisma.BookingWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.technicianId ? { technicianId: q.technicianId } : {}),
  };

  const [total, data] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
};

const listPayments = async (q: { status?: PaymentStatus; page: number; limit: number }) => {
  const where: Prisma.PaymentWhereInput = q.status ? { status: q.status } : {};

  const [total, data] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        booking: { select: { id: true, status: true, service: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
};

export const adminService = { listUsers, updateUserStatus, listBookings, listPayments };
