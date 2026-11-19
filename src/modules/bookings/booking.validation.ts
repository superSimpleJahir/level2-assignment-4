import { z } from "zod";

export const createBookingSchema = z.object({
  serviceId: z.string({ required_error: "serviceId is required" }).min(1, "serviceId is required"),
  scheduledAt: z
    .string({ required_error: "scheduledAt is required" })
    .datetime({ offset: true, message: "scheduledAt must be an ISO date-time, e.g. 2026-08-03T10:00:00Z" })
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() > Date.now(), { message: "scheduledAt must be in the future" }),
  address: z.string({ required_error: "Service address is required" }).trim().min(5, "Address must be at least 5 characters").max(200),
  notes: z.string().trim().max(500).optional(),
});

export const bookingQuerySchema = z.object({
  status: z
    .enum(["REQUESTED", "ACCEPTED", "DECLINED", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
      errorMap: () => ({ message: "Invalid booking status" }),
    })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// What a technician is allowed to move a booking to
export const technicianUpdateSchema = z
  .object({
    status: z.enum(["ACCEPTED", "DECLINED", "IN_PROGRESS", "COMPLETED"], {
      errorMap: () => ({ message: "Status must be one of ACCEPTED, DECLINED, IN_PROGRESS, COMPLETED" }),
    }),
    declineReason: z.string().trim().min(3).max(300).optional(),
  })
  .refine((data) => data.status !== "DECLINED" || !!data.declineReason, {
    message: "Please give a reason when declining a booking",
    path: ["declineReason"],
  });
