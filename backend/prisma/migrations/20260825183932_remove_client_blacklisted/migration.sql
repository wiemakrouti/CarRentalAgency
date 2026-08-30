-- Drop the "Statut" (blacklisted) flag on clients — decided unused: it had
-- no enforcement anywhere (rentals were never blocked for a blacklisted
-- client, informational only) and no client of this agency currently relies
-- on filtering/reporting by it. The free-text `notes` field on Client covers
-- the same "flag a problem client" need without a dedicated column.
ALTER TABLE "clients" DROP COLUMN "blacklisted";
