-- AlterTable
ALTER TABLE "public"."settings" ADD COLUMN     "agencyNameAr" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fiscalStampDutyAmount" DECIMAL(10,3) NOT NULL DEFAULT 1,
ADD COLUMN     "taxId" TEXT;
