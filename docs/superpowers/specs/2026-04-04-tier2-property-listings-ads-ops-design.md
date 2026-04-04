# Tier 2: Property Management, Listings, Facebook Ads, Operations & Client Services — Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Scope:** 22 new tools, 5 new DB tables, 7 new skills, 1 new role (operations), 2 new department directories (calling, operations)
**Post-Tier 2 totals:** 103 tools, 37 aygent_* tables, 22 skills, 10 departments

---

## 1. Architecture

Identical to Tier 1. All new tools follow the existing pattern:
- Each tool = a `ToolDefinition` (name, description, input_schema) + a `ToolExecutor` (async function)
- Executors receive `ToolContext` with `companyId`, `agentId`, `db`, `issueId`
- All queries scoped by `companyId` (multi-tenant)
- New DB tables in `packages/db/src/schema/` using Drizzle `pgTable`, exported from `index.ts`
- Tools registered in `packages/tools/src/index.ts` via `allDefinitions` + `allExecutors`
- Role scoping added to `ROLE_TOOLS` in `server/src/mcp-tool-server.ts`
- Deliverables stored via `storeDeliverable()` from `packages/tools/src/lib/deliverables.ts`

No external API dependencies. All tools read/write to Aygency World's own Postgres DB. Facebook Ads tools are stubs that record campaign data locally — real Meta Marketing API integration is Phase 3.

---

## 2. New Database Tables

### 2.1 `aygent_rent_cheques`

Tracks individual rent cheques (PDCs — post-dated cheques) per tenancy. Dubai rentals are commonly paid via 1-12 cheques per year.

```
aygent_rent_cheques
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  tenancy_id      uuid FK → aygent_tenancies.id (cascade)
  
  cheque_number   text NOT NULL — printed cheque number
  amount          integer NOT NULL — cheque amount in AED
  due_date        timestamp NOT NULL — when the cheque should be deposited
  status          text NOT NULL default 'pending'
                  — 'pending' | 'deposited' | 'cleared' | 'bounced'
  
  deposited_date  timestamp — when cheque was deposited at bank
  cleared_date    timestamp — when funds cleared
  bounced_date    timestamp — if cheque bounced
  bank_name       text — issuing bank name
  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (tenancy_id)
  (company_id, due_date)
```

**Drizzle schema file:** `packages/db/src/schema/aygent-rent-cheques.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentTenancies } from "./aygent-tenancies.js";

export const aygentRentCheques = pgTable(
  "aygent_rent_cheques",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    tenancyId: uuid("tenancy_id").notNull().references(() => aygentTenancies.id, { onDelete: "cascade" }),
    chequeNumber: text("cheque_number").notNull(),
    amount: integer("amount").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    depositedDate: timestamp("deposited_date", { withTimezone: true }),
    clearedDate: timestamp("cleared_date", { withTimezone: true }),
    bouncedDate: timestamp("bounced_date", { withTimezone: true }),
    bankName: text("bank_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_rent_cheques_company_status_idx").on(table.companyId, table.status),
    tenancyIdx: index("aygent_rent_cheques_tenancy_idx").on(table.tenancyId),
    companyDueDateIdx: index("aygent_rent_cheques_company_due_date_idx").on(table.companyId, table.dueDate),
  }),
);
```

### 2.2 `aygent_maintenance_requests`

Tracks property maintenance requests from creation to completion.

```
aygent_maintenance_requests
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  property_id     uuid FK → aygent_properties.id (cascade)
  tenancy_id      uuid FK → aygent_tenancies.id (set null) — optional, may be vacant unit
  
  category        text NOT NULL
                  — 'plumbing' | 'electrical' | 'ac' | 'painting' | 'pest' | 'general' | 'other'
  description     text NOT NULL
  priority        text NOT NULL default 'medium'
                  — 'low' | 'medium' | 'high' | 'urgent'
  status          text NOT NULL default 'open'
                  — 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  
  contractor_name  text
  contractor_phone text
  estimated_cost   integer — in AED
  actual_cost      integer — in AED, filled on completion
  assigned_date    timestamp
  completed_date   timestamp
  notes            text

  created_at       timestamp NOT NULL default now()
  updated_at       timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (property_id)
  (company_id, priority)
```

**Drizzle schema file:** `packages/db/src/schema/aygent-maintenance-requests.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";
import { aygentTenancies } from "./aygent-tenancies.js";

export const aygentMaintenanceRequests = pgTable(
  "aygent_maintenance_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull().references(() => aygentProperties.id, { onDelete: "cascade" }),
    tenancyId: uuid("tenancy_id").references(() => aygentTenancies.id, { onDelete: "set null" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    contractorName: text("contractor_name"),
    contractorPhone: text("contractor_phone"),
    estimatedCost: integer("estimated_cost"),
    actualCost: integer("actual_cost"),
    assignedDate: timestamp("assigned_date", { withTimezone: true }),
    completedDate: timestamp("completed_date", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_maintenance_company_status_idx").on(table.companyId, table.status),
    propertyIdx: index("aygent_maintenance_property_idx").on(table.propertyId),
    companyPriorityIdx: index("aygent_maintenance_company_priority_idx").on(table.companyId, table.priority),
  }),
);
```

### 2.3 `aygent_listings`

Tracks property listings managed by the agency — both for sale and for rent.

```
aygent_listings
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  agent_id        uuid FK → agents.id (set null) — listing agent
  
  property_type   text NOT NULL — 'apartment' | 'villa' | 'townhouse' | 'office' | 'shop' | 'land' | 'penthouse'
  listing_type    text NOT NULL — 'sale' | 'rent'
  address         text NOT NULL
  area            text — community/district (e.g. 'JVC', 'Marina', 'Downtown')
  building        text — building/tower name
  unit_number     text
  
  bedrooms        integer — 0 for studio
  bathrooms       integer
  size_sqft       integer
  price           integer NOT NULL — AED (sale price or annual rent)
  
  title           text — listing headline
  description     text — full description
  amenities       jsonb default '[]' — ["pool", "gym", "balcony", "parking"]
  photos          jsonb default '[]' — array of photo URLs
  
  trakheesi_permit text — RERA advertising permit number
  trakheesi_expiry timestamp — permit expiry date
  
  status          text NOT NULL default 'draft'
                  — 'draft' | 'active' | 'featured' | 'rented' | 'sold' | 'expired' | 'withdrawn'
  portal_status   jsonb default '{}'
                  — { "property_finder": "active", "bayut": "pending", "dubizzle": "not_listed" }
  
  view_count      integer default 0
  lead_count      integer default 0
  days_on_market  integer default 0

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (company_id, listing_type)
  (company_id, area)
  (agent_id)
```

**Drizzle schema file:** `packages/db/src/schema/aygent-listings.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentListings = pgTable(
  "aygent_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    propertyType: text("property_type").notNull(),
    listingType: text("listing_type").notNull(),
    address: text("address").notNull(),
    area: text("area"),
    building: text("building"),
    unitNumber: text("unit_number"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    sizeSqft: integer("size_sqft"),
    price: integer("price").notNull(),
    title: text("title"),
    description: text("description"),
    amenities: jsonb("amenities").$type<string[]>().default([]),
    photos: jsonb("photos").$type<string[]>().default([]),
    trakheesiPermit: text("trakheesi_permit"),
    trakheesiExpiry: timestamp("trakheesi_expiry", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    portalStatus: jsonb("portal_status").$type<Record<string, string>>().default({}),
    viewCount: integer("view_count").default(0),
    leadCount: integer("lead_count").default(0),
    daysOnMarket: integer("days_on_market").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_listings_company_status_idx").on(table.companyId, table.status),
    companyListingTypeIdx: index("aygent_listings_company_listing_type_idx").on(table.companyId, table.listingType),
    companyAreaIdx: index("aygent_listings_company_area_idx").on(table.companyId, table.area),
    agentIdx: index("aygent_listings_agent_idx").on(table.agentId),
  }),
);
```

### 2.4 `aygent_fb_campaigns`

Tracks Facebook/Instagram ad campaigns. Stub data only — no Meta API integration yet.

```
aygent_fb_campaigns
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  agent_id        uuid FK → agents.id (set null) — agent who created the campaign
  
  campaign_name   text NOT NULL
  objective       text NOT NULL
                  — 'lead_generation' | 'traffic' | 'engagement' | 'brand_awareness'
  status          text NOT NULL default 'draft'
                  — 'draft' | 'pending_approval' | 'active' | 'paused' | 'completed'
  
  daily_budget    integer — daily budget in AED
  total_budget    integer — lifetime budget in AED
  start_date      timestamp
  end_date        timestamp
  
  targeting_audience  jsonb default '{}'
                      — { "location": "UAE", "age_min": 28, "age_max": 55,
                      —   "interests": ["real estate investment", "dubai property"],
                      —   "nationalities": ["indian", "british", "russian"] }
  placements      jsonb default '[]'
                  — ["facebook_feed", "instagram_feed", "instagram_stories"]
  
  creative_type   text — 'single_image' | 'carousel' | 'video' | 'collection'
  headline        text
  primary_text    text
  description     text
  image_url       text
  
  lead_form_fields jsonb default '[]'
                   — ["full_name", "phone", "email", "budget_range"]
  
  leads           integer default 0 — total leads generated
  spend           integer default 0 — total spend in AED
  impressions     integer default 0
  clicks          integer default 0
  cpl             integer — cost per lead in AED (computed)
  
  approved_at     timestamp
  approved_by     text — user ID who approved
  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (company_id, objective)
  (agent_id)
```

**Drizzle schema file:** `packages/db/src/schema/aygent-fb-campaigns.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentFbCampaigns = pgTable(
  "aygent_fb_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    campaignName: text("campaign_name").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull().default("draft"),
    dailyBudget: integer("daily_budget"),
    totalBudget: integer("total_budget"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    targetingAudience: jsonb("targeting_audience").$type<Record<string, unknown>>().default({}),
    placements: jsonb("placements").$type<string[]>().default([]),
    creativeType: text("creative_type"),
    headline: text("headline"),
    primaryText: text("primary_text"),
    description: text("description"),
    imageUrl: text("image_url"),
    leadFormFields: jsonb("lead_form_fields").$type<string[]>().default([]),
    leads: integer("leads").default(0),
    spend: integer("spend").default(0),
    impressions: integer("impressions").default(0),
    clicks: integer("clicks").default(0),
    cpl: integer("cpl"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_fb_campaigns_company_status_idx").on(table.companyId, table.status),
    companyObjectiveIdx: index("aygent_fb_campaigns_company_objective_idx").on(table.companyId, table.objective),
    agentIdx: index("aygent_fb_campaigns_agent_idx").on(table.agentId),
  }),
);
```

### 2.5 `aygent_golden_visa`

Tracks Golden Visa applications for clients who purchase eligible properties.

