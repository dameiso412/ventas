-- Slack interactivity: 2 tablas para soportar botones que actúan sobre el CRM.
--
-- slack_alert_snoozes:
--   Cuando un setter clickea "🔇 Snooze 1h" en un alert, escribimos una fila
--   acá. El cron-kpi-monitor consulta antes de enviar — si el snooze está
--   activo (expiresAt > NOW()), suprime el alert.
--   `key` espeja la key usada en el dedup map de cron-kpi-monitor (ej.
--   "speed-to-lead", "unassigned", "stale-seguimiento", etc.).
--
-- slack_actions_log:
--   Audit trail inmutable de cada button click recibido en
--   /api/slack/interactive. Útil para debug ("¿por qué no se marcó?") y
--   para reportes de uso (cuántas veces se actuó desde Slack vs UI).
--
-- Idempotente (IF NOT EXISTS) — re-correr la migración no rompe nada.

CREATE TABLE IF NOT EXISTS "slack_alert_snoozes" (
  "id" serial PRIMARY KEY,
  "alertKey" varchar(80) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "snoozedBySlackUserId" varchar(50),
  "snoozedByEmail" varchar(320),
  "snoozedByName" varchar(255),
  "createdAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_slack_snoozes_key_expires"
  ON "slack_alert_snoozes" ("alertKey", "expiresAt");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "slack_actions_log" (
  "id" serial PRIMARY KEY,
  "actionId" varchar(120) NOT NULL,
  "targetType" varchar(40),
  "targetId" integer,
  "slackUserId" varchar(50) NOT NULL,
  "slackUserName" varchar(255),
  "crmUserEmail" varchar(320),
  "crmUserName" varchar(255),
  "result" varchar(40) NOT NULL DEFAULT 'success',
  "errorMessage" text,
  "rawPayload" jsonb,
  "processingTimeMs" integer,
  "createdAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_slack_actions_action_id"
  ON "slack_actions_log" ("actionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_slack_actions_target"
  ON "slack_actions_log" ("targetType", "targetId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_slack_actions_created"
  ON "slack_actions_log" ("createdAt");
