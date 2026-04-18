-- Extend setter_activities with 5 prospecting columns needed to compute the
-- Cold DM System KPIs (MSR, PRR, CSR, ABR, CAR) and track daily IG account
-- warming activity (follows/likes/comments):
--   igMensajesVistos    — MS (double-blue check received). MSR denom=A num=MS.
--   igFollowsEnviados   — total follow-requests sent (CAR denom).
--   igFollowsAceptados  — follow-requests accepted (CAR num).
--   igLikesEnviados     — warming activity, sanity check vs IG daily limits.
--   igComentariosEnviados — same.
--
-- Kept nullable with default 0 so existing rows stay intact and setter flows
-- that don't capture these yet don't break. Idempotent for safe re-run.

ALTER TABLE "setter_activities" ADD COLUMN IF NOT EXISTS "igMensajesVistos" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "setter_activities" ADD COLUMN IF NOT EXISTS "igFollowsEnviados" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "setter_activities" ADD COLUMN IF NOT EXISTS "igFollowsAceptados" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "setter_activities" ADD COLUMN IF NOT EXISTS "igLikesEnviados" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "setter_activities" ADD COLUMN IF NOT EXISTS "igComentariosEnviados" integer DEFAULT 0;