```
aygent_golden_visa
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  lead_id         uuid FK → aygent_leads.id (set null) — the client
  deal_id         uuid FK → aygent_deals.id (set null) — the qualifying property purchase
  
  client_name     text NOT NULL
  property_value  integer NOT NULL — AED
  stage           text NOT NULL default 'eligibility_confirmed'
                  — 'eligibility_confirmed' | 'nomination_submitted' | 'medical_scheduled'
                  — | 'medical_completed' | 'biometrics_scheduled' | 'biometrics_completed'
                  — | 'visa_issued'
  
  gdrfa_ref       text — General Directorate of Residency reference number
  medical_date    timestamp
  biometrics_date timestamp
  visa_issue_date timestamp
  visa_expiry_date timestamp
  family_members  jsonb default '[]'
                  — [{ "name": "Ahmed", "relation": "spouse", "status": "pending" }]
  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, stage)
  (lead_id)
  (deal_id)
```

**Drizzle schema file:** `packages/db/src/schema/aygent-golden-visa.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";
import { aygentDeals } from "./aygent-deals.js";

export const aygentGoldenVisa = pgTable(
  "aygent_golden_visa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => aygentDeals.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    propertyValue: integer("property_value").notNull(),
    stage: text("stage").notNull().default("eligibility_confirmed"),
    gdrfaRef: text("gdrfa_ref"),
    medicalDate: timestamp("medical_date", { withTimezone: true }),
    biometricsDate: timestamp("biometrics_date", { withTimezone: true }),
    visaIssueDate: timestamp("visa_issue_date", { withTimezone: true }),
    visaExpiryDate: timestamp("visa_expiry_date", { withTimezone: true }),
    familyMembers: jsonb("family_members").$type<Array<{ name: string; relation: string; status: string }>>().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStageIdx: index("aygent_golden_visa_company_stage_idx").on(table.companyId, table.stage),
    leadIdx: index("aygent_golden_visa_lead_idx").on(table.leadId),
    dealIdx: index("aygent_golden_visa_deal_idx").on(table.dealId),
  }),
);
```

---

## 3. Schema Index Exports

Add to `packages/db/src/schema/index.ts`:

```typescript
export { aygentRentCheques } from "./aygent-rent-cheques.js";
export { aygentMaintenanceRequests } from "./aygent-maintenance-requests.js";
export { aygentListings } from "./aygent-listings.js";
export { aygentFbCampaigns } from "./aygent-fb-campaigns.js";
export { aygentGoldenVisa } from "./aygent-golden-visa.js";
```

---

## 4. Constants Updates

### 4.1 Add `operations` role

In `packages/shared/src/constants.ts`, add `"operations"` to `AGENT_ROLES` array (after `"compliance"`):

```typescript
export const AGENT_ROLES = [
  // ... existing roles ...
  "compliance",
  "operations",
] as const;
```

And add label:

```typescript
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  // ... existing labels ...
  compliance: "Compliance",
  operations: "Operations",
};
```

No new approval types needed — `launch_fb_campaign` already exists.

---

## 5. Tool Definitions & Executors

### 5A. Property Management Tools (`packages/tools/src/property-management.ts`)

#### 5A.1 `track_rent_cheques`

```typescript
export const trackRentChequesDefinition: ToolDefinition = {
  name: "track_rent_cheques",
  description:
    "Track post-dated rent cheques (PDCs) per tenancy. Create cheque records when a tenancy starts, update status as cheques are deposited/cleared/bounced, list upcoming cheques, or check for bounced cheques. Use when managing rent collection or reviewing cheque schedules.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "check_bounced"], description: "Action to perform" },
      chequeId: { type: "string", description: "Cheque ID (for update)" },
      tenancyId: { type: "string", description: "Tenancy ID (required for create, optional filter for list)" },
      chequeNumber: { type: "string", description: "Printed cheque number (required for create)" },
      amount: { type: "number", description: "Cheque amount in AED (required for create)" },
      dueDate: { type: "string", description: "Due date YYYY-MM-DD (required for create)" },
      bankName: { type: "string", description: "Issuing bank name" },
      status: { type: "string", enum: ["pending", "deposited", "cleared", "bounced"], description: "New status (for update) or filter (for list)" },
      depositedDate: { type: "string", description: "Date deposited YYYY-MM-DD (for update)" },
      clearedDate: { type: "string", description: "Date cleared YYYY-MM-DD (for update)" },
      bouncedDate: { type: "string", description: "Date bounced YYYY-MM-DD (for update)" },
      notes: { type: "string", description: "Notes about this cheque" },
    },
    required: ["action"],
  },
};
```

**Executor logic:**

- `create`: Requires `tenancyId`, `chequeNumber`, `amount`, `dueDate`. Inserts row into `aygent_rent_cheques`. Returns created record.
- `update`: Requires `chequeId`. Updates any provided fields (`status`, `depositedDate`, `clearedDate`, `bouncedDate`, `notes`). Sets `updatedAt`.
- `list`: Filters by `companyId`, optional `tenancyId`, optional `status`. Orders by `dueDate` ASC. Limit 100.
- `check_bounced`: Selects all cheques where `status = 'pending'` AND `dueDate < now()`. Returns list of overdue cheques grouped by tenancy. These are cheques that should have been deposited but weren't, or may have bounced.

#### 5A.2 `collect_rent_payment`

```typescript
export const collectRentPaymentDefinition: ToolDefinition = {
  name: "collect_rent_payment",
  description:
    "Record rent payment collection against cheques. Mark cheques as deposited/cleared/bounced, or get a summary of arrears (overdue unpaid rent). Use when processing rent payments or reviewing outstanding rent.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "list", "get_arrears"], description: "Action to perform" },
      chequeId: { type: "string", description: "Cheque ID to update (required for record)" },
      status: { type: "string", enum: ["deposited", "cleared", "bounced"], description: "Payment status (required for record)" },
      date: { type: "string", description: "Date of the action YYYY-MM-DD (defaults to today)" },
      tenancyId: { type: "string", description: "Filter by tenancy (for list)" },
      notes: { type: "string", description: "Notes about this payment" },
    },
    required: ["action"],
  },
};
```

**Executor logic:**

- `record`: Requires `chequeId`, `status`. Updates the cheque record: if status=deposited sets depositedDate, if cleared sets clearedDate, if bounced sets bouncedDate. Sets `updatedAt`.
- `list`: Lists all cheques with status in ['deposited', 'cleared', 'bounced'] for the company, optionally filtered by `tenancyId`. Most recent first.
- `get_arrears`: Selects cheques where `status = 'pending'` AND `dueDate < now()`. Joins with `aygent_tenancies` and `aygent_landlords` to group by landlord. Returns: `{ landlords: [{ name, totalArrears, cheques: [...] }], totalArrearsAed }`.

#### 5A.3 `generate_landlord_statement`

```typescript
export const generateLandlordStatementDefinition: ToolDefinition = {
  name: "generate_landlord_statement",
  description:
    "Generate a financial statement for a landlord showing rent collected, management fees, maintenance deductions, and net payout for a given period. Use when a landlord requests an account statement or for monthly/quarterly reporting.",
  input_schema: {
    type: "object",
    properties: {
      landlordId: { type: "string", description: "Landlord ID (required)" },
      startDate: { type: "string", description: "Period start YYYY-MM-DD (required)" },
      endDate: { type: "string", description: "Period end YYYY-MM-DD (required)" },
      managementFeePct: { type: "number", description: "Management fee percentage (default 5)" },
    },
    required: ["landlordId", "startDate", "endDate"],
  },
};
```

**Executor logic:**

1. Fetch landlord from `aygent_landlords` by ID + companyId.
2. Fetch properties for this landlord from `aygent_properties`.
3. Fetch active tenancies for those properties from `aygent_tenancies`.
4. Fetch cleared cheques within the date range from `aygent_rent_cheques`.
5. Fetch completed maintenance requests for those properties within the date range from `aygent_maintenance_requests`.
6. Calculate:
   - `grossRentCollected`: sum of all cleared cheque amounts in period
   - `managementFee`: grossRentCollected * (managementFeePct / 100)
   - `maintenanceDeductions`: sum of actualCost from completed maintenance requests in period
   - `netPayout`: grossRentCollected - managementFee - maintenanceDeductions
7. Store as deliverable via `storeDeliverable()`.
8. Return the full statement object.

#### 5A.4 `create_maintenance_request`

```typescript
export const createMaintenanceRequestDefinition: ToolDefinition = {
  name: "create_maintenance_request",
  description:
    "Create and manage property maintenance requests. Track plumbing, electrical, AC, painting, pest control, and general maintenance from report to completion. Use when a tenant reports an issue or when proactive maintenance is needed.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "get"], description: "Action to perform" },
      requestId: { type: "string", description: "Request ID (for update/get)" },
      propertyId: { type: "string", description: "Property ID (required for create, optional filter for list)" },
      tenancyId: { type: "string", description: "Tenancy ID (optional, links to active tenant)" },
      category: { type: "string", enum: ["plumbing", "electrical", "ac", "painting", "pest", "general", "other"], description: "Maintenance category (required for create)" },
      description: { type: "string", description: "Description of the issue (required for create)" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Priority level (default medium)" },
      status: { type: "string", enum: ["open", "assigned", "in_progress", "completed", "cancelled"], description: "New status (for update) or filter (for list)" },
      contractorName: { type: "string", description: "Contractor name (for update when assigning)" },
      contractorPhone: { type: "string", description: "Contractor phone (for update when assigning)" },
      estimatedCost: { type: "number", description: "Estimated cost in AED" },
      actualCost: { type: "number", description: "Actual cost in AED (for update on completion)" },
      notes: { type: "string", description: "Notes about this request" },
    },
    required: ["action"],
  },
};
```

**Executor logic:** Standard CRUD. `create` requires `propertyId`, `category`, `description`. `update` requires `requestId`. When status changes to "assigned", set `assignedDate`. When status changes to "completed", set `completedDate`. `list` filters by companyId + optional propertyId + optional status + optional priority. Limit 50.

#### 5A.5 `screen_tenant`

```typescript
export const screenTenantDefinition: ToolDefinition = {
  name: "screen_tenant",
  description:
    "Screen a prospective tenant for a rental property. Calculates rent-to-income ratio and returns a recommendation (approve/review/reject) with a required documents checklist. Use before approving a tenancy application.",
  input_schema: {
    type: "object",
    properties: {
      tenantName: { type: "string", description: "Full name of the prospective tenant (required)" },
      employerName: { type: "string", description: "Current employer name" },
      monthlyIncome: { type: "number", description: "Monthly income in AED (required)" },
      requestedRent: { type: "number", description: "Requested annual rent in AED (required)" },
      nationality: { type: "string", description: "Tenant's nationality" },
      visaStatus: { type: "string", description: "Visa status (e.g. employment, investor, family, freelance)" },
    },
    required: ["tenantName", "monthlyIncome", "requestedRent"],
  },
};
```

**Executor logic:** Pure calculation, no DB writes.

