# Phase 1 — CEO-Driven Agency Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demo-ready product where a user talks to a CEO agent, CEO interviews them, builds an org, and a hired Lead Agent processes a real lead end-to-end with live activity visible in the UI.

**Architecture:** Paperclip fork with native tools (ported from AygentDesk), structured CEO commands executed server-side, skill-based role scoping via `--add-dir`, and a live activity panel built on Paperclip's WebSocket infrastructure.

**Tech Stack:** Node.js 20, Express 5, React 19, Drizzle ORM, PostgreSQL, Vite 6, Radix UI, Tailwind CSS 4, TanStack Query, Claude Code (subprocess), pnpm workspaces.

**Source repos:**
- Aygency World (this repo): `/Users/alexanderjackson/Aygency World/`
- AygentDesk (source for tools): `/Users/alexanderjackson/AgentDXB/`

---

## File Structure

### New files to create:

```
packages/db/src/schema/
├── aygent-projects.ts          # 1,800+ Dubai off-plan projects
├── aygent-leads.ts             # Lead pipeline + scoring
├── aygent-activities.ts        # Lead activity timeline
├── aygent-tags.ts              # Tags + lead-tag junction
├── aygent-whatsapp.ts          # WhatsApp message history
├── aygent-email.ts             # Email message history (if needed)
├── aygent-landlords.ts         # Landlord records
├── aygent-properties.ts        # Managed properties
├── aygent-tenancies.ts         # Tenancy records
├── aygent-campaigns.ts         # Email campaigns + steps + enrollments
├── aygent-documents.ts         # Document vault
���── aygent-portals.ts           # Client portals + activity
├── aygent-dld.ts               # DLD transaction cache
├── aygent-viewings.ts          # Viewing records
���── aygent-agent-credentials.ts # Per-agent OAuth tokens (encrypted)
├─�� aygent-agent-memory.ts      # Per-agent memory store
├── aygent-guardrails.ts        # Per-agent guardrail config
├─��� aygent-whatsapp-templates.ts # WhatsApp message templates
├── aygent-news.ts              # News article cache
├── aygent-call-config.ts       # Call agent config + scripts
├── aygent-call-logs.ts         # Call log records
└── aygent-listing-watches.ts   # Bayut/PF listing monitors

packages/tools/
├── package.json
├── tsconfig.json
├── src/
���   ├── index.ts                # Tool registry + executor
│   ├── types.ts                # Tool definition types
│   ├── projects.ts             # search_projects, get_project_details
│   ├── leads.ts                # search_leads, update_lead, get_lead_activity, etc.
│   ├── communication.ts        # WhatsApp, email, Instagram tools
│   ├── calendar.ts             # Calendar + viewing tools
│   ├── content.ts              # Content generation tools
│   ├── market.ts               # DLD, listings, news, web search tools
│   ├── portfolio.ts            # Landlord, property, tenancy tools
│   ├── campaigns.ts            # Campaign tools
│   ├── portals.ts              # Client portal tools
│   ├── documents.ts            # Document tools
│   ├── admin.ts                # Task, memory, guardrails tools
│   └── lib/
│       ├── whatsapp.ts         # WAHA client (copied from AgentDXB)
│       ├── mail.ts             # Gmail/Outlook unified client
│       ├── instagram.ts        # Instagram Graph API client
│       ├── bayut.ts            # Bayut scraper
│       ├── tavily.ts           # Web search client
│       ├── calendar-client.ts  # Google Calendar client
│       └── news.ts             # News aggregator

server/src/services/
├── ceo-commands.ts             # Command handler for CEO structured commands

skills/
├── catalog.md                  # Skill menu for CEO
├── domain/
│   ├── dubai-market.md
│   ├── dubai-compliance.md
│   ├── dubai-buyers.md
│   └── multilingual.md
├── behaviour/
│   ├── lead-response.md
│   ├── lead-qualification.md
│   ├── lead-followup.md
│   ├── lead-handoff.md
│   ├── viewing-scheduling.md
│   ├── content-instagram.md
│   ├── content-pitch-deck.md
│   ├── market-monitoring.md
│   ├── portfolio-management.md
│   ├── campaign-management.md
│   └── call-handling.md
└── tools/
    └── (63 tool skill markdown files — one per tool)

server/src/onboarding-assets/ceo/
├── AGENTS.md                   # OVERWRITE — CEO as company architect
├── HEARTBEAT.md                # OVERWRITE — interview + coordinator modes
├── SOUL.md                     # OVERWRITE — Dubai RE CEO persona
└── TOOLS.md                    # OVERWRITE — command format reference

ui/src/components/
├── LiveActivityPanel.tsx       # Real-time agent activity panel
├── ActivityFeed.tsx            # Scrolling activity feed
└── AgentStatusCard.tsx         # Per-agent status card

ui/src/pages/
└── AgencyDashboard.tsx         # New dashboard with live panel

scripts/
├── seed-projects.ts            # Import 1,800 projects from Reelly API
└── seed-dld.ts                 # Import DLD transactions from CSV
```

### Files to modify:

```
packages/db/src/schema/index.ts           # Add all new table exports
packages/db/package.json                  # (no changes expected)
pnpm-workspace.yaml                       # Add packages/tools
server/src/services/index.ts              # Export ceo-commands service
server/src/routes/issues.ts               # Hook command handler into comment creation
server/src/app.ts                         # Register new tool API routes (if needed)
ui/src/App.tsx                            # Add AgencyDashboard route
ui/src/components/Layout.tsx              # Add nav item for activity panel
ui/src/components/Sidebar.tsx             # Add activity panel toggle
```

---

## Wave 1 — Database Layer

Port AygentDesk's Prisma models to Drizzle tables. Every table gets `companyId` for multi-tenancy (AygentDesk uses `userId` — we change to `companyId`).

### Task 1: Core project + lead tables

**Files:**
- Create: `packages/db/src/schema/aygent-projects.ts`
- Create: `packages/db/src/schema/aygent-leads.ts`
- Create: `packages/db/src/schema/aygent-activities.ts`
- Create: `packages/db/src/schema/aygent-tags.ts`
- Modify: `packages/db/src/schema/index.ts`

**Source reference:** `/Users/alexanderjackson/AgentDXB/prisma/schema.prisma` — models: Project, Lead, LeadActivity, Tag, LeadTag

- [ ] **Step 1: Create projects table**

Port the `Project` model from AygentDesk. Key changes: add `companyId`, rename `reellyId` → keep as external sync ID, all JSON fields use `jsonb()`.

```typescript
// packages/db/src/schema/aygent-projects.ts
import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentProjects = pgTable(
  "aygent_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    reellyId: integer("reelly_id"),
    name: text("name").notNull(),
    developer: text("developer"),
    description: text("description"),
    shortDescription: text("short_description"),
    // Location
    district: text("district"),
    region: text("region"),
    city: text("city"),
    sector: text("sector"),
    location: text("location"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    // Pricing
    minPrice: real("min_price"),
    maxPrice: real("max_price"),
    minSize: real("min_size"),
    maxSize: real("max_size"),
    priceCurrency: text("price_currency").default("AED"),
    areaUnit: text("area_unit").default("sqft"),
    // Status
    constructionStatus: text("construction_status"),
    saleStatus: text("sale_status"),
    completionDate: text("completion_date"),
    completionDatetime: timestamp("completion_datetime", { withTimezone: true }),
    readinessProgress: integer("readiness_progress"),
    // Details
    furnishing: text("furnishing"),
    serviceCharge: real("service_charge"),
    escrowNumber: text("escrow_number"),
    postHandover: boolean("post_handover").default(false),
    buildingCount: integer("building_count"),
    unitsCount: integer("units_count"),
    // Rich data (JSON)
    amenities: jsonb("amenities").$type<string[]>(),
    paymentPlans: jsonb("payment_plans"),
    nearbyLandmarks: jsonb("nearby_landmarks"),
    buildings: jsonb("buildings"),
    parkings: jsonb("parkings"),
    unitBreakdown: jsonb("unit_breakdown"),
    // Media
    coverImageUrl: text("cover_image_url"),
    brochureUrl: text("brochure_url"),
    floorPlanUrl: text("floor_plan_url"),
    generalPlanUrl: text("general_plan_url"),
    images: jsonb("images"),
    // Metadata
    brand: text("brand"),
    managingCompany: text("managing_company"),
    isPartnerProject: boolean("is_partner_project").default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("aygent_projects_company_idx").on(table.companyId),
    developerIdx: index("aygent_projects_developer_idx").on(table.developer),
    districtIdx: index("aygent_projects_district_idx").on(table.district),
    saleStatusIdx: index("aygent_projects_sale_status_idx").on(table.saleStatus),
    priceIdx: index("aygent_projects_price_idx").on(table.minPrice, table.maxPrice),
    reellyIdx: index("aygent_projects_reelly_idx").on(table.companyId, table.reellyId),
  }),
);
```

