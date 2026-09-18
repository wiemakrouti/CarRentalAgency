-- Multi-tenant pivot: introduces "agencies" as the tenant boundary and scopes
-- every business table to one via agencyId. Existing data is backfilled into
-- a single default agency so this deployment keeps working unchanged after
-- the migration; every new agency created from here on (via POST
-- /auth/register) gets its own isolated row set.

-- 1. Tenant table.
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- 2. Backfill agency for all pre-existing data (a no-op INSERT set if this
-- database was already empty — e.g. a fresh demo DB — since every UPDATE
-- below simply touches zero rows).
INSERT INTO "agencies" ("id", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. users
ALTER TABLE "users" ADD COLUMN "agencyId" TEXT;
UPDATE "users" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "users" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_agencyId_idx" ON "users"("agencyId");

-- 4. cars — drop the global unique indexes, replace with per-agency ones.
ALTER TABLE "cars" ADD COLUMN "agencyId" TEXT;
UPDATE "cars" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "cars" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "cars" ADD CONSTRAINT "cars_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "cars_licensePlate_key";
DROP INDEX "cars_vin_key";
DROP INDEX "cars_status_idx";
CREATE UNIQUE INDEX "cars_agencyId_licensePlate_key" ON "cars"("agencyId", "licensePlate");
CREATE UNIQUE INDEX "cars_agencyId_vin_key" ON "cars"("agencyId", "vin");
CREATE INDEX "cars_agencyId_status_idx" ON "cars"("agencyId", "status");

-- 5. clients
ALTER TABLE "clients" ADD COLUMN "agencyId" TEXT;
UPDATE "clients" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "clients" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "clients" ADD CONSTRAINT "clients_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "clients_email_key";
DROP INDEX "clients_phone_idx";
CREATE UNIQUE INDEX "clients_agencyId_email_key" ON "clients"("agencyId", "email");
CREATE INDEX "clients_agencyId_phone_idx" ON "clients"("agencyId", "phone");

-- 6. rentals
ALTER TABLE "rentals" ADD COLUMN "agencyId" TEXT;
UPDATE "rentals" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "rentals" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "rentals_rentalNumber_key";
DROP INDEX "rentals_status_idx";
CREATE UNIQUE INDEX "rentals_agencyId_rentalNumber_key" ON "rentals"("agencyId", "rentalNumber");
CREATE INDEX "rentals_agencyId_status_idx" ON "rentals"("agencyId", "status");

-- 7. payments (denormalized agencyId, backfilled from its rental)
ALTER TABLE "payments" ADD COLUMN "agencyId" TEXT;
UPDATE "payments" p SET "agencyId" = r."agencyId" FROM "rentals" r WHERE r."id" = p."rentalId";
ALTER TABLE "payments" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "payments" ADD CONSTRAINT "payments_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "payments_type_idx";
CREATE INDEX "payments_agencyId_type_idx" ON "payments"("agencyId", "type");

-- 8. expenses
ALTER TABLE "expenses" ADD COLUMN "agencyId" TEXT;
UPDATE "expenses" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "expenses" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "expenses_agencyId_idx" ON "expenses"("agencyId");

-- 9. settings — one row per agency now instead of a single global singleton.
ALTER TABLE "settings" ADD COLUMN "agencyId" TEXT;
UPDATE "settings" SET "agencyId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "settings" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "settings" ADD CONSTRAINT "settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "settings_agencyId_key" ON "settings"("agencyId");
