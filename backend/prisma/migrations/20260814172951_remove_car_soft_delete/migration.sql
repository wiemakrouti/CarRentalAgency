-- DropIndex
DROP INDEX "cars_deletedAt_idx";

-- AlterTable
ALTER TABLE "cars" DROP COLUMN "deletedAt";

