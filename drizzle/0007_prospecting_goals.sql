-- Global configuration table for the IG prospecting system.
-- Stores daily volume targets (DMs/follows/likes/comments per day) and KPI
-- minimum thresholds (MSR, PRR, CSR, ABR, CAR) from the Cold DM System doc.
--
-- Admin can edit values via /prospeccion/metas; the Tablero reads them to
-- compute the traffic-light status of each KPI. Seeded with the doc's default
-- values on creation — ON CONFLICT DO NOTHING keeps existing overrides intact
-- if the migration re-runs.
--
-- `unit`: "count" for absolute targets, "percent" for KPI thresholds (stored
-- as whole numbers: 40 means 40%, not 0.4).
-- `category`: either "daily_volume" or "kpi_threshold" — drives the UI grouping.

CREATE TABLE IF NOT EXISTS "prospecting_goals" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(50) NOT NULL,
  "label" varchar(100) NOT NULL,
  "value" numeric(10,2) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "category" varchar(30) NOT NULL,
  "description" text,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "updatedBy" varchar(255),
  CONSTRAINT "prospecting_goals_key_unique" UNIQUE("key")
);--> statement-breakpoint

-- Seed: 4 daily-volume targets + 5 KPI thresholds, straight from the doc.
INSERT INTO "prospecting_goals" ("key", "label", "value", "unit", "category", "description") VALUES
  ('dms_daily',      'DMs Trojan Horse por día',    '30', 'count',   'daily_volume',  'Mínimo diario de DMs iniciadores (Trojan Horse) por setter. Límite IG: 30/día para cuentas cálidas.'),
  ('follows_daily',  'Follows por día',             '50', 'count',   'daily_volume',  'Mínimo diario de follow-requests a prospectos cualificados. Límite IG: 50/día.'),
  ('likes_daily',    'Likes por día',               '50', 'count',   'daily_volume',  'Mínimo diario de likes a posts de prospectos (warming). Límite IG: 50/día.'),
  ('comments_daily', 'Comentarios por día',         '20', 'count',   'daily_volume',  'Mínimo diario de comentarios en posts de prospectos (warming). Límite IG: 20/día.'),
  ('msr_min',        'MSR mínimo (Message Seen)',   '40', 'percent', 'kpi_threshold', 'Mínimo aceptable de Message Seen Rate — ¿qué % de tus DMs son vistos? Menor = problema de niche/lead quality/account health.'),
  ('prr_min',        'PRR mínimo (Positive Reply)', '6',  'percent', 'kpi_threshold', 'Mínimo aceptable de Positive Reply Rate — ¿qué % de vistos responden positivo? Menor = problema de Trojan Horse video o script.'),
  ('csr_min',        'CSR mínimo (Calendly Sent)',  '3',  'percent', 'kpi_threshold', 'Mínimo aceptable de Calendly Sent Rate — ¿qué % de A llegan a enviar Calendly? Menor = problema de VSL.'),
  ('abr_min',        'ABR mínimo (Appointment Booked)', '2', 'percent', 'kpi_threshold', 'Mínimo aceptable de Appointment Booked Rate — ¿qué % de A agendan? Menor = problema de follow-up / Calendly disponibilidad.'),
  ('car_min',        'CAR mínimo (Connection Accept)',  '50', 'percent', 'kpi_threshold', 'Mínimo aceptable de Connection Accept Rate — ¿qué % de follows son aceptados? Menor = problema de niche / calidad de leads / salud de cuenta.')
ON CONFLICT ("key") DO NOTHING;
