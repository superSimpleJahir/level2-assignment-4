import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch rejected promises, so wrap async handlers
// and forward any error to the global error middleware.
export const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
