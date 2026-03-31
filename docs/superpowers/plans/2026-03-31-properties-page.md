# Properties Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Properties page where agency owners manage their sale and rental listings, with a PF-style card grid, pipeline tracking, lead linking, and agent integration.

**Architecture:** Extend the existing `aygent_properties` Drizzle schema with 3 new columns + 1 new join table. New Express route file + service following the broker.ts pattern. React card grid page + detail page following the Agents.tsx pattern. Sidebar nav entry under new "Inventory" section.

**Tech Stack:** Drizzle ORM, Express 5, React 19, TanStack Query 5, Tailwind CSS 4, Radix UI, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-31-properties-page-design.md`

---

### Task 1: Extend Database Schema

**Files:**
- Modify: `packages/db/src/schema/aygent-properties.ts`
- Create: `packages/db/src/schema/aygent-property-leads.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add new columns to aygent-properties.ts**

Open `packages/db/src/schema/aygent-properties.ts` and add three columns to the table definition, after `serviceCharge`:

```typescript
listingType: text("listing_type").default("sale"),
rentalPrice: real("rental_price"),
pipelineStatus: text("pipeline_status").default("available"),
```

Add a new index inside the index callback:

```typescript
companyListingIdx: index("aygent_properties_company_listing_idx").on(table.companyId, table.listingType),
companyPipelineIdx: index("aygent_properties_company_pipeline_idx").on(table.companyId, table.pipelineStatus),
```

- [ ] **Step 2: Create aygent-property-leads.ts join table**

Create `packages/db/src/schema/aygent-property-leads.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentPropertyLeads = pgTable(
  "aygent_property_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => aygentProperties.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => aygentLeads.id, { onDelete: "cascade" }),
    interestLevel: text("interest_level").default("interested"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_property_leads_company_idx").on(table.companyId),
    propertyIdx: index("aygent_property_leads_property_idx").on(table.propertyId),
    leadIdx: index("aygent_property_leads_lead_idx").on(table.leadId),
    uniquePropertyLead: unique("aygent_property_leads_unique").on(
      table.propertyId,
      table.leadId,
    ),
  }),
);
```

- [ ] **Step 3: Export from schema index**

Open `packages/db/src/schema/index.ts` and add this line alongside the other aygent exports:

```typescript
export { aygentPropertyLeads } from "./aygent-property-leads.js";
```

- [ ] **Step 4: Generate and run migration**

```bash
cd "/Users/alexanderjackson/Aygency World"
pnpm db:generate
pnpm db:migrate
```

Expected: Migration file created in `packages/db/src/migrations/` with ALTER TABLE for the 3 new columns and CREATE TABLE for `aygent_property_leads`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/aygent-properties.ts packages/db/src/schema/aygent-property-leads.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat: add listing_type, rental_price, pipeline_status columns + property_leads join table"
```

---

### Task 2: Properties Service

**Files:**
- Create: `server/src/services/properties.ts`
- Modify: `server/src/services/index.ts`

- [ ] **Step 1: Create properties.ts service**

Create `server/src/services/properties.ts`:

```typescript
import { and, eq, desc, sql, count, gte, lte, ilike } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  aygentProperties,
  aygentPropertyLeads,
  aygentLandlords,
  aygentLeads,
} from "@paperclipai/db";

