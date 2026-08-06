import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@car-rental/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { parseDurationMs } from '../utils/parse-duration.js';
import { prisma } from '../lib/prisma-client.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { AuditService } from './audit.service.js';

interface AccessTokenPayload {
  sub: string;
  role: Role;
}

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

function toSafeUser(user: { id: string; email: string; fullName: string; role: Role }): SafeUser {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

// Opaque random value, not a JWT — the refresh token's only job is to be an
// unguessable key into the RefreshToken table, so it doesn't need to carry
// (or be re-verified against) any encoded claims itself.
function generateRawRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

// SHA-256, not bcrypt: bcrypt's slow KDF defends against brute-forcing a
// low-entropy secret (a password). This token already has 384 bits of
// entropy, so a fast, deterministic hash is both sufficient and necessary
// (deterministic so `findByTokenHash` can look it up directly).
function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export const AuthService = {
  async login(email: string, password: string, meta: SessionMeta) {
    const user = await UsersRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
    }

    const accessToken = signAccessToken(user.id, user.role);
    const rawRefreshToken = generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

    await prisma.$transaction(async (tx) => {
      await RefreshTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashRefreshToken(rawRefreshToken),
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await UsersRepository.updateLastLogin(user.id, tx);
      await AuditService.record(tx, { userId: user.id, action: 'LOGIN', ipAddress: meta.ipAddress });
    });

    return { accessToken, refreshToken: rawRefreshToken, user: toSafeUser(user) };
  },

  async refresh(rawToken: string, meta: SessionMeta) {
    const tokenHash = hashRefreshToken(rawToken);
    const existing = await RefreshTokenRepository.findByTokenHash(tokenHash);

    if (!existing) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Session expirée, veuillez vous reconnecter.');
    }

    if (existing.revokedAt) {
      // A rotated-away token being presented again means it leaked (or a
      // request raced a prior refresh) — treat as theft and kill every other
      // active session for this user rather than trust just this one token.
      await RefreshTokenRepository.revokeAllActiveForUser(existing.userId);
      throw new AppError(401, 'UNAUTHENTICATED', 'Session invalide. Veuillez vous reconnecter.');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Session expirée, veuillez vous reconnecter.');
    }

    const user = await UsersRepository.findById(existing.userId);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Session invalide. Veuillez vous reconnecter.');
    }

    const rawRefreshToken = generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

    await prisma.$transaction(async (tx) => {
      const created = await RefreshTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashRefreshToken(rawRefreshToken),
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await RefreshTokenRepository.revoke(existing.id, created.id, tx);
    });

    const accessToken = signAccessToken(user.id, user.role);
    return { accessToken, refreshToken: rawRefreshToken };
  },

  async logout(rawToken: string | undefined, userId: string, ipAddress?: string) {
    await prisma.$transaction(async (tx) => {
      if (rawToken) {
        const existing = await RefreshTokenRepository.findByTokenHash(hashRefreshToken(rawToken), tx);
        if (existing) {
          await RefreshTokenRepository.deleteById(existing.id, tx);
        }
      }
      await AuditService.record(tx, { userId, action: 'LOGOUT', ipAddress });
    });
  },

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await UsersRepository.findById(userId);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Utilisateur introuvable.');
    }
    return toSafeUser(user);
  },
};
