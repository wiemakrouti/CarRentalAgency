import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import type { ApiError } from '@car-rental/shared';

// Must be registered last, per CLAUDE.md "Never expose internal errors" —
// unknown errors are logged server-side but never leak details to the client.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: ApiError = { success: false, error: { code: err.code, message: err.message } };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiError = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.issues.map((i) => i.message).join(', ') },
    };
    res.status(400).json(body);
    return;
  }

  console.error(err);
  const body: ApiError = {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  };
  res.status(500).json(body);
}
