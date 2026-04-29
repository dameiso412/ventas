-- Round-Robin de asignaciones automáticas (hoy aplica solo a agendas nuevas).
--
-- Tres tablas:
--   round_robin_rules        — una regla por eventType. Solo hay una regla
--                              activa por eventType a la vez (UNIQUE constraint).
--   round_robin_targets      — los setters y sus % por regla. La suma de %
--                              activos por rule debe ser 100 (validado backend,
--                              no en DB para permitir transiciones intermedias
--                              durante un edit).
--   round_robin_assignments  — log inmutable. El algoritmo Weighted Round-Robin
--                              determinístico cuenta filas aquí para calcular
--                              expected vs actual y elegir el siguiente setter.
--
-- Idempotente (IF NOT EXISTS) — re-correr la migración no rompe nada.

CREATE TABLE IF NOT EXISTS "round_robin_rules" (
  "id" serial PRIMARY KEY,
  "eventType" varchar(50) UNIQUE NOT NULL,
  "description" varchar(255),
  "activo" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT NOW() NOT NULL,
  "updatedAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "round_robin_targets" (
  "id" serial PRIMARY KEY,
  "ruleId" integer NOT NULL REFERENCES "round_robin_rules"("id") ON DELETE CASCADE,
  "setterName" varchar(100) NOT NULL,
  "percentage" integer NOT NULL,
  "activo" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT NOW() NOT NULL,
  "updatedAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_rr_targets_rule" ON "round_robin_targets" ("ruleId");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "round_robin_assignments" (
  "id" serial PRIMARY KEY,
  "ruleId" integer NOT NULL REFERENCES "round_robin_rules"("id"),
  "leadId" integer NOT NULL REFERENCES "leads"("id"),
  "setterName" varchar(100) NOT NULL,
  "createdAt" timestamp DEFAULT NOW() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_rr_assignments_rule" ON "round_robin_assignments" ("ruleId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rr_assignments_setter" ON "round_robin_assignments" ("setterName");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rr_assignments_created" ON "round_robin_assignments" ("createdAt");--> statement-breakpoint

-- Seed: rule "AGENDA_NUEVA" inactiva por defecto. El admin la activa
-- desde /admin/round-robin cuando configura los targets y % iniciales.
-- ON CONFLICT DO NOTHING porque eventType es UNIQUE — re-correr la migración
-- no duplica.
INSERT INTO "round_robin_rules" ("eventType", "description", "activo")
VALUES ('AGENDA_NUEVA', 'Round-robin de agendas nuevas (DEMO/INTRO)', 0)
ON CONFLICT ("eventType") DO NOTHING;
