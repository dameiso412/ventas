-- Prospecting doctor reviews — audit trail of troubleshooting sessions.
-- Each row = one time a setter/admin opened the Doctor for a KPI that fell
-- below threshold, ticked the relevant cause boxes (jsonb), and optionally
-- left notes. Used by Fase 5 Doctor page to persist and replay history.
--
-- Indexes optimize three access patterns:
--   - "give me all reviews for setter X"          → setterName
--   - "give me all MSR-related reviews"           → metric
--   - "what did we do in the last 30 days?"       → reviewedAt DESC

CREATE TABLE IF NOT EXISTS "prospecting_doctor_reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "setterName" varchar(255) NOT NULL,
  "metric" varchar(10) NOT NULL,
  "valueAtReview" numeric(6,2),
  "thresholdAtReview" numeric(6,2),
  "causesChecked" jsonb NOT NULL,
  "notes" text,
  "reviewedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_doctor_reviews_setter"      ON "prospecting_doctor_reviews" ("setterName");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_reviews_metric"      ON "prospecting_doctor_reviews" ("metric");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_reviews_reviewed_at" ON "prospecting_doctor_reviews" ("reviewedAt");
