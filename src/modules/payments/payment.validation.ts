import { z } from "zod";

export const createPaymentSchema = z.object({
  bookingId: z.string({ required_error: "bookingId is required" }).min(1, "bookingId is required"),
});

export const confirmPaymentSchema = z.object({
  sessionId: z
    .string({ required_error: "sessionId is required" })
    .min(1, "sessionId is required")
    .startsWith("cs_", "sessionId must be a Stripe Checkout Session id (starts with cs_)"),
});

export const paymentQuerySchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"], {
    errorMap: () => ({ message: "Status must be PENDING, COMPLETED, FAILED or REFUNDED" }),
  }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
