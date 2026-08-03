import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

interface AccessTokenPayload {
  sub: string;
  role: 'ADMIN';
}

// Verifies the short-lived JWT access token (issued by the Phase 1 login
// endpoint) sent as `Authorization: Bearer <token>`. Attaches req.user for
// downstream authorize()/controllers.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired session.'));
  }
}