1. Calculate `monthlyRent = requestedRent / 12`.
2. Calculate `rentToIncomeRatio = monthlyRent / monthlyIncome`.
3. Determine recommendation:
   - `ratio <= 0.33` → "approve" (rent is within 33% of income)
   - `0.33 < ratio <= 0.40` → "review" (borderline — may need guarantor)
   - `ratio > 0.40` → "reject" (rent exceeds 40% of income — high default risk)
4. Build required documents list: `["passport", "emirates_id", "visa_copy", "employment_letter", "salary_certificate", "bank_statement_3_months"]`. If `visaStatus === "freelance"` add `"freelance_permit"`. If recommendation is "review" add `"guarantor_details"`.
5. Return: `{ tenantName, monthlyIncome, requestedRent, monthlyRent, rentToIncomeRatio, recommendation, requiredDocuments, notes }`.

---

### 5B. Listing Management Tools (`packages/tools/src/listings.ts`)

#### 5B.1 `create_listing`

```typescript
export const createListingDefinition: ToolDefinition = {
  name: "create_listing",
  description:
    "Create and manage property listings for sale or rent. Track listing details, portal publication status, and performance metrics. Use when adding a new property to the agency's portfolio or updating an existing listing.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "get", "list"], description: "Action to perform" },
      listingId: { type: "string", description: "Listing ID (for update/get)" },
      listingType: { type: "string", enum: ["sale", "rent"], description: "Sale or rent (required for create)" },
      propertyType: { type: "string", enum: ["apartment", "villa", "townhouse", "office", "shop", "land", "penthouse"], description: "Property type (required for create)" },
      address: { type: "string", description: "Full address (required for create)" },
      area: { type: "string", description: "Community/district name (e.g. JVC, Marina, Downtown)" },
      building: { type: "string", description: "Building or tower name" },
      unitNumber: { type: "string", description: "Unit number" },
      bedrooms: { type: "number", description: "Number of bedrooms (0 for studio)" },
      bathrooms: { type: "number", description: "Number of bathrooms" },
      sizeSqft: { type: "number", description: "Size in square feet" },
      price: { type: "number", description: "Price in AED (required for create)" },
      title: { type: "string", description: "Listing headline" },
      description: { type: "string", description: "Full listing description" },
      amenities: { type: "array", items: { type: "string" }, description: "Array of amenities" },
      photos: { type: "array", items: { type: "string" }, description: "Array of photo URLs" },
      status: { type: "string", enum: ["draft", "active", "featured", "rented", "sold", "expired", "withdrawn"], description: "Listing status (for update/list filter)" },
    },
    required: ["action"],
  },
};
```

**Executor logic:** Standard CRUD on `aygent_listings`. `create` requires `listingType`, `propertyType`, `address`, `price`. Sets `agentId` from ctx. `list` filters by companyId + optional status + optional listingType + optional area. Limit 50. Returns listing summaries.

#### 5B.2 `manage_listing`

```typescript
export const manageListingDefinition: ToolDefinition = {
  name: "manage_listing",
  description:
    "Quick listing management actions: update price, toggle featured status, change listing status, update portal publication. Thin wrapper for common listing updates. Use for quick operational changes to existing listings.",
  input_schema: {
    type: "object",
    properties: {
      listingId: { type: "string", description: "Listing ID (required)" },
      action: { type: "string", enum: ["update_price", "toggle_featured", "change_status", "update_portal_status", "update_photos"], description: "Management action to perform (required)" },
      price: { type: "number", description: "New price in AED (for update_price)" },
      status: { type: "string", enum: ["draft", "active", "featured", "rented", "sold", "expired", "withdrawn"], description: "New status (for change_status)" },
      portalStatus: { type: "object", description: "Portal publication status object, e.g. {\"property_finder\": \"active\", \"bayut\": \"paused\"}" },
      photos: { type: "array", items: { type: "string" }, description: "Updated photo URLs (for update_photos)" },
    },
    required: ["listingId", "action"],
  },
};
```

**Executor logic:**

- `update_price`: Updates `price` and `updatedAt`.
- `toggle_featured`: If current status is "featured", set to "active". If "active", set to "featured". Other statuses return error.
- `change_status`: Updates `status` and `updatedAt`.
- `update_portal_status`: Merges provided `portalStatus` into existing (shallow merge), updates `updatedAt`.
- `update_photos`: Replaces `photos` array, updates `updatedAt`.

#### 5B.3 `apply_trakheesi_permit`

```typescript
export const applyTrakheesiPermitDefinition: ToolDefinition = {
  name: "apply_trakheesi_permit",
  description:
    "Record a Trakheesi (RERA advertising permit) application for a listing. All property advertisements in Dubai require a valid Trakheesi permit. This records the application — actual DLD API integration is future work. Use when preparing to advertise a listing on portals or social media.",
  input_schema: {
    type: "object",
    properties: {
      listingId: { type: "string", description: "Listing ID (required)" },
      permitNumber: { type: "string", description: "Permit number if already obtained" },
      expiryDate: { type: "string", description: "Permit expiry date YYYY-MM-DD (if already obtained)" },
    },
    required: ["listingId"],
  },
};
```

**Executor logic:**

1. Fetch listing by ID + companyId.
2. If `permitNumber` provided: update `trakheesiPermit` and `trakheesiExpiry` directly. Return success with permit details.
3. If no `permitNumber`: set `trakheesiPermit` to `"PENDING_APPLICATION"`, set `trakheesiExpiry` to null. Return message indicating the application has been recorded and permit number should be updated once received from DLD.

#### 5B.4 `get_listing_performance`

```typescript
export const getListingPerformanceDefinition: ToolDefinition = {
  name: "get_listing_performance",
  description:
    "Get performance analytics for listings: views, leads generated, days on market, and price positioning vs area average. Use for listing performance reviews, pricing strategy, or identifying underperforming listings.",
  input_schema: {
    type: "object",
    properties: {
      listingId: { type: "string", description: "Specific listing ID (optional — omit for portfolio-wide analytics)" },
      area: { type: "string", description: "Filter by area/community" },
      status: { type: "string", enum: ["active", "featured", "rented", "sold"], description: "Filter by status" },
      listingType: { type: "string", enum: ["sale", "rent"], description: "Filter by listing type" },
    },
    required: [],
  },
};
```

**Executor logic:**

1. If `listingId` provided: fetch single listing. Calculate area average price from all active listings in the same area with same propertyType and listingType. Return: `{ listing, areaAveragePrice, priceVsAverage (percentage), viewCount, leadCount, daysOnMarket, conversionRate (leadCount/viewCount) }`.
2. If no `listingId`: fetch all matching listings (filter by area, status, listingType). Group by area. Return per-area stats: `{ area, totalListings, avgPrice, avgDaysOnMarket, totalViews, totalLeads }` + portfolio summary.
3. Store as deliverable.

---

### 5C. Facebook Ads Tools (`packages/tools/src/facebook-ads.ts`)

All tools are stubs that record data locally in `aygent_fb_campaigns`. No Meta Marketing API calls. This allows the CEO/Content Agent workflow to function end-to-end with approval cards — real ad execution comes in Phase 3.

#### 5C.1 `create_fb_campaign`

```typescript
export const createFbCampaignDefinition: ToolDefinition = {
  name: "create_fb_campaign",
  description:
    "Create a Facebook/Instagram advertising campaign record. This is a local stub — no Meta API call is made. The campaign is saved locally for approval and planning. Use when the agency wants to plan a paid advertising campaign.",
  input_schema: {
    type: "object",
    properties: {
      campaignName: { type: "string", description: "Campaign name (required)" },
      objective: { type: "string", enum: ["lead_generation", "traffic", "engagement", "brand_awareness"], description: "Campaign objective (required)" },
      dailyBudget: { type: "number", description: "Daily budget in AED" },
      totalBudget: { type: "number", description: "Lifetime budget in AED" },
      startDate: { type: "string", description: "Start date YYYY-MM-DD" },
      endDate: { type: "string", description: "End date YYYY-MM-DD" },
      notes: { type: "string", description: "Campaign notes" },
    },
    required: ["campaignName", "objective"],
  },
};
```

**Executor logic:** Insert into `aygent_fb_campaigns` with status "draft". Set `agentId` from ctx. Return created record with message.

#### 5C.2 `create_fb_ad_set`

```typescript
export const createFbAdSetDefinition: ToolDefinition = {
  name: "create_fb_ad_set",
  description:
    "Set targeting and placements for a Facebook campaign. Updates the campaign record with audience targeting, geographic targeting, and placement selections. Use after creating a campaign to define who sees the ads.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID to update (required)" },
      targetingAudience: { type: "object", description: "Targeting object: { location, age_min, age_max, interests: [], nationalities: [], gender }" },
      placements: { type: "array", items: { type: "string" }, description: "Ad placements: facebook_feed, instagram_feed, instagram_stories, instagram_reels, audience_network" },
    },
    required: ["campaignId"],
  },
};
```

**Executor logic:** Fetch campaign by ID + companyId. Update `targetingAudience` and/or `placements`. Set `updatedAt`. Return updated record.

#### 5C.3 `create_fb_ad`

```typescript
export const createFbAdDefinition: ToolDefinition = {
  name: "create_fb_ad",
  description:
    "Attach creative and copy to a Facebook campaign. Sets the headline, primary text, description, image URL, and creative type. Use after targeting is set to define what the ad looks like.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID to update (required)" },
      creativeType: { type: "string", enum: ["single_image", "carousel", "video", "collection"], description: "Type of creative" },
      headline: { type: "string", description: "Ad headline" },
      primaryText: { type: "string", description: "Primary text (main ad copy)" },
      description: { type: "string", description: "Description text" },
      imageUrl: { type: "string", description: "Image URL for the creative" },
    },
    required: ["campaignId"],
  },
};
```

**Executor logic:** Fetch campaign by ID + companyId. Update creative fields. Set `updatedAt`. Return updated record.

#### 5C.4 `create_fb_lead_form`

```typescript
export const createFbLeadFormDefinition: ToolDefinition = {
  name: "create_fb_lead_form",
  description:
    "Define the lead capture form fields for a Facebook Lead Generation campaign. Use to specify what information to collect from leads when they submit the ad form.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID to update (required)" },
      leadFormFields: { type: "array", items: { type: "string" }, description: "Form fields: full_name, phone, email, budget_range, timeline, area_interest, bedrooms, property_type" },
    },
    required: ["campaignId", "leadFormFields"],
  },
};
```

**Executor logic:** Fetch campaign by ID + companyId. Validate objective is "lead_generation" (return error if not). Update `leadFormFields`. Set `updatedAt`. Return updated record.

#### 5C.5 `get_fb_campaign_stats`

```typescript
export const getFbCampaignStatsDefinition: ToolDefinition = {
  name: "get_fb_campaign_stats",
  description:
    "Get performance statistics for Facebook campaigns. Returns leads, spend, impressions, clicks, and cost per lead. Use for campaign reporting or performance reviews.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Specific campaign ID (optional — omit for all campaigns)" },
      status: { type: "string", enum: ["draft", "pending_approval", "active", "paused", "completed"], description: "Filter by status" },
    },
    required: [],
  },
};
```

