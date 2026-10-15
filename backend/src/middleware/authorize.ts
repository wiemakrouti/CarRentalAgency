import type { NextFunction, Request, Response } from 'express';
import { can, type Permission } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';

// Director-only actions. Who may do what is decided once, in the shared
// PERMISSIONS list (packages/shared/src/permissions.ts), which the frontend
// reads too to hide what a role can't use. Routes without it are open to
// every member of the agency (`authenticate` already scopes them to it).
export function authorizePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !can(req.user.role, permission)) {
      next(new AppError(403, 'FORBIDDEN', "Vous n'avez pas les droits pour effectuer cette action."));
      return;
    }
    next();
  };
}
