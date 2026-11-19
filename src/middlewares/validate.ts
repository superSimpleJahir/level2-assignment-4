import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

// Validates and replaces req.body / req.query / req.params with the parsed
// (trimmed, coerced, defaulted) values. Zod errors go to the global handler.
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        // req.query is a getter in newer Express versions, so mutate in place
        const parsed = schemas.query.parse(req.query);
        Object.keys(req.query).forEach((key) => delete (req.query as Record<string, unknown>)[key]);
        Object.assign(req.query, parsed);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
