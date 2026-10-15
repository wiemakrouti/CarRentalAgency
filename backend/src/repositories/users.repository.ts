import type { Prisma, PrismaClient, Role } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Everything the director's Équipe page shows about a person — never the
// password hash.
const TEAM_MEMBER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  lastLoginAt: true,
  createdAt: true,
  deactivatedAt: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

export const UsersRepository = {
  findByEmail(email: string, db: Db = prisma) {
    return db.user.findUnique({ where: { email } });
  },

  findById(id: string, db: Db = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  updateLastLogin(id: string, db: Db = prisma) {
    return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  updateProfile(id: string, data: { fullName: string; email: string }, db: Db = prisma) {
    return db.user.update({ where: { id }, data });
  },

  // A user's own password change also ends any "temporary password" period.
  updatePassword(id: string, passwordHash: string, db: Db = prisma) {
    return db.user.update({ where: { id }, data: { passwordHash, mustChangePassword: false } });
  },

  // What authenticate() checks on every request: whether the account still
  // exists, is active, and has replaced its temporary password — read fresh
  // from the database, so a deactivation takes effect immediately rather
  // than when the access token expires.
  findAccountStatus(id: string, db: Db = prisma) {
    return db.user.findUnique({
      where: { id },
      select: { role: true, agencyId: true, deactivatedAt: true, mustChangePassword: true },
    });
  },

  // The agency's team for the director's Équipe page — the director first,
  // then employees in the order they were added.
  findTeam(agencyId: string, db: Db = prisma) {
    return db.user.findMany({
      where: { agencyId },
      select: TEAM_MEMBER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  },

  createTeamMember(
    data: { agencyId: string; fullName: string; email: string; passwordHash: string; role: Role },
    db: Db = prisma,
  ) {
    // Created by the director, who vouches for the address — no
    // verification email, but the temporary password must be replaced.
    return db.user.create({
      data: { ...data, emailVerifiedAt: new Date(), mustChangePassword: true },
      select: TEAM_MEMBER_SELECT,
    });
  },

  updateTeamMember(id: string, data: { fullName: string; email: string }, db: Db = prisma) {
    return db.user.update({ where: { id }, data, select: TEAM_MEMBER_SELECT });
  },

  setDeactivatedAt(id: string, deactivatedAt: Date | null, db: Db = prisma) {
    return db.user.update({ where: { id }, data: { deactivatedAt }, select: TEAM_MEMBER_SELECT });
  },

  setTemporaryPassword(id: string, passwordHash: string, db: Db = prisma) {
    return db.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
      select: TEAM_MEMBER_SELECT,
    });
  },
};
