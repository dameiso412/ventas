-- Add Meta-Ads-resolved identifiers to leads so we can join the conversion
-- funnel directly against ad_ads / ad_adsets / ad_campaigns without fuzzy
-- name matching. These are populated at webhook ingestion when the ad's UTM
-- tags use Meta's {{ad.id}} / {{adset.id}} / {{campaign.id}} macros.
--
-- Nullable + indexed so existing rows stay intact and new queries that filter
-- by these columns stay fast (typical pattern: WHERE meta_ad_id = ? for a
-- single-creative breakdown). ALTER is O(1) in Postgres for nullable cols.
-- Idempotent for safe re-run.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "metaAdId" varchar(50);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "metaAdsetId" varchar(50);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "metaCampaignId" varchar(50);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_leads_meta_ad_id" ON "leads" ("metaAdId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_meta_adset_id" ON "leads" ("metaAdsetId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_meta_campaign_id" ON "leads" ("metaCampaignId");
