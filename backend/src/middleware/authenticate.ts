import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@car-rental/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { UsersRepository } from '../repositories/users.repository.js';

interface AccessTokenPayload {
  sub: string;
  role: Role;
  agencyId: string;
}

type AuthenticateOptions = {
  // The few account routes someone still holding a temporary password needs
  // (who am I, change my password, log out) — every other route refuses them.
  allowPendingPasswordChange: boolean;
};

// Verifies the short-lived JWT access token sent as `Authorization: Bearer
// <token>`, then the account itself: it must still exist and be active, and
// (outside the account routes) have replaced the director's temporary
// password. That second check reads the user from the database on every
// request, so a director deactivating an employee — or changing their role —
// takes effect on the very next request, not when the token expires.
// Attaches req.user for downstream authorizePermission()/controllers.
function createAuthenticate({ allowPendingPasswordChange }: AuthenticateOptions) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired session.'));
      return;
    }

    try {
      const account = await UsersRepository.findAccountStatus(payload.sub);
      if (!account) {
        next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired session.'));
        return;
      }
      if (account.deactivatedAt) {
        next(new AppError(401, 'ACCOUNT_DEACTIVATED', 'Ce compte a été désactivé par le directeur de l’agence.'));
        return;
      }
      if (account.mustChangePassword && !allowPendingPasswordChange) {
        next(
          new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Veuillez choisir votre mot de passe avant de continuer.'),
        );
        return;
      }
      req.user = { id: payload.sub, role: account.role, agencyId: account.agencyId };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const authenticate = createAuthenticate({ allowPendingPasswordChange: false });

// Only for GET /auth/me, PATCH /auth/me/password and POST /auth/logout.
export const authenticateAccount = createAuthenticate({ allowPendingPasswordChange: true });