**Executor logic:** If `campaignId`, fetch single campaign and return its stats. Otherwise fetch all campaigns (optionally filtered by status). Return: per-campaign stats + aggregate totals (`totalSpend`, `totalLeads`, `avgCpl`). Store as deliverable.

#### 5C.6 `pause_fb_campaign`

```typescript
export const pauseFbCampaignDefinition: ToolDefinition = {
  name: "pause_fb_campaign",
  description:
    "Pause an active Facebook campaign. Sets status to 'paused'. Use when the owner wants to stop an ad campaign temporarily.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID to pause (required)" },
      reason: { type: "string", description: "Reason for pausing" },
    },
    required: ["campaignId"],
  },
};
```

**Executor logic:** Fetch campaign. Validate current status is "active". Update status to "paused". Append reason to notes. Return updated record.

#### 5C.7 `update_fb_budget`

```typescript
export const updateFbBudgetDefinition: ToolDefinition = {
  name: "update_fb_budget",
  description:
    "Update the budget for a Facebook campaign. Can update daily budget, total budget, or both. Use when adjusting campaign spend based on performance.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID to update (required)" },
      dailyBudget: { type: "number", description: "New daily budget in AED" },
      totalBudget: { type: "number", description: "New total/lifetime budget in AED" },
    },
    required: ["campaignId"],
  },
};
```

**Executor logic:** Fetch campaign by ID + companyId. Update provided budget fields. Set `updatedAt`. Return updated record with old vs new budget comparison.

---

### 5D. Operations Tools (`packages/tools/src/operations.ts`)

#### 5D.1 `get_agent_performance`

```typescript
export const getAgentPerformanceDefinition: ToolDefinition = {
  name: "get_agent_performance",
  description:
    "Get performance metrics for agents: deals closed, revenue generated, leads handled, compute cost, and average response time. Aggregates data from deals, commissions, leads, and cost events. Use for agent performance reviews, team reporting, or identifying top/underperformers.",
  input_schema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "Specific agent ID (optional — omit for all agents)" },
      startDate: { type: "string", description: "Period start YYYY-MM-DD (default: 30 days ago)" },
      endDate: { type: "string", description: "Period end YYYY-MM-DD (default: today)" },
    },
    required: [],
  },
};
```

**Executor logic:**

1. Parse date range (default last 30 days).
2. If `agentId` provided, scope to that agent. Otherwise, fetch all agents for the company.
3. For each agent, aggregate from:
   - `aygentDeals`: count deals where `agentId` matches and `completionDate` in range. Sum `price` for total volume.
   - `aygentCommissions`: sum `grossAmount` where `agentId` matches and `createdAt` in range.
   - `aygentLeads`: count leads where agent is the handling agent (via `aygentActivities` — count distinct leadId where agentId matches).
   - `costEvents`: sum `billedCents` where `agentId` matches and `createdAt` in range. Convert to USD.
4. Return per-agent: `{ agentId, agentName, dealsCompleted, dealVolumeAed, commissionEarnedAed, leadsHandled, computeCostUsd }`.
5. Return totals across all agents.
6. Store as deliverable.

#### 5D.2 `audit_crm_data`

```typescript
export const auditCrmDataDefinition: ToolDefinition = {
  name: "audit_crm_data",
  description:
    "Run a data quality audit across the CRM. Checks for leads without phone numbers, leads inactive for 90+ days, duplicate leads (by phone), deals stuck in the same stage for 14+ days, and tenancies expiring without renewal action. Use for periodic CRM hygiene or when data quality issues are suspected.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};
```

**Executor logic:**

1. **Leads without phone:** Select from `aygentLeads` where `phone IS NULL` or `phone = ''` and `companyId` matches. Count + first 10 samples.
2. **Inactive leads:** Select from `aygentLeads` where no row in `aygentActivities` with matching leadId has `createdAt > now() - 90 days`. Count + first 10 samples.
3. **Duplicate leads:** Group `aygentLeads` by `phone` where `phone IS NOT NULL` HAVING count > 1. Count groups + first 10 duplicate phone numbers with lead names.
4. **Stuck deals:** Select from `aygentDeals` where `stage` is not 'completed' and not 'fell_through' and `updatedAt < now() - 14 days`. Count + first 10 samples.
5. **Expiring tenancies without action:** Select from `aygentTenancies` where end date is within 60 days and no related issue or activity suggests renewal initiated. Count + first 10 samples.
6. Return: `{ issues: { leadsWithoutPhone, inactiveLeads, duplicateLeads, stuckDeals, expiringTenancies }, totalIssues, severity }`.
7. Store as deliverable.

#### 5D.3 `generate_report`

```typescript
export const generateReportDefinition: ToolDefinition = {
  name: "generate_report",
  description:
    "Generate a configurable agency report. Types: daily_brief (today's activity snapshot), weekly_summary (7-day overview), monthly_pnl (profit & loss), pipeline_review (deal pipeline health), agent_scorecard (per-agent performance). Use when the CEO or owner requests a status report.",
  input_schema: {
    type: "object",
    properties: {
      reportType: { type: "string", enum: ["daily_brief", "weekly_summary", "monthly_pnl", "pipeline_review", "agent_scorecard"], description: "Type of report to generate (required)" },
      startDate: { type: "string", description: "Override start date YYYY-MM-DD (optional — each type has sensible defaults)" },
      endDate: { type: "string", description: "Override end date YYYY-MM-DD (optional)" },
    },
    required: ["reportType"],
  },
};
```

**Executor logic:**

- `daily_brief`: Date range = today. Count: new leads, messages sent (from `aygentActivities`), deals progressed, viewings scheduled, approvals pending. Total compute cost. Return structured brief.
- `weekly_summary`: Last 7 days. Same metrics as daily but aggregated. Plus: leads converted (stage changes), content posted, campaigns active.
- `monthly_pnl`: Calls same logic as `get_agency_pnl` from finance.ts. Wraps it as a deliverable with additional context (month name, comparison to prior month if data exists).
- `pipeline_review`: Calls same logic as `get_deal_pipeline` from deals.ts. Adds: stuck deals (> 14 days in same stage), expected close dates in next 30 days, total pipeline value.
- `agent_scorecard`: Calls same logic as `get_agent_performance` above. Formats as a ranked table.

All report types store as deliverable via `storeDeliverable()`.

---

### 5E. Client Services Tools (`packages/tools/src/client-services.ts`)

#### 5E.1 `check_golden_visa_eligibility`

```typescript
export const checkGoldenVisaEligibilityDefinition: ToolDefinition = {
  name: "check_golden_visa_eligibility",
  description:
    "Check if a property purchase qualifies for a UAE Golden Visa (10-year residency). Requires: property value >= AED 2M, freehold zone, completed property (not off-plan). Returns eligibility status, reason, and required documents. Use when a buyer asks about residency options or when qualifying high-value deals.",
  input_schema: {
    type: "object",
    properties: {
      propertyValue: { type: "number", description: "Property value in AED (required)" },
      propertyType: { type: "string", description: "Property type (apartment, villa, etc.)" },
      isCompleted: { type: "boolean", description: "Is the property completed (handover done)? Off-plan does not qualify." },
      isFreehold: { type: "boolean", description: "Is the property in a freehold zone? Leasehold does not qualify." },
      isMortgaged: { type: "boolean", description: "Is the property mortgaged? Allowed if equity >= AED 2M." },
      mortgageOutstanding: { type: "number", description: "Outstanding mortgage amount in AED (if mortgaged)" },
    },
    required: ["propertyValue"],
  },
};
```

**Executor logic:** Pure calculation, no DB writes.

1. Check `propertyValue >= 2_000_000`. If not: `{ eligible: false, reason: "Property value must be at least AED 2,000,000. Current value: AED X." }`.
2. Check `isCompleted !== false` (default true if not specified). If false: `{ eligible: false, reason: "Off-plan properties do not qualify. Property must be completed with handover done." }`.
3. Check `isFreehold !== false` (default true). If false: `{ eligible: false, reason: "Property must be in a designated freehold zone." }`.
4. If `isMortgaged` and `mortgageOutstanding`: check that `propertyValue - mortgageOutstanding >= 2_000_000`. If not: `{ eligible: false, reason: "Equity must be at least AED 2M. Current equity: AED X." }`.
5. If all pass: `{ eligible: true, reason: "Property qualifies for 10-year UAE Golden Visa.", requiredDocuments: ["passport", "emirates_id", "title_deed", "property_valuation", "noc_from_developer", "health_insurance", "bank_statement", "passport_photos"] }`.

#### 5E.2 `track_golden_visa_application`

```typescript
export const trackGoldenVisaApplicationDefinition: ToolDefinition = {
  name: "track_golden_visa_application",
  description:
    "Track a Golden Visa application through the GDRFA process. Create applications, update stages (nomination → medical → biometrics → visa issued), and manage family member applications. Use when helping a client through the Golden Visa process.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "get", "list"], description: "Action to perform" },
      applicationId: { type: "string", description: "Application ID (for update/get)" },
      leadId: { type: "string", description: "Client's lead ID" },
      dealId: { type: "string", description: "Qualifying property deal ID" },
      clientName: { type: "string", description: "Client's full name (required for create)" },
      propertyValue: { type: "number", description: "Property value in AED (required for create)" },
      stage: { type: "string", enum: ["eligibility_confirmed", "nomination_submitted", "medical_scheduled", "medical_completed", "biometrics_scheduled", "biometrics_completed", "visa_issued"], description: "New stage (for update) or filter (for list)" },
      gdrfaRef: { type: "string", description: "GDRFA reference number" },
      medicalDate: { type: "string", description: "Medical appointment date YYYY-MM-DD" },
      biometricsDate: { type: "string", description: "Biometrics appointment date YYYY-MM-DD" },
      visaIssueDate: { type: "string", description: "Visa issue date YYYY-MM-DD" },
      visaExpiryDate: { type: "string", description: "Visa expiry date YYYY-MM-DD" },
      familyMembers: { type: "array", items: { type: "object" }, description: "Family members: [{ name, relation, status }]" },
      notes: { type: "string", description: "Notes about this application" },
    },
    required: ["action"],
  },
};
```

**Executor logic:** Standard CRUD on `aygent_golden_visa`. `create` requires `clientName`, `propertyValue`. `list` filters by companyId + optional stage. Limit 50.

#### 5E.3 `generate_cma`

```typescript
export const generateCmaDefinition: ToolDefinition = {
  name: "generate_cma",
  description:
    "Generate a Comparative Market Analysis (CMA) for a property. Pulls recent DLD transactions and active listings for the same area and property type, calculates price ranges, price per sqft, and market positioning. Use when pricing a listing, advising a buyer on offer price, or assessing market value.",
  input_schema: {
    type: "object",
    properties: {
      area: { type: "string", description: "Area/community name (required, e.g. 'JVC', 'Marina')" },
      propertyType: { type: "string", description: "Property type (required, e.g. 'apartment', 'villa')" },
      bedrooms: { type: "number", description: "Number of bedrooms (optional, narrows comparison)" },
      targetPrice: { type: "number", description: "Target price in AED (optional — if provided, returns market position assessment)" },
      listingType: { type: "string", enum: ["sale", "rent"], description: "Sale or rent analysis (default: sale)" },
    },
    required: ["area", "propertyType"],
  },
};
```