- [ ] **Step 2: Create leads table**

Port the `Lead` model. Change `userId` → `companyId`. Add `agentId` (which AI agent owns this lead).

```typescript
// packages/db/src/schema/aygent-leads.ts
import { pgTable, uuid, text, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentLeads = pgTable(
  "aygent_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    assignedBrokerId: uuid("assigned_broker_id"),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    nationality: text("nationality"),
    budget: jsonb("budget"),
    preferredAreas: jsonb("preferred_areas").$type<string[]>(),
    propertyType: text("property_type"),
    timeline: text("timeline"),
    marketPreference: text("market_preference"),
    source: text("source"),
    stage: text("stage").default("lead").notNull(),
    notes: text("notes"),
    score: integer("score").default(0),
    scoreBreakdown: jsonb("score_breakdown"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    language: text("language"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyStageIdx: index("aygent_leads_company_stage_idx").on(table.companyId, table.stage),
    companyScoreIdx: index("aygent_leads_company_score_idx").on(table.companyId, table.score),
    agentIdx: index("aygent_leads_agent_idx").on(table.agentId),
    companyUpdatedIdx: index("aygent_leads_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);
```

- [ ] **Step 3: Create activities table**

```typescript
// packages/db/src/schema/aygent-activities.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentActivities = pgTable(
  "aygent_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id"),
    type: text("type").notNull(), // whatsapp_sent, whatsapp_received, email_sent, stage_changed, score_updated, note_added, etc.
    title: text("title").notNull(),
    body: text("body"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    leadCreatedIdx: index("aygent_activities_lead_created_idx").on(table.leadId, table.createdAt),
    companyTypeIdx: index("aygent_activities_company_type_idx").on(table.companyId, table.type),
  }),
);
```

- [ ] **Step 4: Create tags + lead_tags tables**

```typescript
// packages/db/src/schema/aygent-tags.ts
import { pgTable, uuid, text, timestamp, jsonb, index, unique, primaryKey } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentTags = pgTable(
  "aygent_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    behavior: jsonb("behavior"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueName: unique("aygent_tags_company_name_unique").on(table.companyId, table.name),
  }),
);

export const aygentLeadTags = pgTable(
  "aygent_lead_tags",
  {
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => aygentTags.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.leadId, table.tagId] }),
  }),
);
```

- [ ] **Step 5: Export all new tables from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export * from "./aygent-projects.js";
export * from "./aygent-leads.js";
export * from "./aygent-activities.js";
export * from "./aygent-tags.js";
```

- [ ] **Step 6: Generate and run migration**

```bash
cd packages/db && pnpm run generate && cd ../..
pnpm db:migrate
```

Expected: Migration SQL file created in `packages/db/src/migrations/`, tables exist in PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/aygent-*.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat: add core Aygent tables — projects, leads, activities, tags"
```

---

### Task 2: Communication + messaging tables

**Files:**
- Create: `packages/db/src/schema/aygent-whatsapp.ts`
- Create: `packages/db/src/schema/aygent-whatsapp-templates.ts`
- Create: `packages/db/src/schema/aygent-agent-credentials.ts`
- Modify: `packages/db/src/schema/index.ts`

**Source reference:** AygentDesk models: WhatsAppMessage, WhatsAppAccount, WhatsAppTemplate, ConnectedAccount

- [ ] **Step 1: Create WhatsApp messages table**

```typescript
// packages/db/src/schema/aygent-whatsapp.ts
import { pgTable, uuid, text, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentWhatsappMessages = pgTable(
  "aygent_whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    chatJid: text("chat_jid").notNull(),
    messageId: text("message_id"),
    fromMe: boolean("from_me").notNull(),
    senderName: text("sender_name"),
    senderPhone: text("sender_phone"),
    content: text("content"),
    mediaType: text("media_type"),
    mediaUrl: text("media_url"),
    status: text("status").default("received"), // received, sent, failed
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyAgentChatIdx: index("aygent_wa_company_agent_chat_idx").on(table.companyId, table.agentId, table.chatJid, table.timestamp),
    messageIdIdx: unique("aygent_wa_message_id_unique").on(table.messageId),
    leadIdx: index("aygent_wa_lead_idx").on(table.leadId),
  }),
);
```

- [ ] **Step 2: Create WhatsApp templates table**

```typescript
// packages/db/src/schema/aygent-whatsapp-templates.ts
import { pgTable, uuid, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentWhatsappTemplates = pgTable(
  "aygent_whatsapp_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(), // intro, viewing_confirmation, followup, market_update, payment_reminder, price_drop
    content: text("content").notNull(),
    isDefault: boolean("is_default").default(false),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyCategoryIdx: index("aygent_wa_templates_company_category_idx").on(table.companyId, table.category),
  }),
);
```

Import `boolean` in the file (already imported above from `drizzle-orm/pg-core`).

- [ ] **Step 3: Create agent credentials table**

Per-agent OAuth tokens for WhatsApp, Gmail, Instagram, Calendar. Encrypted at rest.

```typescript
// packages/db/src/schema/aygent-agent-credentials.ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentAgentCredentials = pgTable(
  "aygent_agent_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    service: text("service").notNull(), // whatsapp, gmail, instagram, google_calendar
    accessToken: text("access_token"), // encrypted at rest
    refreshToken: text("refresh_token"), // encrypted at rest
    providerAccountId: text("provider_account_id"),
    whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
    gmailAddress: text("gmail_address"),
    scopes: text("scopes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    agentServiceIdx: index("aygent_creds_agent_service_idx").on(table.agentId, table.service),
    companyIdx: index("aygent_creds_company_idx").on(table.companyId),
  }),
);
```

- [ ] **Step 4: Export and migrate**

Add to `packages/db/src/schema/index.ts`:
```typescript
export * from "./aygent-whatsapp.js";
export * from "./aygent-whatsapp-templates.js";
export * from "./aygent-agent-credentials.js";
```

```bash
cd packages/db && pnpm run generate && cd ../..
pnpm db:migrate
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/aygent-whatsapp*.ts packages/db/src/schema/aygent-agent-credentials.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat: add WhatsApp, templates, and agent credentials tables"
```

---

### Task 3: Remaining tables (portfolio, campaigns, documents, DLD, viewings, memory, calls, news)

**Files:**
- Create: `packages/db/src/schema/aygent-landlords.ts`
- Create: `packages/db/src/schema/aygent-properties.ts`
- Create: `packages/db/src/schema/aygent-tenancies.ts`
- Create: `packages/db/src/schema/aygent-campaigns.ts`
- Create: `packages/db/src/schema/aygent-documents.ts`
- Create: `packages/db/src/schema/aygent-portals.ts`
- Create: `packages/db/src/schema/aygent-dld.ts`
- Create: `packages/db/src/schema/aygent-viewings.ts`
- Create: `packages/db/src/schema/aygent-agent-memory.ts`
- Create: `packages/db/src/schema/aygent-guardrails.ts`
- Create: `packages/db/src/schema/aygent-news.ts`
- Create: `packages/db/src/schema/aygent-call-config.ts`
- Create: `packages/db/src/schema/aygent-call-logs.ts`
- Create: `packages/db/src/schema/aygent-listing-watches.ts`
- Modify: `packages/db/src/schema/index.ts`

