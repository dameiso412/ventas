#!/usr/bin/env npx tsx
/**
 * migrate-delta.ts — Safe delta migration from Manus CRM export
 *
 * Unlike migrate-manus-data.ts, this script:
 *   - Does NOT truncate any tables
 *   - Uses ON CONFLICT (id) DO UPDATE to upsert records
 *   - Preserves any data already in the CRM
 *   - Resets sequences to max(id)+1 to avoid future conflicts
 *
 * Usage:
 *   npx tsx scripts/migrate-delta.ts
 *   npx tsx scripts/migrate-delta.ts --dry-run   # preview without inserting
 */
import postgres from "postgres";
import { readFileSync } from "fs";

// ── Config ──────────────────────────────────────────────────────────────────────
const EXPORT_PATH = "/Users/dameiso/Downloads/sacamedi_crm_export.json";
const BATCH_SIZE = 50;
const DRY_RUN = process.argv.includes("--dry-run");

const sql = postgres(
  "postgresql://postgres.nlelxzinwhrffwjsxgyl:Hr%2A%21%26SK%2AK2LUtk%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres",
  { prepare: false }
);

// ── Load export ─────────────────────────────────────────────────────────────────
console.log("Loading export JSON...");
const raw = readFileSync(EXPORT_PATH, "utf-8");
const data: Record<string, any[]> = JSON.parse(raw);