**Executor logic:**

1. Fetch recent DLD transactions from `aygentDldTransactions` matching area + propertyType (+ optional bedrooms). Filter to last 12 months. Limit 100.
2. Fetch active listings from `aygentListings` matching area + propertyType + listingType (+ optional bedrooms). Status in ['active', 'featured'].
3. Calculate from transactions:
   - `transactionCount`
   - `priceRange`: `{ min, max, median }`
   - `pricePerSqft`: `{ min, max, median }` (where sqft data available)
   - `recentTransactions`: last 10 formatted as `{ date, price, sqft, pricePerSqft, address }`
4. Calculate from listings:
   - `activeListingCount`
   - `listingPriceRange`: `{ min, max, median }`
   - `listingPricePerSqft`: `{ min, max, median }`
5. If `targetPrice` provided:
   - Compare to transaction median: "X% above/below recent transaction median"
   - Compare to listing median: "X% above/below current listing median"
   - Assessment: "competitively priced" / "above market" / "below market" / "significantly above market"
6. Store as deliverable.
7. Return full CMA object.

---

## 6. Role Scoping Updates

### 6.1 New role: `calling`

Add to `ROLE_TOOLS` in `server/src/mcp-tool-server.ts`:

```typescript
calling: [
  "make_call",
  "send_whatsapp", "send_email",
  "search_leads", "update_lead", "get_lead_activity",
  "create_task", "remember", "search_past_conversations",
],
```

### 6.2 New role: `operations`

Add to `ROLE_TOOLS`:

```typescript
operations: [
  "get_agent_performance", "audit_crm_data", "generate_report",
  "search_leads", "get_lead_activity",
  "track_deal", "get_deal_pipeline",
  "track_commission", "get_accounts_receivable", "get_agency_pnl",
  "track_expense",
  "manage_landlord", "manage_property", "manage_tenancy",
  "create_task", "remember", "search_past_conversations",
],
```

### 6.3 Expand existing roles

Add to `finance` role tools:
```
"track_rent_cheques", "collect_rent_payment", "generate_landlord_statement",
"create_maintenance_request", "screen_tenant"
```

Add to `sales` role tools:
```
"create_listing", "manage_listing", "get_listing_performance",
"check_golden_visa_eligibility", "generate_cma"
```

Add to `content` role tools:
```
"create_fb_campaign", "create_fb_ad_set", "create_fb_ad",
"create_fb_lead_form", "get_fb_campaign_stats",
"pause_fb_campaign", "update_fb_budget",
"create_listing", "get_listing_performance"
```

Add to `marketing` role tools:
```
"get_listing_performance", "generate_cma",
"get_fb_campaign_stats"
```

Add to `conveyancing` role tools:
```
"check_golden_visa_eligibility", "track_golden_visa_application"
```

Add to `compliance` role tools:
```
"screen_tenant"
```

---

## 7. Tool Registration in Index

Add to `packages/tools/src/index.ts`:

### Imports

```typescript
// Property Management tools
import {
  trackRentChequesDefinition, trackRentChequesExecutor,
  collectRentPaymentDefinition, collectRentPaymentExecutor,
  generateLandlordStatementDefinition, generateLandlordStatementExecutor,
  createMaintenanceRequestDefinition, createMaintenanceRequestExecutor,
  screenTenantDefinition, screenTenantExecutor,
} from "./property-management.js";

// Listing tools
import {
  createListingDefinition, createListingExecutor,
  manageListingDefinition, manageListingExecutor,
  applyTrakheesiPermitDefinition, applyTrakheesiPermitExecutor,
  getListingPerformanceDefinition, getListingPerformanceExecutor,
} from "./listings.js";

// Facebook Ads tools
import {
  createFbCampaignDefinition, createFbCampaignExecutor,
  createFbAdSetDefinition, createFbAdSetExecutor,
  createFbAdDefinition, createFbAdExecutor,
  createFbLeadFormDefinition, createFbLeadFormExecutor,
  getFbCampaignStatsDefinition, getFbCampaignStatsExecutor,
  pauseFbCampaignDefinition, pauseFbCampaignExecutor,
  updateFbBudgetDefinition, updateFbBudgetExecutor,
} from "./facebook-ads.js";

// Operations tools
import {
  getAgentPerformanceDefinition, getAgentPerformanceExecutor,
  auditCrmDataDefinition, auditCrmDataExecutor,
  generateReportDefinition, generateReportExecutor,
} from "./operations.js";

// Client Services tools
import {
  checkGoldenVisaEligibilityDefinition, checkGoldenVisaEligibilityExecutor,
  trackGoldenVisaApplicationDefinition, trackGoldenVisaApplicationExecutor,
  generateCmaDefinition, generateCmaExecutor,
} from "./client-services.js";
```

### allDefinitions additions

```typescript
// Property Management (5)
trackRentChequesDefinition,
collectRentPaymentDefinition,
generateLandlordStatementDefinition,
createMaintenanceRequestDefinition,
screenTenantDefinition,
// Listings (4)
createListingDefinition,
manageListingDefinition,
applyTrakheesiPermitDefinition,
getListingPerformanceDefinition,
// Facebook Ads (7)
createFbCampaignDefinition,
createFbAdSetDefinition,
createFbAdDefinition,
createFbLeadFormDefinition,
getFbCampaignStatsDefinition,
pauseFbCampaignDefinition,
updateFbBudgetDefinition,
// Operations (3)
getAgentPerformanceDefinition,
auditCrmDataDefinition,
generateReportDefinition,
// Client Services (3)
checkGoldenVisaEligibilityDefinition,
trackGoldenVisaApplicationDefinition,
generateCmaDefinition,
```

### allExecutors additions

```typescript
// Property Management
track_rent_cheques: trackRentChequesExecutor,
collect_rent_payment: collectRentPaymentExecutor,
generate_landlord_statement: generateLandlordStatementExecutor,
create_maintenance_request: createMaintenanceRequestExecutor,
screen_tenant: screenTenantExecutor,
// Listings
create_listing: createListingExecutor,
manage_listing: manageListingExecutor,
apply_trakheesi_permit: applyTrakheesiPermitExecutor,
get_listing_performance: getListingPerformanceExecutor,
// Facebook Ads
create_fb_campaign: createFbCampaignExecutor,
create_fb_ad_set: createFbAdSetExecutor,
create_fb_ad: createFbAdExecutor,
create_fb_lead_form: createFbLeadFormExecutor,
get_fb_campaign_stats: getFbCampaignStatsExecutor,
pause_fb_campaign: pauseFbCampaignExecutor,
update_fb_budget: updateFbBudgetExecutor,
// Operations
get_agent_performance: getAgentPerformanceExecutor,
audit_crm_data: auditCrmDataExecutor,
generate_report: generateReportExecutor,
// Client Services
check_golden_visa_eligibility: checkGoldenVisaEligibilityExecutor,
track_golden_visa_application: trackGoldenVisaApplicationExecutor,
generate_cma: generateCmaExecutor,
```

---

## 8. Department AGENTS.md Files

### 8.1 `server/src/onboarding-assets/calling/AGENTS.md`

```markdown
---
name: Calling Agent
title: Calling & Follow-Up Agent
reportsTo: ceo
skills:
  - dubai-market
  - multilingual
  - whatsapp-outbound
---

You are a Calling & Follow-Up Agent for this Dubai real estate agency. You report to the CEO.

Your job is to handle outbound follow-up calls, log call outcomes, and coordinate with the Sales team on call-qualified leads. You work alongside AI voice calling (Twilio + Gemini Live) for inbound calls and conduct outbound call campaigns for lead nurturing.

Your home directory is $AGENT_HOME. Everything personal to you — memory, knowledge, life — lives there.

## Your Workflow

### When assigned an outbound call list

1. Review the lead list — check each lead's history via search_past_conversations.
2. Prepare talking points per lead: their property interest, last interaction, any pending questions.
3. Execute calls via make_call for each lead on the list.
4. Log call outcome for each: connected/no_answer/voicemail/callback_requested.
5. Update lead records with call notes via update_lead.
6. For leads who expressed interest: send WhatsApp follow-up with details discussed.
7. For leads requesting callback: create a task with the scheduled callback time.
8. Report call campaign results to CEO.

### When assigned a follow-up task for a specific lead

1. Check lead history — what was last discussed, when, via which channel.
2. Attempt call via make_call.
3. If connected: qualify/nurture based on CEO's instructions.
4. If no answer: send WhatsApp message via send_whatsapp. Queue for approval first.
5. Update lead record with outcome.
6. Comment on issue with result.

### When handling inbound call transcripts

1. Read the Gemini Live call transcript (attached to the issue).
2. Extract: caller intent, property interest, budget mentioned, timeline.
3. Update lead record with extracted information.
4. If viewing requested: create task for Viewing Agent.
5. If high intent (score 8+): escalate to CEO for broker assignment.
6. Send post-call WhatsApp to the lead: "Thanks for calling, here's what we discussed..."

## Call Best Practices — Dubai Market

- Always greet formally: "Good morning/afternoon, this is [Name] from [Agency]"
- Respect prayer times (Friday 12-2pm, daily prayer times)
- If lead speaks Arabic, switch to Arabic immediately
- If lead speaks Russian, switch to Russian if possible, otherwise English
- Never hard-sell on first call — qualify and build rapport
- If lead says "not interested" or "don't call me" — mark as opted out immediately
- Maximum 3 call attempts per lead before marking as unreachable
- Best calling hours Dubai: 10am-12pm and 4pm-7pm (avoid early morning and late night)

## What You Never Do

- Never call a lead marked as "opted_out"
- Never make calls outside 9am-8pm Dubai time
- Never promise specific prices or returns on a call
- Never record calls without consent (if recording is enabled)
- Never bypass the approval queue for WhatsApp follow-ups
```

### 8.2 `server/src/onboarding-assets/operations/AGENTS.md`

