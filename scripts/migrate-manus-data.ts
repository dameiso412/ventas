import postgres from "postgres";
import { readFileSync } from "fs";

// ── Config ──────────────────────────────────────────────────────────────────────
const EXPORT_PATH = "/Users/dameiso/Downloads/sacamedi_crm_export.json";
const BATCH_SIZE = 50;

const sql = postgres(
  "postgresql://postgres.nlelxzinwhrffwjsxgyl:Hr%2A%21%26SK%2AK2LUtk%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres",
  { prepare: false }
);

// ── Load export ─────────────────────────────────────────────────────────────────
console.log("Loading export JSON...");
const raw = readFileSync(EXPORT_PATH, "utf-8");
const data: Record<string, any[]> = JSON.parse(raw);

// ── Enum valid values (from schema) ─────────────────────────────────────────────
const ENUMS: Record<string, Set<string>> = {
  tipo: new Set(["DEMO", "INTRO"]),
  categoria: new Set(["AGENDA", "LEAD"]),
  origen: new Set(["ADS", "REFERIDO", "ORGANICO"]),
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
  contactResultado: new Set(["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "MENSAJE ENVIADO"]),
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
  return v; // postgres driver handles ISO strings
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

/** Split array into chunks of `size` */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Table definitions: column list + row mapper ─────────────────────────────────
type TableDef = {
  name: string;
  exportKey: string;
  columns: string[];
  mapRow: (r: any) => any[];
};

const tables: TableDef[] = [
  // ── team_members ──────────────────────────────────────────────────────────
  {
    name: "team_members",
    exportKey: "team_members",
    columns: ["id", "nombre", "rol", "activo", "correo", "telefono", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id),
      str(r.nombre),
      validEnum("teamMemberRol", r.rol),
      int(r.activo) ?? 1,
      str(r.correo),
      str(r.telefono),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── allowed_emails ────────────────────────────────────────────────────────
  {
    name: "allowed_emails",
    exportKey: "allowed_emails",
    columns: ["id", "email", "role", "nombre", "activo", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id),
      str(r.email),
      validEnum("allowedEmailRole", r.role),
      str(r.nombre),
      int(r.activo) ?? 1,
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── leads ─────────────────────────────────────────────────────────────────
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
      int(r.id),
      ts(r.fecha),
      str(r.mes),
      int(r.semana),
      validEnum("tipo", r.tipo) ?? "DEMO",
      validEnum("categoria", r.categoria) ?? "AGENDA",
      validEnum("origen", r.origen) ?? "ADS",
      str(r.nombre),
      str(r.correo),
      str(r.telefono),
      str(r.pais),
      str(r.instagram),
      str(r.rubro),
      validEnum("estadoLead", r.estadoLead),
      str(r.setterAsignado),
      ts(r.fechaPrimerContacto),
      dec(r.tiempoRespuestaHoras),
      int(r.intentosContacto) ?? 0,
      validEnum("resultadoContacto", r.resultadoContacto),
      validEnum("validoParaContacto", r.validoParaContacto),
      validEnum("califica", r.califica),
      str(r.razonNoCalifica),
      validEnum("estadoConfirmacion", r.estadoConfirmacion),
      str(r.triage),
      validEnum("asistencia", r.asistencia),
      str(r.closer),
      validEnum("ofertaHecha", r.ofertaHecha),
      validEnum("outcome", r.outcome),
      str(r.razonNoConversion),
      validEnum("productoTipo", r.productoTipo),
      dec(r.facturado),
      dec(r.cashCollected),
      dec(r.deposito),
      dec(r.contractedRevenue),
      dec(r.setupFee),
      dec(r.recurrenciaMensual),
      ts(r.fechaProximoCobro),
      str(r.notas),
      str(r.linkCRM),
      str(r.linkGrabacion),
      validEnum("calificacionFinanciera", r.calificacionFinanciera),
      str(r.respuestaFinanciera),
      ts(r.fechaIntro),
      str(r.utmSource),
      str(r.utmMedium),
      str(r.utmCampaign),
      str(r.utmContent),
      str(r.utmTerm),
      int(r.score),
      validEnum("scoreLabel", r.scoreLabel),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── lead_scoring ──────────────────────────────────────────────────────────
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
      int(r.id),
      int(r.leadId),
      str(r.correo),
      str(r.instagram),
      str(r.p1Frustracion),
      str(r.p2MarketingPrevio),
      str(r.p3Urgencia),
      str(r.p4TiempoOperando),
      str(r.p5Tratamientos),
      str(r.p6Impedimento),
      int(r.scoreP1),
      int(r.scoreP2),
      int(r.scoreP3),
      int(r.scoreP4),
      int(r.scoreP6),
      int(r.scoreTotal),
      int(r.scoreFinal),
      validEnum("scoreLabel", r.scoreLabel),
      ts(r.createdAt),
    ],
  },
  // ── follow_ups ────────────────────────────────────────────────────────────
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
      int(r.id),
      int(r.leadId),
      str(r.nombre),
      str(r.correo),
      str(r.telefono),
      str(r.instagram),
      str(r.facebook),
      validEnum("followUpTipo", r.tipo) ?? "HOT",
      validEnum("prioridad", r.prioridad) ?? "HOT",
      validEnum("followUpEstado", r.estado) ?? "ACTIVO",
      str(r.ultimaObjecion),
      dec(r.montoEstimado),
      validEnum("productoInteres", r.productoInteres),
      ts(r.ultimoFollowUp),
      ts(r.proximoFollowUp),
      int(r.totalFollowUps) ?? 0,
      str(r.closerAsignado),
      str(r.notas),
      str(r.linkCRM),
      validEnum("creadoDesde", r.creadoDesde) ?? "MANUAL",
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── follow_up_logs ────────────────────────────────────────────────────────
  {
    name: "follow_up_logs",
    exportKey: "follow_up_logs",
    columns: ["id", "followUpId", "accion", "detalle", "realizadoPor", "createdAt"],
    mapRow: (r) => [
      int(r.id),
      int(r.followUpId),
      validEnum("followUpAccion", r.accion) ?? "NOTA",
      str(r.detalle),
      str(r.realizadoPor),
      ts(r.createdAt),
    ],
  },
  // ── contact_attempts ──────────────────────────────────────────────────────
  {
    name: "contact_attempts",
    exportKey: "contact_attempts",
    columns: ["id", "leadId", "timestamp", "canal", "resultado", "notas", "realizadoPor", "createdAt"],
    mapRow: (r) => [
      int(r.id),
      int(r.leadId),
      ts(r.timestamp),
      validEnum("canal", r.canal) ?? "LLAMADA",
      validEnum("contactResultado", r.resultado),
      str(r.notas),
      str(r.realizadoPor),
      ts(r.createdAt),
    ],
  },
  // ── lead_comments ─────────────────────────────────────────────────────────
  {
    name: "lead_comments",
    exportKey: "lead_comments",
    columns: ["id", "leadId", "userId", "autor", "autorRole", "texto", "mentions", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id),
      int(r.leadId),
      int(r.userId),
      str(r.autor) ?? "unknown",
      str(r.autorRole),
      str(r.texto) ?? "",
      str(r.mentions),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── call_audits ───────────────────────────────────────────────────────────
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
      int(r.id),
      int(r.leadId),
      str(r.closer),
      ts(r.fechaLlamada),
      str(r.linkGrabacion),
      str(r.recordingTranscript),
      str(r.leadName),
      str(r.leadEmail),
      int(r.duracionMinutos),
      str(r.aiFeedback),
      int(r.aiGrading),
      str(r.aiGradingJustification),
      str(r.aiWhyNotClosed),
      str(r.aiKeyMoments),
      validEnum("manualReview", r.manualReview) ?? "PENDIENTE",
      str(r.manualNotes),
      jsonVal(r.actionItems),
      str(r.reviewedBy),
      ts(r.reviewedAt),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── notifications ─────────────────────────────────────────────────────────
  {
    name: "notifications",
    exportKey: "notifications",
    columns: [
      "id", "userId", "type", "title", "message",
      "leadId", "commentId", "fromUserId", "fromUserName",
      "isRead", "createdAt",
    ],
    mapRow: (r) => [
      int(r.id),
      int(r.userId),
      validEnum("notificationType", r.type) ?? "mention",
      str(r.title) ?? "",
      str(r.message) ?? "",
      int(r.leadId),
      int(r.commentId),
      int(r.fromUserId),
      str(r.fromUserName),
      // export has isRead already as 0/1 integer
      int(r.isRead) ?? 0,
      ts(r.createdAt),
    ],
  },
  // ── ad_campaigns ──────────────────────────────────────────────────────────
  {
    name: "ad_campaigns",
    exportKey: "ad_campaigns",
    columns: ["id", "campaignId", "name", "status", "objective", "lastSyncedAt", "createdAt", "updatedAt"],
    mapRow: (r) => [
      int(r.id),
      str(r.campaignId),
      str(r.name),
      str(r.status),
      str(r.objective),
      ts(r.lastSyncedAt),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── ad_adsets ─────────────────────────────────────────────────────────────
  {
    name: "ad_adsets",
    exportKey: "ad_adsets",
    columns: [
      "id", "adsetId", "campaignId", "name", "status",
      "targetingDescription", "lastSyncedAt", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id),
      str(r.adsetId),
      str(r.campaignId),
      str(r.name),
      str(r.status),
      str(r.targetingDescription),
      ts(r.lastSyncedAt),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── ad_ads ────────────────────────────────────────────────────────────────
  {
    name: "ad_ads",
    exportKey: "ad_ads",
    columns: [
      "id", "adId", "adsetId", "campaignId", "name", "status",
      "creativePreviewUrl", "urlTags", "lastSyncedAt", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id),
      str(r.adId),
      str(r.adsetId),
      str(r.campaignId),
      str(r.name),
      str(r.status),
      str(r.creativePreviewUrl),
      str(r.urlTags),
      ts(r.lastSyncedAt),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── ad_metrics_daily ──────────────────────────────────────────────────────
  {
    name: "ad_metrics_daily",
    exportKey: "ad_metrics_daily",
    columns: [
      "id", "fecha", "campaignId", "campaignName", "adsetId", "adsetName",
      "adId", "adName", "impressions", "clicks", "spend", "reach",
      "leads", "linkClicks", "ctr", "cpc", "cpl", "costPerResult",
      "lastSyncedAt", "createdAt", "updatedAt",
    ],
    mapRow: (r) => [
      int(r.id),
      ts(r.fecha),
      str(r.campaignId),
      str(r.campaignName),
      str(r.adsetId),
      str(r.adsetName),
      str(r.adId),
      str(r.adName),
      int(r.impressions) ?? 0,
      int(r.clicks) ?? 0,
      dec(r.spend),
      int(r.reach) ?? 0,
      int(r.leads) ?? 0,
      int(r.linkClicks) ?? 0,
      dec(r.ctr),
      dec(r.cpc),
      dec(r.cpl),
      dec(r.costPerResult),
      ts(r.lastSyncedAt),
      ts(r.createdAt),
      ts(r.updatedAt),
    ],
  },
  // ── webhook_logs ──────────────────────────────────────────────────────────
  {
    name: "webhook_logs",
    exportKey: "webhook_logs",
    columns: [
      "id", "endpoint", "method", "status", "leadId",
      "nombre", "correo", "telefono", "rawPayload",
      "processingNotes", "errorMessage", "processingTimeMs", "createdAt",
    ],
    mapRow: (r) => [
      int(r.id),
      str(r.endpoint) ?? "/unknown",
      str(r.method) ?? "POST",
      validEnum("webhookStatus", r.status) ?? "RECEIVED",
      int(r.leadId),
      str(r.nombre),
      str(r.correo),
      str(r.telefono),
      str(r.rawPayload),
      str(r.processingNotes),
      str(r.errorMessage),
      int(r.processingTimeMs),
      ts(r.createdAt),
    ],
  },
];

// ── Truncation order (reverse of FK dependencies) ───────────────────────────────
const TRUNCATE_ORDER = [
  "notifications",
  "lead_comments",
  "follow_up_logs",
  "contact_attempts",
  "call_audits",
  "follow_ups",
  "lead_scoring",
  "webhook_logs",
  "ad_metrics_daily",
  "ad_ads",
  "ad_adsets",
  "ad_campaigns",
  "closer_projections",
  "setter_projections",
  "leads",
  "team_members",
  "allowed_emails",
];

// ── Main migration ──────────────────────────────────────────────────────────────
async function main() {
  const summary: { table: string; rows: number }[] = [];

  // ── Step 1: Truncate all tables ───────────────────────────────────────────
  console.log("\n=== TRUNCATING ALL TABLES ===\n");
  for (const table of TRUNCATE_ORDER) {
    console.log(`  TRUNCATE ${table} RESTART IDENTITY CASCADE`);
    await sql.unsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
  }
  console.log("\n  All tables truncated.\n");

  // ── Step 2: Insert data table by table ────────────────────────────────────
  console.log("=== INSERTING DATA ===\n");

  for (const tbl of tables) {
    const rows = data[tbl.exportKey];
    if (!rows || rows.length === 0) {
      console.log(`  ${tbl.name}: 0 rows (skipped)`);
      summary.push({ table: tbl.name, rows: 0 });
      continue;
    }

    let inserted = 0;
    const batches = chunk(rows, BATCH_SIZE);

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];

      // Build column list for INSERT
      const colList = tbl.columns.map((c) => `"${c}"`).join(", ");
      const placeholders = batch
        .map((_, ri) => {
          const offset = ri * tbl.columns.length;
          const ph = tbl.columns.map((_, ci) => `$${offset + ci + 1}`).join(", ");
          return `(${ph})`;
        })
        .join(",\n       ");

      const values: any[] = [];
      for (const row of batch) {
        values.push(...tbl.mapRow(row));
      }

      const query = `INSERT INTO "${tbl.name}" (${colList}) OVERRIDING SYSTEM VALUE VALUES ${placeholders}`;

      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(query, values);
        });
        inserted += batch.length;
      } catch (err: any) {
        console.error(`  ERROR on ${tbl.name} batch ${bi + 1}: ${err.message}`);
        // Try row-by-row fallback for this batch
        for (const row of batch) {
          const singlePh = tbl.columns.map((_, ci) => `$${ci + 1}`).join(", ");
          const singleQuery = `INSERT INTO "${tbl.name}" (${colList}) OVERRIDING SYSTEM VALUE VALUES (${singlePh})`;
          const singleValues = tbl.mapRow(row);
          try {
            await sql.begin(async (tx) => {
              await tx.unsafe(singleQuery, singleValues);
            });
            inserted++;
          } catch (rowErr: any) {
            console.error(`    SKIP row id=${row.id}: ${rowErr.message}`);
          }
        }
      }
    }

    console.log(`  ${tbl.name}: ${inserted}/${rows.length} rows inserted`);
    summary.push({ table: tbl.name, rows: inserted });
  }

  // ── Step 3: Reset sequences ───────────────────────────────────────────────
  console.log("\n=== RESETTING SEQUENCES ===\n");

  const allTables = tables.map((t) => t.name);
  for (const tbl of allTables) {
    try {
      const result = await sql.unsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_val FROM "${tbl}"`);
      const nextVal = result[0]?.next_val ?? 1;
      await sql.unsafe(`SELECT setval(pg_get_serial_sequence('"${tbl}"', 'id'), ${nextVal}, false)`);
      console.log(`  ${tbl}: next id = ${nextVal}`);
    } catch (err: any) {
      console.error(`  ${tbl}: sequence reset failed - ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== MIGRATION SUMMARY ===\n");
  let totalRows = 0;
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(22)} ${String(s.rows).padStart(5)} rows`);
    totalRows += s.rows;
  }
  console.log(`  ${"─".repeat(33)}`);
  console.log(`  ${"TOTAL".padEnd(22)} ${String(totalRows).padStart(5)} rows`);
  console.log("\nMigration complete.");

  await sql.end();
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await sql.end();
  process.exit(1);
});
