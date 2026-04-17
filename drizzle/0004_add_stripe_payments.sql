-- Stripe payment ingestion:
-- `stripe_payments` is the local cache of every charge Stripe tells us about
-- (via historical sync or the webhook), linked to a lead when we can match
-- by metadata.leadId or customer email. Unique index on stripeChargeId is the
-- upsert anchor; receiving the same charge twice updates in place.
--
-- `stripe_webhook_logs` gives us idempotency + a forensic trail for replays.
-- The unique eventId lets us noop duplicate deliveries quickly.
--
-- Enum lives separately so Drizzle picks it up without needing a regeneration.

DO $$ BEGIN
  CREATE TYPE "stripe_payment_status" AS ENUM (
    'succeeded',
    'pending',
    'failed',
    'refunded',
    'partially_refunded',
    'disputed',
    'canceled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "stripe_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "stripeChargeId" varchar(64) UNIQUE,
  "stripePaymentIntentId" varchar(64),
  "stripeCustomerId" varchar(64),
  "stripeInvoiceId" varchar(64),
  "stripeCheckoutSessionId" varchar(128),
  "amount" numeric(12,2) NOT NULL,
  "amountRefunded" numeric(12,2) DEFAULT '0',
  "currency" varchar(10) NOT NULL,
  "status" "stripe_payment_status" NOT NULL,
  "paymentMethodBrand" varchar(50),
  "last4" varchar(4),
  "receiptUrl" text,
  "customerEmail" varchar(320),
  "customerName" varchar(255),
  "description" text,
  "leadId" integer,
  "matchMethod" varchar(30),
  "matchedAt" timestamp,
  "matchedBy" varchar(255),
  "rawMetadata" jsonb,
  "stripeCreatedAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_stripe_payments_lead" ON "stripe_payments" ("leadId");
CREATE INDEX IF NOT EXISTS "idx_stripe_payments_status" ON "stripe_payments" ("status");
CREATE INDEX IF NOT EXISTS "idx_stripe_payments_created" ON "stripe_payments" ("stripeCreatedAt");
CREATE INDEX IF NOT EXISTS "idx_stripe_payments_email" ON "stripe_payments" ("customerEmail");

CREATE TABLE IF NOT EXISTS "stripe_webhook_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "eventId" varchar(128) NOT NULL UNIQUE,
  "eventType" varchar(100) NOT NULL,
  "status" varchar(30) NOT NULL,
  "errorMessage" text,
  "rawPayload" text,
  "processingTimeMs" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_stripe_webhook_logs_type" ON "stripe_webhook_logs" ("eventType");
CREATE INDEX IF NOT EXISTS "idx_stripe_webhook_logs_created" ON "stripe_webhook_logs" ("createdAt");
