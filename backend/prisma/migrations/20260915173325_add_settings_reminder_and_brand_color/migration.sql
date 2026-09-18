-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "reminderWindowDays" INTEGER NOT NULL DEFAULT 7;
