/**
 * Seed leads via Supabase REST API (PostgREST).
 * RLS is disabled so the anon key works for inserts.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://nlelxzinwhrffwjsxgyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWx4emlud2hyZmZ3anN4Z3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTc4ODIsImV4cCI6MjA5MTQzMzg4Mn0.bPlh83ssC0390ueYW4qXfYqcZQTv33gmeMuhqgzb0oo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parse the INSERT SQL statements from the seed script output
function parseSQLInserts(sql: string, tableName: string): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const regex = new RegExp(
    `INSERT INTO ${tableName} \\(([^)]+)\\) VALUES \\((.+?)\\);`,
    "g"
  );
  let match;
  while ((match = regex.exec(sql)) !== null) {
    const cols = match[1].split(",").map((c) => c.trim().replace(/"/g, ""));
    const valStr = match[2];

    // Parse values carefully (handle quoted strings with commas)
    const values: (string | number | null)[] = [];
    let current = "";
    let inQuote = false;
    let escaped = false;

    for (let i = 0; i < valStr.length; i++) {
      const ch = valStr[i];
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        current += ch;
        continue;
      }
      if (ch === "'" && !inQuote) {
        inQuote = true;
        continue;
      }
      if (ch === "'" && inQuote) {
        // Check for escaped quote ''
        if (i + 1 < valStr.length && valStr[i + 1] === "'") {
          current += "'";
          i++;
          continue;
        }
        inQuote = false;
        continue;
      }
      if (ch === "," && !inQuote) {
        values.push(parseValue(current.trim()));
        current = "";
        continue;
      }
      current += ch;
    }
    values.push(parseValue(current.trim()));

    const row: Record<string, any> = {};
    cols.forEach((col, i) => {
      if (values[i] !== undefined) {
        row[col] = values[i];
      }
    });
    rows.push(row);
  }
  return rows;
}

function parseValue(v: string): string | number | null {
  if (v === "NULL") return null;
  // Already unquoted by parser
  const num = Number(v);
  if (!isNaN(num) && v !== "") return num;
  return v;
}

async function main() {
  // Read the seed SQL
  const { execSync } = await import("child_process");
  const sql = execSync("npx tsx scripts/seed-historical.ts", {
    encoding: "utf8",
    cwd: path.resolve(import.meta.dirname, ".."),
  });

  // Parse leads
  const leads = parseSQLInserts(sql, "leads");
  console.log(`Parsed ${leads.length} leads`);

  // Insert in batches of 20
  const batchSize = 20;
  let inserted = 0;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const { data, error } = await supabase.from("leads").insert(batch);
    if (error) {
      console.error(`Error at batch ${i / batchSize + 1}:`, error.message);
      // Try one by one
      for (const lead of batch) {
        const { error: singleErr } = await supabase.from("leads").insert(lead);
        if (singleErr) {
          console.error(`  Failed lead "${lead.nombre}": ${singleErr.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${leads.length})`);
    }
  }
  console.log(`\nDone. ${inserted}/${leads.length} leads inserted.`);
}

main().catch(console.error);
