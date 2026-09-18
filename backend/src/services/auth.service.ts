import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import type { Role } from '@car-rental/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { parseDurationMs } from '../utils/parse-duration.js';
import { prisma } from '../lib/prisma-client.js';
import { sendEmail } from '../lib/email-client.js';
import { verificationEmail, passwordResetEmail } from '../lib/email-templates.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository.js';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository.js';
import { AuditService } from './audit.service.js';

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

interface AccessTokenPayload {
  sub: string;
  role: Role;
  agencyId: string;
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
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Every user this returns is, by construction, already verified — login
// rejects unverified accounts outright (see login's own check), so there is
// no "unverified but signed in" state left for callers to care about.
function toSafeUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lastLoginAt: Date | null;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function signAccessToken(userId: string, role: Role, agencyId: string): string {
  return jwt.sign(
    { sub: userId, role, agencyId } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions,
  );
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

// Same shape as the refresh-token helpers above (random bytes + SHA-256),
// under generic names for the email-verification/password-reset tokens —
// separate functions purely so call sites read as what they are, not as
// "a refresh token used for something else".
function generateRawToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export const AuthService = {
  // Creates a brand new agency (tenant) plus its first (and, per this app's
  // single-admin-per-agency model, only) admin — a normal, always-available
  // signup, not a one-time setup gate. Each agency's data is isolated purely
  // by agencyId scoping everywhere else in the app; this is the one place
  // that boundary is actually created.
  //
  // Deliberately does NOT log the new admin in (no tokens issued here):
  // email verification is blocking (see login's own check below), so
  // signing up ends with "go check your email", not a session.
  async register(input: {
    agencyName: string;
    fullName: string;
    email: string;
    password: string;
  }): Promise<{ email: string }> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const rawVerificationToken = generateRawToken();

    let email: string;
    try {
      email = await prisma.$transaction(async (tx) => {
        const agency = await tx.agency.create({ data: {} });

        const created = await tx.user.create({
          data: {
            agencyId: agency.id,
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            role: 'ADMIN',
          },
        });

        await tx.setting.create({
          data: {
            agencyId: agency.id,
            agencyName: input.agencyName,
            currencyCode: 'TND',
          },
        });

        await EmailVerificationTokenRepository.create(
          {
            userId: created.id,
            tokenHash: hashToken(rawVerificationToken),
            expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
          },
          tx,
        );

        await AuditService.record(tx, {
          userId: created.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: created.id,
          after: { email: created.email, fullName: created.fullName },
        });

        return created.email;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Cette adresse email est déjà utilisée.');
      }
      throw err;
    }

    // Best-effort, after commit: a signup must never fail just because the
    // email provider had a hiccup — same "DB first, side effect after"
    // pattern as CarsService's Cloudinary uploads.
    try {
      const { subject, html } = verificationEmail(
        `${env.APP_URL}/verify-email?token=${rawVerificationToken}`,
      );
      await sendEmail({ to: email, subject, html });
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    return { email };
  },

  // Blocking (see login's own check) — until this succeeds, the account
  // exists but can't be logged into.
  async verifyEmail(rawToken: string): Promise<void> {
    const record = await EmailVerificationTokenRepository.findByTokenHash(hashToken(rawToken));
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        400,
        'INVALID_OR_EXPIRED_TOKEN',
        'Ce lien de vérification est invalide ou a expiré.',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await EmailVerificationTokenRepository.deleteAllForUser(record.userId, tx);
      await AuditService.record(tx, { userId: record.userId, action: 'EMAIL_VERIFY' });
    });
  },

  // Public (no auth) — a just-registered admin can't log in yet to request
  // this (verification is blocking), so it has to work from the email alone.
  // Always resolves the same way regardless of whether the email matches an
  // account or is already verified, same non-enumeration rationale as
  // forgotPassword below.
  async resendVerification(email: string): Promise<void> {
    const user = await UsersRepository.findByEmail(email);
    if (!user || user.emailVerifiedAt) return;

    const rawVerificationToken = generateRawToken();
    await prisma.$transaction(async (tx) => {
      // Invalidate any previous outstanding link first — at most one is ever
      // valid, so an old email lying around can't be used after this.
      await EmailVerificationTokenRepository.deleteAllForUser(user.id, tx);
      await EmailVerificationTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashToken(rawVerificationToken),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
        },
        tx,
      );
    });

