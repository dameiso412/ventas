-- Add `landingSlug` to leads so we can aggregate conversion metrics by landing
-- page (Lovable). Lovable redirects to a GHL survey which fires our webhook;
-- the webhook either receives `landing_slug` as a custom field (preferred) or
-- derives it from `landing_url` via `deriveLandingSlug()` in server/_core/landings.ts.
--
-- Nullable because historical leads (pre-GHL-config) have no way to backfill
-- this value — the rows stay NULL and surface as "Sin landing" in the UI,
-- which acts as a visual alarm that GHL isn't sending the slug for some source.
-- Indexed because the landing performance table groups BY this column and we
-- expect dashboards to filter on it daily.
-- Idempotent (IF NOT EXISTS) so re-running the migration is safe.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "landingSlug" varchar(50);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_leads_landing_slug" ON "leads" ("landingSlug");
