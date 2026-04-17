-- Add click-ID + landing capture columns to leads so we can recover
-- attribution when utm_* is stripped but Meta/Google still append their own
-- click identifier. Nullable and variable-size, so ALTER is O(1) in Postgres.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "fbclid" varchar(500);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gclid" varchar(500);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "landingUrl" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attributionReferrer" varchar(500);