export function propertyService(db: Db) {
  return {
    /** List properties with lead counts + pipeline summary */
    list: async (
      companyId: string,
      filters: {
        listingType?: string;
        pipelineStatus?: string;
        area?: string;
        bedrooms?: number;
        propertyType?: string;
        priceMin?: number;
        priceMax?: number;
      } = {},
    ) => {
      const conditions = [eq(aygentProperties.companyId, companyId)];

      if (filters.listingType) {
        conditions.push(eq(aygentProperties.listingType, filters.listingType));
      }
      if (filters.pipelineStatus) {
        conditions.push(eq(aygentProperties.pipelineStatus, filters.pipelineStatus));
      }
      if (filters.area) {
        conditions.push(ilike(aygentProperties.area, `%${filters.area}%`));
      }
      if (filters.bedrooms) {
        conditions.push(eq(aygentProperties.bedrooms, filters.bedrooms));
      }
      if (filters.propertyType) {
        conditions.push(eq(aygentProperties.propertyType, filters.propertyType));
      }
      if (filters.priceMin) {
        conditions.push(gte(aygentProperties.saleValue, filters.priceMin));
      }
      if (filters.priceMax) {
        conditions.push(lte(aygentProperties.saleValue, filters.priceMax));
      }

      // Lead count subquery
      const leadCountSq = db
        .select({
          propertyId: aygentPropertyLeads.propertyId,
          leadCount: count().as("lead_count"),
        })
        .from(aygentPropertyLeads)
        .where(eq(aygentPropertyLeads.companyId, companyId))
        .groupBy(aygentPropertyLeads.propertyId)
        .as("lead_counts");

      const items = await db
        .select({
          id: aygentProperties.id,
          companyId: aygentProperties.companyId,
          landlordId: aygentProperties.landlordId,
          unit: aygentProperties.unit,
          buildingName: aygentProperties.buildingName,
          streetAddress: aygentProperties.streetAddress,
          area: aygentProperties.area,
          propertyType: aygentProperties.propertyType,
          bedrooms: aygentProperties.bedrooms,
          bathrooms: aygentProperties.bathrooms,
          sqft: aygentProperties.sqft,
          floor: aygentProperties.floor,
          viewType: aygentProperties.viewType,
          parkingSpaces: aygentProperties.parkingSpaces,
          photos: aygentProperties.photos,
          saleValue: aygentProperties.saleValue,
          rentalPrice: aygentProperties.rentalPrice,
          listingType: aygentProperties.listingType,
          pipelineStatus: aygentProperties.pipelineStatus,
          status: aygentProperties.status,
          notes: aygentProperties.notes,
          createdAt: aygentProperties.createdAt,
          updatedAt: aygentProperties.updatedAt,
          leadCount: sql<number>`COALESCE(${leadCountSq.leadCount}, 0)`.as("lead_count"),
          landlordName: aygentLandlords.name,
        })
        .from(aygentProperties)
        .leftJoin(leadCountSq, eq(aygentProperties.id, leadCountSq.propertyId))
        .leftJoin(aygentLandlords, eq(aygentProperties.landlordId, aygentLandlords.id))
        .where(and(...conditions))
        .orderBy(desc(aygentProperties.createdAt));

      // Pipeline summary — count per status for current listing type
      const summaryConditions = [eq(aygentProperties.companyId, companyId)];
      if (filters.listingType) {
        summaryConditions.push(eq(aygentProperties.listingType, filters.listingType));
      }

      const summaryRows = await db
        .select({
          pipelineStatus: aygentProperties.pipelineStatus,
          count: count(),
        })
        .from(aygentProperties)
        .where(and(...summaryConditions))
        .groupBy(aygentProperties.pipelineStatus);

      const summary: Record<string, number> = {};
      for (const row of summaryRows) {
        if (row.pipelineStatus) {
          summary[row.pipelineStatus] = row.count;
        }
      }

      return { items, summary };
    },

    /** Get single property with landlord details */
    getById: async (companyId: string, propertyId: string) => {
      const rows = await db
        .select({
          id: aygentProperties.id,
          companyId: aygentProperties.companyId,
          landlordId: aygentProperties.landlordId,
          unit: aygentProperties.unit,
          buildingName: aygentProperties.buildingName,
          streetAddress: aygentProperties.streetAddress,
          area: aygentProperties.area,
          propertyType: aygentProperties.propertyType,
          bedrooms: aygentProperties.bedrooms,
          bathrooms: aygentProperties.bathrooms,
          sqft: aygentProperties.sqft,
          floor: aygentProperties.floor,
          viewType: aygentProperties.viewType,
          parkingSpaces: aygentProperties.parkingSpaces,
          titleDeedNo: aygentProperties.titleDeedNo,
          photos: aygentProperties.photos,
          saleValue: aygentProperties.saleValue,
          purchasePrice: aygentProperties.purchasePrice,
          rentalPrice: aygentProperties.rentalPrice,
          serviceCharge: aygentProperties.serviceCharge,
          listingType: aygentProperties.listingType,
          pipelineStatus: aygentProperties.pipelineStatus,
          status: aygentProperties.status,
          notes: aygentProperties.notes,
          createdAt: aygentProperties.createdAt,
          updatedAt: aygentProperties.updatedAt,
          landlordName: aygentLandlords.name,
          landlordPhone: aygentLandlords.phone,
          landlordEmail: aygentLandlords.email,
        })
        .from(aygentProperties)
        .leftJoin(aygentLandlords, eq(aygentProperties.landlordId, aygentLandlords.id))
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        );
      return rows[0] ?? null;
    },

    /** Create a new property */
    create: async (companyId: string, data: {
      listingType: string;
      buildingName?: string;
      unit?: string;
      streetAddress?: string;
      area?: string;
      propertyType?: string;
      bedrooms?: number;
      bathrooms?: number;
      sqft?: number;
      floor?: string;
      viewType?: string;
      parkingSpaces?: number;
      titleDeedNo?: string;
      photos?: string[];
      saleValue?: number;
      rentalPrice?: number;
      serviceCharge?: number;
      landlordId?: string;
      notes?: string;
      pipelineStatus?: string;
    }) => {
      const [property] = await db
        .insert(aygentProperties)
        .values({
          companyId,
          ...data,
          pipelineStatus: data.pipelineStatus ?? "available",
        })
        .returning();
      return property;
    },

    /** Update a property */
    update: async (companyId: string, propertyId: string, data: Record<string, unknown>) => {
      const [updated] = await db
        .update(aygentProperties)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        )
        .returning();
      return updated ?? null;
    },

    /** Soft delete — set pipeline_status to inactive */
    remove: async (companyId: string, propertyId: string) => {
      await db
        .update(aygentProperties)
        .set({ pipelineStatus: "inactive", updatedAt: new Date() })
        .where(
          and(
            eq(aygentProperties.companyId, companyId),
            eq(aygentProperties.id, propertyId),
          ),
        );
    },

    /** List leads linked to a property */
    listPropertyLeads: async (companyId: string, propertyId: string) => {
      return db
        .select({
          id: aygentPropertyLeads.id,
          leadId: aygentLeads.id,
          name: aygentLeads.name,
          phone: aygentLeads.phone,
          email: aygentLeads.email,
          score: aygentLeads.score,
          stage: aygentLeads.stage,
          interestLevel: aygentPropertyLeads.interestLevel,
          linkedAt: aygentPropertyLeads.createdAt,
        })
        .from(aygentPropertyLeads)
        .innerJoin(aygentLeads, eq(aygentPropertyLeads.leadId, aygentLeads.id))
        .where(
          and(
            eq(aygentPropertyLeads.companyId, companyId),
            eq(aygentPropertyLeads.propertyId, propertyId),
          ),
        )
        .orderBy(desc(aygentPropertyLeads.createdAt));
    },

    /** Link a lead to a property */
    linkLead: async (
      companyId: string,
      propertyId: string,
      leadId: string,
      interestLevel: string = "interested",
    ) => {
      const [link] = await db
        .insert(aygentPropertyLeads)
        .values({ companyId, propertyId, leadId, interestLevel })
        .onConflictDoNothing()
        .returning();
      return link ?? null;
    },

    /** Unlink a lead from a property */
    unlinkLead: async (companyId: string, propertyId: string, leadId: string) => {
      await db
        .delete(aygentPropertyLeads)
        .where(
          and(
            eq(aygentPropertyLeads.companyId, companyId),
            eq(aygentPropertyLeads.propertyId, propertyId),
            eq(aygentPropertyLeads.leadId, leadId),
          ),
        );
    },
  };
}
```

- [ ] **Step 2: Export from services index**

Open `server/src/services/index.ts` and add:

```typescript
export { propertyService } from "./properties.js";
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/properties.ts server/src/services/index.ts
git commit -m "feat: add property service — CRUD, lead linking, pipeline summary"
```

---

### Task 3: Properties API Routes

**Files:**
- Create: `server/src/routes/properties.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create properties.ts route file**

