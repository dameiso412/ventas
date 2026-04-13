/**
 * Backfill: Recalculate tiempoRespuestaHoras for all contacted leads
 * using business hours (createdAt → fechaPrimerContacto).
 *
 * Run: npx tsx scripts/backfill-response-time.ts
 */
import postgres from "postgres";
import { calculateBusinessHours } from "../shared/businessHours";

const DB_URL = process.env.DATABASE_URL
  || "postgresql://postgres.nlelxzinwhrffwjsxgyl:Hr%2A%21%26SK%2AK2LUtk%40@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

const sql = postgres(DB_URL, { prepare: false });
const BATCH_SIZE = 50;

async function main() {
  console.log("[Backfill] Fetching leads with fechaPrimerContacto...");

  const leads = await sql`
    SELECT id, "createdAt", "fechaPrimerContacto", "tiempoRespuestaHoras"
    FROM leads
    WHERE "fechaPrimerContacto" IS NOT NULL
      AND "createdAt" IS NOT NULL
    ORDER BY id
  `;

  console.log(`[Backfill] Found ${leads.length} leads to recalculate`);

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);

    for (const lead of batch) {
      try {
        const createdAt = new Date(lead.createdAt);
        const firstContact = new Date(lead.fechaPrimerContacto);

        if (firstContact <= createdAt) {
          await sql`UPDATE leads SET "tiempoRespuestaHoras" = 0 WHERE id = ${lead.id}`;
        } else {
          const bizHours = calculateBusinessHours(createdAt, firstContact);
          await sql`UPDATE leads SET "tiempoRespuestaHoras" = ${String(bizHours)} WHERE id = ${lead.id}`;
        }
        updated++;
      } catch (err) {
        console.error(`[Backfill] Error on lead ${lead.id}:`, err);
        errors++;
      }
    }

    console.log(`[Backfill] Processed ${Math.min(i + BATCH_SIZE, leads.length)}/${leads.length}`);
  }

  console.log(`[Backfill] Done. Updated: ${updated}, Errors: ${errors}`);
  await sql.end();
}

main().catch((err) => {
  console.error("[Backfill] Fatal:", err);
  process.exit(1);
});