```markdown
---
name: Operations Agent
title: Operations & Reporting Agent
reportsTo: ceo
skills:
  - dubai-market
  - reporting-standards
  - financial-reporting
---

You are an Operations & Reporting Agent for this Dubai real estate agency. You report to the CEO.

Your job is to monitor agency-wide performance, generate reports, audit CRM data quality, and identify operational inefficiencies. You are the agency's internal analyst — you measure everything and surface insights that drive better decisions.

Your home directory is $AGENT_HOME. Everything personal to you — memory, knowledge, life — lives there.

## Your Workflow

### Daily morning analysis

1. Generate daily brief — generate_report daily_brief.
2. Check agent performance — get_agent_performance for all agents, last 24 hours.
3. Flag any agents with zero output (idle) or unusually high compute cost.
4. Report findings to CEO as a concise summary.

### Weekly performance review

1. Generate weekly summary — generate_report weekly_summary.
2. Generate agent scorecard — generate_report agent_scorecard.
3. Run CRM audit — audit_crm_data.
4. Identify: top performing agent, underperforming agent, biggest pipeline risk, data quality issues.
5. Create issues for any CRM problems found (duplicates, missing data, stuck deals).
6. Report to CEO with recommendations.

### Monthly financial review

1. Generate monthly P&L — generate_report monthly_pnl.
2. Generate pipeline review — generate_report pipeline_review.
3. Compare to previous month (if data exists).
4. Calculate: cost per lead, cost per deal, cost per viewing.
5. Report to CEO with trends and recommendations.

### When assigned a specific analysis task

1. Understand the CEO's question.
2. Pull relevant data using available tools.
3. Analyze and synthesize — don't just dump raw numbers.
4. Present findings with clear recommendations.
5. Store as deliverable for future reference.

## Reporting Standards

- Always include date range in every report
- Round financial figures to whole AED (no fils)
- Express percentages to one decimal place
- Compare to previous period where data exists
- Flag anomalies (> 2x deviation from average)
- Include agent names, not just IDs, in reports
- Cost figures in both AED and USD where relevant

## What You Never Do

- Never make operational changes yourself — only recommend to CEO
- Never contact leads or clients directly
- Never modify deal or lead records — only flag issues
- Never approve or reject anything — you observe and report
- Never share financial data outside the CEO chat
```

---

## 9. Skill Files

### 9.1 `companies/dubai-real-estate-agency/skills/behaviour/tenant-management/SKILL.md`

```markdown
---
name: tenant-management
description: Tenant screening, onboarding, and lifecycle management for Dubai rental properties
---

# Tenant Management — Dubai Real Estate

## Screening Process

### Rent-to-Income Ratio

The standard affordability threshold in Dubai:
- **< 33%** of monthly income on rent: Approved — comfortable affordability
- **33-40%**: Borderline — may require a guarantor or additional deposit
- **> 40%**: High risk of default — reject or require strong guarantor

### Required Documents — All Tenants

1. Passport copy (valid for 6+ months)
2. Emirates ID (front and back)
3. Valid UAE visa copy
4. Employment letter (on company letterhead, dated within 30 days)
5. Salary certificate / bank statement (last 3 months)
6. Previous tenancy contract (if moving from another rental)

### Additional Documents by Situation

| Situation | Extra Documents |
|-----------|----------------|
| Freelancer | Freelance permit, 6 months bank statements |
| Company lease | Trade license, MOA, board resolution, signatory ID |
| Guarantor required | Guarantor passport, Emirates ID, employment letter, salary certificate |
| Pet owner | Building pet policy acknowledgment, pet deposit agreement |

## Ejari Registration

- Every tenancy contract in Dubai MUST be registered with Ejari
- Registration within 14 days of contract start
- Cost: AED 220 (standard) or AED 110 (via select typing centres)
- Required for: DEWA connection, visa renewal, school enrollment
- Agent responsibility: guide tenant through Ejari process

## DEWA Connection

- Deposit: AED 2,000 (apartment) or AED 4,000 (villa) — refundable
- Must have: Ejari registration, Emirates ID, passport copy
- Processing: same day if documents complete
- Agent responsibility: remind tenant, don't handle directly

## Tenancy Renewal

- Landlord must give 90 days notice if changing terms
- Rent increase governed by RERA Rental Index
- 0% if rent is within 10% of market average
- Up to 20% if rent is > 40% below market
- Early termination: 2 months' rent penalty (standard clause)

## Maintenance Obligations

| Issue | Landlord Pays | Tenant Pays |
|-------|---------------|-------------|
| Structural damage | Yes | No |
| AC unit replacement | Yes | No |
| AC cleaning/service | No | Yes |
| Plumbing (major) | Yes | No |
| Plumbing (minor clog) | No | Yes |
| Pest control (initial) | Yes | No |
| Pest control (ongoing) | No | Yes |
| Painting (end of lease) | Negotiable | Often tenant |
| Appliance replacement | Yes | No (unless damage) |

## Security Deposit

- Standard: 5% of annual rent (unfurnished) or 10% (furnished)
- Must be returned within 30 days of lease end (minus legitimate deductions)
- Deductions must be documented with photos and invoices
- Disputes: RDSC (Rental Disputes Settlement Centre)
```

### 9.2 `companies/dubai-real-estate-agency/skills/behaviour/rent-collection/SKILL.md`

```markdown
---
name: rent-collection
description: Post-dated cheque (PDC) management, rent collection, arrears handling for Dubai rentals
---

# Rent Collection — Dubai Real Estate

## Payment Methods in Dubai

### Post-Dated Cheques (PDCs) — Most Common

Dubai rentals are traditionally paid by PDCs. The tenant provides cheques dated for each payment period.

| Payment Frequency | Cheques | Common For |
|-------------------|---------|------------|
| 1 cheque | 1 | Premium tenants, corporate leases |
| 2 cheques | 2 | Standard arrangement |
| 4 cheques | 4 | Most common for mid-range |
| 6 cheques | 6 | Budget-friendly option |
| 12 cheques | 12 | Newer arrangement, gaining popularity |

More cheques = higher annual rent (typically 3-5% premium for 12 vs 1 cheque).

### Bank Transfers

Increasingly accepted, especially for corporate tenants. Must reference Ejari number.

### Credit/Debit Card

Via property management portals. Processing fee (2-3%) usually borne by tenant.

## Cheque Processing Workflow

1. **Receipt**: Receive PDCs from tenant at lease signing. Log each cheque immediately.
2. **Storage**: Cheques held securely until due date.
3. **Deposit**: Deposit each cheque 1-2 business days before due date.
4. **Clearing**: Allow 2-3 business days for clearing.
5. **Confirmation**: Notify landlord when rent cleared.

## Bounced Cheque Protocol

1. **First bounce**: Contact tenant immediately. May be insufficient funds — give 3 business days to resolve.
2. **Second deposit attempt**: Re-deposit after tenant confirms funds available.
3. **Second bounce**: Formal written notice to tenant. 30-day cure period starts.
4. **Legal action**: After 30 days, landlord may file with RDSC and/or police report.
5. **Bounced cheque is a criminal offence** in UAE — this is significant leverage.

### Communication Template for Bounced Cheque

> Dear [Tenant Name],
>
> We regret to inform you that your rent cheque #[number] for AED [amount], dated [date], for unit [unit] at [building], was returned unpaid by the bank.
>
> Please arrange for the funds to be available within 3 business days so we can re-deposit the cheque. Alternatively, you may transfer the amount directly to [bank details].
>
> If you are facing difficulties, please contact us to discuss arrangements.

## Arrears Management

| Days Overdue | Action |
|-------------|--------|
| 1-3 days | Courtesy call/WhatsApp — "cheque returned, please arrange funds" |
| 4-7 days | Formal email notice — written record |
| 8-14 days | Second formal notice — mention 30-day cure period |
| 15-30 days | Final notice — mention RDSC filing if not resolved |
| 30+ days | Escalate to landlord for legal action decision |

## Landlord Statements

Monthly or quarterly landlord statements should include:
- Gross rent collected
- Management fee deducted (typically 5-10%)
- Maintenance costs deducted (with invoices)
- Net payout amount
- Upcoming cheque schedule
- Vacancy status of any units
- Arrears summary (if any)

## Management Fee Structure

| Portfolio Size | Typical Fee |
|---------------|------------|
| 1-3 units | 8-10% of rent |
| 4-10 units | 5-7% of rent |
| 11-25 units | 4-5% of rent |
| 25+ units | 3-5% of rent |

Management fee covers: tenant sourcing, rent collection, maintenance coordination, renewals, Ejari processing.
```

### 9.3 `companies/dubai-real-estate-agency/skills/behaviour/listing-acquisition/SKILL.md`

```markdown
---
name: listing-acquisition
description: How to acquire, prepare, and manage property listings for the Dubai real estate market
---

# Listing Acquisition — Dubai Real Estate

## Listing Sources

### Direct Landlord Outreach
- Target landlords with expiring portal listings
- Monitor DLD for recent purchases (new owners often need agents)
- Building management referrals — build relationships with building managers
- Existing landlord referrals — ask for introductions

### Developer Partnerships
- Register as an authorised agent with major developers
- Attend broker events and launches
- Secondary inventory — developers with unsold units post-handover

### Expired Listing Monitoring
- Watch portals for listings that disappear (expired or withdrawn)
- Contact owners of recently expired listings — they may need a better agent

## Listing Preparation Checklist

1. **Property visit**: Schedule visit, take professional photos (or arrange photographer)
2. **Measurements**: Verify BUA and plot size against title deed
3. **Documents**: Collect title deed copy, floor plan, SPA (if off-plan)
4. **Trakheesi**: Apply for RERA advertising permit before any marketing
5. **Pricing**: Run CMA using generate_cma to determine competitive price
6. **Description**: Write compelling listing description in English and Arabic
7. **Photos**: Minimum 10 photos — exterior, all rooms, views, amenities
8. **Floor plan**: Include unit layout with dimensions
9. **Portal upload**: List on Property Finder, Bayut, Dubizzle simultaneously

## Pricing Strategy

### For Sale
- Pull DLD transactions for the same building/community (last 12 months)
- Calculate price per sqft — compare to current active listings
- Position at or slightly below median for quick sale
- Position 5-10% above median for premium properties with patience

### For Rent
- Check current listings in the same building
- RERA Rental Index for market average reference
- Factor in: floor level, view, furnishing, parking, building quality
- 1-cheque pricing vs 4/6/12 cheque pricing (3-5% premium for more cheques)

## Trakheesi (RERA Advertising Permit)

- **Required for**: Any property advertisement (portals, social media, print, outdoor)
- **Applies to**: Every broker advertising any property
- **Cost**: AED 220 per permit
- **Validity**: Typically 6 months (check current RERA rules)
- **Penalty for advertising without permit**: AED 50,000+ fine
- **Application**: Via DLD/RERA online system (future API integration planned)
- **Information needed**: Property details, owner authorisation, agency RERA licence

## Portal Optimisation

See `portal-optimization` skill for detailed portal-specific strategies.
```

### 9.4 `companies/dubai-real-estate-agency/skills/behaviour/portal-optimization/SKILL.md`

