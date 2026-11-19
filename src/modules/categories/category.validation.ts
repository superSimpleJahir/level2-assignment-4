import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string({ required_error: "Category name is required" }).trim().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(100).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(50),
    description: z.string().trim().max(300),
    icon: z.string().trim().max(100),
    isActive: z.boolean({ invalid_type_error: "isActive must be true or false" }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });

export const idParamSchema = z.object({
  id: z.string().min(1, "id is required"),
});
