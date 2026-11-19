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