    const { subject, html } = verificationEmail(
      `${env.APP_URL}/verify-email?token=${rawVerificationToken}`,
    );
    await sendEmail({ to: user.email, subject, html });
  },

  // Always resolves the same way whether or not `email` matches an account —
  // a different response (or timing difference worth caring about at this
  // scale) would let a caller enumerate which emails are registered.
  async forgotPassword(email: string): Promise<void> {
    const user = await UsersRepository.findByEmail(email);
    if (!user) return;

    const rawResetToken = generateRawToken();
    await prisma.$transaction(async (tx) => {
      await PasswordResetTokenRepository.deleteAllForUser(user.id, tx);
      await PasswordResetTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashToken(rawResetToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
        tx,
      );
    });

    const { subject, html } = passwordResetEmail(
      `${env.APP_URL}/reset-password?token=${rawResetToken}`,
    );
    await sendEmail({ to: user.email, subject, html });
  },

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await PasswordResetTokenRepository.findByTokenHash(hashToken(rawToken));
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        400,
        'INVALID_OR_EXPIRED_TOKEN',
        'Ce lien de réinitialisation est invalide ou a expiré.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await UsersRepository.updatePassword(record.userId, passwordHash, tx);
      // Same as a self-service password change: every existing session is
      // revoked, since a reset link is often used precisely because a
      // password (and possibly an active session) was compromised.
      await RefreshTokenRepository.revokeAllActiveForUser(record.userId, tx);
      await PasswordResetTokenRepository.deleteAllForUser(record.userId, tx);
      await AuditService.record(tx, { userId: record.userId, action: 'PASSWORD_RESET' });
    });
  },

  async login(email: string, password: string, meta: SessionMeta) {
    const user = await UsersRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
    }

    // Checked only after the password is confirmed correct — revealing
    // "this account isn't verified yet" to someone who doesn't actually know
    // the password would leak account state for free.
    if (!user.emailVerifiedAt) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Veuillez vérifier votre adresse email avant de vous connecter.',
      );
    }

    const accessToken = signAccessToken(user.id, user.role, user.agencyId);
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
      await AuditService.record(tx, {
        userId: user.id,
        action: 'LOGIN',
        ipAddress: meta.ipAddress,
      });
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

    const accessToken = signAccessToken(user.id, user.role, user.agencyId);
    return { accessToken, refreshToken: rawRefreshToken };
  },

  async logout(rawToken: string | undefined, userId: string, ipAddress?: string) {
    await prisma.$transaction(async (tx) => {
      if (rawToken) {
        const existing = await RefreshTokenRepository.findByTokenHash(
          hashRefreshToken(rawToken),
          tx,
        );
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

  async updateProfile(
    userId: string,
    input: { fullName: string; email: string },
    meta: SessionMeta,
  ): Promise<SafeUser> {
    const existing = await UsersRepository.findByEmail(input.email);
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Cette adresse email est déjà utilisée.');
    }

    const before = await UsersRepository.findById(userId);
    if (!before) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Utilisateur introuvable.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await UsersRepository.updateProfile(userId, input, tx);
      await AuditService.record(tx, {
        userId,
        action: 'PROFILE_UPDATE',
        entityType: 'User',
        entityId: userId,
        before: { fullName: before.fullName, email: before.email },
        after: { fullName: user.fullName, email: user.email },
        ipAddress: meta.ipAddress,
      });
      return user;
    });

    return toSafeUser(updated);
  },

  // Revokes every refresh token for this user, on every device, once the new
  // password is saved — a stolen or already-open session elsewhere can no
  // longer silently refresh its way to a new access token. This browser's
  // own current access token (a short-lived JWT, not looked up server-side)
  // keeps working until it naturally expires, so changing your own password
  // doesn't yank the rug from under the tab you did it in; it just won't
  // survive to the next refresh, same as every other session.
  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    meta: SessionMeta,
  ): Promise<void> {
    const user = await UsersRepository.findById(userId);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Utilisateur introuvable.');
    }

    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Le mot de passe actuel est incorrect.');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await UsersRepository.updatePassword(userId, passwordHash, tx);
      await RefreshTokenRepository.revokeAllActiveForUser(userId, tx);
      await AuditService.record(tx, {
        userId,
        action: 'PASSWORD_CHANGE',
        ipAddress: meta.ipAddress,
      });
    });
  },

  // `currentRawToken` (the refresh cookie on this very request, when present)
  // is how a session is flagged `isCurrent` — the access token alone carries
  // no session/device identity, only the user id.
  async listSessions(userId: string, currentRawToken: string | undefined) {
    const currentHash = currentRawToken ? hashRefreshToken(currentRawToken) : null;
    const sessions = await RefreshTokenRepository.findActiveByUser(userId);
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: currentHash !== null && session.tokenHash === currentHash,
    }));
  },

  async revokeSession(
    userId: string,
    sessionId: string,
    currentRawToken: string | undefined,
    meta: SessionMeta,
  ) {
    const session = await RefreshTokenRepository.findById(sessionId);
    if (!session || session.userId !== userId || session.revokedAt) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session introuvable.');
    }

    // The list only ever renders a "Déconnecter" button on OTHER sessions
    // (see ProfilePage), but the check still belongs here — this is the
    // actual security boundary, the UI hiding the button is just a courtesy.
    const currentHash = currentRawToken ? hashRefreshToken(currentRawToken) : null;
    if (currentHash && session.tokenHash === currentHash) {
      throw new AppError(
        400,
        'CANNOT_REVOKE_CURRENT_SESSION',
        'Utilisez la déconnexion pour fermer votre session actuelle.',
      );
    }

    await prisma.$transaction(async (tx) => {
      await RefreshTokenRepository.revoke(sessionId, undefined, tx);
      await AuditService.record(tx, {
        userId,
        action: 'SESSION_REVOKE',
        entityType: 'RefreshToken',
        entityId: sessionId,
        ipAddress: meta.ipAddress,
      });
    });
  },

  async revokeOtherSessions(
    userId: string,
    currentRawToken: string | undefined,
    meta: SessionMeta,
  ): Promise<void> {
    const currentHash = currentRawToken ? hashRefreshToken(currentRawToken) : null;

    await prisma.$transaction(async (tx) => {
      if (currentHash) {
        await RefreshTokenRepository.revokeAllActiveForUserExcept(userId, currentHash, tx);
      } else {
        // No refresh cookie on this request (shouldn't normally happen while
        // authenticated) — nothing to except, so the safe fallback is to
        // revoke everything rather than silently no-op.
        await RefreshTokenRepository.revokeAllActiveForUser(userId, tx);
      }
      await AuditService.record(tx, {
        userId,
        action: 'SESSIONS_REVOKE_OTHERS',
        ipAddress: meta.ipAddress,
      });
    });
  },
};