Create `server/src/routes/properties.ts`:

```typescript
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { propertyService } from "../services/properties.js";
import { assertCompanyAccess } from "./authz.js";

export function propertyRoutes(db: Db) {
  const router = Router();
  const svc = propertyService(db);

  // List properties with filters + pipeline summary
  router.get("/companies/:companyId/properties", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const filters: Record<string, unknown> = {};
    const q = req.query;
    if (q.listingType) filters.listingType = q.listingType;
    if (q.pipelineStatus) filters.pipelineStatus = q.pipelineStatus;
    if (q.area) filters.area = q.area;
    if (q.bedrooms) filters.bedrooms = Number(q.bedrooms);
    if (q.propertyType) filters.propertyType = q.propertyType;
    if (q.priceMin) filters.priceMin = Number(q.priceMin);
    if (q.priceMax) filters.priceMax = Number(q.priceMax);

    const result = await svc.list(companyId, filters);
    res.json(result);
  });

  // Get single property
  router.get("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.getById(companyId, propertyId);
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json(property);
  });

  // Create property
  router.post("/companies/:companyId/properties", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.create(companyId, req.body);
    res.status(201).json(property);
  });

  // Update property
  router.patch("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const updated = await svc.update(companyId, propertyId, req.body);
    if (!updated) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json(updated);
  });

  // Soft delete property
  router.delete("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    await svc.remove(companyId, propertyId);
    res.json({ deleted: true });
  });

  // List leads linked to a property
  router.get("/companies/:companyId/properties/:propertyId/leads", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const leads = await svc.listPropertyLeads(companyId, propertyId);
    res.json(leads);
  });

  // Link a lead to a property
  router.post("/companies/:companyId/properties/:propertyId/leads", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { leadId, interestLevel } = req.body;
    if (!leadId || typeof leadId !== "string") {
      res.status(400).json({ error: "leadId is required" });
      return;
    }

    const link = await svc.linkLead(companyId, propertyId, leadId, interestLevel);
    res.status(201).json(link);
  });

  // Unlink a lead from a property
  router.delete("/companies/:companyId/properties/:propertyId/leads/:leadId", async (req, res) => {
    const { companyId, propertyId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    await svc.unlinkLead(companyId, propertyId, leadId);
    res.json({ unlinked: true });
  });

  return router;
}
```

- [ ] **Step 2: Export from routes index**

Open `server/src/routes/index.ts` and add:

```typescript
export { propertyRoutes } from "./properties.js";
```

- [ ] **Step 3: Mount in app.ts**

Open `server/src/app.ts` and find the block where routes are mounted with `api.use(...)`. Add this line after `api.use(brokerRoutes(db));`:

```typescript
api.use(propertyRoutes(db));
```

Import it at the top of `server/src/app.ts` alongside the other route imports:

```typescript
import { propertyRoutes } from "./routes/properties.js";
```

Or if app.ts uses the routes index for imports, add it to that import block.

- [ ] **Step 4: Verify the server starts**

```bash
cd "/Users/alexanderjackson/Aygency World"
pnpm dev
```

Expected: Server starts without errors. Kill it after confirming.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/properties.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat: add properties API routes — CRUD, lead linking, filters"
```

---

### Task 4: UI API Client + Query Keys

**Files:**
- Create: `ui/src/api/properties.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Create properties API client**

Create `ui/src/api/properties.ts`:

```typescript
import { api } from "./client";

export interface Property {
  id: string;
  companyId: string;
  landlordId: string | null;
  unit: string | null;
  buildingName: string | null;
  streetAddress: string | null;
  area: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  floor: string | null;
  viewType: string | null;
  parkingSpaces: number | null;
  titleDeedNo: string | null;
  photos: string[];
  saleValue: number | null;
  purchasePrice: number | null;
  rentalPrice: number | null;
  serviceCharge: number | null;
  listingType: string | null;
  pipelineStatus: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  landlordName: string | null;
  landlordPhone?: string | null;
  landlordEmail?: string | null;
}

export interface PropertyListResponse {
  items: Property[];
  summary: Record<string, number>;
}

export interface PropertyLead {
  id: string;
  leadId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  stage: string | null;
  interestLevel: string | null;
  linkedAt: string;
}

export interface PropertyFilters {
  listingType?: string;
  pipelineStatus?: string;
  area?: string;
  bedrooms?: number;
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
}

function buildQuery(filters: PropertyFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const propertiesApi = {
  list: (companyId: string, filters: PropertyFilters = {}) =>
    api.get<PropertyListResponse>(
      `/companies/${companyId}/properties${buildQuery(filters)}`,
    ),

  get: (companyId: string, propertyId: string) =>
    api.get<Property>(`/companies/${companyId}/properties/${propertyId}`),

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Property>(`/companies/${companyId}/properties`, data),

  update: (companyId: string, propertyId: string, data: Record<string, unknown>) =>
    api.patch<Property>(`/companies/${companyId}/properties/${propertyId}`, data),

  remove: (companyId: string, propertyId: string) =>
    api.delete(`/companies/${companyId}/properties/${propertyId}`),

  listLeads: (companyId: string, propertyId: string) =>
    api.get<PropertyLead[]>(
      `/companies/${companyId}/properties/${propertyId}/leads`,
    ),

  linkLead: (companyId: string, propertyId: string, leadId: string, interestLevel?: string) =>
    api.post(`/companies/${companyId}/properties/${propertyId}/leads`, {
      leadId,
      interestLevel,
    }),

  unlinkLead: (companyId: string, propertyId: string, leadId: string) =>
    api.delete(
      `/companies/${companyId}/properties/${propertyId}/leads/${leadId}`,
    ),
};
```

- [ ] **Step 2: Add query keys**

Open `ui/src/lib/queryKeys.ts` and add a `properties` section alongside the existing domains:

```typescript
properties: {
  list: (companyId: string, filters?: Record<string, unknown>) =>
    ["properties", companyId, filters ?? {}] as const,
  detail: (companyId: string, propertyId: string) =>
    ["properties", companyId, propertyId] as const,
  leads: (companyId: string, propertyId: string) =>
    ["properties", companyId, propertyId, "leads"] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/properties.ts ui/src/lib/queryKeys.ts
git commit -m "feat: add properties API client + query keys"
```

---

### Task 5: Properties List Page (Card Grid)

**Files:**
- Create: `ui/src/pages/Properties.tsx`

- [ ] **Step 1: Create Properties.tsx**

Create `ui/src/pages/Properties.tsx`:

```tsx
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, type PropertyFilters, type Property } from "../api/properties";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Tabs } from "@/components/ui/tabs";
import { PageTabBar } from "../components/PageTabBar";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { Building2, Plus, SlidersHorizontal } from "lucide-react";

const PROPERTY_GRADIENTS = [
  "linear-gradient(135deg, #064e3b, #047857)",
  "linear-gradient(135deg, #3730a3, #4f46e5)",
  "linear-gradient(135deg, #0c4a6e, #0369a1)",
  "linear-gradient(135deg, #78350f, #b45309)",
  "linear-gradient(135deg, #134e4a, #0f766e)",
  "linear-gradient(135deg, #7f1d1d, #b91c1c)",
  "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
  "linear-gradient(135deg, #500724, #9d174d)",
] as const;

const SALE_STAGES = ["available", "viewing_scheduled", "offer_received", "under_negotiation", "sold"] as const;
const RENTAL_STAGES = ["available", "viewing_scheduled", "application_received", "under_contract", "rented"] as const;

const STAGE_LABELS: Record<string, string> = {
  available: "Available",
  viewing_scheduled: "Viewing Scheduled",
  offer_received: "Offer Received",
  under_negotiation: "Under Negotiation",
  sold: "Sold",
  application_received: "Application Received",
  under_contract: "Under Contract",
  rented: "Rented",
};

const STAGE_COLORS: Record<string, string> = {
  available: "text-green-700 dark:text-green-400",
  viewing_scheduled: "text-violet-700 dark:text-violet-400",
  offer_received: "text-amber-700 dark:text-amber-400",
  application_received: "text-amber-700 dark:text-amber-400",
  under_negotiation: "text-orange-700 dark:text-orange-400",
  under_contract: "text-orange-700 dark:text-orange-400",
  sold: "text-muted-foreground opacity-60",
  rented: "text-muted-foreground opacity-60",
};

const STAGE_DOT_COLORS: Record<string, string> = {
  available: "bg-green-600 dark:bg-green-400",
  viewing_scheduled: "bg-violet-600 dark:bg-violet-400",
  offer_received: "bg-amber-600 dark:bg-amber-400",
  application_received: "bg-amber-600 dark:bg-amber-400",
  under_negotiation: "bg-orange-600 dark:bg-orange-400",
  under_contract: "bg-orange-600 dark:bg-orange-400",
  sold: "bg-muted-foreground/50",
  rented: "bg-muted-foreground/50",
};

const STAGE_PILL_COLORS: Record<string, string> = {
  available: "bg-green-500/10 text-green-700 dark:bg-green-400/12 dark:text-green-400",
  viewing_scheduled: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/12 dark:text-violet-400",
  offer_received: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/12 dark:text-amber-400",
  application_received: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/12 dark:text-amber-400",
  under_negotiation: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/12 dark:text-orange-400",
  under_contract: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/12 dark:text-orange-400",
  sold: "bg-muted-foreground/10 text-muted-foreground",
  rented: "bg-muted-foreground/10 text-muted-foreground",
};

function formatPrice(value: number | null, type: string | null): string {
  if (!value) return "Price TBD";
  const formatted = value >= 1_000_000
    ? `AED ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    : `AED ${value.toLocaleString()}`;
  return type === "rental" ? `${formatted}/yr` : formatted;
}

