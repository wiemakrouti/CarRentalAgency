import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

interface ValidationTargets {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Runs before the controller so nothing unvalidated reaches a service,
// per CLAUDE.md "Validate every request." Parsed (coerced/defaulted) values
// are written back onto req so controllers read trusted, typed data.
export function validate(schemas: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
