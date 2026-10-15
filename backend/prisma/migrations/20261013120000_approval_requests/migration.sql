-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('CAR_PRICE_CHANGE', 'LARGE_EXPENSE', 'LARGE_DISCOUNT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "largeDiscountThreshold" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "activityAlertsSeenAt";

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "entityId" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "requesterSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_agencyId_status_createdAt_idx" ON "approval_requests"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "approval_requests_requestedById_createdAt_idx" ON "approval_requests"("requestedById", "createdAt");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

