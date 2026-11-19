import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Validate the environment once at boot so a missing variable
// fails loudly here instead of somewhere deep inside a request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAIL: z.string().email().default("admin@fixitnow.com"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin@12345"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