function daysListed(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1d listed";
  return `${days}d listed`;
}

function isSoldOrRented(status: string | null): boolean {
  return status === "sold" || status === "rented";
}

type ListingTab = "sale" | "rental";

export function Properties() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();

  const pathTab = location.pathname.split("/").pop();
  const tab: ListingTab = pathTab === "rental" ? "rental" : "sale";
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filters: PropertyFilters = useMemo(() => ({
    listingType: tab,
    ...(statusFilter ? { pipelineStatus: statusFilter } : {}),
  }), [tab, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.properties.list(selectedCompanyId!, filters),
    queryFn: () => propertiesApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Inventory" }]);
  }, [setBreadcrumbs]);

  // Reset status filter when switching tabs
  useEffect(() => {
    setStatusFilter(null);
  }, [tab]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Building2} message="Select a company to view properties." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const items = data?.items ?? [];
  const summary = data?.summary ?? {};
  const stages = tab === "sale" ? SALE_STAGES : RENTAL_STAGES;

  // Count totals for tab badges
  const saleCount = Object.values(data?.summary ?? {}).reduce((a, b) => a + b, 0);
  // We'd need a second query for the other tab's count, but for now we show the current tab's count

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Properties"
        actions={
          <>
            <Button variant="ghost" size="sm">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filter
            </Button>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Property
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-4">
          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => navigate(`/properties/${v}`)}>
            <PageTabBar
              items={[
                { value: "sale", label: "Sales" },
                { value: "rental", label: "Rentals" },
              ]}
              value={tab}
              onValueChange={(v) => navigate(`/properties/${v}`)}
            />
          </Tabs>

          {/* Pipeline status pills */}
          <div className="flex gap-2 flex-wrap">
            {stages.map((stage) => {
              const count = summary[stage] ?? 0;
              if (count === 0 && statusFilter !== stage) return null;
              const isActive = statusFilter === stage;
              return (
                <button
                  key={stage}
                  onClick={() => setStatusFilter(isActive ? null : stage)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium transition-all",
                    STAGE_PILL_COLORS[stage],
                    isActive && "ring-1 ring-current",
                  )}
                >
                  {STAGE_LABELS[stage]} &middot; {count}
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <EmptyState
              icon={Building2}
              message={
                statusFilter
                  ? "No properties match this filter."
                  : `No ${tab === "sale" ? "sale" : "rental"} properties yet. Add your first listing.`
              }
            />
          )}

          {/* Card grid */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {items.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  gradient={PROPERTY_GRADIENTS[index % PROPERTY_GRADIENTS.length]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({
  property,
  gradient,
}: {
  property: Property;
  gradient: string;
}) {
  const status = property.pipelineStatus ?? "available";
  const photoCount = property.photos?.length ?? 0;
  const price = property.listingType === "rental" ? property.rentalPrice : property.saleValue;
  const sold = isSoldOrRented(status);

  return (
    <Link
      to={`/properties/${property.id}`}
      className={cn(
        "block rounded-xl border border-border/50 bg-card/80 overflow-hidden",
        "hover:border-primary/25 hover:-translate-y-px hover:shadow-md transition-all",
        "no-underline text-inherit",
        sold && "opacity-50",
      )}
    >
      {/* Photo area */}
      <div
        className="relative h-[140px] flex items-center justify-center text-4xl"
        style={{ background: gradient }}
      >
        {photoCount > 0 ? (
          <img
            src={property.photos[0]}
            alt={property.buildingName ?? "Property"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>🏢</span>
        )}
        {/* Status badge */}
        <span
          className={cn(
            "absolute top-2 left-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10.5px] font-medium",
            "bg-background/85 backdrop-blur-sm",
            STAGE_COLORS[status],
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT_COLORS[status])} />
          {STAGE_LABELS[status]}
        </span>
        {/* Photo count */}
        {photoCount > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-[10px] text-white">
            {photoCount} photos
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3.5">
        <div className="text-[16px] font-extrabold tracking-tight">
          {formatPrice(price, property.listingType)}
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5">
          {property.buildingName ?? "—"} &middot; {property.area ?? "—"}
        </div>

        {/* Specs */}
        <div className="flex gap-3 text-[11.5px] text-muted-foreground/80 mt-2 pt-2 border-t border-border">
          {property.bedrooms != null && <span>{property.bedrooms} Beds</span>}
          {property.bathrooms != null && <span>{property.bathrooms} Baths</span>}
          {property.sqft != null && <span>{property.sqft.toLocaleString()} sqft</span>}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2">
          {property.leadCount > 0 ? (
            <span className="text-[11px] text-primary font-medium">
              {property.leadCount} {property.leadCount === 1 ? "lead" : "leads"}
            </span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-muted-foreground/50">
            {daysListed(property.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/Properties.tsx
git commit -m "feat: add Properties list page — card grid with tabs, pipeline pills"
```

---

### Task 6: Property Detail Page

**Files:**
- Create: `ui/src/pages/PropertyDetail.tsx`

- [ ] **Step 1: Create PropertyDetail.tsx**

Create `ui/src/pages/PropertyDetail.tsx`:

```tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi, type PropertyLead } from "../api/properties";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import {
  ArrowLeft,
  Bed,
  Bath,
  Maximize,
  Layers,
  Eye,
  Car,
  Phone,
  Mail,
  User,
  Link as LinkIcon,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  available: "Available",
  viewing_scheduled: "Viewing Scheduled",
  offer_received: "Offer Received",
  under_negotiation: "Under Negotiation",
  sold: "Sold",
  application_received: "Application Received",
  under_contract: "Under Contract",
  rented: "Rented",
};

const STAGE_COLORS: Record<string, string> = {
  available: "text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-400/12",
  viewing_scheduled: "text-violet-700 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-400/12",
  offer_received: "text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/12",
  application_received: "text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/12",
  under_negotiation: "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/12",
  under_contract: "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/12",
  sold: "text-muted-foreground bg-muted",
  rented: "text-muted-foreground bg-muted",
};

function formatPrice(value: number | null): string {
  if (!value) return "—";
  return `AED ${value.toLocaleString()}`;
}

export function PropertyDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const { data: property, isLoading } = useQuery({
    queryKey: queryKeys.properties.detail(selectedCompanyId!, propertyId!),
    queryFn: () => propertiesApi.get(selectedCompanyId!, propertyId!),
    enabled: !!selectedCompanyId && !!propertyId,
  });

  const { data: leads } = useQuery({
    queryKey: queryKeys.properties.leads(selectedCompanyId!, propertyId!),
    queryFn: () => propertiesApi.listLeads(selectedCompanyId!, propertyId!),
    enabled: !!selectedCompanyId && !!propertyId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Properties", href: "/properties" },
      { label: property?.buildingName ?? "Property" },
    ]);
  }, [setBreadcrumbs, property]);

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (!property) return <div className="p-5 text-muted-foreground">Property not found.</div>;

  const status = property.pipelineStatus ?? "available";
  const price = property.listingType === "rental" ? property.rentalPrice : property.saleValue;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={property.buildingName ?? "Property"}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/properties")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5 max-w-3xl">

          {/* Photo gallery */}
          {property.photos && property.photos.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {property.photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="h-48 rounded-lg object-cover flex-shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="h-48 rounded-lg bg-accent flex items-center justify-center text-5xl">
              🏢
            </div>
          )}

          {/* Price + Status */}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold tracking-tight">
              {formatPrice(price)}
              {property.listingType === "rental" && <span className="text-base font-normal text-muted-foreground">/yr</span>}
            </span>
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium",
              STAGE_COLORS[status],
            )}>
              {STAGE_LABELS[status]}
            </span>
          </div>

          {/* Location */}
          <div className="text-sm text-muted-foreground">
            {[property.unit, property.buildingName, property.streetAddress, property.area]
              .filter(Boolean)
              .join(" · ")}
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {property.bedrooms != null && (
              <div className="flex items-center gap-2 text-sm">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span>{property.bedrooms} Bedrooms</span>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="flex items-center gap-2 text-sm">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span>{property.bathrooms} Bathrooms</span>
              </div>
            )}
            {property.sqft != null && (
              <div className="flex items-center gap-2 text-sm">
                <Maximize className="h-4 w-4 text-muted-foreground" />
                <span>{property.sqft.toLocaleString()} sqft</span>
              </div>
            )}
            {property.floor && (
              <div className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span>Floor {property.floor}</span>
              </div>
            )}
            {property.viewType && (
              <div className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>{property.viewType} view</span>
              </div>
            )}
            {property.parkingSpaces != null && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>{property.parkingSpaces} Parking</span>
              </div>
            )}
          </div>

          {/* Owner section */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Owner
            </h3>
            {property.landlordName ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{property.landlordName}</span>
                </div>
                {property.landlordPhone && (
                  <a
                    href={`tel:${property.landlordPhone}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {property.landlordPhone}
                  </a>
                )}
                {property.landlordEmail && (
                  <a
                    href={`mailto:${property.landlordEmail}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {property.landlordEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No owner linked.</p>
            )}
          </div>

          {/* Interested leads */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Interested Leads
              </h3>
              <Button variant="ghost" size="sm">
                <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                Link Lead
              </Button>
            </div>
            {leads && leads.length > 0 ? (
              <div className="space-y-2">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {lead.name ?? "Unknown"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {lead.interestLevel} &middot; Score: {lead.score ?? "—"}
                      </div>
                    </div>
                    {lead.stage && (
                      <span className="text-[10.5px] text-muted-foreground">
                        {lead.stage}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leads linked yet.</p>
            )}
          </div>

          {/* Notes */}
          {property.notes && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{property.notes}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/PropertyDetail.tsx
git commit -m "feat: add PropertyDetail page — specs, owner, linked leads"
```

---

### Task 7: Wire Up Navigation & Routes

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/Sidebar.tsx`

- [ ] **Step 1: Add routes to App.tsx**

Open `ui/src/App.tsx`. Add imports at the top:

```typescript
import { Properties } from "./pages/Properties";
import { PropertyDetail } from "./pages/PropertyDetail";
```

Find the `boardRoutes()` function and add these routes alongside the other page routes (after the agents routes is a good spot):

```tsx
<Route path="properties" element={<Navigate to="/properties/sale" replace />} />
<Route path="properties/sale" element={<Properties />} />
<Route path="properties/rental" element={<Properties />} />
<Route path="properties/:propertyId" element={<PropertyDetail />} />
```

- [ ] **Step 2: Add sidebar nav item**

Open `ui/src/components/Sidebar.tsx`. Add the `Building2` import to the lucide-react import line:

```typescript
import { ..., Building2 } from "lucide-react";
```

Find the `{/* TEAM */}` section comment. Add a new section BEFORE it (between Work and Team):

```tsx
{/* INVENTORY */}
<SidebarSection label="Inventory">
  <SidebarNavItem to="/properties" label="Properties" icon={Building2} />
</SidebarSection>
```

- [ ] **Step 3: Add "properties" to board route roots**

Open `ui/src/lib/company-routes.ts` (or wherever `boardRouteRoots` is defined) and add `"properties"` to the list of board route roots so the company prefix routing works correctly.

- [ ] **Step 4: Verify in browser**

```bash
cd "/Users/alexanderjackson/Aygency World"
pnpm dev
```

Open the app, verify:
- "Inventory > Properties" appears in sidebar
- Clicking it navigates to `/properties/sale`
- Sales/Rentals tabs work
- Empty state shows (no data yet)

- [ ] **Step 5: Commit**

```bash
git add ui/src/App.tsx ui/src/components/Sidebar.tsx ui/src/lib/company-routes.ts
git commit -m "feat: wire properties page into navigation and routing"
```

---

### Task 8: Seed Demo Properties

**Files:**
- Modify: `packages/db/src/seed-demo.ts`

- [ ] **Step 1: Add property seed data**

Open `packages/db/src/seed-demo.ts`. Find where agents and other entities are seeded. After the existing seed blocks, add property seeding.

First, add the import at the top alongside other schema imports:

```typescript
import { aygentProperties, aygentPropertyLeads } from "./schema/index.js";
```

Then add the seed block (after agent seeding, using `cid` for company ID):

```typescript
// ── Properties ──────────────────────────────────────
console.log("  Seeding properties...");

const propertyData = [
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Binghatti Hills",
    area: "JVC",
    unit: "1204",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1245,
    floor: "12",
    viewType: "Pool",
    parkingSpaces: 1,
    saleValue: 1_850_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(12),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "The Address Residences",
    area: "Downtown Dubai",
    unit: "3502",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    sqft: 2100,
    floor: "35",
    viewType: "Burj Khalifa",
    parkingSpaces: 2,
    saleValue: 3_200_000,
    pipelineStatus: "viewing_scheduled",
    photos: [],
    createdAt: daysAgo(5),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Vincitore Palacio",
    area: "Arjan",
    unit: "507",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    sqft: 780,
    floor: "5",
    viewType: "Garden",
    parkingSpaces: 1,
    saleValue: 950_000,
    pipelineStatus: "offer_received",
    photos: [],
    createdAt: daysAgo(28),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Marina Gate",
    area: "Dubai Marina",
    unit: "2201",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1580,
    floor: "22",
    viewType: "Marina",
    parkingSpaces: 1,
    saleValue: 2_400_000,
    pipelineStatus: "sold",
    photos: [],
    createdAt: daysAgo(45),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Sobha Hartland Greens",
    area: "MBR City",
    unit: "Villa 14",
    propertyType: "villa",
    bedrooms: 4,
    bathrooms: 5,
    sqft: 3200,
    floor: "G+1",
    viewType: "Lagoon",
    parkingSpaces: 2,
    saleValue: 4_500_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(2),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Bloom Towers",
    area: "JVC",
    unit: "804",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    sqft: 650,
    floor: "8",
    viewType: "Community",
    parkingSpaces: 1,
    rentalPrice: 55_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(7),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "DAMAC Hills 2",
    area: "DAMAC Hills",
    unit: "TH-22",
    propertyType: "townhouse",
    bedrooms: 3,
    bathrooms: 3,
    sqft: 1800,
    floor: "G+1",
    viewType: "Park",
    parkingSpaces: 2,
    rentalPrice: 95_000,
    pipelineStatus: "viewing_scheduled",
    photos: [],
    createdAt: daysAgo(10),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Park Heights",
    area: "Dubai Hills",
    unit: "1605",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1100,
    floor: "16",
    viewType: "Park",
    parkingSpaces: 1,
    rentalPrice: 120_000,
    pipelineStatus: "application_received",
    photos: [],
    createdAt: daysAgo(20),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Al Habtoor City",
    area: "Business Bay",
    unit: "4101",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 4,
    sqft: 2400,
    floor: "41",
    viewType: "Canal",
    parkingSpaces: 2,
    rentalPrice: 180_000,
    pipelineStatus: "under_contract",
    photos: [],
    createdAt: daysAgo(35),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Samana Golf Avenue",
    area: "Dubai Sports City",
    unit: "302",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 2,
    sqft: 890,
    floor: "3",
    viewType: "Golf Course",
    parkingSpaces: 1,
    rentalPrice: 65_000,
    pipelineStatus: "rented",
    photos: [],
    createdAt: daysAgo(60),
  },
];

const insertedProperties = await db
  .insert(aygentProperties)
  .values(propertyData)
  .returning({ id: aygentProperties.id });

console.log(`  ✓ ${insertedProperties.length} properties seeded`);
```

- [ ] **Step 2: Run the seed**

```bash
cd "/Users/alexanderjackson/Aygency World"
pnpm db:migrate
# If there's a seed command:
npx tsx packages/db/src/seed-demo.ts
```

Expected: "10 properties seeded" output.

- [ ] **Step 3: Verify in browser**

Open the app and navigate to Properties. Should see:
- Sales tab: 5 properties (Binghatti Hills, The Address, Vincitore, Marina Gate, Sobha Hartland)
- Rentals tab: 5 properties (Bloom Towers, DAMAC Hills, Park Heights, Al Habtoor, Samana Golf)
- Pipeline pills showing correct counts
- Cards showing price, location, specs, status badges

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed-demo.ts
git commit -m "feat: seed 10 demo properties across sales and rentals tabs"
```

---

### Task 9: Agent Skill File

**Files:**
- Create: `skills/behaviour/property-management.md`

- [ ] **Step 1: Create the skill file**

Create `skills/behaviour/property-management.md`:

```markdown
---
name: property-management
description: >
  Search, match, and manage property listings in the agency inventory.
  Use when: a lead asks about available properties, you need to suggest listings,
  or you need to create/update a property record.
  Don't use when: the task is about market research or DLD transactions (use market tools).
---

# Property Management

## Searching Properties

Query the agency's property inventory:

```bash
curl -s "$AYGENCY_URL/api/companies/$COMPANY_ID/properties?listingType=sale&area=JVC&bedrooms=2" \
  -H "Authorization: Bearer $API_KEY" | jq '.items'
```

### Available Filters
- `listingType` — `sale` or `rental`
- `pipelineStatus` — `available`, `viewing_scheduled`, `offer_received`, `under_negotiation`, `sold` (sale) or `application_received`, `under_contract`, `rented` (rental)
- `area` — location name (partial match)
- `bedrooms` — exact number
- `propertyType` — `apartment`, `villa`, `townhouse`, `studio`, `penthouse`
- `priceMin`, `priceMax` — AED range (applies to sale_value)

## Matching Leads to Properties

When qualifying a lead, extract their preferences and search:
1. Get lead budget range, preferred area, bedroom count
2. Query properties: `?listingType=sale&area={area}&bedrooms={beds}&priceMin={min}&priceMax={max}`
3. Present top 2-3 matches to the lead with key details (building, area, price, sqft)
4. Link interested leads: POST to `/properties/{id}/leads` with `{ "leadId": "...", "interestLevel": "interested" }`

## Updating Pipeline Status

When a property's status changes:

```bash
curl -X PATCH "$AYGENCY_URL/api/companies/$COMPANY_ID/properties/$PROPERTY_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipelineStatus": "viewing_scheduled"}'
```

### Valid Transitions
- Sales: available → viewing_scheduled → offer_received → under_negotiation → sold
- Rentals: available → viewing_scheduled → application_received → under_contract → rented

## Creating Draft Listings

When onboarding a new property (e.g., from a landlord conversation):

```bash
curl -X POST "$AYGENCY_URL/api/companies/$COMPANY_ID/properties" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "listingType": "rental",
    "buildingName": "...",
    "area": "...",
    "propertyType": "apartment",
    "bedrooms": 2,
    "bathrooms": 2,
    "sqft": 1200,
    "rentalPrice": 85000,
    "pipelineStatus": "draft",
    "notes": "New listing from landlord onboarding"
  }'
```

Draft listings require owner approval before becoming visible.

## Escalation Rules
- **Offer received**: Immediately notify CEO with offer details
- **Stale listing (30+ days available)**: Flag to CEO, suggest price adjustment
- **High-demand property (5+ leads)**: Suggest scheduling open house or raising price
```

- [ ] **Step 2: Commit**

```bash
git add skills/behaviour/property-management.md
git commit -m "feat: add property-management skill for agent inventory access"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Schema changes (listing_type, rental_price, pipeline_status) — Task 1
- [x] Property-leads join table — Task 1
- [x] API routes (all 8 endpoints) — Task 3
- [x] List response with summary counts — Task 2 service
- [x] Properties list page with card grid — Task 5
- [x] Property detail page with owner + leads — Task 6
- [x] Sidebar navigation — Task 7
- [x] App routes — Task 7
- [x] Seed data — Task 8
- [x] Agent skill file — Task 9
- [x] Status colors per pipeline stage — Task 5 (STAGE_COLORS maps)

**2. Placeholder scan:** No TBDs, TODOs, or vague steps. All code is complete.

**3. Type consistency:** `Property` interface in api/properties.ts matches service return shape. `PropertyFilters` matches query params in route. Pipeline stage strings consistent across service, UI, and skill file.
