import { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { ZodError } from "zod";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

type ErrorBody = {
  statusCode: number;
  message: string;
  errorDetails: unknown;
};

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): ErrorBody => {
  switch (err.code) {
    case "P2002": {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return {
        statusCode: 409,
        message: `A record with this ${target} already exists`,
        errorDetails: { code: err.code, target },
      };
    }
    case "P2025":
      return { statusCode: 404, message: "Requested record was not found", errorDetails: { code: err.code } };
    case "P2003":
      return {
        statusCode: 400,
        message: "Related record does not exist or is still in use",
        errorDetails: { code: err.code, field: err.meta?.field_name },
      };
    default:
      return { statusCode: 400, message: "Database request failed", errorDetails: { code: err.code } };
  }
};

// Last middleware in the chain. Whatever goes wrong, the client always gets
// { success: false, message, errorDetails } with a sensible status code.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let body: ErrorBody = {
    statusCode: 500,
    message: "Something went wrong on our side",
    errorDetails: null,
  };

  if (err instanceof ApiError) {
    body = { statusCode: err.statusCode, message: err.message, errorDetails: err.errorDetails };
  } else if (err instanceof ZodError) {
    body = {
      statusCode: 400,
      message: "Validation failed",
      errorDetails: err.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    body = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    body = { statusCode: 400, message: "Invalid data sent to the database", errorDetails: null };
  } else if (err instanceof jwt.TokenExpiredError) {
    body = { statusCode: 401, message: "Your session has expired, please log in again", errorDetails: null };
  } else if (err instanceof jwt.JsonWebTokenError) {
    body = { statusCode: 401, message: "Invalid authentication token", errorDetails: null };
  } else if (err instanceof Stripe.errors.StripeError) {
    body = {
      statusCode: err.statusCode && err.statusCode < 500 ? 400 : 502,
      message: `Payment provider error: ${err.message}`,
      errorDetails: { type: err.type, code: err.code },
    };
  } else if (err?.type === "entity.parse.failed") {
    body = { statusCode: 400, message: "Request body contains invalid JSON", errorDetails: null };
  } else if (err?.type === "entity.too.large") {
    body = { statusCode: 413, message: "Request body is too large", errorDetails: null };
  }

  if (body.statusCode >= 500) {
    console.error("[error]", err);
    if (env.NODE_ENV === "development" && err instanceof Error) {
      body.errorDetails = { stack: err.stack };
    }
  }

  res.status(body.statusCode).json({
    success: false,
    message: body.message,
    errorDetails: body.errorDetails,
  });
};