**Source reference:** AygentDesk Prisma schema — all remaining models.

This task ports every remaining AygentDesk model to Drizzle. Follow the exact same pattern as Tasks 1-2. Each table:
- Gets `companyId` FK to `companies` (replaces AygentDesk's `userId`)
- Gets relevant indexes matching AygentDesk's `@@index` directives
- Uses `jsonb()` for JSON fields, `text()` for long text, `uuid()` for IDs

- [ ] **Step 1: Create landlords table**

Port AygentDesk `Landlord` model. Fields: id, companyId, name, phone, email, address, dob, passport, emiratesId, nationality, notes, timestamps.

```typescript
// packages/db/src/schema/aygent-landlords.ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentLandlords = pgTable(
  "aygent_landlords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    dob: text("dob"),
    passport: text("passport"),
    emiratesId: text("emirates_id"),
    nationality: text("nationality"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("aygent_landlords_company_idx").on(table.companyId),
    companyNameIdx: index("aygent_landlords_company_name_idx").on(table.companyId, table.name),
  }),
);
```

- [ ] **Step 2: Create managed properties table**

Port AygentDesk `ManagedProperty`. Fields: id, companyId, landlordId, unit, buildingName, streetAddress, area, propertyType, bedrooms, bathrooms, sqft, floor, viewType, parkingSpaces, titleDeedNo, photos (jsonb), saleValue, purchasePrice, serviceCharge, status (occupied|vacant|notice_given), notes, timestamps.

```typescript
// packages/db/src/schema/aygent-properties.ts
import { pgTable, uuid, text, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLandlords } from "./aygent-landlords.js";

export const aygentProperties = pgTable(
  "aygent_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    landlordId: uuid("landlord_id").notNull().references(() => aygentLandlords.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    buildingName: text("building_name"),
    streetAddress: text("street_address"),
    area: text("area"),
    propertyType: text("property_type"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    sqft: real("sqft"),
    floor: text("floor"),
    viewType: text("view_type"),
    parkingSpaces: integer("parking_spaces"),
    titleDeedNo: text("title_deed_no"),
    photos: jsonb("photos").$type<string[]>(),
    saleValue: real("sale_value"),
    purchasePrice: real("purchase_price"),
    serviceCharge: real("service_charge"),
    status: text("status").default("vacant"), // occupied, vacant, notice_given
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("aygent_properties_company_idx").on(table.companyId),
    companyStatusIdx: index("aygent_properties_company_status_idx").on(table.companyId, table.status),
    landlordIdx: index("aygent_properties_landlord_idx").on(table.landlordId),
  }),
);
```

- [ ] **Step 3: Create tenancies table**

Port AygentDesk `Tenancy`. Fields: id, companyId, managedPropertyId, tenantName/Phone/Email/Passport/EmiratesId/Nationality/Notes, rent, leaseStart, leaseEnd, securityDeposit, paymentFrequency, ejariNumber, status, timestamps.

```typescript
// packages/db/src/schema/aygent-tenancies.ts
import { pgTable, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";

export const aygentTenancies = pgTable(
  "aygent_tenancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    managedPropertyId: uuid("managed_property_id").notNull().references(() => aygentProperties.id, { onDelete: "cascade" }),
    tenantName: text("tenant_name").notNull(),
    tenantPhone: text("tenant_phone"),
    tenantEmail: text("tenant_email"),
    tenantPassport: text("tenant_passport"),
    tenantEmiratesId: text("tenant_emirates_id"),
    tenantNationality: text("tenant_nationality"),
    tenantNotes: text("tenant_notes"),
    rent: real("rent"),
    leaseStart: timestamp("lease_start", { withTimezone: true }),
    leaseEnd: timestamp("lease_end", { withTimezone: true }),
    securityDeposit: real("security_deposit"),
    paymentFrequency: text("payment_frequency"),
    ejariNumber: text("ejari_number"),
    status: text("status").default("active"), // active, expired, terminated, renewed
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("aygent_tenancies_company_idx").on(table.companyId),
    propertyIdx: index("aygent_tenancies_property_idx").on(table.managedPropertyId),
    companyStatusLeaseEndIdx: index("aygent_tenancies_status_lease_idx").on(table.companyId, table.status, table.leaseEnd),
  }),
);
```

- [ ] **Step 4: Create campaigns tables (campaign + steps + enrollments)**

```typescript
// packages/db/src/schema/aygent-campaigns.ts
import { pgTable, uuid, text, integer, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentCampaigns = pgTable(
  "aygent_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // warm_nurture, cold_outreach, post_viewing, custom
    status: text("status").default("active"), // active, paused, completed
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("aygent_campaigns_company_idx").on(table.companyId),
    statusIdx: index("aygent_campaigns_status_idx").on(table.status),
  }),
);

export const aygentCampaignSteps = pgTable(
  "aygent_campaign_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => aygentCampaigns.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    delayDays: integer("delay_days").default(1),
    delayHours: integer("delay_hours").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueStep: unique("aygent_campaign_steps_unique").on(table.campaignId, table.stepNumber),
  }),
);

export const aygentCampaignEnrollments = pgTable(
  "aygent_campaign_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => aygentCampaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => aygentLeads.id, { onDelete: "cascade" }),
    currentStep: integer("current_step").default(0),
    status: text("status").default("active"), // active, paused, completed, unsubscribed
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    opens: integer("opens").default(0),
    clicks: integer("clicks").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueEnrollment: unique("aygent_enrollments_unique").on(table.campaignId, table.leadId),
    statusNextSendIdx: index("aygent_enrollments_status_next_idx").on(table.status, table.nextSendAt),
  }),
);
```

- [ ] **Step 5: Create documents, portals, DLD, viewings, memory, guardrails, news, call tables**

Create remaining table files following the same pattern. Each file ports the corresponding AygentDesk Prisma model to Drizzle with `companyId`. Reference the Prisma schema at `/Users/alexanderjackson/AgentDXB/prisma/schema.prisma` for exact fields.

Files to create (follow exact same Drizzle patterns as above):

- `aygent-documents.ts` — Port `Document` model (id, companyId, agentId, name, type, fileUrl, fileSize, mimeType, leadId, projectId, landlordId, managedPropertyId, tenancyId, expiresAt, notes, timestamps)
- `aygent-portals.ts` — Port `ClientPortal` + `PortalActivity` models
- `aygent-dld.ts` — Port `DLDTransaction` model (38 denormalized columns + companyId)
- `aygent-viewings.ts` — Port `Viewing` model (id, companyId, agentId, leadId, projectId, calendarEventId, datetime, location, status, reminderSent, confirmationSent, notes, timestamps)
- `aygent-agent-memory.ts` — Port `AgentMemory` model (id, companyId, agentId, type, subject, content, expiresAt, timestamps) with unique on (agentId, subject, type)
- `aygent-guardrails.ts` — Simple table: id, companyId, agentId, rule, condition, action, enabled, timestamps
- `aygent-news.ts` — Port `NewsArticle` model (id, companyId, title, url, source, category, summary, imageUrl, publishedAt, timestamps) with unique on url
- `aygent-call-config.ts` — Port `CallAgentConfig` + `CallScript` models
- `aygent-call-logs.ts` ��� Port `CallLog` model
- `aygent-listing-watches.ts` — Port `ListingWatch` model (id, companyId, agentId, purpose, location, bedrooms, maxPrice, propertyType, isActive, lastChecked, lastCount, timestamps)

- [ ] **Step 6: Export all remaining tables from schema index**

Add all new exports to `packages/db/src/schema/index.ts`.

- [ ] **Step 7: Generate and run migration**

```bash
cd packages/db && pnpm run generate && cd ../..
pnpm db:migrate
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/aygent-*.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat: add all remaining Aygent tables — portfolio, campaigns, docs, DLD, viewings, memory, calls"
```

---

## Wave 2 — Tools Package

Create a `packages/tools` workspace package containing all 63 tools ported from AygentDesk. Tools use Drizzle instead of Prisma.

### Task 4: Tools package setup + project/lead tools

**Files:**
- Create: `packages/tools/package.json`
- Create: `packages/tools/tsconfig.json`
- Create: `packages/tools/src/types.ts`
- Create: `packages/tools/src/index.ts`
- Create: `packages/tools/src/projects.ts`
- Create: `packages/tools/src/leads.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create packages/tools/package.json**

```json
{
  "name": "@aygent/tools",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch"
  },
  "dependencies": {
    "@aygent/db": "workspace:*",
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/tools/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Add to pnpm-workspace.yaml**

Add `packages/tools` to the workspace packages list. Read the file first to see exact format, then add the entry.

- [ ] **Step 4: Create tool types**

```typescript
// packages/tools/src/types.ts
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolContext {
  companyId: string;
  agentId: string;
  db: unknown; // Drizzle db instance — typed loosely here, narrowed in implementation
}

export type ToolExecutor = (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

export interface ToolRegistry {
  definitions: ToolDefinition[];
  executors: Record<string, ToolExecutor>;
  execute: (toolName: string, input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
```

- [ ] **Step 5: Create project tools**

Port `search_projects` and `get_project_details` from AygentDesk `tools.ts`. Replace Prisma queries with Drizzle. Reference: `/Users/alexanderjackson/AgentDXB/src/lib/ai/tools.ts` — search for `search_projects` and `get_project_details` tool definitions.

```typescript
// packages/tools/src/projects.ts
import { eq, and, ilike, gte, lte, sql } from "drizzle-orm";
import { aygentProjects } from "@aygent/db/schema";
import type { ToolDefinition, ToolExecutor, ToolContext } from "./types.js";

export const searchProjectsDef: ToolDefinition = {
  name: "search_projects",
  description: "Search Dubai off-plan projects by name, developer, location, price range, status. Use to find projects matching a lead's criteria.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search by project name (fuzzy match)" },
      developer: { type: "string", description: "Filter by developer name" },
      district: { type: "string", description: "Filter by district/area" },
      minPrice: { type: "number", description: "Minimum price in AED" },
      maxPrice: { type: "number", description: "Maximum price in AED" },
      saleStatus: { type: "string", description: "Filter by sale status" },
      constructionStatus: { type: "string", description: "Filter by construction status" },
      postHandover: { type: "boolean", description: "Filter post-handover payment plans" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
};

export const searchProjects: ToolExecutor = async (input, ctx) => {
  const { db, companyId } = ctx;
  const limit = (input.limit as number) || 10;
  const conditions = [eq(aygentProjects.companyId, companyId)];

  if (input.query) conditions.push(ilike(aygentProjects.name, `%${input.query}%`));
  if (input.developer) conditions.push(ilike(aygentProjects.developer, `%${input.developer}%`));
  if (input.district) conditions.push(ilike(aygentProjects.district, `%${input.district}%`));
  if (input.minPrice) conditions.push(gte(aygentProjects.minPrice, input.minPrice as number));
  if (input.maxPrice) conditions.push(lte(aygentProjects.maxPrice, input.maxPrice as number));
  if (input.saleStatus) conditions.push(eq(aygentProjects.saleStatus, input.saleStatus as string));
  if (input.constructionStatus) conditions.push(eq(aygentProjects.constructionStatus, input.constructionStatus as string));
  if (input.postHandover) conditions.push(eq(aygentProjects.postHandover, true));

  const results = await (db as any).select().from(aygentProjects).where(and(...conditions)).limit(limit);

  return {
    results: results.map((p: any) => ({
      id: p.id,
      name: p.name,
      developer: p.developer,
      district: p.district,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      constructionStatus: p.constructionStatus,
      completionDate: p.completionDate,
      readinessProgress: p.readinessProgress,
      postHandover: p.postHandover,
      unitBreakdown: p.unitBreakdown,
      goldenVisaEligible: (p.maxPrice || 0) >= 2000000,
    })),
    totalAvailable: results.length,
    showing: Math.min(results.length, limit),
  };
};

export const getProjectDetailsDef: ToolDefinition = {
  name: "get_project_details",
  description: "Get full details of a specific project including payment plans, amenities, floor plans, landmarks, and unit breakdown.",
  input_schema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project UUID" },
    },
    required: ["projectId"],
  },
};

export const getProjectDetails: ToolExecutor = async (input, ctx) => {
  const { db, companyId } = ctx;
  const results = await (db as any)
    .select()
    .from(aygentProjects)
    .where(and(eq(aygentProjects.id, input.projectId as string), eq(aygentProjects.companyId, companyId)))
    .limit(1);

  if (results.length === 0) return { error: "Project not found" };
  return results[0];
};
```

- [ ] **Step 6: Create lead tools**

Port `search_leads`, `update_lead`, `get_lead_activity`, `tag_lead`, `untag_lead`, `create_tag`, `list_tags`, `get_follow_ups`, `bulk_follow_up`, `bulk_lead_action`, `reactivate_stale_leads`, `match_deal_to_leads`, `deduplicate_leads`, `merge_leads` from AygentDesk. Follow same pattern as project tools — Drizzle queries replacing Prisma.

Reference: `/Users/alexanderjackson/AgentDXB/src/lib/ai/tools.ts` — search for each tool name.

Each tool gets a `ToolDefinition` (name, description, input_schema) and a `ToolExecutor` function.

- [ ] **Step 7: Create tool registry index**

```typescript
// packages/tools/src/index.ts
import { searchProjectsDef, searchProjects, getProjectDetailsDef, getProjectDetails } from "./projects.js";
// Import all other tool modules...
import type { ToolRegistry, ToolContext } from "./types.js";

export type { ToolDefinition, ToolExecutor, ToolContext, ToolRegistry } from "./types.js";

const definitions = [
  searchProjectsDef,
  getProjectDetailsDef,
  // ... all 63 tool definitions
];

const executors: Record<string, (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>> = {
  search_projects: searchProjects,
  get_project_details: getProjectDetails,
  // ... all 63 executors
};

export function createToolRegistry(): ToolRegistry {
  return {
    definitions,
    executors,
    execute: async (toolName, input, ctx) => {
      const executor = executors[toolName];
      if (!executor) throw new Error(`Unknown tool: ${toolName}`);
      return executor(input, ctx);
    },
  };
}

export function getToolDefinitions(toolNames?: string[]): typeof definitions {
  if (!toolNames) return definitions;
  return definitions.filter((d) => toolNames.includes(d.name));
}
```

- [ ] **Step 8: Install dependencies and build**

```bash
pnpm install
cd packages/tools && pnpm build
```

Expected: Compiles without errors. `dist/` created.

- [ ] **Step 9: Commit**

```bash
git add packages/tools/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: add tools package with project + lead tools ported from AygentDesk"
```

---

### Task 5: Remaining tool modules (communication, calendar, content, market, portfolio, campaigns, portals, documents, admin)

**Files:**
- Create: `packages/tools/src/communication.ts`
- Create: `packages/tools/src/calendar.ts`
- Create: `packages/tools/src/content.ts`
- Create: `packages/tools/src/market.ts`
- Create: `packages/tools/src/portfolio.ts`
- Create: `packages/tools/src/campaigns.ts`
- Create: `packages/tools/src/portals.ts`
- Create: `packages/tools/src/documents.ts`
- Create: `packages/tools/src/admin.ts`
- Create: `packages/tools/src/lib/whatsapp.ts`
- Create: `packages/tools/src/lib/mail.ts`
- Create: `packages/tools/src/lib/instagram.ts`
- Create: `packages/tools/src/lib/bayut.ts`
- Create: `packages/tools/src/lib/tavily.ts`
- Create: `packages/tools/src/lib/calendar-client.ts`
- Create: `packages/tools/src/lib/news.ts`
- Modify: `packages/tools/src/index.ts`

Port all remaining tools from AygentDesk following the same pattern established in Task 4. Each module:

1. Copies the tool definition (name, description, input_schema) from AygentDesk
2. Ports the executor from Prisma to Drizzle queries
3. Copies external API client code into `lib/` (WhatsApp WAHA, Gmail, Instagram, Bayut, Tavily)

**Source files to reference:**
- Tool definitions + executors: `/Users/alexanderjackson/AgentDXB/src/lib/ai/tools.ts`
- WhatsApp client: `/Users/alexanderjackson/AgentDXB/src/lib/whatsapp/waha.ts`
- Gmail client: `/Users/alexanderjackson/AgentDXB/src/lib/mail/unified.ts` + `gmail.ts`
- Instagram client: `/Users/alexanderjackson/AgentDXB/src/lib/instagram/client.ts`
- Bayut scraper: `/Users/alexanderjackson/AgentDXB/src/lib/bayut/scraper.ts`
- News aggregator: `/Users/alexanderjackson/AgentDXB/src/lib/news/aggregator.ts`
- Calendar: `/Users/alexanderjackson/AgentDXB/src/lib/calendar/unified.ts`

For external API clients (`lib/`), copy the implementation largely as-is. The clients talk to external APIs (Meta, Google, Bayut) — they don't touch the database, so no Prisma → Drizzle conversion needed.

- [ ] **Step 1: Create communication tools** — `search_whatsapp`, `send_whatsapp`, `search_email`, `send_email`, `search_instagram_dms`, `send_instagram_dm`, `post_to_instagram`, `list_whatsapp_templates`, `use_whatsapp_template`, `make_call`

- [ ] **Step 2: Create lib/whatsapp.ts** — Copy WAHA client from AygentDesk

- [ ] **Step 3: Create lib/mail.ts** — Copy unified mail client from AygentDesk

- [ ] **Step 4: Create lib/instagram.ts** — Copy Instagram client from AygentDesk

- [ ] **Step 5: Create calendar tools** — `get_calendar`, `create_event`, `check_availability`, `schedule_viewing`, `get_viewings`

- [ ] **Step 6: Create lib/calendar-client.ts** — Copy Google Calendar client from AygentDesk

- [ ] **Step 7: Create content tools** — `generate_pitch_deck`, `generate_pitch_presentation`, `generate_landing_page`, `generate_social_content`, `generate_content`, `generate_market_report`, `launch_campaign`, `create_drip_campaign`, `enroll_lead_in_campaign`

- [ ] **Step 8: Create market tools** — `search_dld_transactions`, `scrape_dxb_transactions`, `get_building_analysis`, `search_listings`, `watch_listings`, `analyze_investment`, `web_search`, `get_news`

- [ ] **Step 9: Create lib/bayut.ts** — Copy Bayut scraper from AygentDesk

- [ ] **Step 10: Create lib/tavily.ts** — Copy Tavily web search wrapper from AygentDesk

- [ ] **Step 11: Create lib/news.ts** — Copy news aggregator from AygentDesk

- [ ] **Step 12: Create portfolio tools** — `manage_landlord`, `manage_property`, `manage_tenancy`, `calculate_rera_rent`, `calculate_dld_fees`

- [ ] **Step 13: Create campaigns tools** — `get_campaign_stats`

- [ ] **Step 14: Create portals tools** — `create_portal`, `get_portal_activity`

- [ ] **Step 15: Create documents tools** — `list_documents`, `extract_document_data`, `scrape_url`

- [ ] **Step 16: Create admin tools** — `create_task`, `remember`, `set_guardrails`

- [ ] **Step 17: Update index.ts with all tool registrations**

- [ ] **Step 18: Build and verify**

```bash
cd packages/tools && pnpm build
```

Expected: Compiles without errors.

- [ ] **Step 19: Commit**

```bash
git add packages/tools/
git commit -m "feat: port all 63 AygentDesk tools to native Drizzle-based tool package"
```

---

## Wave 3 — Skill Library

Markdown files that define domain knowledge, agent behaviour, and the tool catalog.

### Task 6: Domain knowledge skills

**Files:**
- Create: `skills/domain/dubai-market.md`
- Create: `skills/domain/dubai-compliance.md`
- Create: `skills/domain/dubai-buyers.md`
- Create: `skills/domain/multilingual.md`

**Source reference:** AygentDesk system prompt at `/Users/alexanderjackson/AgentDXB/src/lib/ai/prompts.ts` and AygentDesk skill at `/Users/alexanderjackson/AgentDXB/.claude/skills/dubai-real-estate/SKILL.md`

- [ ] **Step 1: Create dubai-market.md**

Extract Dubai market knowledge from AygentDesk's system prompt + dubai-real-estate skill. Include: area names and price ranges (JVC AED 800-1,400/sqft, Downtown AED 2,500-4,500/sqft, etc.), developer tiers, Golden Visa rules (AED 2M+), payment plan structures (10-20% down, construction-linked), key landmarks, off-plan vs secondary.

- [ ] **Step 2: Create dubai-compliance.md**

RERA advertising rules, PDPA data rules, never guarantee yields, escrow rules, disclaimer templates, licence number requirements. Source from AygentDesk's system prompt compliance section.

- [ ] **Step 3: Create dubai-buyers.md**

Buyer personas by nationality. Russian = ROI numbers and direct. Arabic = relationship first, formal, titles. Chinese = formal, relationship-first. English = match their tone. Language preferences per nationality.

- [ ] **Step 4: Create multilingual.md**

Language detection rules (detect from first message, remember per lead). Tone per language. Greeting conventions. Keep project/area names in original form. Supported: Arabic, English, Russian, Chinese, Hindi, Urdu, French.

- [ ] **Step 5: Commit**

```bash
git add skills/domain/
git commit -m "feat: add domain knowledge skills — Dubai market, compliance, buyers, multilingual"
```

---

### Task 7: Behaviour skills + tool catalog

**Files:**
- Create: `skills/behaviour/lead-response.md`
- Create: `skills/behaviour/lead-qualification.md`
- Create: `skills/behaviour/lead-followup.md`
- Create: `skills/behaviour/lead-handoff.md`
- Create: `skills/behaviour/viewing-scheduling.md`
- Create: `skills/behaviour/content-instagram.md`
- Create: `skills/behaviour/content-pitch-deck.md`
- Create: `skills/behaviour/market-monitoring.md`
- Create: `skills/behaviour/portfolio-management.md`
- Create: `skills/behaviour/campaign-management.md`
- Create: `skills/behaviour/call-handling.md`
- Create: `skills/catalog.md`

**Source reference:** AygentDesk system prompt behaviour rules + the spec at `docs/superpowers/specs/2026-03-29-phase1-ceo-driven-agency-builder-design.md`

- [ ] **Step 1: Create lead-response.md**

Rules: respond in same language, first reply max 3 sentences, never quote specific price first, include agent name in sign-off, if asked "are you a bot?" respond naturally, never send second message before lead replies. Include first response template and examples.

- [ ] **Step 2: Create lead-qualification.md**

Qualification sequence: budget range → timeline → financing (cash/mortgage) → area preference. Scoring rubric (0-10): source quality, budget clarity, timeline urgency, prior DLD history. Escalation triggers: score 8+, budget > 5M, explicit broker request.

- [ ] **Step 3: Create lead-followup.md**

Follow-up cadence: score 8-10 = daily, score 5-7 = every 48h, score 1-4 = weekly nurture. Stale lead reactivation rules (inactive > X days). Re-engagement message patterns. When to stop following up.

- [ ] **Step 4: Create remaining behaviour skills**

Create each skill file with clear rules, templates, and examples. Follow the pattern from lead-response/qualification/followup. Each skill should be self-contained — an agent reading only this skill should know exactly how to behave.

- [ ] **Step 5: Create skills/catalog.md**

The menu the CEO sees. One line per skill with description:

```markdown
# Skill Catalog

## Domain Knowledge (assigned to all agents)
- dubai-market: Dubai areas, pricing, developers, Golden Visa, payment plans
- dubai-compliance: RERA rules, PDPA, yield disclaimers, escrow
- dubai-buyers: Buyer personas by nationality, language preferences
- multilingual: Language detection, tone per language, greeting conventions

## Behaviour Skills
- lead-response: First reply rules — < 5 min, match language, max 3 sentences
- lead-qualification: Qualify leads (budget → timeline → financing), scoring 0-10
- lead-followup: Follow-up cadence by score, stale lead reactivation
- lead-handoff: When/how to hand lead to human broker
- viewing-scheduling: Book viewings, propose 3 slots, reminders, post-viewing follow-up
- content-instagram: Daily Instagram posts, carousels, captions, hashtags
- content-pitch-deck: Generate investor pitch decks (3-step approval flow)
- market-monitoring: DLD transaction monitoring, new launch alerts, price movement tracking
- portfolio-management: Landlord management, tenancy lifecycle, RERA rent calculations
- campaign-management: Drip campaign design, enrolment, performance monitoring
- call-handling: Inbound/outbound call scripts, post-call logging

## Tool Groups
- Search & Intel (7 tools): search_projects, get_project_details, search_listings, watch_listings, search_dld_transactions, scrape_dxb_transactions, get_building_analysis
- Communication (10 tools): search_whatsapp, send_whatsapp, search_email, send_email, search_instagram_dms, send_instagram_dm, post_to_instagram, list_whatsapp_templates, use_whatsapp_template, make_call
- Lead Pipeline (14 tools): search_leads, update_lead, get_lead_activity, tag_lead, untag_lead, create_tag, list_tags, get_follow_ups, bulk_follow_up, bulk_lead_action, reactivate_stale_leads, match_deal_to_leads, deduplicate_leads, merge_leads
- Content Generation (9 tools): generate_pitch_deck, generate_pitch_presentation, generate_landing_page, generate_social_content, generate_content, generate_market_report, launch_campaign, create_drip_campaign, enroll_lead_in_campaign
- Calendar & Viewings (5 tools): get_calendar, create_event, check_availability, schedule_viewing, get_viewings
- Portfolio (5 tools): manage_landlord, manage_property, manage_tenancy, calculate_rera_rent, calculate_dld_fees
- Client & Docs (5 tools): create_portal, get_portal_activity, list_documents, extract_document_data, scrape_url
- Market & Admin (7 tools): analyze_investment, web_search, get_news, get_campaign_stats, create_task, remember, set_guardrails
```

- [ ] **Step 6: Commit**

```bash
git add skills/
git commit -m "feat: add behaviour skills + tool catalog for CEO skill assignment"
```

---

## Wave 4 — CEO Agent + Command Handler

### Task 8: CEO agent config files

**Files:**
- Overwrite: `server/src/onboarding-assets/ceo/AGENTS.md`
- Overwrite: `server/src/onboarding-assets/ceo/HEARTBEAT.md`
- Overwrite: `server/src/onboarding-assets/ceo/SOUL.md`
- Overwrite: `server/src/onboarding-assets/ceo/TOOLS.md`

- [ ] **Step 1: Write CEO AGENTS.md**

The CEO's role definition. Must include:
- You are the CEO of this agency. You are the company architect.
- Two modes: Builder (no team) and Coordinator (team exists)
- Builder mode interview playbook: ask vision → ask pain points → ask scale → propose team → configure agents → hire
- Coordinator mode: delegate, brief, escalate, report
- The full skill catalog (inline or referenced)
- The structured command format for `hire_team`, `pause_agent`, `resume_agent`, `pause_all`, `resume_all`, `update_agent_config`
- Cost estimation formula (heartbeats × ~$0.05-0.10 per run = daily cost)
- Two-step hiring: structure then per-agent configuration
- User can provide templates, tone preferences, restrictions, or say "you decide"
- Always close the loop: after an agent acts, report back to the owner
- Welcome-back briefing when owner returns after 2+ hours
- Never talk to sub-agents' clients directly — delegate via issues

Read the existing files first to understand Paperclip's conventions, then overwrite with Aygency World CEO config.

- [ ] **Step 2: Write CEO HEARTBEAT.md**

The CEO's execution checklist per heartbeat. Must include:
1. Check identity (GET /api/agents/me)
2. Check if any agents have been hired yet → if not, enter Builder mode
3. If Builder mode: continue the interview conversation
4. If Coordinator mode:
   a. Check for completed agent runs → report results to owner
   b. Check for pending approvals → remind owner
   c. Check for escalations → flag immediately
   d. If owner has been away > 2 hours → generate welcome-back brief
   e. Check for new issues assigned to CEO → triage and delegate
5. Fact extraction: save durable facts to memory
6. Exit with status comment

- [ ] **Step 3: Write CEO SOUL.md**

CEO personality for a Dubai RE agency:
- Professional but warm — not corporate, not casual
- Knowledgeable about Dubai real estate market
- Thinks in terms of business outcomes (leads converted, deals closed, response time)
- Direct: leads with the answer, not the reasoning
- Gives cost/value context: "this will cost ~$X/day but should recover Y leads"
- Never uses filler: no "I'd be happy to", no "Great question"
- Adapts formality to the owner's tone
- Numbers-oriented: always quantify impact where possible

- [ ] **Step 4: Write CEO TOOLS.md**

Document the structured command format with examples:

```markdown
# CEO Commands

When you need to perform an action (hire agents, pause agents, etc.), emit a structured command block in your message.

## hire_team

\`\`\`paperclip-command
{
  "action": "hire_team",
  "departments": [
    {
      "name": "Department Name",
      "agents": [
        {
          "name": "Agent Name",
          "role": "Role description",
          "focus": "Area of focus",
          "persona": "Personality and tone description",
          "skills": ["skill-name-1", "skill-name-2"],
          "tools": ["tool_name_1", "tool_name_2"],
          "heartbeat_minutes": 15,
          "custom_instructions": "Any user-specified instructions, templates, or restrictions",
          "reports_to": "Manager Agent Name" or null
        }
      ]
    }
  ]
}
\`\`\`

## pause_agent / resume_agent
\`\`\`paperclip-command
{ "action": "pause_agent", "agent_name": "Layla" }
\`\`\`

## pause_all / resume_all
\`\`\`paperclip-command
{ "action": "pause_all" }
\`\`\`

## update_agent_config
\`\`\`paperclip-command
{
  "action": "update_agent_config",
  "agent_name": "Layla",
  "updates": {
    "custom_instructions": "Updated instructions...",
    "skills_add": ["new-skill"],
    "skills_remove": ["old-skill"]
  }
}
\`\`\`
```

- [ ] **Step 5: Commit**

```bash
git add server/src/onboarding-assets/ceo/
git commit -m "feat: CEO agent config — company architect with interview playbook and command format"
```

---

### Task 9: Command handler service

**Files:**
- Create: `server/src/services/ceo-commands.ts`
- Modify: `server/src/services/index.ts`
- Modify: `server/src/routes/issues.ts` (hook into comment creation)

**Source reference for Paperclip APIs:**
- Agent creation: `server/src/services/agents.ts` — `agentService(db).create()`
- Routine creation: `server/src/services/routines.ts` — `routineService(db).create()`
- Project creation: `server/src/services/projects.ts`
- Issue comments: `server/src/routes/issues.ts` — POST comment endpoint
- Live events: `server/src/services/live-events.ts` — `publishLiveEvent()`

- [ ] **Step 1: Create ceo-commands.ts**

```typescript
// server/src/services/ceo-commands.ts
import type { Db } from "@aygent/db";
import { agentService } from "./agents.js";
import { routineService } from "./routines.js";
import { publishLiveEvent } from "./live-events.js";

interface HireAgent {
  name: string;
  role: string;
  focus?: string;
  persona?: string;
  skills: string[];
  tools: string[];
  heartbeat_minutes: number;
  custom_instructions?: string;
  reports_to?: string | null;
}

interface HireTeamCommand {
  action: "hire_team";
  departments: Array<{
    name: string;
    agents: HireAgent[];
  }>;
}

interface PauseAgentCommand {
  action: "pause_agent";
  agent_name: string;
}

interface ResumeAgentCommand {
  action: "resume_agent";
  agent_name: string;
}

interface PauseAllCommand {
  action: "pause_all";
}

interface ResumeAllCommand {
  action: "resume_all";
}

interface UpdateAgentConfigCommand {
  action: "update_agent_config";
  agent_name: string;
  updates: {
    custom_instructions?: string;
    skills_add?: string[];
    skills_remove?: string[];
  };
}

type CeoCommand =
  | HireTeamCommand
  | PauseAgentCommand
  | ResumeAgentCommand
  | PauseAllCommand
  | ResumeAllCommand
  | UpdateAgentConfigCommand;

const COMMAND_PATTERN = /```paperclip-command\s*\n([\s\S]*?)\n```/;

export function ceoCommandService(db: Db) {
  return {
    /** Check if a comment body contains a CEO command */
    hasCommand(body: string): boolean {
      return COMMAND_PATTERN.test(body);
    },

    /** Parse and extract command from comment body */
    parseCommand(body: string): CeoCommand | null {
      const match = body.match(COMMAND_PATTERN);
      if (!match) return null;
      try {
        return JSON.parse(match[1]) as CeoCommand;
      } catch {
        return null;
      }
    },

    /** Execute a parsed command */
    async execute(command: CeoCommand, companyId: string, issueId: string): Promise<string> {
      switch (command.action) {
        case "hire_team":
          return this.executeHireTeam(command, companyId);
        case "pause_agent":
          return this.executePauseAgent(command, companyId);
        case "resume_agent":
          return this.executeResumeAgent(command, companyId);
        case "pause_all":
          return this.executePauseAll(companyId);
        case "resume_all":
          return this.executeResumeAll(companyId);
        case "update_agent_config":
          return this.executeUpdateConfig(command, companyId);
        default:
          return `Unknown command action: ${(command as any).action}`;
      }
    },

    async executeHireTeam(command: HireTeamCommand, companyId: string): Promise<string> {
      const agentSvc = agentService(db);
      const routineSvc = routineService(db);
      const hired: string[] = [];
      const agentNameToId: Record<string, string> = {};

      for (const dept of command.departments) {
        // Create project for department
        // Note: use projectService if available, or create directly

        for (const agentDef of dept.agents) {
          // Resolve reports_to to agent ID
          const reportsTo = agentDef.reports_to ? agentNameToId[agentDef.reports_to] : undefined;

          // Create agent
          const agent = await agentSvc.create(companyId, {
            name: agentDef.name,
            role: "specialist",
            title: agentDef.role,
            reportsTo: reportsTo || undefined,
            adapterType: "claude_local",
            adapterConfig: {
              model: "claude-sonnet-4-6",
            },
            desiredSkills: [...agentDef.skills, ...agentDef.tools.map((t) => `tool-${t}`)],
            metadata: {
              focus: agentDef.focus,
              persona: agentDef.persona,
              customInstructions: agentDef.custom_instructions,
              department: dept.name,
            },
          });

          agentNameToId[agentDef.name] = agent.id;

          // Create routine with cron trigger for heartbeat
          const cronExpression = this.minutesToCron(agentDef.heartbeat_minutes);
          const routine = await routineSvc.create(companyId, {
            title: `${agentDef.name} heartbeat`,
            assigneeAgentId: agent.id,
            status: "active",
            concurrencyPolicy: "coalesce_if_active",
            catchUpPolicy: "skip_missed",
          });

          // Create cron trigger
          await routineSvc.createTrigger(routine.id, companyId, {
            kind: "cron",
            enabled: true,
            cronExpression,
            timezone: "Asia/Dubai",
          });

          hired.push(`${agentDef.name} (${agentDef.role})`);

          publishLiveEvent({
            companyId,
            type: "agent:created",
            payload: { agentId: agent.id, name: agentDef.name, role: agentDef.role },
          });
        }
      }

      return `Hired ${hired.length} agents: ${hired.join(", ")}. All heartbeat schedules active.`;
    },

    async executePauseAgent(command: PauseAgentCommand, companyId: string): Promise<string> {
      // Find agent by name, set status to paused, pause their routines
      // Implementation uses agentService + routineService
      return `Paused ${command.agent_name}.`;
    },

    async executeResumeAgent(command: ResumeAgentCommand, companyId: string): Promise<string> {
      return `Resumed ${command.agent_name}.`;
    },

    async executePauseAll(companyId: string): Promise<string> {
      return "All agents paused.";
    },

    async executeResumeAll(companyId: string): Promise<string> {
      return "All agents resumed.";
    },

    async executeUpdateConfig(command: UpdateAgentConfigCommand, companyId: string): Promise<string> {
      return `Updated ${command.agent_name}'s configuration.`;
    },

    /** Convert heartbeat minutes to cron expression */
    minutesToCron(minutes: number): string {
      if (minutes <= 0) return "0 * * * *"; // hourly fallback
      if (minutes < 60) return `*/${minutes} * * * *`;
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    },
  };
}
```

- [ ] **Step 2: Export from services index**

Add to `server/src/services/index.ts`:
```typescript
export { ceoCommandService } from "./ceo-commands.js";
```

- [ ] **Step 3: Hook into comment creation flow**

Find the POST comment endpoint in `server/src/routes/issues.ts`. After a comment is successfully created, check if it contains a CEO command and execute it.

Read `server/src/routes/issues.ts` to find the exact comment creation handler, then add:

```typescript
// After comment is created and saved:
const cmdSvc = ceoCommandService(db);
if (cmdSvc.hasCommand(comment.body)) {
  const command = cmdSvc.parseCommand(comment.body);
  if (command) {
    const result = await cmdSvc.execute(command, companyId, issueId);
    // Create a follow-up system comment with the result
    await issueService(db).createComment(issueId, {
      body: `**System:** ${result}`,
      authorType: "system",
    });
  }
}
```

- [ ] **Step 4: Test command parsing**

Create a simple test to verify command parsing works:

```bash
cd server && pnpm test -- --grep "ceo-commands"
```

Write a test file `server/src/services/__tests__/ceo-commands.test.ts` that verifies:
- `hasCommand()` detects command blocks
- `parseCommand()` extracts valid JSON
- `minutesToCron()` converts correctly (15 → `*/15 * * * *`, 60 → `0 */1 * * *`, 240 → `0 */4 * * *`)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ceo-commands.ts server/src/services/index.ts server/src/routes/issues.ts server/src/services/__tests__/
git commit -m "feat: CEO command handler — hire_team, pause/resume, update_agent_config"
```

