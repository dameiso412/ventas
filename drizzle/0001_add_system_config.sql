-- Add system_config table for platform-wide settings (ticket default, future commission rates)
-- Note: this migration is idempotent because production may have diverged from 0000 snapshot.

CREATE TABLE IF NOT EXISTS "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"description" text,
	"updatedBy" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
INSERT INTO "system_config" ("key", "value", "description") VALUES
	('defaultTicketValue', '3150', 'Valor default del ticket por lead (USD) cuando contractedRevenue está vacío — usado en Dashboard > Pipeline')
ON CONFLICT ("key") DO NOTHING;
