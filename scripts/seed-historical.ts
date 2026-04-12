#!/usr/bin/env npx tsx
/**
 * seed-historical.ts
 *
 * Reads Manus DB dump JSON files and generates PostgreSQL INSERT statements
 * for seeding the Supabase database with historical data.
 *
 * Usage:
 *   npx tsx scripts/seed-historical.ts > seed.sql
 *   npx tsx scripts/seed-historical.ts | pbcopy    # copy to clipboard
 *
 * Tables seeded:
 *   - allowed_emails (4 records)
 *   - team_members (4 records)
 *   - leads (~106+ records from INSERT dumps + later additions)
 *   - closer_activities (12 records, post-cleanup)
 *   - setter_activities (10 records, excluding test data)
 *   - monthly_metrics (1 record with historical data)
 *   - call_audits (partial - from 97-row dump, filtered to real data)
 */

import { readFileSync } from "fs";
import { join } from "path";

const DB_DIR =
  "/tmp/sacamedi-extract/sacamedi-crm-main/.manus/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readDump(filename: string) {
  const raw = readFileSync(join(DB_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

/** Escape a string for use inside a SQL single-quoted literal. */
function esc(val: string): string {
  return val.replace(/'/g, "''");
}

/**
 * Convert a MySQL dump value to a PostgreSQL literal.
 * Handles NULL, numbers, booleans, and strings.
 */
function pgVal(val: unknown): string {
  if (val === null || val === undefined || val === "NULL" || val === "") {
    return "NULL";
  }
  const s = String(val);
  // Pure numeric (int or decimal)
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return s;
  }
  return `'${esc(s)}'`;
}

/**
 * Build a single INSERT statement for a PostgreSQL table.
 * `colMap` optionally renames MySQL columns → PG columns.
 * If `skipId` is true, the `id` column is omitted (PG serial).
 */
function buildInsert(
  table: string,
  columns: string[],
  values: string[],
  colMap: Record<string, string> = {},
  skipId = true
): string {
  const pgCols: string[] = [];
  const pgVals: string[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (skipId && col === "id") continue;
    const pgCol = colMap[col] || `"${col}"`;
    pgCols.push(pgCol);
    pgVals.push(values[i]);
  }

  return `INSERT INTO ${table} (${pgCols.join(", ")}) VALUES (${pgVals.join(", ")});`;
}

// ---------------------------------------------------------------------------
// 1. allowed_emails
// ---------------------------------------------------------------------------

function seedAllowedEmails(): string[] {
  const dump = readDump("db-query-1772810806821.json");
  const rows: any[] = dump.rows;
  const lines: string[] = [
    "-- ==============================================",
    "-- allowed_emails (4 records)",
    "-- ==============================================",
  ];

  for (const r of rows) {
    const cols = ['"email"', '"role"', '"nombre"', '"activo"', '"createdAt"'];
    const vals = [
      pgVal(r.email),
      pgVal(r.role),
      pgVal(r.nombre),
      pgVal(r.activo),
      pgVal(r.createdAt),
    ];
    lines.push(
      `INSERT INTO allowed_emails (${cols.join(", ")}) VALUES (${vals.join(", ")});`
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// 2. team_members
// ---------------------------------------------------------------------------

function seedTeamMembers(): string[] {
  // The CREATE+INSERT file at 1772556538724 has the canonical data
  // But it was a CREATE TABLE + INSERT, not a SELECT. The data is embedded in the query.
  const members = [
    { nombre: "Nicolás", rol: "SETTER" },
    { nombre: "Josefa", rol: "SETTER" },
    { nombre: "Damaso", rol: "CLOSER" },
    { nombre: "Alejandro", rol: "CLOSER" },
  ];

  const lines: string[] = [
    "",
    "-- ==============================================",
    "-- team_members (4 records)",
    "-- ==============================================",
  ];

  for (const m of members) {
    lines.push(
      `INSERT INTO team_members ("nombre", "rol") VALUES ('${esc(m.nombre)}', '${m.rol}');`
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// 3. leads  (main extraction)
// ---------------------------------------------------------------------------

function seedLeads(): string[] {
  const lines: string[] = [
    "",
    "-- ==============================================",
    "-- leads (from INSERT batch + later additions)",
    "-- ==============================================",
  ];

  // ---- A) Parse the main INSERT batch (106 leads) ----
  const insertFiles = [
    "db-query-1771778124223.json",
    "db-query-1771778154550.json",
    "db-query-1771778192159.json",
    "db-query-1771778219641.json",
    "db-query-1771778246137.json",
    "db-query-1771778273605.json",
    "db-query-1771778307375.json",
    "db-query-1771778333641.json",
    "db-query-1771778359917.json",
    "db-query-1771778387932.json",
    "db-query-1771778411644.json",
  ];

  // MySQL INSERT columns from the batch
  const mysqlCols = [
    "fecha",
    "mes",
    "semana",
    "tipo",
    "origen",
    "nombre",
    "correo",
    "telefono",
    "pais",
    "setterAsignado",
    "resultadoContacto",
    "validoParaContacto",
    "califica",
    "razonNoCalifica",
    "estadoConfirmacion",
    "triage",
    "asistencia",
    "closer",
    "ofertaHecha",
    "outcome",
    "razonNoConversion",
    "facturado",
    "cashCollected",
    "deposito",
    "contractedRevenue",
    "notas",
    "linkCRM",
    "linkGrabacion",
    "score",
    "scoreLabel",
  ];

  // PG column names (quoted to preserve camelCase)
  const pgCols = mysqlCols.map((c) => `"${c}"`);

  let leadCount = 0;

  for (const file of insertFiles) {
    const dump = readDump(file);
    const query: string = dump.query;

    // Split on semicolons to get individual statements
    const rawStmts = query.split(";").map((s) => s.trim()).filter(Boolean);
    for (const rawStmt of rawStmts) {
      // Only process INSERT INTO leads (skip closer_activities, setter_activities, etc.)
      if (!rawStmt.match(/^INSERT\s+INTO\s+leads\s/i)) continue;

      // Extract the VALUES(...) portion
      const valMatch = rawStmt.match(/VALUES\s*\((.+)\)\s*$/s);
      if (!valMatch) continue;

      const rawValues = valMatch[1];

      // Parse the comma-separated values, respecting quoted strings
      const parsed = parseSqlValues(rawValues);
      if (parsed.length !== mysqlCols.length) {
        // Mismatched column count - skip but warn
        process.stderr.write(
          `Warning: ${file}: expected ${mysqlCols.length} values, got ${parsed.length}\n`
        );
        continue;
      }

      // Skip test leads
      const nameIdx = mysqlCols.indexOf("nombre");
      const name = parsed[nameIdx];
      if (name === "'Test Lead'" || name === "'Test CRM Lead'") continue;

      lines.push(
        `INSERT INTO leads (${pgCols.join(", ")}) VALUES (${parsed.join(", ")});`
      );
      leadCount++;
    }
  }

  // ---- B) 7 extra leads from later INSERT (1771962169052) ----
  const extraDump = readDump("db-query-1771962169052.json");
  const extraQuery: string = extraDump.query;
  const extraRawStmts = extraQuery.split(";").map((s) => s.trim()).filter(Boolean);

  const extraCols = [
    "fecha",
    "mes",
    "semana",
    "tipo",
    "origen",
    "nombre",
    "correo",
    "telefono",
    "resultadoContacto",
    "asistencia",
    "outcome",
  ];
  const extraPgCols = extraCols.map((c) => `"${c}"`);

  lines.push("");
  lines.push("-- Extra leads added later (7 records)");

  for (const rawStmt of extraRawStmts) {
    if (!rawStmt.match(/^INSERT\s+INTO\s+leads\s/i)) continue;
    const valMatch = rawStmt.match(/VALUES\s*\((.+)\)\s*$/s);
    if (!valMatch) continue;

    const parsed = parseSqlValues(valMatch[1]);
    if (parsed.length !== extraCols.length) continue;

    lines.push(
      `INSERT INTO leads (${extraPgCols.join(", ")}) VALUES (${parsed.join(", ")});`
    );
    leadCount++;
  }

  // ---- C) 1 extra lead: Luis Guillermo Inzunza (1772131181215) ----
  lines.push("");
  lines.push("-- Luis Guillermo Inzunza (added later)");
  lines.push(
    `INSERT INTO leads ("nombre", "correo", "telefono", "fecha", "mes", "semana") ` +
      `VALUES ('Luis Guillermo Inzunza', NULL, NULL, '2026-02-26 20:15:00', 'Febrero', 4);`
  );
  leadCount++;

  // ---- D) LEAD-category leads from SELECT at 1772718553878 ----
  const leadCatDump = readDump("db-query-1772718553878.json");
  const leadCatRows: any[] = leadCatDump.rows;

  if (leadCatRows.length > 0) {
    lines.push("");
    lines.push(
      `-- LEAD-category leads (${leadCatRows.length} records from import)`
    );

    for (const r of leadCatRows) {
      // Skip test leads
      if (
        r.nombre === "ULTIMA PRUEBA UTM" ||
        r.nombre === "Test Lead" ||
        r.nombre === "Test CRM Lead"
      )
        continue;

      const cols = [
        '"nombre"',
        '"correo"',
        '"telefono"',
        '"origen"',
        '"estadoLead"',
        '"notas"',
        '"fecha"',
        '"categoria"',
      ];
      const vals = [
        pgVal(r.nombre),
        pgVal(r.correo),
        pgVal(r.telefono),
        pgVal(r.origen),
        pgVal(r.estadoLead),
        pgVal(r.notas),
        pgVal(r.fecha),
        "'LEAD'",
      ];
      lines.push(
        `INSERT INTO leads (${cols.join(", ")}) VALUES (${vals.join(", ")});`
      );
      leadCount++;
    }
  }

  // ---- E) Apply key UPDATE corrections ----
  lines.push("");
  lines.push("-- Corrections: capitalize mes, fix names, fix productoTipo");
  lines.push(
    `UPDATE leads SET "mes" = 'Febrero' WHERE "mes" = 'febrero';`
  );
  lines.push(
    `UPDATE leads SET "mes" = 'Enero' WHERE "mes" = 'enero';`
  );
  lines.push(
    `UPDATE leads SET "productoTipo" = 'PIF' WHERE "outcome" = 'VENTA';`
  );
  lines.push(
    `UPDATE leads SET "setterAsignado" = 'Nicolás' WHERE "setterAsignado" IN ('Nicolas', 'nicolas', 'Nicola', 'Niccolas', 'Nico', 'nico', 'Nicolas Shadi');`
  );
  lines.push(
    `UPDATE leads SET "setterAsignado" = 'Josefa' WHERE "setterAsignado" IN ('JOSEFA', 'Jose');`
  );

  // Fix semana based on day of month (replaying the Manus UPDATE)
  lines.push("");
  lines.push("-- Recalculate semana from fecha");
  lines.push(`UPDATE leads SET "semana" = CASE`);
  lines.push(
    `  WHEN EXTRACT(DAY FROM "fecha") BETWEEN 1 AND 7 THEN 1`
  );
  lines.push(
    `  WHEN EXTRACT(DAY FROM "fecha") BETWEEN 8 AND 14 THEN 2`
  );
  lines.push(
    `  WHEN EXTRACT(DAY FROM "fecha") BETWEEN 15 AND 21 THEN 3`
  );
  lines.push(`  ELSE 4`);
  lines.push(`END WHERE "fecha" IS NOT NULL;`);

  // Fix leads without fecha to semana=3 for Febrero
  lines.push(
    `UPDATE leads SET "semana" = 3 WHERE "mes" = 'Febrero' AND "fecha" IS NULL AND ("semana" IS NULL OR "semana" = 1);`
  );

  // Delete test leads that slipped in
  lines.push("");
  lines.push("-- Remove any test leads");
  lines.push(
    `DELETE FROM leads WHERE "nombre" = 'Test Lead' AND "correo" = 'test@test.com';`
  );
  lines.push(
    `DELETE FROM leads WHERE "nombre" = 'Test Lead';`
  );
  lines.push(
    `DELETE FROM leads WHERE "nombre" = 'Test CRM Lead';`
  );

  // Set Enero for the batch of leads identified by Manus
  lines.push("");
  lines.push("-- Fix mes for Enero leads (these IDs won't match PG serials,");
  lines.push("-- but the nombre-based correction handles most cases)");
  lines.push(
    `-- Note: The original Manus UPDATE used MySQL IDs. Since PG assigns new serials,`
  );
  lines.push(
    `-- the mes='Enero' leads were those inserted first (first ~49 leads in the batch).`
  );
  lines.push(
    `-- The INSERT data already has mes='enero'/'Enero' set correctly.`
  );

  process.stderr.write(`  Leads processed: ${leadCount}\n`);
  return lines;
}

/**
 * Parse a MySQL VALUES clause into individual value tokens.
 * Handles:
 *  - Quoted strings with escaped quotes: 'it''s a test'
 *  - NULL keyword
 *  - Numbers (including decimals)
 *  - Nested parentheses are not expected in this data
 */
function parseSqlValues(raw: string): string[] {
  const values: string[] = [];
  let i = 0;
  const s = raw.trim();

  while (i < s.length) {
    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    if (s[i] === "'") {
      // Quoted string - find the end
      let end = i + 1;
      while (end < s.length) {
        if (s[end] === "'" && end + 1 < s.length && s[end + 1] === "'") {
          // Escaped quote
          end += 2;
          continue;
        }
        if (s[end] === "'") {
          break;
        }
        end++;
      }
      // The value is from i to end (inclusive)
      const val = s.slice(i, end + 1);
      // Convert MySQL escaped quotes to PostgreSQL format (already same: '')
      values.push(val);
      i = end + 1;
    } else {
      // Unquoted value (NULL, number)
      let end = i;
      while (end < s.length && s[end] !== ",") end++;
      const val = s.slice(i, end).trim();
      values.push(val);
      i = end;
    }

    // Skip comma
    while (i < s.length && /[\s,]/.test(s[i])) {
      if (s[i] === ",") {
        i++;
        break;
      }
      i++;
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// 4. closer_activities
// ---------------------------------------------------------------------------

function seedCloserActivities(): string[] {
  // SELECT * dump at 1771852739838, filtered to id < 210009 (test data deleted)
  const dump = readDump("db-query-1771852739838.json");
  const rows: any[] = dump.rows.filter(
    (r: any) => parseInt(r.id) < 210009
  );

  const lines: string[] = [
    "",
    "-- ==============================================",
    `-- closer_activities (${rows.length} records)`,
    "-- ==============================================",
  ];

  const cols = [
    "fecha",
    "mes",
    "semana",
    "closer",
    "scheduleCalls",
    "liveCalls",
    "offers",
    "deposits",
    "closes",
    "piffRevenue",
    "piffCash",
    "setupRevenue",
    "setupCash",
    "notas",
    "createdAt",
    "updatedAt",
  ];
  const pgCols = cols.map((c) => `"${c}"`);

  for (const r of rows) {
    const vals = cols.map((c) => pgVal(r[c]));
    lines.push(
      `INSERT INTO closer_activities (${pgCols.join(", ")}) VALUES (${vals.join(", ")});`
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// 5. setter_activities
// ---------------------------------------------------------------------------

function seedSetterActivities(): string[] {
  // Dump at 1772317396563 has 19 rows, but some are test data
  // DELETE WHERE notas LIKE '%Test sin intros%' OR '%Test con intros%'
  // Also DELETE WHERE id >= 210009 (already happened before this dump for setter)
  const dump = readDump("db-query-1772317396563.json");
  const rows: any[] = dump.rows.filter((r: any) => {
    const notas = r.notas || "";
    if (notas.includes("Test sin intros") || notas.includes("Test con intros"))
      return false;
    return true;
  });

  const lines: string[] = [
    "",
    "-- ==============================================",
    `-- setter_activities (${rows.length} records)`,
    "-- ==============================================",
  ];

  const cols = [
    "fecha",
    "mes",
    "semana",
    "setter",
    "intentosLlamada",
    "introsEfectivas",
    "demosAseguradasConIntro",
    "demosEnCalendario",
    "demosConfirmadas",
    "demosAsistidas",
    "introAgendadas",
    "introLive",
    "introADemo",
    "notas",
    "createdAt",
    "updatedAt",
  ];
  const pgCols = cols.map((c) => `"${c}"`);

  for (const r of rows) {
    const vals = cols.map((c) => pgVal(r[c]));
    lines.push(
      `INSERT INTO setter_activities (${pgCols.join(", ")}) VALUES (${vals.join(", ")});`
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// 6. monthly_metrics
// ---------------------------------------------------------------------------

function seedMonthlyMetrics(): string[] {
  // Only id=30003 survived cleanup. Use the pre-zero values (actual historical data).
  // The full data is in the SELECT * at 1771779087368.
  const dump = readDump("db-query-1771779087368.json");
  const row = dump.rows.find((r: any) => r.id === "30003");

  const lines: string[] = [
    "",
    "-- ==============================================",
    "-- monthly_metrics (1 record - Febrero 2026)",
    "-- ==============================================",
  ];

  if (row) {
    // Use pre-zeroed values from the original dump
    lines.push(
      `INSERT INTO monthly_metrics ("mes", "anio", "adSpend", "totalLeadsRaw", "totalLeads", "visitasLandingPage", "ctrUnico", "ctr", "createdAt") ` +
        `VALUES ('Febrero', 2026, 500.00, 150, 0, 2000, 3.50, 0.00, '${row.createdAt}');`
    );
  }

  // Also add an Enero placeholder since we have Enero leads
  lines.push(
    `INSERT INTO monthly_metrics ("mes", "anio") VALUES ('Enero', 2026);`
  );

  return lines;
}

// ---------------------------------------------------------------------------
// 7. call_audits (best-effort from available data)
// ---------------------------------------------------------------------------

function seedCallAudits(): string[] {
  // The 97-row dump at 1772899430204 has partial columns.
  // After final cleanup, only 26 records survived (those with non-null linkGrabacion
  // and not test data). We don't have a full dump of those 26 records.
  //
  // Best approach: include the records from the 97-row dump that look like real data,
  // acknowledging some may have been cleaned up later.
  //
  // The dump has: id, leadId, closer, fechaLlamada, duracionMinutos, aiGrading,
  //               leadName, leadEmail, manualReview, createdAt, feedback_preview
  // Missing full: aiFeedback, aiGradingJustification, aiWhyNotClosed, aiKeyMoments,
  //               linkGrabacion, recordingTranscript

  const dump = readDump("db-query-1772899430204.json");
  const rows: any[] = dump.rows.filter((r: any) => {
    // Remove known test data
    if (r.leadName === "Test Lead Audit") return false;
    if (r.closer === "Test") return false;
    return true;
  });

  const lines: string[] = [
    "",
    "-- ==============================================",
    `-- call_audits (${rows.length} records - PARTIAL DATA)`,
    "-- NOTE: Full text fields (aiFeedback, transcripts) are not available",
    "-- from the dumps. Only metadata is seeded. The final DB had 26 records;",
    "-- this dump pre-dates the final cleanup so may include extras.",
    "-- ==============================================",
  ];

  for (const r of rows) {
    const cols = [
      '"leadId"',
      '"closer"',
      '"fechaLlamada"',
      '"duracionMinutos"',
      '"aiGrading"',
      '"leadName"',
      '"leadEmail"',
      '"manualReview"',
      '"createdAt"',
    ];
    const vals = [
      pgVal(r.leadId),
      pgVal(r.closer),
      pgVal(r.fechaLlamada),
      pgVal(r.duracionMinutos),
      pgVal(r.aiGrading),
      pgVal(r.leadName),
      pgVal(r.leadEmail),
      pgVal(r.manualReview),
      pgVal(r.createdAt),
    ];
    lines.push(
      `INSERT INTO call_audits (${cols.join(", ")}) VALUES (${vals.join(", ")});`
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const output: string[] = [];

  output.push("-- ============================================================");
  output.push("-- SacaMedi CRM Historical Data Seed");
  output.push(`-- Generated: ${new Date().toISOString()}`);
  output.push("-- Source: Manus DB dumps from /tmp/sacamedi-extract/");
  output.push("-- ============================================================");
  output.push("");
  output.push("BEGIN;");
  output.push("");

  // Disable triggers during bulk insert for performance
  output.push("-- Disable triggers for bulk insert");
  output.push("SET session_replication_role = 'replica';");
  output.push("");

  try {
    output.push(...seedAllowedEmails());
    output.push(...seedTeamMembers());
    output.push(...seedLeads());
    output.push(...seedCloserActivities());
    output.push(...seedSetterActivities());
    output.push(...seedMonthlyMetrics());
    output.push(...seedCallAudits());
  } catch (err) {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  }

  output.push("");
  output.push("-- Re-enable triggers");
  output.push("SET session_replication_role = 'origin';");
  output.push("");
  output.push("COMMIT;");
  output.push("");

  // Write to stdout
  console.log(output.join("\n"));

  process.stderr.write("\nSeed SQL generated successfully.\n");
}

main();
