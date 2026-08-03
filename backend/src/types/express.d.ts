import type { Role } from '@car-rental/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
