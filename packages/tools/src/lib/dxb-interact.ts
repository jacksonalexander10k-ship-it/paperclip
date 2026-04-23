// DXB Interact scraper — drives dxbinteract.com via headless Chromium.
//
// The site is Oracle APEX behind Cloudflare, so fetch-based scraping is
// impossible. We load the homepage, wait for the APEX report tables to
// populate via their internal wwv_flow.ajax calls, extract the rendered
// rows, and parse the concatenated cell strings into structured records.
//
// A single Chromium instance is cached between calls for performance.

import { chromium, type Browser } from "playwright";

export type DxbTransactionType = "sale" | "rent";

export interface DxbTransaction {
  type: DxbTransactionType;
  building: string | null;
  area: string | null;
  propertyType: string | null;
  status: "offplan" | "ready" | null;
  floor: string | null;
  unit: string | null;
  price: number | null;
  pricePerSqft: number | null;
  capitalGainPct: number | null;
  sizeSqft: number | null;
  rooms: string | null;
  date: string | null;
  soldBy: "developer" | "owner" | null;
  rentalYield: string | null;
  duration: string | null;
  purchasePrice: string | null;
  raw: { location: string; priceOrSpecs: string; specsOrDuration: string; dateOrPurchase: string };
}

interface ScrapeResult {
  results: DxbTransaction[];
  area?: string;
  message: string;
  scrapedAt: string;
}

// ── Browser launcher ────────────────────────────────────────────────
// Fresh browser per call — Chromium launches in ~1s, and reusing it
// across contexts caused intermittent APEX/Cloudflare flakiness.

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
}

// Kept for callers that previously closed the cached instance — no-op now.
export async function closeBrowser(): Promise<void> {
  // no-op
}

// ── Parsers ─────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Sale location cell example:
//   "Binghatti Skyblade, Downtown Dubai Offplan Apartment, Floor 38Unit"
//   "The Hillgate - Tower A, Nadd Hessa Offplan ApartmentUnit"
//   "Peninsula One, Business Bay Ready Apartment, Floor 24, Unit 2404"
function parseSaleLocation(raw: string): {
  building: string | null;
  area: string | null;
  propertyType: string | null;
  status: "offplan" | "ready" | null;
  floor: string | null;
  unit: string | null;
} {
  let cleaned = raw.trim();

  let unit: string | null = null;
  const unitMatch = cleaned.match(/,\s*Unit\s+([^,]+?)$/i);
  if (unitMatch) {
    unit = unitMatch[1]!.trim();
    cleaned = cleaned.slice(0, unitMatch.index).trim();
  } else {
    cleaned = cleaned.replace(/Unit\s*$/i, "").trim();
  }

  const firstComma = cleaned.indexOf(",");
  if (firstComma < 0) {
    return {
      building: cleaned || null,
      area: null,
      propertyType: null,
      status: null,
      floor: null,
      unit,
    };
  }
  const building = cleaned.slice(0, firstComma).trim();
  let rest = cleaned.slice(firstComma + 1).trim();

  let floor: string | null = null;
  const floorMatch = rest.match(/,\s*Floor\s+([^,]+?)$/i);
  if (floorMatch) {
    floor = floorMatch[1]!.trim();
    rest = rest.slice(0, floorMatch.index).trim();
  }

  const typeMatch = rest.match(
    /\b(Apartment|Villa|Townhouse|Penthouse|Office|Hotel Apartment|Shop|Land|Building)\b/i,
  );
  let propertyType: string | null = null;
  let area = rest;
  if (typeMatch) {
    propertyType = typeMatch[1]!;
    area = rest.slice(0, typeMatch.index).trim();
  }

  let status: "offplan" | "ready" | null = null;
  const statusMatch = area.match(/\b(Offplan|Ready)\b\s*$/i);
  if (statusMatch) {
    status = statusMatch[1]!.toLowerCase() as "offplan" | "ready";
    area = area.slice(0, statusMatch.index).trim();
  }

  return {
    building: building || null,
    area: area || null,
    propertyType,
    status,
    floor,
    unit,
  };
}

