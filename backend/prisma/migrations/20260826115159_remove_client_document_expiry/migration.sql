-- Drop the expiry date on client documents — decided unused: unlike the
-- driving license expiry (which powers a real alert/filter/badge system),
-- nothing reads this field. It was only ever stored and displayed as plain
-- text, never surfaced as an alert.
ALTER TABLE "client_documents" DROP COLUMN "expiryDate";
