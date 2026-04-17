-- Add ad_creatives table for caching Meta Ads creative media (video, thumbnail, copy)
-- One row per adId. Populated by fetchAdCreatives() during metaAds.syncStructure.
-- Idempotent so it can be re-run safely in environments where production has drifted.

CREATE TABLE IF NOT EXISTS "ad_creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"adId" varchar(64) NOT NULL,
	"creativeId" varchar(64),
	"videoId" varchar(64),
	"videoSourceUrl" text,
	"videoPermalinkUrl" text,
	"thumbnailUrl" text,
	"imageUrl" text,
	"title" varchar(500),
	"body" text,
	"callToActionType" varchar(50),
	"destinationUrl" text,
	"instagramPermalinkUrl" text,
	"effectiveObjectStoryId" varchar(128),
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_creatives_adId_unique" UNIQUE("adId")
);