// Sale price cell example:
//   "AED 1,724,999 (-) AED 4,563 /sqft"                  — no prior sale
//   "AED 3,200,000 (+14%) AED 2,100 /sqft"               — 14% gain
//   "AED 1,500,000 (-3.5%) AED 1,800 /sqft"              — 3.5% loss
function parseSalePrice(raw: string): {
  price: number | null;
  pricePerSqft: number | null;
  capitalGainPct: number | null;
} {
  const aedMatches = raw.match(/AED\s+([\d,]+(?:\.\d+)?)/gi) ?? [];
  const price = aedMatches[0] ? parseNumber(aedMatches[0]) : null;
  const pricePerSqft = aedMatches[1] ? parseNumber(aedMatches[1]) : null;
  const gainMatch = raw.match(/\(([+-]?\d+(?:\.\d+)?)%\)/);
  const capitalGainPct = gainMatch ? parseFloat(gainMatch[1]!) : null;
  return { price, pricePerSqft, capitalGainPct };
}

// Sale specs cell example: "378 sqft Studio" / "1,259 sqft 2 Beds"
function parseSaleSpecs(raw: string): { sizeSqft: number | null; rooms: string | null } {
  const sizeMatch = raw.match(/([\d,]+(?:\.\d+)?)\s*sqft/i);
  const sizeSqft = sizeMatch ? parseNumber(sizeMatch[1]!) : null;
  const roomsMatch = raw.replace(/[\d,]+(?:\.\d+)?\s*sqft/i, "").trim();
  return { sizeSqft, rooms: roomsMatch || null };
}

// Sale date cell example: "14, Apr 2026 Developer" / "14, Apr 2026 Owner"
function parseSaleDate(raw: string): {
  date: string | null;
  soldBy: "developer" | "owner" | null;
} {
  const m = raw.match(/^(\d{1,2},?\s*\w{3}\s+\d{4})\s*(.*)$/);
  if (!m) return { date: raw.trim() || null, soldBy: null };
  const sellerRaw = m[2]!.trim().toLowerCase();
  const soldBy: "developer" | "owner" | null =
    sellerRaw === "developer" ? "developer" : sellerRaw === "owner" ? "owner" : null;
  return { date: m[1]!.trim(), soldBy };
}

// Rent location cell example:
//   "Peninsula One, Business Bay Apartment , Floor No. 24 , Unit No 2404"
//   "Jabal Ali First Apartment , Floor No. 2 , Unit No"
function parseRentLocation(raw: string): {
  building: string | null;
  area: string | null;
  propertyType: string | null;
  floor: string | null;
  unit: string | null;
} {
  let cleaned = raw.trim();

  let unit: string | null = null;
  const unitMatch = cleaned.match(/,\s*Unit No\.?\s*([^,]*?)$/i);
  if (unitMatch) {
    const val = unitMatch[1]!.trim();
    unit = val || null;
    cleaned = cleaned.slice(0, unitMatch.index).trim();
  }

  let floor: string | null = null;
  const floorMatch = cleaned.match(/,\s*Floor No\.?\s*([^,]+?)$/i);
  if (floorMatch) {
    floor = floorMatch[1]!.trim();
    cleaned = cleaned.slice(0, floorMatch.index).trim();
  }

  const typeMatch = cleaned.match(
    /\b(Apartment|Villa|Townhouse|Penthouse|Office|Hotel Apartment|Shop|Land|Building)\b/i,
  );
  let propertyType: string | null = null;
  let beforeType = cleaned;
  if (typeMatch) {
    propertyType = typeMatch[1]!;
    beforeType = cleaned.slice(0, typeMatch.index).trim().replace(/,\s*$/, "").trim();
  }

  const commaIdx = beforeType.indexOf(",");
  let building: string | null = null;
  let area: string | null = null;
  if (commaIdx >= 0) {
    building = beforeType.slice(0, commaIdx).trim();
    area = beforeType.slice(commaIdx + 1).trim();
  } else {
    area = beforeType;
  }
  return {
    building: building || null,
    area: area || null,
    propertyType,
    floor,
    unit,
  };
}

