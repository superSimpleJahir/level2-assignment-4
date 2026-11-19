import { z } from "zod";

export const adminUserQuerySchema = z.object({
  role: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BANNED"], {
    errorMap: () => ({ message: "Status must be ACTIVE or BANNED" }),
  }),
});

export const adminBookingQuerySchema = z.object({
  status: z.enum(["REQUESTED", "ACCEPTED", "DECLINED", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  customerId: z.string().optional(),
  technicianId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const adminPaymentQuerySchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