---

## Wave 5 — Live Activity Panel (UI)

### Task 10: Agent status cards + activity feed

**Files:**
- Create: `ui/src/components/AgentStatusCard.tsx`
- Create: `ui/src/components/ActivityFeed.tsx`
- Create: `ui/src/components/LiveActivityPanel.tsx`

**Source reference:**
- WebSocket subscription: `ui/src/context/LiveUpdatesProvider.tsx`
- Existing run widget: `ui/src/components/LiveRunWidget.tsx`
- Existing agent cards: `ui/src/pages/Agents.tsx`

- [ ] **Step 1: Read existing UI patterns**

Read these files to understand component conventions, imports, hooks, and styling:
- `ui/src/components/LiveRunWidget.tsx`
- `ui/src/context/LiveUpdatesProvider.tsx`
- `ui/src/pages/Agents.tsx`
- `ui/src/components/ui/card.tsx`
- `ui/src/components/ui/badge.tsx`

- [ ] **Step 2: Create AgentStatusCard.tsx**

A card per agent showing: avatar/icon, name, role, status (idle/working/waiting/paused), current action text, last action with timestamp, today's stats.

Status indicator: coloured dot with CSS animation (grey pulse = idle, green pulse = working, blue pulse = waiting for approval, amber = thinking, red = paused).