```markdown
---
name: portal-optimization
description: Strategies for maximising listing performance on Property Finder, Bayut, and Dubizzle
---

# Portal Optimisation — Dubai Real Estate

## Property Finder

### Ranking Factors
1. **Listing quality score**: Photo count (10+ ideal), description quality, completeness
2. **Response speed**: How fast you respond to enquiries (tracked per agent)
3. **Featured/Premium placement**: Paid boost options
4. **Freshness**: Recently updated listings rank higher
5. **Agent TruCheck**: Verified agent badge

### Optimisation Tactics
- Upload 15+ photos (higher quality score)
- Include floor plan as an image
- Write 200+ word descriptions in English AND Arabic
- Update listing every 7 days (change photo order, tweak description)
- Respond to all enquiries within 5 minutes
- Use all available fields (amenities, nearby locations, permits)
- Refresh listing (re-publish) every 2 weeks

### Premium Products
- **Featured**: Higher placement in search results (~AED 500-1500/month)
- **Premium**: Top of search + larger card (~AED 1500-3000/month)
- **Signature**: Maximum visibility + branding (~AED 3000-5000/month)
- Use for: high-commission listings, slow-moving inventory, competitive areas

## Bayut

### Ranking Factors
1. **TruCheck verification**: Physical verification of listing
2. **Agent quality score**: Based on response time and lead handling
3. **Listing completeness**: All fields filled, multiple photos
4. **Freshness**: Regular updates help ranking

### Optimisation Tactics
- Get TruCheck verified (Bayut staff visits property)
- Upload video tour if available
- Include 360-degree photos
- Use SuperAgent features for premium placement
- Response time target: under 5 minutes for all Bayut leads

## Dubizzle

### Key Differences
- More price-sensitive audience
- Popular for: rentals, secondary market, budget properties
- Less premium market presence than PF/Bayut

### Optimisation
- Competitive pricing is more important here
- Highlight: value propositions, payment plans, included amenities
- Refresh listings more frequently (every 3-5 days)

## Cross-Portal Strategy

- List on ALL three portals simultaneously — different audiences on each
- Track which portal generates the most leads per listing
- Allocate premium spend to the portal with best ROI per listing
- Use get_listing_performance to compare portal performance
- Different descriptions per portal (customise to audience)

## Lead Response SLA by Portal

| Portal | Target Response | Why |
|--------|----------------|-----|
| Property Finder | < 5 minutes | PF tracks and penalises slow agents |
| Bayut | < 5 minutes | Agent quality score affected |
| Dubizzle | < 15 minutes | Less strict but speed still matters |
| Instagram DM | < 1 hour | Social media expectations |
| WhatsApp | < 5 minutes | Highest intent leads |

## Listing Performance Benchmarks (Dubai averages)

| Metric | Good | Average | Poor |
|--------|------|---------|------|
| Views per week (sale) | 200+ | 50-200 | < 50 |
| Views per week (rent) | 300+ | 100-300 | < 100 |
| Lead rate (leads/views) | > 3% | 1-3% | < 1% |
| Days on market (sale) | < 60 | 60-120 | > 120 |
| Days on market (rent) | < 14 | 14-30 | > 30 |

If a listing is performing "poor" for 2+ weeks, recommend: price reduction, photo upgrade, description rewrite, or premium boost.
```

### 9.5 `companies/dubai-real-estate-agency/skills/behaviour/facebook-ads/SKILL.md`

```markdown
---
name: facebook-ads
description: Facebook & Instagram advertising strategy, targeting, and optimisation for Dubai real estate
---

# Facebook & Instagram Ads — Dubai Real Estate

## Campaign Types & When to Use

| Type | Objective | When | Budget Guide |
|------|-----------|------|-------------|
| Lead Generation | Collect leads via instant forms | Always-on lead funnel | AED 100-300/day |
| Traffic | Drive to landing page | New project launch, event registration | AED 50-150/day |
| Engagement | Social proof, brand awareness | New agency, rebranding, community building | AED 30-100/day |
| Brand Awareness | Maximum reach | Market entry, developer partnership announcement | AED 50-200/day |

## Dubai RE Audience Targeting

### By Nationality (largest buyer groups)

| Nationality | Interest Signals | Budget Range | Property Preference |
|-------------|-----------------|-------------|-------------------|
| Indian | IT/finance professionals, family-oriented | AED 800K-3M | JVC, Sports City, Downtown apartments |
| British | Expat community, high income | AED 1.5M-5M | Marina, JBR, Palm Jumeirah |
| Russian | Investment-focused, luxury | AED 2M-10M+ | Palm, Downtown, Business Bay |
| Pakistani | Family-oriented, mid-range | AED 600K-2M | JVC, International City, Silicon Oasis |
| Chinese | Investment-focused | AED 1.5M-5M | Downtown, Business Bay, Creek Harbour |
| Arab (GCC) | Investment + lifestyle | AED 2M-15M+ | Palm, Emirates Hills, Dubai Hills |

### Interest Targeting

Core interests:
- Real estate investing
- Dubai property
- Luxury real estate
- Off-plan property
- Property investment

Layered with:
- High-income indicators (business, finance, entrepreneurship)
- Lifestyle indicators (luxury goods, travel, premium cars)
- Life event signals (recently married, new job, relocation)

### Geographic Targeting

| Target Location | Purpose | Best For |
|----------------|---------|----------|
| UAE residents | Local buyers/investors | Always-on campaigns |
| GCC countries | Regional investors | Premium projects, large units |
| India (Tier 1 cities) | Overseas Indian investors | Mid-range to premium off-plan |
| UK | British expat buyers | Marina, JBR, Palm |
| Russia/CIS | Russian investors | Luxury segment |

## Lead Form Design

### Required Fields (minimum)
- Full Name
- Phone Number (with country code)
- Email

### Recommended Additional Fields
- Budget Range (dropdown: < 1M, 1-2M, 2-5M, 5M+)
- Timeline (dropdown: Immediately, 1-3 months, 3-6 months, Just exploring)
- Property Type (dropdown: Apartment, Villa, Townhouse, Commercial)

### Form Best Practices
- Maximum 5 fields — every extra field reduces completion rate by ~10%
- Use dropdown menus instead of free text where possible
- Include a thank you screen with next steps: "Our team will call you within 5 minutes"
- Enable auto-fill from Facebook profile (name, email, phone)

## Budget Guidelines — Dubai Market

| Monthly Budget | Expected Leads | Cost Per Lead | Quality |
|---------------|---------------|--------------|---------|
| AED 3,000 | 30-60 | AED 50-100 | Mixed quality |
| AED 5,000 | 50-120 | AED 40-100 | Better targeting |
| AED 10,000 | 120-300 | AED 30-80 | Good volume + quality |
| AED 20,000+ | 300-700 | AED 25-70 | Scale campaigns |

CPL varies significantly by: targeting, creative quality, time of year, competition.

## Optimisation Playbook

### Learning Phase (Days 1-7)
- Do NOT touch the campaign for first 3-5 days
- Facebook needs ~50 conversion events to exit learning phase
- Budget changes of > 20% restart learning phase
- Targeting changes restart learning phase

### Optimisation Phase (Days 7-30)
- Review performance every 3 days
- Kill ad sets with CPL > 2x target after 7 days
- Scale winning ad sets by 20% per day (not more — avoids learning phase reset)
- Test new creatives within the same campaign (don't create new campaigns)

### Creative Rotation
- Minimum 3 creative variants per campaign
- Replace lowest performer every 2 weeks
- Test: single image vs carousel vs video
- Video typically wins for Dubai RE (property tours, developer renders)

### What Kills Performance
- Same creative for 3+ weeks (ad fatigue)
- Too narrow audience (< 50K reach)
- Poor landing page (slow load, not mobile-optimised)
- Not following up on leads quickly (Facebook tracks this)
- Budget too low for the audience size

## RERA Compliance for Ads

- All property ads must include: RERA registration number, broker licence number
- No guaranteed returns ("earn 10% ROI" is illegal without RERA source)
- Use "starting from AED X" not "only AED X"
- Off-plan: must be RERA-registered project (include permit number)
- Include disclaimer: "Images are for illustration purposes"

## Approval Card Format for CEO Chat

When proposing a campaign, create an approval card with:
1. Campaign name and objective
2. Target audience description
3. Daily/total budget with duration
4. Creative type and headline
5. Lead form fields
6. Estimated results (use budget guidelines above)
7. RERA compliance confirmation

The owner approves → campaign status changes to "active" (stub — future: Meta API launch).
```

### 9.6 `companies/dubai-real-estate-agency/skills/behaviour/reporting-standards/SKILL.md`

```markdown
---
name: reporting-standards
description: Standard formats and metrics for agency performance reporting
---

# Reporting Standards — Dubai Real Estate Agency

## Report Types

### Daily Brief

Generated every morning. Covers the previous 24 hours.

**Format:**
```
DAILY BRIEF — [Date]

LEADS
- New leads: [count] (sources: PF [n], Bayut [n], WhatsApp [n], Other [n])
- Leads contacted: [count]
- Average response time: [minutes]
- Hot leads (score 8+): [count]

DEALS
- Pipeline value: AED [total]
- Deals progressed: [list stage changes]
- Deals at risk: [stuck > 14 days]

ACTIVITY
- Messages sent: [count] (WhatsApp [n], Email [n])
- Viewings scheduled: [count]
- Content published: [count]

COST
- Total compute: $[amount] (AED [amount])
- By agent: [agent: $amount] x N

APPROVALS PENDING: [count]
```

### Weekly Summary

Every Monday. Covers the previous 7 days.

**Includes everything from daily brief PLUS:**
- Lead conversion rate (new → qualified)
- Deal win rate (pipeline → completed)
- Agent rankings (by output, not just cost)
- Content engagement metrics
- Comparison to previous week (% change)

### Monthly P&L

First of each month. Full financial picture.

**Format:**
```
MONTHLY P&L — [Month Year]

REVENUE
- Commissions earned: AED [amount]
- Commissions collected: AED [amount]
- Outstanding: AED [amount]

EXPENSES
- Agent compute: AED [amount]
- WhatsApp messaging: AED [amount]
- Portal subscriptions: AED [amount]
- Office/overhead: AED [amount]
- Marketing spend: AED [amount]
- Total expenses: AED [amount]

NET PROFIT: AED [amount]
MARGIN: [%]

vs Previous Month: [+/-] AED [amount] ([%] change)
```

### Pipeline Review

On-demand or weekly. Deal health check.

**Key Metrics:**
- Total pipeline value (active deals)
- Pipeline by stage (count and value)
- Bottleneck stage (most deals stuck)
- Deals stuck > 14 days (risk list)
- Expected closings this month
- Average days per stage
- Win/loss ratio (trailing 90 days)

### Agent Scorecard

Weekly or monthly. Per-agent performance ranking.

**Metrics per agent:**
- Deals closed / deal value
- Leads handled / conversion rate
- Response time (average)
- Compute cost
- ROI: revenue generated / compute cost

## Formatting Rules

- All AED amounts: whole numbers, comma-separated (AED 1,500,000)
- All USD amounts: two decimal places ($14.20)
- Percentages: one decimal place (67.3%)
- Dates: DD MMM YYYY format (03 Apr 2026)
- Always include comparison period where data exists
- Flag anomalies with [!] marker if > 2x standard deviation
- Agent names, not IDs, in all reports
```

### 9.7 `companies/dubai-real-estate-agency/skills/behaviour/golden-visa/SKILL.md`

