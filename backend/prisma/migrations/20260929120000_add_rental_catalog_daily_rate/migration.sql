-- AlterTable: add nullable first so existing rentals can be backfilled —
-- every rental created before negotiated prices existed was charged the
-- catalogue rate, so its catalogue rate is its own dailyRate.
ALTER TABLE "rentals" ADD COLUMN "catalogDailyRate" DECIMAL(10,3);

UPDATE "rentals" SET "catalogDailyRate" = "dailyRate";

ALTER TABLE "rentals" ALTER COLUMN "catalogDailyRate" SET NOT NULL;
