-- The director's activity journal and team alerts.

-- Scope audit rows to their agency so the journal can filter on it.
ALTER TABLE "audit_logs" ADD COLUMN "agencyId" TEXT;
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "audit_logs_agencyId_createdAt_idx" ON "audit_logs"("agencyId", "createdAt");

-- Backfill: rows with an author take the author's agency; the automatic
-- reservation cancellations (no author) take their rental's agency.
UPDATE "audit_logs" a SET "agencyId" = u."agencyId" FROM "users" u WHERE a."userId" = u."id";
UPDATE "audit_logs" a SET "agencyId" = r."agencyId"
  FROM "rentals" r
  WHERE a."agencyId" IS NULL AND a."entityType" = 'Rental' AND a."entityId" = r."id";

-- When the director last looked at the team alerts.
ALTER TABLE "users" ADD COLUMN "activityAlertsSeenAt" TIMESTAMP(3);

-- Threshold for the "large expense" alert.
ALTER TABLE "settings" ADD COLUMN "largeExpenseThreshold" DECIMAL(10,3) NOT NULL DEFAULT 500;