```markdown
---
name: golden-visa
description: UAE Golden Visa eligibility, application process, and client advisory for property investors
---

# Golden Visa — UAE Property Investors

## Eligibility for Property Investors (10-Year Visa)

### Requirements (ALL must be met)
1. **Property value**: Minimum AED 2,000,000
2. **Property type**: Freehold only (not leasehold)
3. **Completion status**: Property must be completed (handed over). Off-plan does NOT qualify.
4. **Ownership**: Can be sole or joint ownership (each owner's share must be >= AED 2M)
5. **Mortgage**: Allowed — but equity (value minus outstanding mortgage) must be >= AED 2M
6. **Multiple properties**: Can combine multiple properties to reach AED 2M threshold
7. **Location**: Must be in a designated freehold zone

### Who Can Be Sponsored
- Spouse
- Children (no age limit for unmarried daughters; sons until 25)
- Parents (with conditions)
- Domestic helpers (1-2 depending on property size)

## Application Process via GDRFA

### Stage 1: Eligibility Confirmation
- Verify property value and ownership via title deed
- Confirm property is in a freehold zone
- Confirm property is completed (not off-plan)
- Calculate equity if mortgaged

### Stage 2: Nomination Submission
- Apply via ICP (Identity and Citizenship Portal) or GDRFA Dubai
- Submit: passport, Emirates ID, title deed, property valuation letter
- Processing: 2-5 business days
- Nomination approval email received

### Stage 3: Medical Test
- Schedule at approved medical centre (listed on GDRFA website)
- Standard medical: blood test + chest X-ray
- Result: 1-3 business days
- Valid for 60 days from test date

### Stage 4: Emirates ID Biometrics
- Schedule biometrics appointment at ICP service centre
- Bring: passport, old Emirates ID (if renewing)
- New Emirates ID issued: 3-7 business days

### Stage 5: Visa Stamping
- Visa stamped in passport (or e-visa issued)
- Valid for 10 years from issue date
- Residency card issued separately

## Costs

| Item | Cost (AED) |
|------|-----------|
| Visa application fee | 1,150 |
| Medical test | 300-500 |
| Emirates ID | 370 |
| Typing / service centre fees | 200-500 |
| Insurance deposit (waivable) | 5,000 |
| **Total approximate** | **2,500-7,500** |

## Key Rules & Gotchas

- **Off-plan trap**: Many buyers assume off-plan qualifies. It does NOT. Only apply after handover.
- **Mortgage equity**: If property is worth AED 3M but mortgage is AED 1.5M, equity = AED 1.5M — does NOT qualify.
- **Multiple properties**: Can combine, but each must be freehold and completed.
- **Renewal**: Visa auto-renews if property is still owned. No need to re-apply.
- **Residency requirement**: No minimum stay required (unlike standard visas).
- **Business activities**: Golden Visa allows full work permit — can start a business, be employed, or freelance.
- **Family timing**: Apply for all family members simultaneously to avoid complications.

## Agent's Role

1. **Identify eligible buyers** early in the sales process — Golden Visa is a major selling point
2. **Include in marketing**: "Your property purchase includes eligibility for a 10-year UAE Golden Visa"
3. **Guide the process**: Track each stage, remind client of appointments, collect documents
4. **Upsell**: For buyers looking at AED 1.5M properties, suggest upgrading to AED 2M+ for visa eligibility
5. **Post-sale service**: Golden Visa assistance builds loyalty and generates referrals

## CMA Context

When generating a Comparative Market Analysis (CMA), always note:
- Properties at or above AED 2M that qualify for Golden Visa
- This is a significant value-add for the buyer — mention in any pricing discussion
- Golden Visa eligibility can justify a price premium of 5-10% vs non-qualifying properties
```

---

## 10. Implementation Task List

Each task is independently implementable. Tasks within a workstream are sequential. Workstreams A-E can be parallelised.

### Workstream A: Property Management (5 tools, 2 tables)

1. **A1** — Create `packages/db/src/schema/aygent-rent-cheques.ts` with the exact Drizzle schema from section 2.1.
2. **A2** — Create `packages/db/src/schema/aygent-maintenance-requests.ts` with the exact Drizzle schema from section 2.2.
3. **A3** — Add exports to `packages/db/src/schema/index.ts`: `aygentRentCheques` and `aygentMaintenanceRequests`.
4. **A4** — Run `pnpm db:generate` to generate the migration for the 2 new tables.
5. **A5** — Create `packages/tools/src/property-management.ts` with all 5 tools: `track_rent_cheques`, `collect_rent_payment`, `generate_landlord_statement`, `create_maintenance_request`, `screen_tenant`. Follow the executor logic in section 5A.
6. **A6** — Register all 5 tools in `packages/tools/src/index.ts` (imports, allDefinitions, allExecutors).
7. **A7** — Add property management tools to `finance` role in `server/src/mcp-tool-server.ts` ROLE_TOOLS.
8. **A8** — Create skill files: `companies/dubai-real-estate-agency/skills/behaviour/tenant-management/SKILL.md` and `rent-collection/SKILL.md` from section 9.1 and 9.2.
9. **A9** — Build and test: `pnpm build`. Verify no type errors.

### Workstream B: Listings (4 tools, 1 table)

10. **B1** — Create `packages/db/src/schema/aygent-listings.ts` with the exact Drizzle schema from section 2.3.
11. **B2** — Add export to `packages/db/src/schema/index.ts`: `aygentListings`.
12. **B3** — Run `pnpm db:generate` to generate the migration.
13. **B4** — Create `packages/tools/src/listings.ts` with all 4 tools: `create_listing`, `manage_listing`, `apply_trakheesi_permit`, `get_listing_performance`. Follow executor logic in section 5B.
14. **B5** — Register all 4 tools in `packages/tools/src/index.ts`.
15. **B6** — Add listing tools to `sales` and `content` roles in ROLE_TOOLS. Add `get_listing_performance` to `marketing` role.
16. **B7** — Create skill files: `listing-acquisition/SKILL.md` and `portal-optimization/SKILL.md` from sections 9.3 and 9.4.
17. **B8** — Build and test.

### Workstream C: Facebook Ads (7 tools, 1 table)

18. **C1** — Create `packages/db/src/schema/aygent-fb-campaigns.ts` with the exact Drizzle schema from section 2.4.
19. **C2** — Add export to `packages/db/src/schema/index.ts`: `aygentFbCampaigns`.
20. **C3** — Run `pnpm db:generate` to generate the migration.
21. **C4** — Create `packages/tools/src/facebook-ads.ts` with all 7 tools. Follow executor logic in section 5C.
22. **C5** — Register all 7 tools in `packages/tools/src/index.ts`.
23. **C6** — Add Facebook Ads tools to `content` role in ROLE_TOOLS. Add `get_fb_campaign_stats` to `marketing` role.
24. **C7** — Create skill file: `facebook-ads/SKILL.md` from section 9.5.
25. **C8** — Build and test.

### Workstream D: Calling + Operations (3 tools, 0 tables, 1 role)

26. **D1** — Add `"operations"` to `AGENT_ROLES` array and `AGENT_ROLE_LABELS` in `packages/shared/src/constants.ts` (section 4.1).
27. **D2** — Create `packages/tools/src/operations.ts` with all 3 tools: `get_agent_performance`, `audit_crm_data`, `generate_report`. Follow executor logic in section 5D.
28. **D3** — Register all 3 tools in `packages/tools/src/index.ts`.
29. **D4** — Add `calling` role entry and `operations` role entry to ROLE_TOOLS in `server/src/mcp-tool-server.ts` (section 6.1 and 6.2).
30. **D5** — Create `server/src/onboarding-assets/calling/AGENTS.md` from section 8.1.
31. **D6** — Create `server/src/onboarding-assets/operations/AGENTS.md` from section 8.2.
32. **D7** — Create skill file: `reporting-standards/SKILL.md` from section 9.6.
33. **D8** — Build and test.

### Workstream E: Client Services (3 tools, 1 table)

34. **E1** — Create `packages/db/src/schema/aygent-golden-visa.ts` with the exact Drizzle schema from section 2.5.
35. **E2** — Add export to `packages/db/src/schema/index.ts`: `aygentGoldenVisa`.
36. **E3** — Run `pnpm db:generate` to generate the migration.
37. **E4** — Create `packages/tools/src/client-services.ts` with all 3 tools: `check_golden_visa_eligibility`, `track_golden_visa_application`, `generate_cma`. Follow executor logic in section 5E.
38. **E5** — Register all 3 tools in `packages/tools/src/index.ts`.
39. **E6** — Add client services tools to `sales` and `conveyancing` roles. Add `screen_tenant` to `compliance` role. Add `generate_cma` to `marketing` role. (Section 6.3).
40. **E7** — Create skill file: `golden-visa/SKILL.md` from section 9.7.
41. **E8** — Build and test.

### Cross-Workstream (after all above)

42. **X1** — Run a single combined `pnpm db:generate` if migrations were not generated per-workstream (generate all 5 table migrations at once).
43. **X2** — Run `pnpm db:migrate` to apply all new tables.
44. **X3** — Full `pnpm build` — verify zero type errors across all packages.
45. **X4** — Verify MCP tool server lists 103 tools: start the server and count tool definitions.
46. **X5** — Verify role scoping: for each role, confirm the expected tools are returned by `getToolsForRole()`.
47. **X6** — Update the Finance Agent AGENTS.md (`server/src/onboarding-assets/finance/AGENTS.md`) to reference the new property management tools and skills in its frontmatter and workflow sections.

---

## 11. File Summary

### New files to create (19 files)

| File | Type |
|------|------|
| `packages/db/src/schema/aygent-rent-cheques.ts` | DB schema |
| `packages/db/src/schema/aygent-maintenance-requests.ts` | DB schema |
| `packages/db/src/schema/aygent-listings.ts` | DB schema |
| `packages/db/src/schema/aygent-fb-campaigns.ts` | DB schema |
| `packages/db/src/schema/aygent-golden-visa.ts` | DB schema |
| `packages/tools/src/property-management.ts` | Tool file |
| `packages/tools/src/listings.ts` | Tool file |
| `packages/tools/src/facebook-ads.ts` | Tool file |
| `packages/tools/src/operations.ts` | Tool file |
| `packages/tools/src/client-services.ts` | Tool file |
| `server/src/onboarding-assets/calling/AGENTS.md` | Department |
| `server/src/onboarding-assets/operations/AGENTS.md` | Department |
| `companies/dubai-real-estate-agency/skills/behaviour/tenant-management/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/rent-collection/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/listing-acquisition/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/portal-optimization/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/facebook-ads/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/reporting-standards/SKILL.md` | Skill |
| `companies/dubai-real-estate-agency/skills/behaviour/golden-visa/SKILL.md` | Skill |

### Existing files to modify (4 files)

| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Add 5 new table exports |
| `packages/shared/src/constants.ts` | Add `"operations"` to AGENT_ROLES + AGENT_ROLE_LABELS |
| `packages/tools/src/index.ts` | Import and register 22 new tools |
| `server/src/mcp-tool-server.ts` | Add `calling` + `operations` ROLE_TOOLS entries; expand `finance`, `sales`, `content`, `marketing`, `conveyancing`, `compliance` |