// Rent specs cell example: "2 Beds 915 sqft"
function parseRentSpecs(raw: string): { sizeSqft: number | null; rooms: string | null } {
  const sizeMatch = raw.match(/([\d,]+(?:\.\d+)?)\s*sqft/i);
  const sizeSqft = sizeMatch ? parseNumber(sizeMatch[1]!) : null;
  const rooms = raw.replace(/([\d,]+(?:\.\d+)?)\s*sqft/i, "").trim();
  return { sizeSqft, rooms: rooms || null };
}

// Rent rental cell example:
//   "150,000 +9.93% Rental Yield based on the latest Purchase price. +9.93% New"
//   "72,765 Renewed"
function parseRentAmount(raw: string): { price: number | null; rentalYield: string | null } {
  const price = parseNumber(raw.split(/\s+/)[0] ?? "");
  const yieldMatch = raw.match(/([+-]?\d+(?:\.\d+)?%)\s*Rental Yield/i);
  return { price, rentalYield: yieldMatch ? yieldMatch[1]! : null };
}

// ── Main scrape ─────────────────────────────────────────────────────

export async function scrapeDxbTransactions(opts: {
  area?: string;
  building?: string;
  transactionType?: string;
  days?: number;
  limit?: number;
}): Promise<ScrapeResult> {
  const wantedType = (opts.transactionType ?? "sales").toLowerCase();
  const limit = opts.limit ?? 50;
  const start = Date.now();

  const attemptOnce = async (): Promise<
    Array<{ type: "sale" | "rent"; cells: string[] }>
  > => {
    const browser = await launchBrowser();
    try {
      const ctx = await browser.newContext({
        userAgent: UA,
        viewport: { width: 1440, height: 900 },
        locale: "en-GB",
      });
      try {
        return await runScrape(ctx, wantedType);
      } finally {
        await ctx.close().catch(() => {});
      }
    } finally {
      await browser.close().catch(() => {});
    }
  };

  const MAX_ATTEMPTS = 2;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const rawRows = await attemptOnce();
      return finalize(rawRows, opts, start);
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    results: [],
    area: opts.area,
    message: `DXB Interact scrape failed after ${MAX_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}. Is Chromium installed? Run: pnpm exec playwright install chromium`,
    scrapedAt: new Date().toISOString(),
  };
}

