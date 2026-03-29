/**
 * Seed all Dubai off-plan projects from the Reelly API into aygent_projects.
 *
 * Usage:
 *   npx tsx scripts/seed-projects.ts --company-id <uuid>
 *
 * Requires DATABASE_URL to be set (or defaults to the dev DB).
 * Optionally set REELLY_API_KEY if the API requires it.
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { aygentProjects } from "../packages/db/src/schema/aygent-projects.js";

// ── CLI args ────────────────────────────────────────────────────────

function parseArgs(): { companyId: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--company-id");
  if (idx === -1 || !args[idx + 1]) {
    console.error("Usage: npx tsx scripts/seed-projects.ts --company-id <uuid>");
    process.exit(1);
  }
  return { companyId: args[idx + 1]! };
}

const { companyId } = parseArgs();

// ── Config ──────────────────────────────────────────────────────────

const REELLY_BASE = "https://api-reelly.up.railway.app/api/v2/clients";
const API_KEY = process.env.REELLY_API_KEY || "";
const DB_URL = process.env.DATABASE_URL;
const PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 10;
const DETAIL_DELAY_MS = 500;

if (!DB_URL) {
  console.error("DATABASE_URL must be set in environment or .env");
  process.exit(1);
}

// ── Database ────────────────────────────────────────────────────────

const pgClient = postgres(DB_URL);
const db = drizzle(pgClient);

// ── Reelly API types ────────────────────────────────────────────────

interface ReellyProject {
  id: number;
  name: string;
  developer: string;
  construction_status: string;
  sale_status: string;
  overview: string | null;
  short_description: string | null;
  managing_company: string | null;
  completion_date: string | null;
  completion_datetime: string | null;
  brand: string | null;
  is_partner_project: boolean;
  building_count: number;
  units_count: number;
  min_price: number;
  max_price: number;
  min_size: number;
  max_size: number;
  price_currency: string;
  area_unit: string;
  cover_image: { url: string } | null;
  location: {
    district: string | null;
    region: string | null;
    city: string | null;
    sector: string | null;
    village: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

interface ReellyDetail extends ReellyProject {
  project_amenities: Array<{ amenity: { name: string } }>;
  payment_plans: Array<{
    name: string;
    duration_months: number;
    is_handover: boolean;
    months_after_handover: number;
    eoi: string;
    steps: Array<{
      title: string;
      percentage: string;
      milestone: string;
      order: number;
    }>;
  }>;
  project_map_points: Array<{
    map_point_name: string;
    distance: number | null;
    time: number | null;
  }>;
  buildings: Array<{
    name: string | null;
    floors_count: number | null;
    building_type: string;
  }>;
  parkings: Array<{
    unit_type: string;
    unit_bedrooms: number;
    parking_space: number;
  }>;
  floor_plans: Array<{ file: string }>;
  marketing_brochure: string | null;
  general_plan: { url: string } | null;
  lobby: Array<{ url: string }>;
  interior: Array<{ url: string }>;
  architecture: Array<{ url: string }>;
  readiness_progress: number | null;
  escrow_number: string | null;
  service_charge: string | null;
  furnishing: string | null;
  post_handover: boolean;
}

// ── API helpers ─────────────────────────────────────────────────────

async function reellyFetch<T>(
  apiPath: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${REELLY_BASE}${apiPath}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {};
  if (API_KEY) headers["X-API-Key"] = API_KEY;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Reelly API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Data cleanup (ported from AygentDesk sync-reelly.ts) ────────────

function cleanStatus(raw: string): string {
  const map: Record<string, string> = {
    under_construction: "Under Construction",
    completed: "Completed",
    presale: "Presale",
  };
  return (
    map[raw] ||
    raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function cleanSaleStatus(raw: string): string {
  const map: Record<string, string> = {
    on_sale: "On Sale",
    out_of_stock: "Out of Stock",
    presale_eoi: "Presale (EOI)",
    start_of_sales: "Start of Sales",
    announced: "Announced",
  };
  return (
    map[raw] ||
    raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function cleanOverview(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanFurnishing(raw: string | null): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    semi_furnished: "Semi-Furnished",
    fully_furnished: "Fully Furnished",
    unfurnished: "Unfurnished",
    furnished: "Furnished",
  };
  return (
    map[raw] ||
    raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function buildLocation(loc: ReellyProject["location"]): string {
  return [loc.district, loc.region].filter(Boolean).join(", ") || "Dubai";
}

function parseServiceCharge(raw: string | null): number | null {
  if (!raw) return null;
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`Seeding projects for company ${companyId}\n`);

  // Step 1: Fetch all project summaries (paginated)
  console.log("Fetching project list...");
  const projects: ReellyProject[] = [];
  let offset = 0;
  let total = 0;
  do {
    const page = await reellyFetch<{
      count: number;
      results: ReellyProject[];
    }>("/projects", {
      limit: PAGE_SIZE,
      offset,
      preferred_currency: "AED",
      preferred_area_unit: "sqft",
    });
    total = page.count;
    projects.push(...page.results);
    offset += PAGE_SIZE;
    console.log(`  Fetched page ${Math.ceil(offset / PAGE_SIZE)}... (${projects.length}/${total})`);
  } while (offset < total);
  console.log(`${projects.length} project summaries fetched\n`);

  // Step 2: Fetch details in batches
  console.log("Fetching project details...");
  const details = new Map<number, ReellyDetail>();
  let done = 0;
  for (let i = 0; i < projects.length; i += DETAIL_BATCH_SIZE) {
    const batch = projects.slice(i, i + DETAIL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (p) => {
        try {
          return await reellyFetch<ReellyDetail>(`/projects/${p.id}`, {
            preferred_currency: "AED",
            preferred_area_unit: "sqft",
          });
        } catch {
          await sleep(2000);
          try {
            return await reellyFetch<ReellyDetail>(`/projects/${p.id}`, {
              preferred_currency: "AED",
              preferred_area_unit: "sqft",
            });
          } catch {
            return null;
          }
        }
      }),
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j] && batch[j]) details.set(batch[j]!.id, results[j]!);
    }
    done += batch.length;
    if (done % 50 === 0 || done === projects.length) {
      console.log(`  Details: ${done}/${projects.length} (${details.size} ok)`);
    }
    if (i + DETAIL_BATCH_SIZE < projects.length) await sleep(DETAIL_DELAY_MS);
  }
  console.log(`${details.size} details fetched\n`);

  // Step 3: Upsert to DB
  console.log("Upserting projects to database...");
  let upserted = 0;
  let errors = 0;

  for (const project of projects) {
    const detail = details.get(project.id);
    try {
      const data = {
        companyId,
        reellyId: project.id,
        name: project.name.trim(),
        developer: project.developer.trim(),
        description: cleanOverview(detail?.overview ?? project.overview),
        shortDescription: project.short_description?.trim() || null,
        district:
          typeof project.location.district === "string"
            ? project.location.district.trim() || null
            : null,
        region:
          typeof project.location.region === "string"
            ? project.location.region.trim() || null
            : null,
        city:
          typeof project.location.city === "string"
            ? project.location.city.trim() || null
            : null,
        sector:
          typeof project.location.sector === "string"
            ? project.location.sector.trim() || null
            : null,
        location: buildLocation(project.location),
        latitude: project.location.latitude,
        longitude: project.location.longitude,
        minPrice: project.min_price,
        maxPrice: project.max_price,
        minSize: project.min_size,
        maxSize: project.max_size,
        priceCurrency: project.price_currency || "AED",
        areaUnit: project.area_unit || "sqft",
        constructionStatus: cleanStatus(project.construction_status),
        saleStatus: cleanSaleStatus(project.sale_status),
        completionDate: project.completion_date?.trim() || null,
        completionDatetime: project.completion_datetime
          ? new Date(project.completion_datetime)
          : null,
        readinessProgress: detail?.readiness_progress ?? null,
        furnishing: cleanFurnishing(detail?.furnishing ?? null),
        serviceCharge: parseServiceCharge(detail?.service_charge ?? null),
        escrowNumber: detail?.escrow_number?.trim() || null,
        postHandover: detail?.post_handover ?? false,
        buildingCount: project.building_count,
        unitsCount: project.units_count,
        amenities: detail?.project_amenities
          ? detail.project_amenities.map((a) => a.amenity.name)
          : [],
        paymentPlans: detail?.payment_plans
          ? detail.payment_plans.map((pp) => ({
              name: pp.name,
              durationMonths: pp.duration_months,
              isHandover: pp.is_handover,
              monthsAfterHandover: pp.months_after_handover,
              eoi: pp.eoi,
              steps: pp.steps.map((s) => ({
                title: s.title,
                percentage: s.percentage,
                milestone: s.milestone,
                order: s.order,
              })),
            }))
          : [],
        nearbyLandmarks: detail?.project_map_points
          ? detail.project_map_points.map((poi) => ({
              name: poi.map_point_name,
              distanceKm: poi.distance,
              timeMin: poi.time,
            }))
          : [],
        buildings: detail?.buildings
          ? detail.buildings.map((b) => ({
              name: b.name,
              floorsCount: b.floors_count,
              type: b.building_type,
            }))
          : [],
        parkings: detail?.parkings
          ? detail.parkings.map((pk) => ({
              unitType: pk.unit_type,
              bedrooms: pk.unit_bedrooms,
              spaces: pk.parking_space,
            }))
          : [],
        coverImageUrl: project.cover_image?.url || null,
        brochureUrl: detail?.marketing_brochure?.trim() || null,
        floorPlanUrl: detail?.floor_plans?.[0]?.file || null,
        generalPlanUrl: detail?.general_plan?.url || null,
        images: detail
          ? (() => {
              const imgs: Array<{ type: string; url: string }> = [];
              for (const img of detail.lobby || [])
                imgs.push({ type: "lobby", url: img.url });
              for (const img of detail.interior || [])
                imgs.push({ type: "interior", url: img.url });
              for (const img of detail.architecture || [])
                imgs.push({ type: "architecture", url: img.url });
              return imgs;
            })()
          : [],
        brand: project.brand?.trim() || null,
        managingCompany: project.managing_company?.trim() || null,
        isPartnerProject: project.is_partner_project,
        syncedAt: new Date(),
        updatedAt: new Date(),
      };

      await db
        .insert(aygentProjects)
        .values(data)
        .onConflictDoUpdate({
          target: [aygentProjects.companyId, aygentProjects.reellyId],
          set: {
            name: sql`excluded.name`,
            developer: sql`excluded.developer`,
            description: sql`excluded.description`,
            shortDescription: sql`excluded.short_description`,
            district: sql`excluded.district`,
            region: sql`excluded.region`,
            city: sql`excluded.city`,
            sector: sql`excluded.sector`,
            location: sql`excluded.location`,
            latitude: sql`excluded.latitude`,
            longitude: sql`excluded.longitude`,
            minPrice: sql`excluded.min_price`,
            maxPrice: sql`excluded.max_price`,
            minSize: sql`excluded.min_size`,
            maxSize: sql`excluded.max_size`,
            priceCurrency: sql`excluded.price_currency`,
            areaUnit: sql`excluded.area_unit`,
            constructionStatus: sql`excluded.construction_status`,
            saleStatus: sql`excluded.sale_status`,
            completionDate: sql`excluded.completion_date`,
            completionDatetime: sql`excluded.completion_datetime`,
            readinessProgress: sql`excluded.readiness_progress`,
            furnishing: sql`excluded.furnishing`,
            serviceCharge: sql`excluded.service_charge`,
            escrowNumber: sql`excluded.escrow_number`,
            postHandover: sql`excluded.post_handover`,
            buildingCount: sql`excluded.building_count`,
            unitsCount: sql`excluded.units_count`,
            amenities: sql`excluded.amenities`,
            paymentPlans: sql`excluded.payment_plans`,
            nearbyLandmarks: sql`excluded.nearby_landmarks`,
            buildings: sql`excluded.buildings`,
            parkings: sql`excluded.parkings`,
            coverImageUrl: sql`excluded.cover_image_url`,
            brochureUrl: sql`excluded.brochure_url`,
            floorPlanUrl: sql`excluded.floor_plan_url`,
            generalPlanUrl: sql`excluded.general_plan_url`,
            images: sql`excluded.images`,
            brand: sql`excluded.brand`,
            managingCompany: sql`excluded.managing_company`,
            isPartnerProject: sql`excluded.is_partner_project`,
            syncedAt: sql`excluded.synced_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

      upserted++;
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.warn(
          `  DB error: ${project.id} (${project.name}): ${(err as Error).message}`,
        );
      }
    }
    if (upserted % 100 === 0 && upserted > 0) {
      console.log(`  ${upserted}/${projects.length} saved (${errors} errors)`);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  console.log(
    `\nDone in ${mins}m ${secs}s. Inserted/updated ${upserted} projects (${errors} errors).`,
  );

  await pgClient.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
