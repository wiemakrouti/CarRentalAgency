-- DropIndex
DROP INDEX "clients_deletedAt_idx";

-- DropIndex
DROP INDEX "clients_email_idx";

-- DropIndex
DROP INDEX "clients_email_active_key";

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "deletedAt";

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");
