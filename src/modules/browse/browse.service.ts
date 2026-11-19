import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildMeta } from "../../utils/pagination";

// Only expose technicians whose account is in good standing
const activeTechnician: Prisma.TechnicianProfileWhereInput = { user: { status: "ACTIVE" } };

const technicianCard = {
  id: true,
  headline: true,
  city: true,
  skills: true,
  experienceYears: true,
  hourlyRate: true,
  ratingAvg: true,
  reviewCount: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.TechnicianProfileSelect;

type ServiceQuery = {
  search?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy: "price" | "rating" | "newest";
  order: "asc" | "desc";
  page: number;
  limit: number;
};

const listServices = async (q: ServiceQuery) => {
  const where: Prisma.ServiceWhereInput = {
    isActive: true,
    category: { isActive: true },
    technician: {
      ...activeTechnician,
      ...(q.location ? { city: { contains: q.location, mode: "insensitive" } } : {}),
      ...(q.minRating !== undefined ? { ratingAvg: { gte: q.minRating } } : {}),
    },
    ...(q.category ? { category: { isActive: true, OR: [{ id: q.category }, { slug: q.category }] } } : {}),
    ...(q.minPrice !== undefined || q.maxPrice !== undefined
      ? { price: { ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}), ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}) } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: "insensitive" } },
            { description: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ServiceOrderByWithRelationInput =
    q.sortBy === "price"
      ? { price: q.order }
      : q.sortBy === "rating"
        ? { technician: { ratingAvg: q.order } }
        : { createdAt: q.order };

  const [total, data] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        technician: { select: technicianCard },
      },
    }),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
};

const getService = async (id: string) => {
  const service = await prisma.service.findFirst({
    where: { id, isActive: true, technician: activeTechnician },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      technician: { select: technicianCard },
    },
  });
  if (!service) throw ApiError.notFound("Service not found");
  return service;
};

type TechnicianQuery = {
  search?: string;
  category?: string;
  city?: string;
  skill?: string;
  minRating?: number;
  sortBy: "rating" | "experience" | "rate";
  order: "asc" | "desc";
  page: number;
  limit: number;
};

const listTechnicians = async (q: TechnicianQuery) => {
  const where: Prisma.TechnicianProfileWhereInput = {
    ...activeTechnician,
    ...(q.city ? { city: { contains: q.city, mode: "insensitive" } } : {}),
    ...(q.minRating !== undefined ? { ratingAvg: { gte: q.minRating } } : {}),
    ...(q.skill ? { skills: { has: q.skill } } : {}),
    ...(q.category
      ? { services: { some: { isActive: true, category: { OR: [{ id: q.category }, { slug: q.category }] } } } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { user: { name: { contains: q.search, mode: "insensitive" } } },
            { headline: { contains: q.search, mode: "insensitive" } },
            { bio: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.TechnicianProfileOrderByWithRelationInput =
    q.sortBy === "experience"
      ? { experienceYears: q.order }
      : q.sortBy === "rate"
        ? { hourlyRate: q.order }
        : { ratingAvg: q.order };

  const [total, data] = await prisma.$transaction([
    prisma.technicianProfile.count({ where }),
    prisma.technicianProfile.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        ...technicianCard,
        services: {
          where: { isActive: true },
          select: { id: true, title: true, price: true, category: { select: { name: true } } },
          take: 5,
        },
      },
    }),
  ]);

  return { data, meta: buildMeta(q.page, q.limit, total) };
};

const getTechnician = async (id: string) => {
  const technician = await prisma.technicianProfile.findFirst({
    where: { id, ...activeTechnician },
    select: {
      ...technicianCard,
      bio: true,
      createdAt: true,
      services: {
        where: { isActive: true, category: { isActive: true } },
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!technician) throw ApiError.notFound("Technician not found");
  return technician;
};

export const browseService = { listServices, getService, listTechnicians, getTechnician };
