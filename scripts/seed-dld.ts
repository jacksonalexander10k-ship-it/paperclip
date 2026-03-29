/**
 * Import DLD (Dubai Land Department) transactions from CSV into aygent_dld_transactions.
 *
 * Usage:
 *   npx tsx scripts/seed-dld.ts --company-id <uuid> --csv ~/Downloads/Transactions.csv
 *
 * Requires DATABASE_URL to be set (or defaults to the dev DB).
 * CSV format: standard DLD Transactions export with headers matching the column map below.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { aygentDldTransactions } from "../packages/db/src/schema/aygent-dld.js";

// ── CLI args ────────────────────────────────────────────────────────

function parseArgs(): { companyId: string; csvPath: string } {
  const args = process.argv.slice(2);
  const companyIdx = args.indexOf("--company-id");
  const csvIdx = args.indexOf("--csv");

  if (companyIdx === -1 || !args[companyIdx + 1]) {
    console.error(
      "Usage: npx tsx scripts/seed-dld.ts --company-id <uuid> --csv <path>",
    );
    process.exit(1);
  }
  if (csvIdx === -1 || !args[csvIdx + 1]) {
    console.error(
      "Usage: npx tsx scripts/seed-dld.ts --company-id <uuid> --csv <path>",
    );
    process.exit(1);
  }

  return {
    companyId: args[companyIdx + 1]!,
    csvPath: args[csvIdx + 1]!,
  };
}

const { companyId, csvPath } = parseArgs();

// ── Config ──────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL;
const BATCH_SIZE = 500;

if (!DB_URL) {
  console.error("DATABASE_URL must be set in environment or .env");
  process.exit(1);
}

// ── Database ────────────────────────────────────────────────────────

const pgClient = postgres(DB_URL);
const db = drizzle(pgClient);

// ── CSV parsing (minimal, no external dep) ──────────────────────────

function parseCSV(
  content: string,
): Array<Record<string, string>> {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCsvLine(lines[0]!);
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]!] = values[j] || "";
    }
    records.push(record);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────

function cleanVal(val: string | undefined): string | null {
  if (!val || val === "null" || val === "") return null;
  return val.trim();
}

function parseNum(val: string | undefined): number | null {
  if (!val || val === "null" || val === "") return null;
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : null;
}

function parseInt_(val: string | undefined): number | null {
  if (!val || val === "null" || val === "") return null;
  const num = parseInt(val, 10);
  return Number.isFinite(num) ? num : null;
}

function parseBool(val: string | undefined): boolean | null {
  if (!val || val === "null" || val === "") return null;
  const lower = val.toLowerCase().trim();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return null;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("DLD Transaction Importer");
  console.log("========================\n");
  console.log(`CSV:        ${csvPath}`);
  console.log(`Company:    ${companyId}`);
  console.log(`DB:         ${DB_URL!.replace(/:[^:@]+@/, ":***@")}\n`);

  // Read and parse CSV
  const csvData = readFileSync(csvPath, "utf-8");
  const records = parseCSV(csvData);
  console.log(`Parsed ${records.length} records from CSV\n`);

  if (records.length === 0) {
    console.log("No records to import.");
    await pgClient.end();
    return;
  }

  // Show detected columns
  const sampleKeys = Object.keys(records[0]!);
  console.log(`Detected columns: ${sampleKeys.join(", ")}\n`);

  // Batch insert
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const rows = batch.map((record) => ({
      companyId,
      transactionId: cleanVal(record["transaction_id"]),
      procedureNameEn: cleanVal(record["procedure_name_en"]),
      projectNameEn: cleanVal(record["project_name_en"]),
      actualWorth: parseNum(record["actual_worth"]),
      propertyUsageEn: cleanVal(record["property_usage_en"]),
      instanceDate: cleanVal(record["instance_date"]),
      buildingNameEn: cleanVal(record["building_name_en"]),
      transGroupEn: cleanVal(record["trans_group_en"]),
      propertyTypeEn: cleanVal(record["property_type_en"]),
      propertySubTypeEn: cleanVal(record["property_sub_type_en"]),
      roomsEn: cleanVal(record["rooms_en"]),
      areaNameEn: cleanVal(record["area_name_en"]),
      regTypeEn: cleanVal(record["reg_type_en"]),
      masterProjectEn: cleanVal(record["master_project_en"]),
      meterSalePrice: parseNum(record["meter_sale_price"]),
      nearestMetroEn: cleanVal(record["nearest_metro_en"]),
      nearestMallEn: cleanVal(record["nearest_mall_en"]),
      nearestLandmarkEn: cleanVal(record["nearest_landmark_en"]),
      hasParking: parseBool(record["has_parking"]),
      noOfBuyers: parseInt_(record["no_of_parties_role_1"]),
      noOfSellers: parseInt_(record["no_of_parties_role_2"]),
      source: "csv-import",
    }));

    try {
      await db.insert(aygentDldTransactions).values(rows);
      inserted += rows.length;
    } catch (err) {
      errors += rows.length;
      if (errors <= BATCH_SIZE * 3) {
        console.warn(`  Batch error at row ${i}: ${(err as Error).message}`);
      }
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(
        `  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (${inserted} inserted, ${errors} errors)`,
      );
    }
  }

  console.log(`\nDone!`);
  console.log(`  Total parsed:  ${records.length}`);
  console.log(`  Inserted:      ${inserted}`);
  console.log(`  Errors:        ${errors}`);

  await pgClient.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