// ── Enum valid values ───────────────────────────────────────────────────────────
const ENUMS: Record<string, Set<string>> = {
  tipo: new Set(["DEMO", "INTRO"]),
  categoria: new Set(["AGENDA", "LEAD"]),
  origen: new Set(["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"]),
  estadoLead: new Set(["NUEVO", "CONTACTADO", "CALIFICADO", "DESCARTADO", "CONVERTIDO_AGENDA"]),
  resultadoContacto: new Set(["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "WHATSAPP LIMPIADO", "PENDIENTE"]),
  validoParaContacto: new Set(["SÍ", "NO"]),
  califica: new Set(["SÍ", "NO", "POR EVALUAR"]),
  estadoConfirmacion: new Set(["CONFIRMADA", "NO CONFIRMADA", "CANCELADA", "REAGENDADA", "PENDIENTE"]),
  asistencia: new Set(["ASISTIÓ", "NO SHOW", "PENDIENTE"]),
  ofertaHecha: new Set(["SÍ", "NO", "N/A"]),
  outcome: new Set(["VENTA", "PERDIDA", "SEGUIMIENTO", "PENDIENTE"]),
  productoTipo: new Set(["PIF", "SETUP_MONTHLY"]),
  calificacionFinanciera: new Set(["SÍ", "NO", "PARCIAL", "PENDIENTE"]),
  scoreLabel: new Set(["HOT", "WARM", "TIBIO", "FRÍO"]),
  manualReview: new Set(["PENDIENTE", "REVISADA", "ACCIONADA"]),
  followUpTipo: new Set(["HOT", "WARM"]),
  prioridad: new Set(["RED_HOT", "HOT", "WARM", "COLD"]),
  followUpEstado: new Set(["ACTIVO", "CERRADO_GANADO", "CERRADO_PERDIDO", "MOVIDO_A_WARM", "ARCHIVADO"]),
  productoInteres: new Set(["PIF", "SETUP_MONTHLY", "POR_DEFINIR"]),
  followUpAccion: new Set(["LLAMADA", "WHATSAPP", "EMAIL", "DM_INSTAGRAM", "DM_FACEBOOK", "NOTA", "CAMBIO_TIPO", "CAMBIO_ESTADO", "REAGENDADO"]),
  webhookStatus: new Set(["RECEIVED", "PROCESSED", "DUPLICATE", "UPDATED", "ERROR"]),
  canal: new Set(["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"]),
  contactResultado: new Set(["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "MENSAJE ENVIADO", "WHATSAPP LIMPIADO"]),
  notificationType: new Set(["mention", "comment", "system"]),
  teamMemberRol: new Set(["SETTER", "CLOSER", "SETTER_CLOSER"]),
  allowedEmailRole: new Set(["admin", "setter", "closer"]),
  creadoDesde: new Set(["MANUAL", "CITAS", "SCORING"]),
};

function validEnum(enumName: string, value: any): string | null {
  if (value == null) return null;
  const set = ENUMS[enumName];
  if (!set) return value;
  return set.has(value) ? value : null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function ts(v: any): string | null {
  if (v == null) return null;
  return v;
}

function dec(v: any): string | null {
  if (v == null) return null;
  return String(v);
}

function int(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: any): string | null {
  if (v == null) return null;
  return String(v);
}

function jsonVal(v: any): string | null {
  if (v == null) return null;
  return JSON.stringify(v);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Table definitions ───────────────────────────────────────────────────────────
type TableDef = {
  name: string;
  exportKey: string;
  columns: string[];
  /** Columns to update on conflict (all except "id") */
  updateColumns?: string[];
  mapRow: (r: any) => any[];
};

const tables: TableDef[] = [
  {
    name: "team_members",
    exportKey: "team_members",
    columns: ["id", "nombre", "rol", "activo", "correo", "telefono", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id), str(r.nombre), validEnum("teamMemberRol", r.rol),
      int(r.activo) ?? 1, str(r.correo), str(r.telefono), ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "allowed_emails",
    exportKey: "allowed_emails",
    columns: ["id", "email", "role", "nombre", "activo", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id), str(r.email), validEnum("allowedEmailRole", r.role),
      str(r.nombre), int(r.activo) ?? 1, ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "leads",
    exportKey: "leads",
    columns: [
      "id", "fecha", "mes", "semana", "tipo", "categoria", "origen",
      "nombre", "correo", "telefono", "pais", "instagram", "rubro",
      "estadoLead", "setterAsignado", "fechaPrimerContacto",
      "tiempoRespuestaHoras", "intentosContacto", "resultadoContacto",
      "validoParaContacto", "califica", "razonNoCalifica",
      "estadoConfirmacion", "triage", "asistencia", "closer",
      "ofertaHecha", "outcome", "razonNoConversion", "productoTipo",
      "facturado", "cashCollected", "deposito", "contractedRevenue",
      "setupFee", "recurrenciaMensual", "fechaProximoCobro",
      "notas", "linkCRM", "linkGrabacion", "calificacionFinanciera",
      "respuestaFinanciera", "fechaIntro",
      "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm",
      "score", "scoreLabel", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), ts(r.fecha), str(r.mes), int(r.semana),
      validEnum("tipo", r.tipo) ?? "DEMO", validEnum("categoria", r.categoria) ?? "AGENDA",
      validEnum("origen", r.origen) ?? "ADS",
      str(r.nombre), str(r.correo), str(r.telefono), str(r.pais), str(r.instagram), str(r.rubro),
      validEnum("estadoLead", r.estadoLead), str(r.setterAsignado), ts(r.fechaPrimerContacto),
      dec(r.tiempoRespuestaHoras), int(r.intentosContacto) ?? 0,
      validEnum("resultadoContacto", r.resultadoContacto),
      validEnum("validoParaContacto", r.validoParaContacto),
      validEnum("califica", r.califica), str(r.razonNoCalifica),
      validEnum("estadoConfirmacion", r.estadoConfirmacion), str(r.triage),
      validEnum("asistencia", r.asistencia), str(r.closer),
      validEnum("ofertaHecha", r.ofertaHecha), validEnum("outcome", r.outcome),
      str(r.razonNoConversion), validEnum("productoTipo", r.productoTipo),
      dec(r.facturado), dec(r.cashCollected), dec(r.deposito), dec(r.contractedRevenue),
      dec(r.setupFee), dec(r.recurrenciaMensual), ts(r.fechaProximoCobro),
      str(r.notas), str(r.linkCRM), str(r.linkGrabacion),
      validEnum("calificacionFinanciera", r.calificacionFinanciera),
      str(r.respuestaFinanciera), ts(r.fechaIntro),
      str(r.utmSource), str(r.utmMedium), str(r.utmCampaign), str(r.utmContent), str(r.utmTerm),
      int(r.score), validEnum("scoreLabel", r.scoreLabel),
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "lead_scoring",
    exportKey: "lead_scoring",
    columns: [
      "id", "leadId", "correo", "instagram",
      "p1Frustracion", "p2MarketingPrevio", "p3Urgencia",
      "p4TiempoOperando", "p5Tratamientos", "p6Impedimento",
      "scoreP1", "scoreP2", "scoreP3", "scoreP4", "scoreP6",
      "scoreTotal", "scoreFinal", "scoreLabel", "createdAt",
    ],
    mapRow: (r) => [
      int(r.id), int(r.leadId), str(r.correo), str(r.instagram),
      str(r.p1Frustracion), str(r.p2MarketingPrevio), str(r.p3Urgencia),
      str(r.p4TiempoOperando), str(r.p5Tratamientos), str(r.p6Impedimento),
      int(r.scoreP1), int(r.scoreP2), int(r.scoreP3), int(r.scoreP4), int(r.scoreP6),
      int(r.scoreTotal), int(r.scoreFinal), validEnum("scoreLabel", r.scoreLabel),
      ts(r.createdAt),
    ],
  },
  {
    name: "follow_ups",
    exportKey: "follow_ups",
    columns: [
      "id", "leadId", "nombre", "correo", "telefono", "instagram", "facebook",
      "tipo", "prioridad", "estado", "ultimaObjecion", "montoEstimado",
      "productoInteres", "ultimoFollowUp", "proximoFollowUp", "totalFollowUps",
      "closerAsignado", "notas", "linkCRM", "creadoDesde", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), int(r.leadId), str(r.nombre), str(r.correo), str(r.telefono),
      str(r.instagram), str(r.facebook),
      validEnum("followUpTipo", r.tipo) ?? "HOT", validEnum("prioridad", r.prioridad) ?? "HOT",
      validEnum("followUpEstado", r.estado) ?? "ACTIVO",
      str(r.ultimaObjecion), dec(r.montoEstimado),
      validEnum("productoInteres", r.productoInteres),
      ts(r.ultimoFollowUp), ts(r.proximoFollowUp), int(r.totalFollowUps) ?? 0,
      str(r.closerAsignado), str(r.notas), str(r.linkCRM),
      validEnum("creadoDesde", r.creadoDesde) ?? "MANUAL",
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "follow_up_logs",
    exportKey: "follow_up_logs",
    columns: ["id", "followUpId", "accion", "detalle", "realizadoPor", "createdAt"],
    mapRow: (r) => [
      int(r.id), int(r.followUpId),
      validEnum("followUpAccion", r.accion) ?? "NOTA",
      str(r.detalle), str(r.realizadoPor), ts(r.createdAt),
    ],
  },
  {
    name: "contact_attempts",
    exportKey: "contact_attempts",
    columns: ["id", "leadId", "timestamp", "canal", "resultado", "notas", "realizadoPor", "createdAt"],
    mapRow: (r) => [
      int(r.id), int(r.leadId), ts(r.timestamp),
      validEnum("canal", r.canal) ?? "LLAMADA",
      validEnum("contactResultado", r.resultado),
      str(r.notas), str(r.realizadoPor), ts(r.createdAt),
    ],
  },
  {
    name: "lead_comments",
    exportKey: "lead_comments",
    columns: ["id", "leadId", "userId", "autor", "autorRole", "texto", "mentions", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id), int(r.leadId), int(r.userId),
      str(r.autor) ?? "unknown", str(r.autorRole),
      str(r.texto) ?? "", str(r.mentions),
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "call_audits",
    exportKey: "call_audits",
    columns: [
      "id", "leadId", "closer", "fechaLlamada", "linkGrabacion",
      "recordingTranscript", "leadName", "leadEmail",
      "duracionMinutos", "aiFeedback", "aiGrading",
      "aiGradingJustification", "aiWhyNotClosed", "aiKeyMoments",
      "manualReview", "manualNotes", "actionItems",
      "reviewedBy", "reviewedAt", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), int(r.leadId), str(r.closer), ts(r.fechaLlamada), str(r.linkGrabacion),
      str(r.recordingTranscript), str(r.leadName), str(r.leadEmail),
      int(r.duracionMinutos), str(r.aiFeedback), int(r.aiGrading),
      str(r.aiGradingJustification), str(r.aiWhyNotClosed), str(r.aiKeyMoments),
      validEnum("manualReview", r.manualReview) ?? "PENDIENTE",
      str(r.manualNotes), jsonVal(r.actionItems),
      str(r.reviewedBy), ts(r.reviewedAt), ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "setter_activities",
    exportKey: "setter_activities",
    columns: [
      "id", "fecha", "mes", "semana", "setter",
      "intentosLlamada", "introsEfectivas", "demosAseguradasConIntro",
      "demosEnCalendario", "demosConfirmadas", "demosAsistidas",
      "cierresAtribuidos", "revenueAtribuido", "cashAtribuido", "notas",
      "introAgendadas", "introLive", "introADemo",
      "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), ts(r.fecha), str(r.mes), int(r.semana), str(r.setter),
      int(r.intentosLlamada) ?? 0, int(r.introsEfectivas) ?? 0, int(r.demosAseguradasConIntro) ?? 0,
      int(r.demosEnCalendario) ?? 0, int(r.demosConfirmadas) ?? 0, int(r.demosAsistidas) ?? 0,
      int(r.cierresAtribuidos) ?? 0, dec(r.revenueAtribuido), dec(r.cashAtribuido),
      str(r.notas),
      int(r.introAgendadas) ?? 0, int(r.introLive) ?? 0, int(r.introADemo) ?? 0,
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "closer_activities",
    exportKey: "closer_activities",
    columns: [
      "id", "fecha", "mes", "semana", "closer",
      "scheduleCalls", "liveCalls", "offers", "deposits", "closes",
      "piffRevenue", "piffCash", "setupRevenue", "setupCash",
      "notas", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), ts(r.fecha), str(r.mes), int(r.semana), str(r.closer),
      int(r.scheduleCalls) ?? 0, int(r.liveCalls) ?? 0, int(r.offers) ?? 0,
      int(r.deposits) ?? 0, int(r.closes) ?? 0,
      dec(r.piffRevenue), dec(r.piffCash), dec(r.setupRevenue), dec(r.setupCash),
      str(r.notas), ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "setter_projections",
    exportKey: "setter_projections",
    columns: [
      "id", "setter", "semana", "mes", "anio", "weekStarting", "weekEnding",
      "intentosLlamadaTarget", "introsEfectivasTarget", "demosAseguradasTarget",
      "demosCalendarioTarget", "demosConfirmadasTarget", "demosAsistidasTarget",
      "bloodGoalDemosAsistidas", "bloodGoalCierres", "stretchGoalDemosAsistidas",
      "stretchGoalCierres", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), str(r.setter), int(r.semana), str(r.mes), int(r.anio),
      ts(r.weekStarting), ts(r.weekEnding),
      int(r.intentosLlamadaTarget), int(r.introsEfectivasTarget), int(r.demosAseguradasTarget),
      int(r.demosCalendarioTarget), int(r.demosConfirmadasTarget), int(r.demosAsistidasTarget),
      int(r.bloodGoalDemosAsistidas), int(r.bloodGoalCierres),
      int(r.stretchGoalDemosAsistidas), int(r.stretchGoalCierres),
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "closer_projections",
    exportKey: "closer_projections",
    columns: [
      "id", "closer", "semana", "mes", "anio", "weekStarting", "weekEnding",
      "scheduledCallsTarget", "showRateTarget", "offerRateTarget", "closeRateTarget",
      "projectedLiveCalls", "projectedOffers", "projectedCloses",
      "bloodGoalCloses", "stretchGoalCloses",
      "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id), str(r.closer), int(r.semana), str(r.mes), int(r.anio),
      ts(r.weekStarting), ts(r.weekEnding),
      int(r.scheduledCallsTarget), dec(r.showRateTarget), dec(r.offerRateTarget), dec(r.closeRateTarget),
      int(r.projectedLiveCalls), int(r.projectedOffers), int(r.projectedCloses),
      int(r.bloodGoalCloses), int(r.stretchGoalCloses),
      ts(r.createdAt), ts(r.updatedAt),
    ],
  },
  {
    name: "notifications",
    exportKey: "notifications",
    columns: [
      "id", "userId", "type", "title", "message",
      "leadId", "commentId", "fromUserId", "fromUserName", "isRead", "createdAt",
    ],
    mapRow: (r) => [
      int(r.id), int(r.userId),
      validEnum("notificationType", r.type) ?? "mention",
      str(r.title) ?? "", str(r.message) ?? "",
      int(r.leadId), int(r.commentId), int(r.fromUserId), str(r.fromUserName),
      int(r.isRead) ?? 0, ts(r.createdAt),
    ],
  },
];

// ── Main delta migration ────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) {
    console.log("*** DRY RUN — no data will be written ***\n");
  }

  // Step 1: Check current state
  console.log("=== CURRENT DATABASE STATE ===\n");
  for (const tbl of tables) {
    const result = await sql.unsafe(`SELECT COUNT(*) as count FROM "${tbl.name}"`);
    const exportCount = data[tbl.exportKey]?.length ?? 0;
    console.log(`  ${tbl.name.padEnd(22)} DB: ${String(result[0]?.count ?? 0).padStart(5)}  Export: ${String(exportCount).padStart(5)}`);
  }

  const summary: { table: string; inserted: number; updated: number; skipped: number }[] = [];

  // Step 2: Upsert table by table
  console.log("\n=== UPSERTING DATA ===\n");

  for (const tbl of tables) {
    const rows = data[tbl.exportKey];
    if (!rows || rows.length === 0) {
      console.log(`  ${tbl.name}: 0 rows (skipped)`);
      summary.push({ table: tbl.name, inserted: 0, updated: 0, skipped: 0 });
      continue;
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Process row by row for accurate counting
    for (const row of rows) {
      const values = tbl.mapRow(row);
      const colList = tbl.columns.map((c) => `"${c}"`).join(", ");
      const placeholders = tbl.columns.map((_, i) => `$${i + 1}`).join(", ");

      // Build SET clause for UPDATE (all columns except id)
      const updateCols = tbl.columns.filter((c) => c !== "id");
      const setClause = updateCols
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

      const query = `
        INSERT INTO "${tbl.name}" (${colList})
        OVERRIDING SYSTEM VALUE
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${setClause}
      `;

      if (DRY_RUN) {
        inserted++;
        continue;
      }

      try {
        // Check if record exists first (for counting)
        const existing = await sql.unsafe(`SELECT id FROM "${tbl.name}" WHERE id = $1`, [values[0]]);
        await sql.unsafe(query, values);

        if (existing.length > 0) {
          updated++;
        } else {
          inserted++;
        }
      } catch (err: any) {
        console.error(`    SKIP ${tbl.name} id=${row.id}: ${err.message.substring(0, 100)}`);
        skipped++;
      }
    }

    console.log(`  ${tbl.name}: +${inserted} new, ~${updated} updated, ${skipped} skipped (of ${rows.length})`);
    summary.push({ table: tbl.name, inserted, updated, skipped });
  }

  // Step 3: Reset sequences to avoid ID conflicts with future inserts
  if (!DRY_RUN) {
    console.log("\n=== RESETTING SEQUENCES ===\n");
    for (const tbl of tables) {
      try {
        const result = await sql.unsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_val FROM "${tbl.name}"`);
        const nextVal = result[0]?.next_val ?? 1;
        await sql.unsafe(`SELECT setval(pg_get_serial_sequence('"${tbl.name}"', 'id'), ${nextVal}, false)`);
        console.log(`  ${tbl.name}: next id = ${nextVal}`);
      } catch (err: any) {
        console.error(`  ${tbl.name}: sequence reset failed - ${err.message}`);
      }
    }
  }

  // Summary
  console.log("\n=== MIGRATION SUMMARY ===\n");
  let totalNew = 0, totalUpdated = 0, totalSkipped = 0;
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(22)} +${String(s.inserted).padStart(4)} new  ~${String(s.updated).padStart(4)} upd  ${s.skipped > 0 ? `⚠ ${s.skipped} skip` : ""}`);
    totalNew += s.inserted;
    totalUpdated += s.updated;
    totalSkipped += s.skipped;
  }
  console.log(`  ${"─".repeat(50)}`);
  console.log(`  ${"TOTAL".padEnd(22)} +${String(totalNew).padStart(4)} new  ~${String(totalUpdated).padStart(4)} upd  ${totalSkipped > 0 ? `⚠ ${totalSkipped} skip` : ""}`);
  console.log(`\nDelta migration complete.${DRY_RUN ? " (DRY RUN - nothing written)" : ""}`);

  await sql.end();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await sql.end();
  process.exit(1);
});