Use Paperclip's existing `Card` component from `ui/src/components/ui/card.tsx`. Subscribe to WebSocket events for real-time status updates.

```typescript
// Approximate structure — adapt to match existing Paperclip UI patterns
interface AgentStatusCardProps {
  agent: {
    id: string;
    name: string;
    title: string;
    status: "idle" | "working" | "waiting" | "paused";
    currentAction?: string;
    lastAction?: string;
    lastActionTime?: string;
    todayStats?: { leadsHandled: number; messagesDrafted: number; approvalsPending: number };
  };
}
```

- [ ] **Step 3: Create ActivityFeed.tsx**

Scrolling feed of real-time events across all agents. Each line: timestamp, agent name (colour-coded), action description. Auto-scrolls but pauses on hover.

Subscribe to WebSocket events: `heartbeat:started`, `heartbeat:completed`, and custom `agent:action` events. Parse heartbeat run events into human-readable descriptions.

```typescript
interface ActivityEvent {
  timestamp: string;
  agentName: string;
  agentColor: string;
  action: string;
  type: "info" | "success" | "waiting" | "error";
}
```

Use a `useRef` for the scroll container and `scrollTo({ behavior: "smooth" })` for auto-scroll. Track `isHovering` state to pause auto-scroll on mouse enter.

