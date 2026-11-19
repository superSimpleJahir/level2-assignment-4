import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { signToken } from "../../utils/jwt";

// Never return the password hash to the client
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: Extract<Role, "CUSTOMER" | "TECHNICIAN">;
  phone?: string;
  address?: string;
};

const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const hashed = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashed,
      role: input.role,
      phone: input.phone,
      address: input.address,
      // Technicians get an empty profile right away so they can fill it in later
      ...(input.role === "TECHNICIAN" ? { technicianProfile: { create: {} } } : {}),
    },
    select: publicUserSelect,
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { user, token };
};

const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message for "no such user" and "wrong password" so emails can't be probed
  const invalid = ApiError.unauthorized("Invalid email or password");
  if (!user) throw invalid;

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) throw invalid;

  if (user.status === "BANNED") throw ApiError.forbidden("Your account has been banned. Contact support.");

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const { password: _omit, ...safeUser } = user;
  return { user: safeUser, token };
};

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      technicianProfile: {
        select: {
          id: true,
          headline: true,
          bio: true,
          skills: true,
          experienceYears: true,
          hourlyRate: true,
          city: true,
          ratingAvg: true,
          reviewCount: true,
        },
      },
    },
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
};

const updateMe = async (userId: string, data: { name?: string; phone?: string; address?: string }) =>
  prisma.user.update({ where: { id: userId }, data, select: publicUserSelect });

const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) throw ApiError.badRequest("Current password is incorrect");

  const hashed = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
};

export const authService = { register, login, getMe, updateMe, changePassword };
