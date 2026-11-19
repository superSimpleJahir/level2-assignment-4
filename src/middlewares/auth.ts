import { Role } from "@prisma/client";
import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { catchAsync } from "../utils/catchAsync";
import { verifyToken } from "../utils/jwt";

// Reads "Authorization: Bearer <token>", checks it and attaches req.user.
// We hit the DB once so a banned or deleted user is locked out immediately,
// even if their token has not expired yet.
export const authenticate: RequestHandler = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or malformed Authorization header. Use: Bearer <token>");
  }

  const payload = verifyToken(header.split(" ")[1]);

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user) throw ApiError.unauthorized("The account for this token no longer exists");
  if (user.status === "BANNED") throw ApiError.forbidden("Your account has been banned. Contact support.");

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

// Usage: router.use(authenticate, authorize("ADMIN"))
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action is only available to: ${roles.join(", ")}`));
    }
    next();
  };
