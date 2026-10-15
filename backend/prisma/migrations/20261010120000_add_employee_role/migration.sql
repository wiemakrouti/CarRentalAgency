-- Employees: a second role beside the agency's director, plus the two
-- account flags the director's team management relies on.
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

ALTER TABLE "users"
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
