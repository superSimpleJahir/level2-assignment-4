import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";

// Every technician endpoint starts from the logged-in user's profile
export const getProfileOrThrow = async (userId: string) => {
  const profile = await prisma.technicianProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound("Technician profile not found for this account");
  return profile;
};

const getMyProfile = async (userId: string) => {
  const profile = await getProfileOrThrow(userId);
  return prisma.technicianProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, address: true } },
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      services: { include: { category: { select: { id: true, name: true } } } },
    },
  });
};

const updateProfile = async (
  userId: string,
  data: {
    headline?: string;
    bio?: string;
    skills?: string[];
    experienceYears?: number;
    hourlyRate?: number;
    city?: string;
  },
) => {
  const profile = await getProfileOrThrow(userId);
  return prisma.technicianProfile.update({ where: { id: profile.id }, data });
};

// Replaces the whole weekly schedule in one go, which keeps the client simple
const setAvailability = async (
  userId: string,
  slots: { dayOfWeek: number; startTime: string; endTime: string }[],
) => {
  const profile = await getProfileOrThrow(userId);

  await prisma.$transaction([
    prisma.availabilitySlot.deleteMany({ where: { technicianId: profile.id } }),
    prisma.availabilitySlot.createMany({
      data: slots.map((slot) => ({ ...slot, technicianId: profile.id })),
    }),
  ]);

  return prisma.availabilitySlot.findMany({
    where: { technicianId: profile.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
};

export const technicianService = { getMyProfile, updateProfile, setAvailability };

// ---------------- Services offered by the technician ----------------

const assertCategoryUsable = async (categoryId: string) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest("The selected category does not exist");
  if (!category.isActive) throw ApiError.badRequest("The selected category is currently disabled");
};

const getOwnedService = async (userId: string, serviceId: string) => {
  const profile = await getProfileOrThrow(userId);
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  // 404 (not 403) so we don't reveal that someone else's service id exists
  if (!service || service.technicianId !== profile.id) throw ApiError.notFound("Service not found");
  return service;
};

const listMyServices = async (userId: string) => {
  const profile = await getProfileOrThrow(userId);
  return prisma.service.findMany({
    where: { technicianId: profile.id },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

const createService = async (
  userId: string,
  data: { title: string; description: string; categoryId: string; price: number; durationMinutes: number },
) => {
  const profile = await getProfileOrThrow(userId);
  await assertCategoryUsable(data.categoryId);
  return prisma.service.create({
    data: { ...data, technicianId: profile.id },
    include: { category: { select: { id: true, name: true } } },
  });
};

const updateService = async (
  userId: string,
  serviceId: string,
  data: {
    title?: string;
    description?: string;
    categoryId?: string;
    price?: number;
    durationMinutes?: number;
    isActive?: boolean;
  },
) => {
  await getOwnedService(userId, serviceId);
  if (data.categoryId) await assertCategoryUsable(data.categoryId);
  return prisma.service.update({
    where: { id: serviceId },
    data,
    include: { category: { select: { id: true, name: true } } },
  });
};

const deleteService = async (userId: string, serviceId: string) => {
  await getOwnedService(userId, serviceId);

  // Services that already have bookings are kept for history, just hidden
  const bookings = await prisma.booking.count({ where: { serviceId } });
  if (bookings > 0) {
    await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
    return { archived: true };
  }

  await prisma.service.delete({ where: { id: serviceId } });
  return { archived: false };
};

export const technicianServiceCrud = { listMyServices, createService, updateService, deleteService };
