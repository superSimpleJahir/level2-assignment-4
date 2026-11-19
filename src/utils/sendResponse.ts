import { Response } from "express";

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Options<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: Meta;
};

// Every successful response has the same shape: { success, message, data, meta? }
export const sendResponse = <T>(res: Response, { statusCode = 200, message, data, meta }: Options<T>) => {
  res.status(statusCode).json({
    success: true,
    message,
    ...(meta ? { meta } : {}),
    data: data ?? null,
  });
};
