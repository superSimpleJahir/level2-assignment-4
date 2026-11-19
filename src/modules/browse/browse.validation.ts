import { z } from "zod";

const page = z.coerce.number().int().min(1, "page must be 1 or more").default(1);
const limit = z.coerce.number().int().min(1).max(100, "limit cannot be more than 100").default(10);
const optionalNumber = (label: string) => z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0).optional();

export const serviceQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().optional(), // category id or slug
    location: z.string().trim().max(60).optional(), // technician city
    minPrice: optionalNumber("minPrice"),
    maxPrice: optionalNumber("maxPrice"),
    minRating: z.coerce.number().min(0).max(5, "minRating must be between 0 and 5").optional(),
    sortBy: z.enum(["price", "rating", "newest"]).default("newest"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page,
    limit,
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: "minPrice cannot be greater than maxPrice",
    path: ["minPrice"],
  });

export const technicianQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().optional(),
  city: z.string().trim().max(60).optional(),
  skill: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().min(0).max(5, "minRating must be between 0 and 5").optional(),
  sortBy: z.enum(["rating", "experience", "rate"]).default("rating"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page,
  limit,
});
