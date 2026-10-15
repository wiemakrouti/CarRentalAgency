import bcrypt from 'bcryptjs';
import type { CreateEmployeeInput, ResetEmployeePasswordInput, UpdateEmployeeInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { AuditService } from './audit.service.js';

type Actor = { id: string; agencyId: string };
type Meta = { ipAddress?: string };

const BCRYPT_ROUNDS = 10;

// The employee `id` of the director's own agency — never the director
// themselves: their own account is managed from the profile page, and a
// director must never be able to lock themselves (or another admin) out.
async function findEmployee(actor: Actor, id: string) {
  const user = await UsersRepository.findById(id);
  if (!user || user.agencyId !== actor.agencyId) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Membre de l’équipe introuvable.');
  }
  if (user.role !== 'EMPLOYEE') {
    throw new AppError(403, 'CANNOT_MANAGE_ADMIN', 'Le compte du directeur se gère depuis son profil.');
  }
  return user;
}

async function assertEmailFree(email: string, exceptUserId?: string) {
  const existing = await UsersRepository.findByEmail(email);
  if (existing && existing.id !== exceptUserId) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Cette adresse email est déjà utilisée.');
  }
}

// The director's team management (Équipe page). Every change is written to
// the audit log in the same transaction, attributed to the director.
export const TeamService = {
  list(agencyId: string) {
    return UsersRepository.findTeam(agencyId);
  },

  async createEmployee(actor: Actor, input: CreateEmployeeInput, meta: Meta) {
    await assertEmailFree(input.email);
    const passwordHash = await bcrypt.hash(input.temporaryPassword, BCRYPT_ROUNDS);
    return prisma.$transaction(async (tx) => {
      const member = await UsersRepository.createTeamMember(
        { agencyId: actor.agencyId, fullName: input.fullName, email: input.email, passwordHash, role: 'EMPLOYEE' },
        tx,
      );
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: member.id,
        after: { fullName: member.fullName, email: member.email, role: member.role },
        ipAddress: meta.ipAddress,
      });
      return member;
    });
  },

  async updateEmployee(actor: Actor, id: string, input: UpdateEmployeeInput, meta: Meta) {
    const before = await findEmployee(actor, id);
    await assertEmailFree(input.email, id);
    return prisma.$transaction(async (tx) => {
      const member = await UsersRepository.updateTeamMember(id, input, tx);
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: id,
        before: { fullName: before.fullName, email: before.email },
        after: { fullName: member.fullName, email: member.email },
        ipAddress: meta.ipAddress,
      });
      return member;
    });
  },

  // Cuts the employee off at once: login refused, every session revoked,
  // and authenticate() rejects their still-valid access token on the next
  // request. Their history stays attributed to them.
  async deactivate(actor: Actor, id: string, meta: Meta) {
    const before = await findEmployee(actor, id);
    if (before.deactivatedAt) return UsersRepository.setDeactivatedAt(id, before.deactivatedAt);
    return prisma.$transaction(async (tx) => {
      const member = await UsersRepository.setDeactivatedAt(id, new Date(), tx);
      await RefreshTokenRepository.revokeAllActiveForUser(id, tx);
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'USER_DEACTIVATE',
        entityType: 'User',
        entityId: id,
        ipAddress: meta.ipAddress,
      });
      return member;
    });
  },

  async reactivate(actor: Actor, id: string, meta: Meta) {
    const before = await findEmployee(actor, id);
    if (!before.deactivatedAt) return UsersRepository.setDeactivatedAt(id, null);
    return prisma.$transaction(async (tx) => {
      const member = await UsersRepository.setDeactivatedAt(id, null, tx);
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'USER_REACTIVATE',
        entityType: 'User',
        entityId: id,
        ipAddress: meta.ipAddress,
      });
      return member;
    });
  },

  // A forgotten password: the director sets a new temporary one, which the
  // employee must replace at their next login. Open sessions end now.
  async resetPassword(actor: Actor, id: string, input: ResetEmployeePasswordInput, meta: Meta) {
    await findEmployee(actor, id);
    const passwordHash = await bcrypt.hash(input.temporaryPassword, BCRYPT_ROUNDS);
    return prisma.$transaction(async (tx) => {
      const member = await UsersRepository.setTemporaryPassword(id, passwordHash, tx);
      await RefreshTokenRepository.revokeAllActiveForUser(id, tx);
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'USER_PASSWORD_RESET',
        entityType: 'User',
        entityId: id,
        ipAddress: meta.ipAddress,
      });
      return member;
    });
  },
};
