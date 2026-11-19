import { z } from "zod";

const password = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password must be at most 64 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Please provide a valid email"),
  password,
  // Admins are created by the seed script only, never through public signup
  role: z.enum(["CUSTOMER", "TECHNICIAN"], {
    errorMap: () => ({ message: "Role must be either CUSTOMER or TECHNICIAN" }),
  }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally starting with +")
    .optional(),
  address: z.string().trim().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Please provide a valid email"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally starting with +"),
    address: z.string().trim().max(200),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: password,
});
