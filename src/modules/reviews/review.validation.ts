import { z } from "zod";

export const createReviewSchema = z.object({
  bookingId: z.string({ required_error: "bookingId is required" }).min(1, "bookingId is required"),
  rating: z
    .number({ required_error: "Rating is required", invalid_type_error: "Rating must be a number" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z.string().trim().max(1000, "Comment can be at most 1000 characters").optional(),
});