async function runScrape(
  ctx: import("playwright").BrowserContext,
  wantedType: string,
): Promise<Array<{ type: "sale" | "rent"; cells: string[] }>> {
  const page = await ctx.newPage();
  await page.goto("https://dxbinteract.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const wantsRent =
    wantedType === "rentals" ||
    wantedType === "rent" ||
    wantedType === "rents" ||
    wantedType === "all";
  const wantsSale =
    wantedType === "sales" || wantedType === "sale" || wantedType === "all" || wantedType === "";

  // Wait for the required table(s) to populate. APEX loads sales quickly,
  // rentals via a second wwv_flow.ajax call that can lag a few seconds.
  const waitExpr = wantsRent && wantsSale
    ? `!!document.querySelector('#report_table_soldhistory tbody tr') && !!document.querySelector('#report_table_rentHistory tbody tr')`
    : wantsRent
      ? `!!document.querySelector('#report_table_rentHistory tbody tr')`
      : `!!document.querySelector('#report_table_soldhistory tbody tr')`;
  await page.waitForFunction(waitExpr, null, { timeout: 45000 });

  // Let APEX settle.
  await page.waitForTimeout(1500);

  // Always extract both tables, filter by wantedType. String-form evaluate
  // avoids issues with transpilers injecting closure helpers.
  const extractScript = `(() => {
    const out = [];
    const clone = (el) => {
      const c = el.cloneNode(true);
      // Strip visually-hidden elements so their text doesn't leak into cells.
      c.querySelectorAll('.u-hidden, [aria-hidden="true"], script, style').forEach(n => n.remove());
      return c;
    };
    const grab = (id, tag) => {
      const t = document.getElementById(id);
      if (!t) return;
      const rows = t.querySelectorAll('tbody tr');
      for (const tr of rows) {
        const cells = [];
        const tds = tr.querySelectorAll('td');
        for (const td of tds) {
          const c = clone(td);
          cells.push((c.textContent || '').replace(/\\s+/g, ' ').trim());
        }
        out.push({ type: tag, cells });
      }
    };
    grab('report_table_soldhistory', 'sale');
    grab('report_table_rentHistory', 'rent');
    return out;
  })()`;
  const allRows = (await page.evaluate(extractScript)) as Array<{
    type: "sale" | "rent";
    cells: string[];
  }>;

  return allRows.filter((r) => {
    if (wantedType === "all") return true;
    if (wantedType === "sales" || wantedType === "sale") return r.type === "sale";
    if (wantedType === "rentals" || wantedType === "rent" || wantedType === "rents") {
      return r.type === "rent";
    }
    return r.type === "sale";
  });
}

function parseRows(
  rawRows: Array<{ type: "sale" | "rent"; cells: string[] }>,
): DxbTransaction[] {
  return rawRows.map((r) => {
    if (r.type === "sale") {
      const loc = parseSaleLocation(r.cells[0] ?? "");
      const price = parseSalePrice(r.cells[1] ?? "");
      const specs = parseSaleSpecs(r.cells[2] ?? "");
      const date = parseSaleDate(r.cells[3] ?? "");
      return {
        type: "sale",
        building: loc.building,
        area: loc.area,
        propertyType: loc.propertyType,
        status: loc.status,
        floor: loc.floor,
        unit: loc.unit,
        price: price.price,
        pricePerSqft: price.pricePerSqft,
        capitalGainPct: price.capitalGainPct,
        sizeSqft: specs.sizeSqft,
        rooms: specs.rooms,
        date: date.date,
        soldBy: date.soldBy,
        rentalYield: null,
        duration: null,
        purchasePrice: null,
        raw: {
          location: r.cells[0] ?? "",
          priceOrSpecs: r.cells[1] ?? "",
          specsOrDuration: r.cells[2] ?? "",
          dateOrPurchase: r.cells[3] ?? "",
        },
      };
    }
    const loc = parseRentLocation(r.cells[0] ?? "");
    const specs = parseRentSpecs(r.cells[1] ?? "");
    const amount = parseRentAmount(r.cells[2] ?? "");
    return {
      type: "rent",
      building: loc.building,
      area: loc.area,
      propertyType: loc.propertyType,
      status: null,
      floor: loc.floor,
      unit: loc.unit,
      price: amount.price,
      pricePerSqft: null,
      capitalGainPct: null,
      sizeSqft: specs.sizeSqft,
      rooms: specs.rooms,
      date: null,
      soldBy: null,
      rentalYield: amount.rentalYield,
      duration: r.cells[3] ?? null,
      purchasePrice: r.cells[4] ?? null,
      raw: {
        location: r.cells[0] ?? "",
        priceOrSpecs: r.cells[2] ?? "",
        specsOrDuration: r.cells[1] ?? "",
        dateOrPurchase: r.cells[3] ?? "",
      },
    };
  });
}

function finalize(
  rawRows: Array<{ type: "sale" | "rent"; cells: string[] }>,
  opts: { area?: string; building?: string; limit?: number },
  startMs: number,
): ScrapeResult {
  const parsed = parseRows(rawRows);
  const areaFilter = opts.area?.toLowerCase();
  const buildingFilter = opts.building?.toLowerCase();
  const filtered = parsed.filter((t) => {
    if (areaFilter) {
      const inArea =
        (t.area && t.area.toLowerCase().includes(areaFilter)) ||
        (t.building && t.building.toLowerCase().includes(areaFilter));
      if (!inArea) return false;
    }
    if (buildingFilter) {
      if (!t.building || !t.building.toLowerCase().includes(buildingFilter)) return false;
    }
    return true;
  });
  const results = filtered.slice(0, opts.limit ?? 50);
  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  const msg = opts.area
    ? `Scraped ${parsed.length} latest transactions from DXB Interact, ${results.length} matched area "${opts.area}" (${elapsedSec}s).`
    : `Scraped ${results.length} latest transactions from DXB Interact (${elapsedSec}s).`;
  return {
    results,
    area: opts.area,
    message: msg,
    scrapedAt: new Date().toISOString(),
  };
}
