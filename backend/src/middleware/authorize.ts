import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';

// A no-op today (every route that uses it calls authorize('ADMIN'), and
// every user is ADMIN) — exists so adding real multi-role permissions later
// doesn't require touching every route, only this middleware and the routes
// that need a *different* role than ADMIN. See docs/architecture.md §1.
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}
