-- Unique index on (fecha, setter) in setter_activities to enable upsert-merge
-- semantics from the Rutina AM/PM page (Fase 3). Without this, the page can't
-- use ON CONFLICT to update the existing row — it would insert a duplicate
-- and AM/PM inputs would compete for persistence instead of merging.
--
-- Rationale: fecha stores dates (not full timestamps) for setter reporting —
-- one row per setter per day. We normalize at the application layer to the
-- start of day (00:00) before upserting, so the (fecha, setter) pair is a
-- deterministic identifier.
--
-- NOTE: this migration will FAIL if duplicates already exist for (fecha, setter).
-- The Fase 1 runbook instructs to run:
--   SELECT fecha, setter, COUNT(*) FROM setter_activities
--   GROUP BY 1,2 HAVING COUNT(*) > 1;
-- first, and manually resolve duplicates (merge rows or delete extras) before
-- applying this migration. Idempotent via IF NOT EXISTS.

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_setter_activities_fecha_setter"
  ON "setter_activities" ("fecha", "setter");
