-- Extend ig_funnel_stage enum with DM_VISTO between DM_ENVIADO and EN_CONVERSACION.
-- This maps the "Message Seen" (MS) state from the Cold DM System methodology
-- — the ✓✓ double-blue indicator between send and reply. Needed so MSR (Message
-- Seen Rate) can be computed per lead, not just aggregated setter activity.
--
-- Postgres treats ALTER TYPE ADD VALUE as O(1) and zero-downtime since Postgres
-- 12 (no table rewrite). Existing rows remain valid — no migration of data needed.
-- Idempotent via IF NOT EXISTS.

ALTER TYPE "public"."ig_funnel_stage" ADD VALUE IF NOT EXISTS 'DM_VISTO' BEFORE 'EN_CONVERSACION';