- [ ] **Step 4: Create LiveActivityPanel.tsx**

Combines AgentStatusCard grid + ActivityFeed. Laid out as:
- Top: row/grid of AgentStatusCards (responsive — 2-3 per row on desktop, 1 on mobile)
- Bottom: ActivityFeed (scrolling, takes remaining height)

Toggle between "compact" (just status dots + names) and "expanded" (full cards + feed).

- [ ] **Step 5: Add to layout**

Read `ui/src/components/Layout.tsx` and `ui/src/components/Sidebar.tsx`. Add a nav item or sidebar toggle for the activity panel. The panel can render as a right sidebar or overlay — match the existing Paperclip UI pattern for secondary panels.

- [ ] **Step 6: Verify it renders**

```bash
pnpm dev
```

Open browser, navigate to the dashboard. The activity panel should render (empty state — no agents yet). Verify no console errors.

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/AgentStatusCard.tsx ui/src/components/ActivityFeed.tsx ui/src/components/LiveActivityPanel.tsx ui/src/components/Layout.tsx ui/src/components/Sidebar.tsx
git commit -m "feat: live activity panel — agent status cards + scrolling activity feed"
```

---

## Wave 6 — Seed Data + Demo Flow

### Task 11: Project seed script

**Files:**
- Create: `scripts/seed-projects.ts`

**Source reference:** AygentDesk Reelly sync script at `/Users/alexanderjackson/AgentDXB/scripts/sync-reelly.ts`

- [ ] **Step 1: Create seed-projects.ts**

Port the Reelly sync script to use Drizzle instead of Prisma. The script:
1. Fetches all projects from Reelly API (paginated)
2. Fetches project details in batches
3. Upserts to `aygent_projects` table via Drizzle
4. Takes `companyId` as a CLI argument

```bash
npx tsx scripts/seed-projects.ts --company-id <uuid>
```

Reference the API endpoints and data mapping from `/Users/alexanderjackson/AgentDXB/scripts/sync-reelly.ts`.

- [ ] **Step 2: Run seed**

```bash
npx tsx scripts/seed-projects.ts --company-id <demo-company-uuid>
```

Expected: ~1,800 projects inserted. Verify with Drizzle Studio:
```bash
pnpm db:studio
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-projects.ts
git commit -m "feat: project seed script — imports 1,800 Dubai off-plan projects from Reelly API"
```

---

### Task 12: End-to-end demo flow test

**Files:** No new files — this task verifies everything works together.

**Prerequisites:** All previous tasks complete. Database migrated. Projects seeded. Server running.

- [ ] **Step 1: Start the server**

```bash
pnpm dev
```

Verify: server starts on port 3001, UI loads in browser.

- [ ] **Step 2: Create a company and CEO agent**

Use the Paperclip UI to create a new company. A CEO agent should be created automatically (via onboarding assets). Verify the CEO exists in the agent list.

- [ ] **Step 3: Trigger CEO heartbeat**

Manually trigger the CEO agent's heartbeat. The CEO should enter Builder mode (no team hired yet) and post an introductory message as a comment on its assigned issue.

Verify: CEO comment appears asking about the user's vision and pain points.

- [ ] **Step 4: Simulate user conversation**

Reply to the CEO's comment with: "I run a small agency in Dubai. Off-plan focus, JVC and Downtown. Two brokers, Sara and Mohammed. My biggest problem is leads going cold — I get 30-40 enquiries a week but can only follow up on maybe 10."

Trigger CEO heartbeat again. CEO should propose a team.

- [ ] **Step 5: Approve the team**

Reply: "Go." Trigger CEO heartbeat. CEO should emit `hire_team` command. The command handler should create agents.

Verify: new agents appear in the agent list, routines created with correct cron schedules, activity panel shows the new agents.

- [ ] **Step 6: Create a fake inbound lead**

Create a Paperclip issue assigned to the Lead Agent (JVC):
- Title: "New lead: Ahmed Al Hashimi — JVC, 800K AED"
- Body: "Hi, I'm interested in apartments in JVC, budget around 800K AED"

- [ ] **Step 7: Trigger Lead Agent heartbeat**

Manually trigger the Lead Agent's heartbeat. The agent should:
1. Pick up the issue
2. Run `search_projects` (should find JVC projects from seed data)
3. Score the lead
4. Draft a WhatsApp response
5. Post result as a comment

Verify: comment appears with the drafted response. Activity panel shows the agent's actions.

- [ ] **Step 8: Trigger CEO heartbeat (close the loop)**

Trigger CEO heartbeat. CEO should read the Lead Agent's result and post a summary to the owner.

Verify: CEO comment appears reporting what happened.

- [ ] **Step 9: Commit any fixes from the demo run**

```bash
git add -A
git commit -m "fix: demo flow adjustments from end-to-end testing"
```

---

## Summary

| Wave | Tasks | What it produces |
|------|-------|-----------------|
| **Wave 1** | Tasks 1-3 | Database: all Drizzle tables matching AygentDesk |
| **Wave 2** | Tasks 4-5 | Tools: all 63 tools as a native package |
| **Wave 3** | Tasks 6-7 | Skills: domain knowledge + behaviour + catalog |
| **Wave 4** | Tasks 8-9 | CEO: agent config + command handler |
| **Wave 5** | Task 10 | UI: live activity panel |
| **Wave 6** | Tasks 11-12 | Seed data + end-to-end demo test |

Each wave produces independently testable output. Wave 1 can be verified with `pnpm db:studio`. Wave 2 with `pnpm build`. Wave 3 by reading the markdown files. Wave 4 with unit tests. Wave 5 by loading the UI. Wave 6 is the full integration test.
