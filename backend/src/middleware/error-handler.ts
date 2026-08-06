import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '../utils/app-error.js';
import type { ApiError } from '@car-rental/shared';

const MULTER_ERROR_MESSAGES: Partial<Record<MulterError['code'], string>> = {
  LIMIT_FILE_SIZE: 'Le fichier dépasse la taille maximale autorisée (5 Mo).',
  LIMIT_UNEXPECTED_FILE: "Champ de fichier inattendu.",
};

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

  // Any module accepting file uploads (Cars, and later Clients/Payments) can
  // throw this from its multer middleware — handled centrally so none of
  // them need their own translation.
  if (err instanceof MulterError) {
    const body: ApiError = {
      success: false,
      error: {
        code: `UPLOAD_${err.code}`,
        message: MULTER_ERROR_MESSAGES[err.code] ?? 'Erreur lors du téléchargement du fichier.',
      },
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
