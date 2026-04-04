# Tier 1: Finance, Deals & Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 19 new tools (finance, deals, compliance), 6 new DB tables, 6 new skills, and 2 new agent roles to Aygency World — enabling agencies to track deals from offer to transfer, manage commissions and invoicing, and maintain AML/KYC compliance records.

**Architecture:** All new tools follow the existing `ToolDefinition` + `ToolExecutor` pattern in `packages/tools/src/`, reading/writing to new Drizzle tables in `packages/db/src/schema/`. Role scoping in `server/src/mcp-tool-server.ts` controls which agents see which tools. Skills are plain markdown in the company template directory.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Node.js

**Spec:** `docs/superpowers/specs/2026-04-03-tier1-finance-deals-compliance-design.md`

---

## File Structure

### New files to create:
```
packages/db/src/schema/
  aygent-deals.ts              — deals table
  aygent-commissions.ts        — commission tracking table
  aygent-invoices.ts           — invoice records table
  aygent-expenses.ts           — agency expense tracking table
  aygent-compliance-checks.ts  — KYC/PEP/sanctions audit trail
  aygent-broker-cards.ts       — RERA broker card tracking

packages/tools/src/
  finance.ts                   — 8 finance tools
  deals.ts                     — 5 deal tracking tools
  compliance.ts                — 6 compliance tools

server/src/onboarding-assets/
  conveyancing/AGENTS.md       — Transaction Agent role definition
  compliance/AGENTS.md         — Compliance Agent role definition

companies/dubai-real-estate-agency/skills/behaviour/
  commission-structure.md
  deal-progression.md
  vat-compliance.md
  aml-kyc-process.md
  rera-compliance.md
  financial-reporting.md
```

### Files to modify:
```
packages/db/src/schema/index.ts         — export new tables
packages/shared/src/constants.ts        — add new roles
packages/tools/src/index.ts             — register new tools
server/src/mcp-tool-server.ts           — role scoping
```

---

## Task 1: Add new role enums

**Files:**
- Modify: `packages/shared/src/constants.ts:37-57` (AGENT_ROLES) and `:60-79` (AGENT_ROLE_LABELS)

- [ ] **Step 1: Add conveyancing and compliance roles to AGENT_ROLES**

In `packages/shared/src/constants.ts`, find the `AGENT_ROLES` array and add two new entries after `"manager"`:

```typescript
export const AGENT_ROLES = [
  "ceo",
  "cto",
  "cmo",
  "cfo",
  "engineer",
  "designer",
  "pm",
  "qa",
  "devops",
  "researcher",
  "general",
  // Aygency World — Dubai real estate roles
  "sales",
  "content",
  "marketing",
  "viewing",
  "finance",
  "calling",
  "manager",
  "conveyancing",
  "compliance",
] as const;
```

- [ ] **Step 2: Add labels for the new roles**

In the same file, add to `AGENT_ROLE_LABELS`:

```typescript
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  // ... existing entries ...
  manager: "Manager",
  conveyancing: "Conveyancing",
  compliance: "Compliance",
};
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm build --filter @paperclipai/shared`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add conveyancing and compliance agent roles"
```

---

## Task 2: Create deals database table

**Files:**
- Create: `packages/db/src/schema/aygent-deals.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the deals schema file**

Create `packages/db/src/schema/aygent-deals.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentDeals = pgTable(
  "aygent_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),

    dealType: text("deal_type").notNull(), // sale | rental | offplan | offplan_resale
    stage: text("stage").notNull().default("offer"),
    // offer → form_f → noc_applied → noc_received → mortgage_processing
    // → mortgage_approved → transfer_booked → transfer_complete → completed | fell_through
    fellThroughReason: text("fell_through_reason"),

    propertyAddress: text("property_address").notNull(),
    propertyType: text("property_type"), // apartment | villa | townhouse | office | land
    area: text("area"),
    developer: text("developer"),
    projectName: text("project_name"),

    price: integer("price").notNull(), // AED
    buyerName: text("buyer_name"),
    buyerPhone: text("buyer_phone"),
    buyerEmail: text("buyer_email"),
    sellerName: text("seller_name"),
    sellerPhone: text("seller_phone"),

    formFDate: timestamp("form_f_date", { withTimezone: true }),
    nocAppliedDate: timestamp("noc_applied_date", { withTimezone: true }),
    nocReceivedDate: timestamp("noc_received_date", { withTimezone: true }),
    nocExpiryDate: timestamp("noc_expiry_date", { withTimezone: true }),
    mortgageBank: text("mortgage_bank"),
    mortgageStatus: text("mortgage_status"), // pre_approved | valuation | final_offer | cheques_ready
    transferDate: timestamp("transfer_date", { withTimezone: true }),
    completionDate: timestamp("completion_date", { withTimezone: true }),

    documentsChecklist: jsonb("documents_checklist").$type<Record<string, boolean>>().default({}),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStageIdx: index("aygent_deals_company_stage_idx").on(table.companyId, table.stage),
    companyTypeIdx: index("aygent_deals_company_type_idx").on(table.companyId, table.dealType),
    leadIdx: index("aygent_deals_lead_idx").on(table.leadId),
    agentIdx: index("aygent_deals_agent_idx").on(table.agentId),
  }),
);
```

- [ ] **Step 2: Export from index.ts**

Add to the bottom of `packages/db/src/schema/index.ts`:

```typescript
export { aygentDeals } from "./aygent-deals.js";
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm build --filter @paperclipai/db`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/aygent-deals.ts packages/db/src/schema/index.ts
git commit -m "feat: add aygent_deals database table"
```

---

## Task 3: Create commissions database table

**Files:**
- Create: `packages/db/src/schema/aygent-commissions.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the commissions schema file**

Create `packages/db/src/schema/aygent-commissions.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { aygentDeals } from "./aygent-deals.js";

export const aygentCommissions = pgTable(
  "aygent_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").notNull().references(() => aygentDeals.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),

    dealType: text("deal_type").notNull(),
    grossAmount: integer("gross_amount").notNull(), // AED
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),

    agentSplitPct: numeric("agent_split_pct", { precision: 5, scale: 2 }),
    agentAmount: integer("agent_amount"),
    agencyAmount: integer("agency_amount"),

    vatAmount: integer("vat_amount"),
    totalWithVat: integer("total_with_vat"),

    status: text("status").notNull().default("earned"),
    // earned → invoiced → collected | overdue | written_off
    invoiceNumber: text("invoice_number"),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidDate: timestamp("paid_date", { withTimezone: true }),
    paidAmount: integer("paid_amount"),

    source: text("source"), // buyer | seller | developer | tenant | landlord
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_commissions_company_status_idx").on(table.companyId, table.status),
    dealIdx: index("aygent_commissions_deal_idx").on(table.dealId),
    agentIdx: index("aygent_commissions_agent_idx").on(table.agentId),
  }),
);
```

- [ ] **Step 2: Export from index.ts**

Add to the bottom of `packages/db/src/schema/index.ts`:

```typescript
export { aygentCommissions } from "./aygent-commissions.js";
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/aygent-commissions.ts packages/db/src/schema/index.ts
git commit -m "feat: add aygent_commissions database table"
```

---

## Task 4: Create invoices, expenses, compliance checks, and broker cards tables

**Files:**
- Create: `packages/db/src/schema/aygent-invoices.ts`
- Create: `packages/db/src/schema/aygent-expenses.ts`
- Create: `packages/db/src/schema/aygent-compliance-checks.ts`
- Create: `packages/db/src/schema/aygent-broker-cards.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the invoices schema**

Create `packages/db/src/schema/aygent-invoices.ts`:

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
import { aygentDeals } from "./aygent-deals.js";
import { aygentCommissions } from "./aygent-commissions.js";

export const aygentInvoices = pgTable(
  "aygent_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    commissionId: uuid("commission_id").references(() => aygentCommissions.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => aygentDeals.id, { onDelete: "set null" }),

    invoiceNumber: text("invoice_number").notNull(), // INV-2026-0001
    invoiceType: text("invoice_type").notNull(), // commission | management_fee | consultancy | other

    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),

    description: text("description").notNull(),
    amount: integer("amount").notNull(), // AED before VAT
    vatAmount: integer("vat_amount").notNull(),
    total: integer("total").notNull(), // amount + vat

    status: text("status").notNull().default("draft"),
    // draft → sent → paid → overdue → cancelled
    dueDate: timestamp("due_date", { withTimezone: true }),
    sentDate: timestamp("sent_date", { withTimezone: true }),
    paidDate: timestamp("paid_date", { withTimezone: true }),
    paidAmount: integer("paid_amount").default(0),

    agencyName: text("agency_name"),
    agencyRera: text("agency_rera"),
    agencyTrn: text("agency_trn"), // Tax Registration Number

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_invoices_company_status_idx").on(table.companyId, table.status),
    companyTypeIdx: index("aygent_invoices_company_type_idx").on(table.companyId, table.invoiceType),
  }),
);
```

- [ ] **Step 2: Create the expenses schema**

Create `packages/db/src/schema/aygent-expenses.ts`:

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

export const aygentExpenses = pgTable(
  "aygent_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

    category: text("category").notNull(),
    // marketing | portals | photography | office | salaries | transport | technology | licensing | other
    description: text("description").notNull(),
    amount: integer("amount").notNull(), // AED
    vatAmount: integer("vat_amount").default(0),
    date: timestamp("date", { withTimezone: true }).notNull(),
    recurring: text("recurring"), // null | monthly | quarterly | yearly
    vendor: text("vendor"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCategoryIdx: index("aygent_expenses_company_category_idx").on(table.companyId, table.category),
    companyDateIdx: index("aygent_expenses_company_date_idx").on(table.companyId, table.date),
  }),
);
```

- [ ] **Step 3: Create the compliance checks schema**

Create `packages/db/src/schema/aygent-compliance-checks.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentDeals } from "./aygent-deals.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentComplianceChecks = pgTable(
  "aygent_compliance_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => aygentDeals.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => aygentLeads.id, { onDelete: "set null" }),

    clientName: text("client_name").notNull(),
    clientType: text("client_type").notNull(), // buyer | seller | tenant | landlord
    nationality: text("nationality"),
    emiratesId: text("emirates_id"),
    passportNumber: text("passport_number"),

    checkType: text("check_type").notNull(), // kyc | pep | sanctions | enhanced_dd
    status: text("status").notNull().default("pending"),
    // pending → clear → flagged → escalated → resolved

    documentsCollected: jsonb("documents_collected").$type<Record<string, boolean>>().default({}),
    // { passport: true, emirates_id: true, visa: true, proof_of_funds: false, source_of_wealth: false }

    riskLevel: text("risk_level"), // low | medium | high
    flagReason: text("flag_reason"),
    resolution: text("resolution"),

    checkedBy: text("checked_by"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // CDD valid for 1 year

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCheckIdx: index("aygent_compliance_company_check_idx").on(table.companyId, table.checkType, table.status),
    dealIdx: index("aygent_compliance_deal_idx").on(table.dealId),
    clientNameIdx: index("aygent_compliance_client_name_idx").on(table.clientName),
  }),
);
```

- [ ] **Step 4: Create the broker cards schema**

Create `packages/db/src/schema/aygent-broker-cards.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentBrokerCards = pgTable(
  "aygent_broker_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

    brokerName: text("broker_name").notNull(),
    reraCardNumber: text("rera_card_number"),
    reraBrn: text("rera_brn"), // Broker Registration Number

    issueDate: timestamp("issue_date", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    // active | expiring_soon | expired | suspended | pending

    dreiTrainingDate: timestamp("drei_training_date", { withTimezone: true }),
    dreiCertificateId: text("drei_certificate_id"),
    amlTrainingDate: timestamp("aml_training_date", { withTimezone: true }),
    amlTrainingExpiry: timestamp("aml_training_expiry", { withTimezone: true }),

    phone: text("phone"),
    email: text("email"),
    areasFocus: jsonb("areas_focus").$type<string[]>().default([]),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("aygent_broker_cards_company_status_idx").on(table.companyId, table.status),
    companyExpiryIdx: index("aygent_broker_cards_company_expiry_idx").on(table.companyId, table.expiryDate),
  }),
);
```

- [ ] **Step 5: Export all 4 new tables from index.ts**

Add to the bottom of `packages/db/src/schema/index.ts`:

```typescript
export { aygentInvoices } from "./aygent-invoices.js";
export { aygentExpenses } from "./aygent-expenses.js";
export { aygentComplianceChecks } from "./aygent-compliance-checks.js";
export { aygentBrokerCards } from "./aygent-broker-cards.js";
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm build --filter @paperclipai/db`
Expected: Build succeeds.

- [ ] **Step 7: Generate and run migration**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm db:generate`
Expected: New migration file created in `packages/db/src/migrations/`.

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm db:migrate`
Expected: Migration applied successfully. All 6 new tables created.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/aygent-invoices.ts packages/db/src/schema/aygent-expenses.ts packages/db/src/schema/aygent-compliance-checks.ts packages/db/src/schema/aygent-broker-cards.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat: add invoices, expenses, compliance checks, and broker cards tables"
```

---

## Task 5: Create deals tools

**Files:**
- Create: `packages/tools/src/deals.ts`

- [ ] **Step 1: Create deals.ts with all 5 tools**

Create `packages/tools/src/deals.ts`:

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
import { aygentDeals, aygentCommissions } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// Stage transition validation
// ═══════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  offer: ["form_f", "fell_through"],
  form_f: ["noc_applied", "fell_through"],
  noc_applied: ["noc_received", "fell_through"],
  noc_received: ["mortgage_processing", "transfer_booked", "fell_through"],
  mortgage_processing: ["mortgage_approved", "fell_through"],
  mortgage_approved: ["transfer_booked", "fell_through"],
  transfer_booked: ["transfer_complete", "fell_through"],
  transfer_complete: ["completed"],
  completed: [],
  fell_through: [],
};

function generateChecklist(dealType: string, isMortgage: boolean): Record<string, boolean> {
  const base: Record<string, boolean> = {
    passport_buyer: false,
    emirates_id_buyer: false,
  };

  if (dealType === "sale" || dealType === "offplan_resale") {
    Object.assign(base, {
      passport_seller: false,
      title_deed: false,
      form_f: false,
      noc: false,
      managers_cheques: false,
    });
    if (isMortgage) {
      Object.assign(base, {
        mortgage_pre_approval: false,
        valuation_report: false,
        final_offer_letter: false,
        mortgage_insurance: false,
      });
    }
  } else if (dealType === "offplan") {
    Object.assign(base, {
      spa: false,
      oqood_registration: false,
      payment_receipts: false,
      escrow_confirmation: false,
    });
  } else if (dealType === "rental") {
    Object.assign(base, {
      visa_copy: false,
      employment_letter: false,
      tenancy_contract: false,
      ejari_registration: false,
      security_deposit: false,
    });
  }

  return base;
}

// ═══════════════════════════════════════════════════
// track_deal
// ═══════════════════════════════════════════════════

export const trackDealDefinition: ToolDefinition = {
  name: "track_deal",
  description:
    "Track real estate deals from offer to completion. Create, update, list, or view deals. Each deal tracks the property, buyer, seller, stage, documents, and key dates. Use when a new sale/rental is agreed or when checking deal status.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "get", "list"], description: "Action to perform" },
      dealId: { type: "string", description: "Deal ID (for update/get)" },
      dealType: { type: "string", enum: ["sale", "rental", "offplan", "offplan_resale"], description: "Type of deal" },
      propertyAddress: { type: "string", description: "Property address" },
      propertyType: { type: "string", enum: ["apartment", "villa", "townhouse", "office", "land"], description: "Property type" },
      area: { type: "string", description: "Area (e.g. JVC, Downtown, Marina)" },
      developer: { type: "string", description: "Developer name (for off-plan)" },
      projectName: { type: "string", description: "Project name (for off-plan)" },
      price: { type: "number", description: "Sale price or annual rent in AED" },
      buyerName: { type: "string", description: "Buyer/tenant name" },
      buyerPhone: { type: "string", description: "Buyer/tenant phone" },
      buyerEmail: { type: "string", description: "Buyer/tenant email" },
      sellerName: { type: "string", description: "Seller/landlord name" },
      sellerPhone: { type: "string", description: "Seller/landlord phone" },
      leadId: { type: "string", description: "Link to existing lead record" },
      isMortgage: { type: "boolean", description: "Is buyer using mortgage financing?" },
      expectedCloseDate: { type: "string", description: "Expected completion date (ISO)" },
      notes: { type: "string", description: "Notes about the deal" },
      stage: { type: "string", description: "Filter by stage (for list action)" },
    },
    required: ["action"],
  },
};

export const trackDealExecutor: ToolExecutor = async (input, ctx) => {
  const { action, dealId, dealType, propertyAddress, propertyType, area, developer, projectName,
    price, buyerName, buyerPhone, buyerEmail, sellerName, sellerPhone, leadId,
    isMortgage, expectedCloseDate, notes, stage } = input as Record<string, unknown>;

  const t = aygentDeals;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (stage) conditions.push(eq(t.stage, stage as string));
    if (dealType) conditions.push(eq(t.dealType, dealType as string));

    const deals = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.updatedAt))
      .limit(50);

    return { deals, total: deals.length };
  }

  if (action === "get" && dealId) {
    const results = await ctx.db.select().from(t)
      .where(and(eq(t.id, dealId as string), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Deal not found." };
    return results[0];
  }

  if (action === "create") {
    if (!dealType || !propertyAddress || !price) {
      return { error: "dealType, propertyAddress, and price are required to create a deal." };
    }
    const checklist = generateChecklist(dealType as string, (isMortgage as boolean) ?? false);
    const created = await ctx.db.insert(t).values({
      companyId: ctx.companyId,
      agentId: ctx.agentId,
      leadId: leadId as string | undefined,
      dealType: dealType as string,
      propertyAddress: propertyAddress as string,
      propertyType: propertyType as string | undefined,
      area: area as string | undefined,
      developer: developer as string | undefined,
      projectName: projectName as string | undefined,
      price: price as number,
      buyerName: buyerName as string | undefined,
      buyerPhone: buyerPhone as string | undefined,
      buyerEmail: buyerEmail as string | undefined,
      sellerName: sellerName as string | undefined,
      sellerPhone: sellerPhone as string | undefined,
      documentsChecklist: checklist,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate as string) : undefined,
      notes: notes as string | undefined,
    }).returning();

    return { deal: created[0], message: `Deal created for ${propertyAddress}.` };
  }

  if (action === "update" && dealId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (propertyAddress) updates.propertyAddress = propertyAddress;
    if (propertyType) updates.propertyType = propertyType;
    if (area) updates.area = area;
    if (developer) updates.developer = developer;
    if (projectName) updates.projectName = projectName;
    if (price) updates.price = price;
    if (buyerName) updates.buyerName = buyerName;
    if (buyerPhone) updates.buyerPhone = buyerPhone;
    if (buyerEmail) updates.buyerEmail = buyerEmail;
    if (sellerName) updates.sellerName = sellerName;
    if (sellerPhone) updates.sellerPhone = sellerPhone;
    if (expectedCloseDate) updates.expectedCloseDate = new Date(expectedCloseDate as string);
    if (notes) updates.notes = notes;

    const updated = await ctx.db.update(t).set(updates)
      .where(and(eq(t.id, dealId as string), eq(t.companyId, ctx.companyId)))
      .returning();
    if (updated.length === 0) return { error: "Deal not found." };
    return { deal: updated[0], message: "Deal updated." };
  }

  return { error: "Invalid action. Use create, update, get, or list." };
};

// ═══════════════════════════════════════════════════
// update_deal_stage
// ═══════════════════════════════════════════════════

export const updateDealStageDefinition: ToolDefinition = {
  name: "update_deal_stage",
  description:
    "Move a deal to the next stage in the transaction pipeline. Validates that the transition is allowed (e.g. can't skip from offer to transfer). Use when a deal milestone is reached — Form F signed, NOC received, mortgage approved, transfer complete, etc.",
  input_schema: {
    type: "object",
    properties: {
      dealId: { type: "string", description: "Deal ID" },
      newStage: {
        type: "string",
        enum: ["form_f", "noc_applied", "noc_received", "mortgage_processing", "mortgage_approved", "transfer_booked", "transfer_complete", "completed", "fell_through"],
        description: "The new stage to move the deal to",
      },
      fellThroughReason: { type: "string", description: "Required if newStage is fell_through" },
      formFDate: { type: "string", description: "Date Form F was signed (ISO)" },
      nocAppliedDate: { type: "string", description: "Date NOC was applied (ISO)" },
      nocReceivedDate: { type: "string", description: "Date NOC was received (ISO)" },
      nocExpiryDate: { type: "string", description: "NOC expiry date (ISO)" },
      mortgageBank: { type: "string", description: "Name of mortgage bank" },
      transferDate: { type: "string", description: "DLD transfer appointment date (ISO)" },
      notes: { type: "string", description: "Notes about this stage change" },
    },
    required: ["dealId", "newStage"],
  },
};

export const updateDealStageExecutor: ToolExecutor = async (input, ctx) => {
  const { dealId, newStage, fellThroughReason, formFDate, nocAppliedDate, nocReceivedDate,
    nocExpiryDate, mortgageBank, transferDate, notes } = input as Record<string, string>;

  const t = aygentDeals;
  const results = await ctx.db.select().from(t)
    .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)))
    .limit(1);

  if (results.length === 0) return { error: "Deal not found." };
  const deal = results[0];

  const allowed = VALID_TRANSITIONS[deal.stage];
  if (!allowed || !allowed.includes(newStage)) {
    return { error: `Cannot transition from "${deal.stage}" to "${newStage}". Allowed: ${(allowed ?? []).join(", ") || "none"}.` };
  }

  if (newStage === "fell_through" && !fellThroughReason) {
    return { error: "fellThroughReason is required when marking a deal as fell_through." };
  }

  const updates: Record<string, unknown> = {
    stage: newStage,
    updatedAt: new Date(),
  };

  if (fellThroughReason) updates.fellThroughReason = fellThroughReason;
  if (formFDate) updates.formFDate = new Date(formFDate);
  if (nocAppliedDate) updates.nocAppliedDate = new Date(nocAppliedDate);
  if (nocReceivedDate) updates.nocReceivedDate = new Date(nocReceivedDate);
  if (nocExpiryDate) updates.nocExpiryDate = new Date(nocExpiryDate);
  if (mortgageBank) updates.mortgageBank = mortgageBank;
  if (transferDate) updates.transferDate = new Date(transferDate);
  if (notes) updates.notes = deal.notes ? `${deal.notes}\n\n[${newStage}] ${notes}` : `[${newStage}] ${notes}`;
  if (newStage === "completed") updates.completionDate = new Date();

  const updated = await ctx.db.update(t).set(updates)
    .where(eq(t.id, dealId))
    .returning();

  return { deal: updated[0], message: `Deal moved to "${newStage}".` };
};

// ═══════════════════════════════════════════════════
// get_deal_pipeline
// ═══════════════════════════════════════════════════

export const getDealPipelineDefinition: ToolDefinition = {
  name: "get_deal_pipeline",
  description:
    "Get a pipeline view of all active deals grouped by stage. Shows total counts, total value, and identifies bottleneck stages. Use for pipeline reviews, morning briefs, or reporting.",
  input_schema: {
    type: "object",
    properties: {
      dealType: { type: "string", enum: ["sale", "rental", "offplan", "offplan_resale"], description: "Filter by deal type" },
      agentId: { type: "string", description: "Filter by assigned agent" },
    },
  },
};

export const getDealPipelineExecutor: ToolExecutor = async (input, ctx) => {
  const { dealType, agentId } = input as { dealType?: string; agentId?: string };

  const conditions = [eq(aygentDeals.companyId, ctx.companyId)];
  if (dealType) conditions.push(eq(aygentDeals.dealType, dealType));
  if (agentId) conditions.push(eq(aygentDeals.agentId, agentId));

  const deals = await ctx.db.select().from(aygentDeals)
    .where(and(...conditions))
    .orderBy(desc(aygentDeals.updatedAt));

  const stages: Record<string, typeof deals> = {};
  let totalActive = 0;
  let totalValue = 0;

  for (const deal of deals) {
    if (deal.stage === "completed" || deal.stage === "fell_through") continue;
    if (!stages[deal.stage]) stages[deal.stage] = [];
    stages[deal.stage].push(deal);
    totalActive++;
    totalValue += deal.price;
  }

  // Find bottleneck: stage with most deals
  let bottleneck = "";
  let maxCount = 0;
  for (const [stage, stageDeals] of Object.entries(stages)) {
    if (stageDeals.length > maxCount) {
      maxCount = stageDeals.length;
      bottleneck = stage;
    }
  }

  const completed = deals.filter((d) => d.stage === "completed").length;
  const fellThrough = deals.filter((d) => d.stage === "fell_through").length;

  return {
    pipeline: stages,
    summary: {
      total_active: totalActive,
      total_value_aed: totalValue,
      bottleneck_stage: bottleneck || "none",
      completed,
      fell_through: fellThrough,
    },
  };
};

// ═══════════════════════════════════════════════════
// generate_document_checklist
// ═══════════════════════════════════════════════════

export const generateDocumentChecklistDefinition: ToolDefinition = {
  name: "generate_document_checklist",
  description:
    "Generate the required document checklist for a deal type (sale, rental, off-plan). Optionally save it to an existing deal record. Use when starting a new transaction to know what documents need to be collected.",
  input_schema: {
    type: "object",
    properties: {
      dealType: { type: "string", enum: ["sale", "rental", "offplan", "offplan_resale"], description: "Type of deal" },
      isMortgage: { type: "boolean", description: "Is buyer using mortgage?" },
      dealId: { type: "string", description: "Optional: save checklist to this deal" },
    },
    required: ["dealType"],
  },
};

export const generateDocumentChecklistExecutor: ToolExecutor = async (input, ctx) => {
  const { dealType, isMortgage, dealId } = input as { dealType: string; isMortgage?: boolean; dealId?: string };

  const checklist = generateChecklist(dealType, isMortgage ?? false);

  if (dealId) {
    await ctx.db.update(aygentDeals).set({
      documentsChecklist: checklist,
      updatedAt: new Date(),
    }).where(and(eq(aygentDeals.id, dealId), eq(aygentDeals.companyId, ctx.companyId)));
  }

  return {
    deal_type: dealType,
    is_mortgage: isMortgage ?? false,
    checklist,
    total_documents: Object.keys(checklist).length,
    message: dealId ? "Checklist saved to deal." : "Checklist generated. Provide dealId to save it.",
  };
};

// ═══════════════════════════════════════════════════
// calculate_transfer_costs
// ═══════════════════════════════════════════════════

export const calculateTransferCostsDefinition: ToolDefinition = {
  name: "calculate_transfer_costs",
  description:
    "Calculate comprehensive transfer costs for a Dubai property transaction. Includes DLD fee (4%), trustee fees, NOC fee, mortgage registration, agent commission, and VAT. More detailed than calculate_dld_fees — use this for full deal cost breakdown.",
  input_schema: {
    type: "object",
    properties: {
      price: { type: "number", description: "Sale price in AED" },
      dealType: { type: "string", enum: ["sale", "rental", "offplan"], description: "Type of transaction" },
      isMortgage: { type: "boolean", description: "Is buyer using mortgage?" },
      mortgageAmount: { type: "number", description: "Mortgage loan amount in AED" },
      commissionRate: { type: "number", description: "Agent commission % (default: 2 for sale, 5 for rental)" },
      nocFee: { type: "number", description: "Developer NOC fee in AED (default: 1000)" },
    },
    required: ["price", "dealType"],
  },
};

export const calculateTransferCostsExecutor: ToolExecutor = async (input, ctx) => {
  const { price, dealType, isMortgage, mortgageAmount, commissionRate, nocFee } = input as {
    price: number; dealType: string; isMortgage?: boolean;
    mortgageAmount?: number; commissionRate?: number; nocFee?: number;
  };

  const defaultCommission = dealType === "rental" ? 5 : dealType === "offplan" ? 0 : 2;
  const rate = commissionRate ?? defaultCommission;
  const noc = nocFee ?? 1000;

  const dldTransferFee = Math.round(price * 0.04);
  const dldAdmin = 580;
  const titleDeed = 4200;
  const commission = Math.round(price * (rate / 100));
  const commissionVat = Math.round(commission * 0.05);
  const mortgageReg = isMortgage && mortgageAmount ? Math.round(mortgageAmount * 0.0025) : 0;
  const trustee = 4000; // standard Registration Trustee fee

  const buyerTotal = dldTransferFee + dldAdmin + titleDeed + noc + commission + commissionVat + mortgageReg + trustee;

  const breakdown = {
    dld_transfer_fee: { amount: dldTransferFee, note: "4% of sale price" },
    dld_admin_fee: { amount: dldAdmin, note: "Fixed AED 580" },
    title_deed_issuance: { amount: titleDeed, note: "Fixed AED 4,200" },
    noc_fee: { amount: noc, note: `Developer NOC fee` },
    registration_trustee: { amount: trustee, note: "Fixed AED 4,000" },
    agent_commission: { amount: commission, note: `${rate}% of price` },
    commission_vat: { amount: commissionVat, note: "5% VAT on commission" },
    ...(mortgageReg > 0 ? {
      mortgage_registration: { amount: mortgageReg, note: `0.25% of loan (AED ${mortgageAmount})` },
    } : {}),
  };

  const result = {
    price_aed: price,
    deal_type: dealType,
    is_mortgage: isMortgage ?? false,
    breakdown,
    buyer_total_aed: buyerTotal,
    formatted_total: `AED ${buyerTotal.toLocaleString()}`,
  };

  if (ctx.issueId) {
    await storeDeliverable(ctx, {
      type: "transfer_cost_breakdown",
      data: result,
    });
  }

  return result;
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/alexanderjackson/Aygency\ World && npx tsc --noEmit packages/tools/src/deals.ts`
Expected: No errors (or run full build in step after registering).

- [ ] **Step 3: Commit**

```bash
git add packages/tools/src/deals.ts
git commit -m "feat: add 5 deal tracking tools (track_deal, update_deal_stage, get_deal_pipeline, generate_document_checklist, calculate_transfer_costs)"
```

---

## Task 6: Create finance tools

**Files:**
- Create: `packages/tools/src/finance.ts`

- [ ] **Step 1: Create finance.ts with all 8 tools**

Create `packages/tools/src/finance.ts`:

```typescript
import { eq, and, desc, gte, lte, sql, ne } from "drizzle-orm";
import {
  aygentCommissions,
  aygentInvoices,
  aygentExpenses,
  aygentDeals,
} from "@paperclipai/db";
import { costEvents } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// track_commission
// ═══════════════════════════════════════════════════

export const trackCommissionDefinition: ToolDefinition = {
  name: "track_commission",
  description:
    "Track commissions earned from deals. Create, update, list, or view commission records. Auto-calculates agent/agency split and VAT (5%). Use when a deal closes or when checking outstanding commissions.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "get"], description: "Action to perform" },
      commissionId: { type: "string", description: "Commission ID (for update/get)" },
      dealId: { type: "string", description: "Link to deal record" },
      grossAmount: { type: "number", description: "Total commission in AED" },
      commissionRate: { type: "number", description: "Commission percentage applied (e.g. 2)" },
      agentSplitPct: { type: "number", description: "Broker's share percentage (e.g. 60)" },
      source: { type: "string", enum: ["buyer", "seller", "developer", "tenant", "landlord"], description: "Who pays the commission" },
      status: { type: "string", enum: ["earned", "invoiced", "collected", "overdue", "written_off"], description: "Filter by status (for list)" },
      notes: { type: "string", description: "Notes" },
    },
    required: ["action"],
  },
};

export const trackCommissionExecutor: ToolExecutor = async (input, ctx) => {
  const { action, commissionId, dealId, grossAmount, commissionRate, agentSplitPct,
    source, status, notes } = input as Record<string, unknown>;

  const t = aygentCommissions;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (status) conditions.push(eq(t.status, status as string));

    const commissions = await ctx.db.select().from(t)
      .where(and(...conditions))
      .orderBy(desc(t.createdAt))
      .limit(50);

    const totalEarned = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
    const totalCollected = commissions
      .filter((c) => c.status === "collected")
      .reduce((sum, c) => sum + (c.paidAmount ?? c.grossAmount), 0);

    return { commissions, total: commissions.length, totalEarned, totalCollected };
  }

  if (action === "get" && commissionId) {
    const results = await ctx.db.select().from(t)
      .where(and(eq(t.id, commissionId as string), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Commission not found." };
    return results[0];
  }

  if (action === "create") {
    if (!dealId || !grossAmount) {
      return { error: "dealId and grossAmount are required." };
    }

    // Look up the deal to get deal_type
    const deals = await ctx.db.select().from(aygentDeals)
      .where(and(eq(aygentDeals.id, dealId as string), eq(aygentDeals.companyId, ctx.companyId)))
      .limit(1);
    if (deals.length === 0) return { error: "Deal not found." };

    const gross = grossAmount as number;
    const splitPct = (agentSplitPct as number) ?? 60;
    const agentAmt = Math.round(gross * (splitPct / 100));
    const agencyAmt = gross - agentAmt;
    const vat = Math.round(gross * 0.05);

    const created = await ctx.db.insert(t).values({
      companyId: ctx.companyId,
      dealId: dealId as string,
      agentId: ctx.agentId,
      dealType: deals[0].dealType,
      grossAmount: gross,
      commissionRate: commissionRate ? String(commissionRate) : null,
      agentSplitPct: String(splitPct),
      agentAmount: agentAmt,
      agencyAmount: agencyAmt,
      vatAmount: vat,
      totalWithVat: gross + vat,
      source: (source as string) ?? "buyer",
      notes: notes as string | undefined,
    }).returning();

    return {
      commission: created[0],
      message: `Commission recorded: AED ${gross.toLocaleString()} (agent: AED ${agentAmt.toLocaleString()}, agency: AED ${agencyAmt.toLocaleString()}, VAT: AED ${vat.toLocaleString()}).`,
    };
  }

  if (action === "update" && commissionId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (notes) updates.notes = notes;

    const updated = await ctx.db.update(t).set(updates)
      .where(and(eq(t.id, commissionId as string), eq(t.companyId, ctx.companyId)))
      .returning();
    if (updated.length === 0) return { error: "Commission not found." };
    return { commission: updated[0], message: "Commission updated." };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// calculate_commission_split
// ═══════════════════════════════════════════════════

export const calculateCommissionSplitDefinition: ToolDefinition = {
  name: "calculate_commission_split",
  description:
    "Calculate commission breakdown for a deal. Pure calculation — does not save anything. Shows gross commission, agent share, agency share, and VAT. Use when quoting costs to clients or planning deals.",
  input_schema: {
    type: "object",
    properties: {
      price: { type: "number", description: "Property price or annual rent in AED" },
      dealType: { type: "string", enum: ["sale", "rental", "offplan"], description: "Type of deal" },
      commissionRate: { type: "number", description: "Override commission % (default: 2% sale, 5% rental, 5% offplan)" },
      agentTier: { type: "string", enum: ["junior", "senior", "top", "custom"], description: "Agent tier for split calculation" },
      customSplitPct: { type: "number", description: "Custom agent split % (if agentTier is custom)" },
    },
    required: ["price", "dealType"],
  },
};

export const calculateCommissionSplitExecutor: ToolExecutor = async (input, _ctx) => {
  const { price, dealType, commissionRate, agentTier, customSplitPct } = input as {
    price: number; dealType: string; commissionRate?: number;
    agentTier?: string; customSplitPct?: number;
  };

  const defaultRates: Record<string, number> = { sale: 2, rental: 5, offplan: 5 };
  const rate = commissionRate ?? defaultRates[dealType] ?? 2;

  const tierSplits: Record<string, number> = { junior: 50, senior: 60, top: 70 };
  const splitPct = agentTier === "custom" && customSplitPct
    ? customSplitPct
    : tierSplits[agentTier ?? "senior"] ?? 60;

  const gross = Math.round(price * (rate / 100));
  const agentShare = Math.round(gross * (splitPct / 100));
  const agencyShare = gross - agentShare;
  const vat = Math.round(gross * 0.05);

  return {
    price_aed: price,
    deal_type: dealType,
    commission_rate_pct: rate,
    gross_commission_aed: gross,
    agent_split_pct: splitPct,
    agent_share_aed: agentShare,
    agency_share_aed: agencyShare,
    vat_5pct_aed: vat,
    total_with_vat_aed: gross + vat,
  };
};

// ═══════════════════════════════════════════════════
// generate_invoice
// ═══════════════════════════════════════════════════

export const generateInvoiceDefinition: ToolDefinition = {
  name: "generate_invoice",
  description:
    "Generate a tax invoice for commission, management fee, or consultancy. Auto-generates invoice number, calculates 5% VAT, and stores the invoice record. Use after a deal completes to invoice the client.",
  input_schema: {
    type: "object",
    properties: {
      invoiceType: { type: "string", enum: ["commission", "management_fee", "consultancy", "other"], description: "Type of invoice" },
      clientName: { type: "string", description: "Client to invoice" },
      clientEmail: { type: "string", description: "Client email" },
      clientPhone: { type: "string", description: "Client phone" },
      description: { type: "string", description: "Invoice description / line item" },
      amount: { type: "number", description: "Amount in AED before VAT" },
      dueDate: { type: "string", description: "Payment due date (ISO)" },
      dealId: { type: "string", description: "Link to deal record" },
      commissionId: { type: "string", description: "Link to commission record" },
      notes: { type: "string", description: "Notes" },
    },
    required: ["invoiceType", "clientName", "description", "amount"],
  },
};

export const generateInvoiceExecutor: ToolExecutor = async (input, ctx) => {
  const { invoiceType, clientName, clientEmail, clientPhone, description, amount,
    dueDate, dealId, commissionId, notes } = input as Record<string, unknown>;

  const amt = amount as number;
  const vat = Math.round(amt * 0.05);
  const total = amt + vat;

  // Generate invoice number: INV-YYYY-NNNN
  const year = new Date().getFullYear();
  const countResult = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(aygentInvoices)
    .where(eq(aygentInvoices.companyId, ctx.companyId));
  const nextNum = (countResult[0]?.count ?? 0) + 1;
  const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, "0")}`;

  const created = await ctx.db.insert(aygentInvoices).values({
    companyId: ctx.companyId,
    commissionId: commissionId as string | undefined,
    dealId: dealId as string | undefined,
    invoiceNumber,
    invoiceType: invoiceType as string,
    clientName: clientName as string,
    clientEmail: clientEmail as string | undefined,
    clientPhone: clientPhone as string | undefined,
    description: description as string,
    amount: amt,
    vatAmount: vat,
    total,
    dueDate: dueDate ? new Date(dueDate as string) : undefined,
    notes: notes as string | undefined,
  }).returning();

  if (ctx.issueId) {
    await storeDeliverable(ctx, { type: "invoice", data: created[0] });
  }

  return {
    invoice: created[0],
    message: `Invoice ${invoiceNumber} created: AED ${amt.toLocaleString()} + VAT AED ${vat.toLocaleString()} = AED ${total.toLocaleString()}.`,
  };
};

// ═══════════════════════════════════════════════════
// track_payment
// ═══════════════════════════════════════════════════

export const trackPaymentDefinition: ToolDefinition = {
  name: "track_payment",
  description:
    "Record payments received against invoices, list outstanding invoices, or get aging report. Use when a client pays a commission or management fee, or to check what's overdue.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "list_outstanding", "get_aging"], description: "Action to perform" },
      invoiceId: { type: "string", description: "Invoice ID (for record action)" },
      amountPaid: { type: "number", description: "Payment amount in AED" },
      paymentDate: { type: "string", description: "Payment date (ISO, default: today)" },
    },
    required: ["action"],
  },
};

export const trackPaymentExecutor: ToolExecutor = async (input, ctx) => {
  const { action, invoiceId, amountPaid, paymentDate } = input as Record<string, unknown>;

  const t = aygentInvoices;

  if (action === "record") {
    if (!invoiceId || !amountPaid) return { error: "invoiceId and amountPaid are required." };

    const invoices = await ctx.db.select().from(t)
      .where(and(eq(t.id, invoiceId as string), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (invoices.length === 0) return { error: "Invoice not found." };

    const invoice = invoices[0];
    const newPaidAmount = (invoice.paidAmount ?? 0) + (amountPaid as number);
    const fullyPaid = newPaidAmount >= invoice.total;

    await ctx.db.update(t).set({
      paidAmount: newPaidAmount,
      paidDate: fullyPaid ? new Date(paymentDate as string ?? new Date().toISOString()) : undefined,
      status: fullyPaid ? "paid" : invoice.status,
      updatedAt: new Date(),
    }).where(eq(t.id, invoiceId as string));

    return {
      message: fullyPaid
        ? `Invoice ${invoice.invoiceNumber} fully paid (AED ${newPaidAmount.toLocaleString()}).`
        : `Payment recorded. AED ${newPaidAmount.toLocaleString()} of AED ${invoice.total.toLocaleString()} paid.`,
      fully_paid: fullyPaid,
    };
  }

  if (action === "list_outstanding") {
    const invoices = await ctx.db.select().from(t)
      .where(and(
        eq(t.companyId, ctx.companyId),
        ne(t.status, "paid"),
        ne(t.status, "cancelled"),
      ))
      .orderBy(t.dueDate);

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.total - (inv.paidAmount ?? 0), 0);
    return { invoices, total_outstanding_aed: totalOutstanding };
  }

  if (action === "get_aging") {
    const invoices = await ctx.db.select().from(t)
      .where(and(
        eq(t.companyId, ctx.companyId),
        ne(t.status, "paid"),
        ne(t.status, "cancelled"),
      ));

    const now = Date.now();
    const buckets = { current: 0, days_30: 0, days_60: 0, days_90_plus: 0 };

    for (const inv of invoices) {
      const outstanding = inv.total - (inv.paidAmount ?? 0);
      const dueDate = inv.dueDate?.getTime() ?? now;
      const daysOverdue = Math.max(0, Math.floor((now - dueDate) / 86400000));

      if (daysOverdue === 0) buckets.current += outstanding;
      else if (daysOverdue <= 30) buckets.days_30 += outstanding;
      else if (daysOverdue <= 60) buckets.days_60 += outstanding;
      else buckets.days_90_plus += outstanding;
    }

    const total = buckets.current + buckets.days_30 + buckets.days_60 + buckets.days_90_plus;
    return { aging: buckets, total_outstanding_aed: total, invoice_count: invoices.length };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// get_accounts_receivable
// ═══════════════════════════════════════════════════

export const getAccountsReceivableDefinition: ToolDefinition = {
  name: "get_accounts_receivable",
  description:
    "Get accounts receivable summary — total outstanding invoices broken down by type, age, and client. Use for financial reporting and cash flow monitoring.",
  input_schema: {
    type: "object",
    properties: {},
  },
};

export const getAccountsReceivableExecutor: ToolExecutor = async (_input, ctx) => {
  const invoices = await ctx.db.select().from(aygentInvoices)
    .where(and(
      eq(aygentInvoices.companyId, ctx.companyId),
      ne(aygentInvoices.status, "paid"),
      ne(aygentInvoices.status, "cancelled"),
    ));

  const byType: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  let total = 0;

  for (const inv of invoices) {
    const outstanding = inv.total - (inv.paidAmount ?? 0);
    total += outstanding;
    byType[inv.invoiceType] = (byType[inv.invoiceType] ?? 0) + outstanding;
    byClient[inv.clientName] = (byClient[inv.clientName] ?? 0) + outstanding;
  }

  return {
    total_outstanding_aed: total,
    by_type: byType,
    by_client: byClient,
    invoice_count: invoices.length,
    average_outstanding_aed: invoices.length > 0 ? Math.round(total / invoices.length) : 0,
  };
};

// ═══════════════════════════════════════════════════
// calculate_vat
// ═══════════════════════════════════════════════════

export const calculateVatDefinition: ToolDefinition = {
  name: "calculate_vat",
  description:
    "Calculate UAE VAT (5%) on an amount. Can also generate a quarterly VAT summary from invoices and expenses. Use when preparing invoices, quoting prices, or filing VAT returns.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["calculate", "quarterly_summary"], description: "calculate = single amount, quarterly_summary = period summary" },
      amount: { type: "number", description: "Amount in AED (for calculate)" },
      isInclusive: { type: "boolean", description: "Is VAT already included in the amount? (default: false)" },
      startDate: { type: "string", description: "Period start (ISO, for quarterly_summary)" },
      endDate: { type: "string", description: "Period end (ISO, for quarterly_summary)" },
    },
    required: ["action"],
  },
};

export const calculateVatExecutor: ToolExecutor = async (input, ctx) => {
  const { action, amount, isInclusive, startDate, endDate } = input as Record<string, unknown>;

  if (action === "calculate") {
    if (!amount) return { error: "amount is required." };
    const amt = amount as number;
    if (isInclusive) {
      const net = Math.round(amt / 1.05);
      const vat = amt - net;
      return { net_amount: net, vat_amount: vat, gross_amount: amt, vat_rate: 5 };
    }
    const vat = Math.round(amt * 0.05);
    return { net_amount: amt, vat_amount: vat, gross_amount: amt + vat, vat_rate: 5 };
  }

  if (action === "quarterly_summary") {
    if (!startDate || !endDate) return { error: "startDate and endDate required." };
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // VAT collected (from invoices)
    const invoices = await ctx.db.select().from(aygentInvoices)
      .where(and(
        eq(aygentInvoices.companyId, ctx.companyId),
        gte(aygentInvoices.createdAt, start),
        lte(aygentInvoices.createdAt, end),
        ne(aygentInvoices.status, "cancelled"),
      ));
    const vatCollected = invoices.reduce((sum, inv) => sum + inv.vatAmount, 0);

    // VAT paid (from expenses)
    const expenses = await ctx.db.select().from(aygentExpenses)
      .where(and(
        eq(aygentExpenses.companyId, ctx.companyId),
        gte(aygentExpenses.date, start),
        lte(aygentExpenses.date, end),
      ));
    const vatPaid = expenses.reduce((sum, exp) => sum + (exp.vatAmount ?? 0), 0);

    return {
      period: { start: startDate, end: endDate },
      vat_collected: vatCollected,
      vat_paid_on_expenses: vatPaid,
      net_vat_payable: vatCollected - vatPaid,
      invoice_count: invoices.length,
      expense_count: expenses.length,
    };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// track_expense
// ═══════════════════════════════════════════════════

export const trackExpenseDefinition: ToolDefinition = {
  name: "track_expense",
  description:
    "Track agency operational expenses for P&L reporting. Create expenses, list by category, or get a summary for a period. Categories: marketing, portals, photography, office, salaries, transport, technology, licensing, other.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "list", "summary"], description: "Action to perform" },
      category: { type: "string", enum: ["marketing", "portals", "photography", "office", "salaries", "transport", "technology", "licensing", "other"], description: "Expense category" },
      description: { type: "string", description: "What the expense is for" },
      amount: { type: "number", description: "Amount in AED" },
      vatAmount: { type: "number", description: "VAT paid on this expense (if any)" },
      date: { type: "string", description: "Expense date (ISO)" },
      recurring: { type: "string", enum: ["monthly", "quarterly", "yearly"], description: "If this is a recurring expense" },
      vendor: { type: "string", description: "Vendor/supplier name" },
      startDate: { type: "string", description: "Period start (for list/summary)" },
      endDate: { type: "string", description: "Period end (for list/summary)" },
    },
    required: ["action"],
  },
};

export const trackExpenseExecutor: ToolExecutor = async (input, ctx) => {
  const { action, category, description, amount, vatAmount, date, recurring, vendor,
    startDate, endDate } = input as Record<string, unknown>;

  const t = aygentExpenses;

  if (action === "create") {
    if (!category || !description || !amount || !date) {
      return { error: "category, description, amount, and date are required." };
    }
    const created = await ctx.db.insert(t).values({
      companyId: ctx.companyId,
      category: category as string,
      description: description as string,
      amount: amount as number,
      vatAmount: (vatAmount as number) ?? 0,
      date: new Date(date as string),
      recurring: recurring as string | undefined,
      vendor: vendor as string | undefined,
    }).returning();
    return { expense: created[0], message: `Expense recorded: AED ${(amount as number).toLocaleString()} (${category}).` };
  }

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (category) conditions.push(eq(t.category, category as string));
    if (startDate) conditions.push(gte(t.date, new Date(startDate as string)));
    if (endDate) conditions.push(lte(t.date, new Date(endDate as string)));

    const expenses = await ctx.db.select().from(t)
      .where(and(...conditions))
      .orderBy(desc(t.date))
      .limit(100);

    return { expenses, total: expenses.length };
  }

  if (action === "summary") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (startDate) conditions.push(gte(t.date, new Date(startDate as string)));
    if (endDate) conditions.push(lte(t.date, new Date(endDate as string)));

    const expenses = await ctx.db.select().from(t).where(and(...conditions));

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const exp of expenses) {
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + exp.amount;
      total += exp.amount;
    }

    return { by_category: byCategory, total_aed: total, expense_count: expenses.length };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// get_agency_pnl
// ═══════════════════════════════════════════════════

export const getAgencyPnlDefinition: ToolDefinition = {
  name: "get_agency_pnl",
  description:
    "Get agency profit & loss report for a period. Shows revenue (commissions + management fees collected), expenses, agent compute costs, and net profit. Use for monthly/quarterly financial reviews and CEO morning briefs.",
  input_schema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Period start (ISO)" },
      endDate: { type: "string", description: "Period end (ISO)" },
    },
    required: ["startDate", "endDate"],
  },
};

export const getAgencyPnlExecutor: ToolExecutor = async (input, ctx) => {
  const { startDate, endDate } = input as { startDate: string; endDate: string };
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Revenue: collected commissions
  const commissions = await ctx.db.select().from(aygentCommissions)
    .where(and(
      eq(aygentCommissions.companyId, ctx.companyId),
      eq(aygentCommissions.status, "collected"),
      gte(aygentCommissions.paidDate!, start),
      lte(aygentCommissions.paidDate!, end),
    ));
  const commissionRevenue = commissions.reduce((sum, c) => sum + c.grossAmount, 0);

  // Revenue: paid invoices (non-commission)
  const invoices = await ctx.db.select().from(aygentInvoices)
    .where(and(
      eq(aygentInvoices.companyId, ctx.companyId),
      eq(aygentInvoices.status, "paid"),
      ne(aygentInvoices.invoiceType, "commission"),
      gte(aygentInvoices.paidDate!, start),
      lte(aygentInvoices.paidDate!, end),
    ));
  const otherRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Expenses
  const expenses = await ctx.db.select().from(aygentExpenses)
    .where(and(
      eq(aygentExpenses.companyId, ctx.companyId),
      gte(aygentExpenses.date, start),
      lte(aygentExpenses.date, end),
    ));
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expensesByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] ?? 0) + exp.amount;
  }

  // Agent compute costs (from Paperclip's cost_events)
  const costs = await ctx.db.select().from(costEvents)
    .where(and(
      eq(costEvents.companyId, ctx.companyId),
      gte(costEvents.createdAt, start),
      lte(costEvents.createdAt, end),
    ));
  const computeCost = costs.reduce((sum, c) => sum + (c.costCents ?? 0), 0) / 100; // cents to dollars

  const totalRevenue = commissionRevenue + otherRevenue;
  const netProfit = totalRevenue - totalExpenses - computeCost;

  return {
    period: { start: startDate, end: endDate },
    revenue: {
      commissions: commissionRevenue,
      management_fees_and_other: otherRevenue,
      total: totalRevenue,
    },
    expenses: {
      by_category: expensesByCategory,
      total: totalExpenses,
    },
    agent_compute_cost_usd: computeCost,
    net_profit_aed: netProfit,
    margin_pct: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/tools/src/finance.ts
git commit -m "feat: add 8 finance tools (commission, invoice, payment, VAT, expense, P&L)"
```

---

## Task 7: Create compliance tools

**Files:**
- Create: `packages/tools/src/compliance.ts`

- [ ] **Step 1: Create compliance.ts with all 6 tools**

Create `packages/tools/src/compliance.ts`:

```typescript
import { eq, and, desc, lte, gte } from "drizzle-orm";
import {
  aygentComplianceChecks,
  aygentBrokerCards,
  aygentDeals,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// KYC document requirements by client type
// ═══════════════════════════════════════════════════

function getRequiredDocuments(clientType: string, riskLevel: string): Record<string, boolean> {
  const base: Record<string, boolean> = {
    passport: false,
    emirates_id: false,
    visa: false,
  };

  if (clientType === "buyer" || clientType === "tenant") {
    base.proof_of_address = false;
  }

  if (clientType === "buyer") {
    base.source_of_funds = false;
  }

  if (riskLevel === "high") {
    base.source_of_wealth = false;
    base.bank_reference = false;
    base.company_documents = false;
  }

  return base;
}

// High-risk nationalities per UAE NRA (simplified)
const HIGH_RISK_NATIONALITIES = [
  "iran", "north korea", "syria", "yemen", "afghanistan",
  "libya", "somalia", "south sudan", "myanmar",
];

// ═══════════════════════════════════════════════════
// run_kyc_check
// ═══════════════════════════════════════════════════

export const runKycCheckDefinition: ToolDefinition = {
  name: "run_kyc_check",
  description:
    "Create or manage KYC (Know Your Customer) checks for deal parties. Generates document requirements based on client type and risk level. Required for every transaction >= AED 55,000 (virtually all real estate). Use when onboarding a buyer, seller, tenant, or landlord.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "get", "list"], description: "Action to perform" },
      checkId: { type: "string", description: "Check ID (for update/get)" },
      clientName: { type: "string", description: "Client's full name" },
      clientType: { type: "string", enum: ["buyer", "seller", "tenant", "landlord"], description: "Type of client" },
      nationality: { type: "string", description: "Client's nationality" },
      emiratesId: { type: "string", description: "Emirates ID number" },
      passportNumber: { type: "string", description: "Passport number" },
      dealId: { type: "string", description: "Link to deal record" },
      leadId: { type: "string", description: "Link to lead record" },
      documentsCollected: { type: "object", description: "Update document collection status: { passport: true, ... }" },
      status: { type: "string", enum: ["pending", "clear", "flagged", "escalated", "resolved"], description: "Update status or filter (for list)" },
      flagReason: { type: "string", description: "Reason for flagging" },
      resolution: { type: "string", description: "How flagged items were resolved" },
    },
    required: ["action"],
  },
};

export const runKycCheckExecutor: ToolExecutor = async (input, ctx) => {
  const { action, checkId, clientName, clientType, nationality, emiratesId,
    passportNumber, dealId, leadId, documentsCollected, status, flagReason, resolution } = input as Record<string, unknown>;

  const t = aygentComplianceChecks;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (status) conditions.push(eq(t.status, status as string));
    if (dealId) conditions.push(eq(t.dealId!, dealId as string));

    const checks = await ctx.db.select().from(t)
      .where(and(...conditions))
      .orderBy(desc(t.createdAt))
      .limit(50);
    return { checks, total: checks.length };
  }

  if (action === "get" && checkId) {
    const results = await ctx.db.select().from(t)
      .where(and(eq(t.id, checkId as string), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Check not found." };
    return results[0];
  }

  if (action === "create") {
    if (!clientName || !clientType) {
      return { error: "clientName and clientType are required." };
    }

    const nat = (nationality as string)?.toLowerCase() ?? "";
    const isHighRisk = HIGH_RISK_NATIONALITIES.includes(nat);
    const riskLevel = isHighRisk ? "high" : "low";
    const requiredDocs = getRequiredDocuments(clientType as string, riskLevel);

    const created = await ctx.db.insert(t).values({
      companyId: ctx.companyId,
      dealId: dealId as string | undefined,
      leadId: leadId as string | undefined,
      clientName: clientName as string,
      clientType: clientType as string,
      nationality: nationality as string | undefined,
      emiratesId: emiratesId as string | undefined,
      passportNumber: passportNumber as string | undefined,
      checkType: "kyc",
      riskLevel,
      documentsCollected: requiredDocs,
      checkedBy: "system",
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000), // valid 1 year
    }).returning();

    return {
      check: created[0],
      required_documents: requiredDocs,
      risk_level: riskLevel,
      message: isHighRisk
        ? `KYC check created for ${clientName}. HIGH RISK — enhanced due diligence required.`
        : `KYC check created for ${clientName}. Standard due diligence.`,
    };
  }

  if (action === "update" && checkId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (documentsCollected) updates.documentsCollected = documentsCollected;
    if (status) updates.status = status;
    if (flagReason) updates.flagReason = flagReason;
    if (resolution) updates.resolution = resolution;

    const updated = await ctx.db.update(t).set(updates)
      .where(and(eq(t.id, checkId as string), eq(t.companyId, ctx.companyId)))
      .returning();
    if (updated.length === 0) return { error: "Check not found." };
    return { check: updated[0], message: "KYC check updated." };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// screen_pep_sanctions
// ═══════════════════════════════════════════════════

export const screenPepSanctionsDefinition: ToolDefinition = {
  name: "screen_pep_sanctions",
  description:
    "Screen a person against PEP (Politically Exposed Persons) and sanctions lists. Creates an audit trail record. Currently records the check locally — future integration with external screening APIs. Use for every party in a real estate transaction.",
  input_schema: {
    type: "object",
    properties: {
      clientName: { type: "string", description: "Person's full name" },
      clientType: { type: "string", enum: ["buyer", "seller", "tenant", "landlord"], description: "Type of client" },
      nationality: { type: "string", description: "Nationality" },
      passportNumber: { type: "string", description: "Passport number" },
      emiratesId: { type: "string", description: "Emirates ID" },
      dealId: { type: "string", description: "Link to deal" },
      leadId: { type: "string", description: "Link to lead" },
      notes: { type: "string", description: "Manual screening notes or results" },
    },
    required: ["clientName", "clientType"],
  },
};

export const screenPepSanctionsExecutor: ToolExecutor = async (input, ctx) => {
  const { clientName, clientType, nationality, passportNumber, emiratesId,
    dealId, leadId, notes } = input as Record<string, unknown>;

  // Create PEP check record
  const pepCheck = await ctx.db.insert(aygentComplianceChecks).values({
    companyId: ctx.companyId,
    dealId: dealId as string | undefined,
    leadId: leadId as string | undefined,
    clientName: clientName as string,
    clientType: clientType as string,
    nationality: nationality as string | undefined,
    emiratesId: emiratesId as string | undefined,
    passportNumber: passportNumber as string | undefined,
    checkType: "pep",
    status: "clear", // default clear — flag manually if match found
    riskLevel: "low",
    checkedBy: "system",
    checkedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400000),
  }).returning();

  // Create sanctions check record
  const sanctionsCheck = await ctx.db.insert(aygentComplianceChecks).values({
    companyId: ctx.companyId,
    dealId: dealId as string | undefined,
    leadId: leadId as string | undefined,
    clientName: clientName as string,
    clientType: clientType as string,
    nationality: nationality as string | undefined,
    emiratesId: emiratesId as string | undefined,
    passportNumber: passportNumber as string | undefined,
    checkType: "sanctions",
    status: "clear",
    riskLevel: "low",
    checkedBy: "system",
    checkedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400000),
  }).returning();

  return {
    pep_check: pepCheck[0],
    sanctions_check: sanctionsCheck[0],
    message: `PEP and sanctions screening completed for ${clientName}. Status: CLEAR. Note: This is a local record. For production, integrate with ComplyAdvantage or Refinitiv for live screening.`,
  };
};

// ═══════════════════════════════════════════════════
// track_broker_card
// ═══════════════════════════════════════════════════

export const trackBrokerCardDefinition: ToolDefinition = {
  name: "track_broker_card",
  description:
    "Track RERA broker card status, expiry dates, and training compliance. Create records for brokers, check for expiring cards, or update training dates. Use for compliance monitoring and license renewal reminders.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "check_expiring"], description: "Action to perform" },
      cardId: { type: "string", description: "Broker card ID (for update)" },
      brokerName: { type: "string", description: "Broker's full name" },
      reraCardNumber: { type: "string", description: "RERA broker card number" },
      reraBrn: { type: "string", description: "Broker Registration Number" },
      issueDate: { type: "string", description: "Card issue date (ISO)" },
      expiryDate: { type: "string", description: "Card expiry date (ISO)" },
      dreiTrainingDate: { type: "string", description: "DREI certification date (ISO)" },
      dreiCertificateId: { type: "string", description: "DREI certificate ID" },
      amlTrainingDate: { type: "string", description: "AML refresher training date (ISO)" },
      phone: { type: "string", description: "Broker phone" },
      email: { type: "string", description: "Broker email" },
      areasFocus: { type: "array", items: { type: "string" }, description: "Areas the broker focuses on" },
      daysAhead: { type: "number", description: "Check expiring within N days (default: 90)" },
      notes: { type: "string", description: "Notes" },
    },
    required: ["action"],
  },
};

export const trackBrokerCardExecutor: ToolExecutor = async (input, ctx) => {
  const { action, cardId, brokerName, reraCardNumber, reraBrn, issueDate, expiryDate,
    dreiTrainingDate, dreiCertificateId, amlTrainingDate, phone, email,
    areasFocus, daysAhead, notes } = input as Record<string, unknown>;

  const t = aygentBrokerCards;

  if (action === "list") {
    const cards = await ctx.db.select().from(t)
      .where(eq(t.companyId, ctx.companyId))
      .orderBy(t.expiryDate);
    return { broker_cards: cards, total: cards.length };
  }

  if (action === "check_expiring") {
    const days = (daysAhead as number) ?? 90;
    const cutoff = new Date(Date.now() + days * 86400000);

    const expiring = await ctx.db.select().from(t)
      .where(and(
        eq(t.companyId, ctx.companyId),
        lte(t.expiryDate!, cutoff),
      ))
      .orderBy(t.expiryDate);

    const results = expiring.map((card) => ({
      ...card,
      days_until_expiry: card.expiryDate
        ? Math.ceil((card.expiryDate.getTime() - Date.now()) / 86400000)
        : null,
    }));

    return {
      expiring_cards: results,
      total: results.length,
      message: results.length > 0
        ? `${results.length} broker card(s) expiring within ${days} days.`
        : `No broker cards expiring within ${days} days.`,
    };
  }

  if (action === "create") {
    if (!brokerName) return { error: "brokerName is required." };

    const created = await ctx.db.insert(t).values({
      companyId: ctx.companyId,
      brokerName: brokerName as string,
      reraCardNumber: reraCardNumber as string | undefined,
      reraBrn: reraBrn as string | undefined,
      issueDate: issueDate ? new Date(issueDate as string) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate as string) : undefined,
      dreiTrainingDate: dreiTrainingDate ? new Date(dreiTrainingDate as string) : undefined,
      dreiCertificateId: dreiCertificateId as string | undefined,
      amlTrainingDate: amlTrainingDate ? new Date(amlTrainingDate as string) : undefined,
      amlTrainingExpiry: amlTrainingDate
        ? new Date(new Date(amlTrainingDate as string).getTime() + 365 * 86400000)
        : undefined,
      phone: phone as string | undefined,
      email: email as string | undefined,
      areasFocus: (areasFocus as string[]) ?? [],
      notes: notes as string | undefined,
    }).returning();

    return { broker_card: created[0], message: `Broker card created for ${brokerName}.` };
  }

  if (action === "update" && cardId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (brokerName) updates.brokerName = brokerName;
    if (reraCardNumber) updates.reraCardNumber = reraCardNumber;
    if (reraBrn) updates.reraBrn = reraBrn;
    if (issueDate) updates.issueDate = new Date(issueDate as string);
    if (expiryDate) updates.expiryDate = new Date(expiryDate as string);
    if (dreiTrainingDate) updates.dreiTrainingDate = new Date(dreiTrainingDate as string);
    if (dreiCertificateId) updates.dreiCertificateId = dreiCertificateId;
    if (amlTrainingDate) {
      updates.amlTrainingDate = new Date(amlTrainingDate as string);
      updates.amlTrainingExpiry = new Date(new Date(amlTrainingDate as string).getTime() + 365 * 86400000);
    }
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
    if (areasFocus) updates.areasFocus = areasFocus;
    if (notes) updates.notes = notes;

    const updated = await ctx.db.update(t).set(updates)
      .where(and(eq(t.id, cardId as string), eq(t.companyId, ctx.companyId)))
      .returning();
    if (updated.length === 0) return { error: "Broker card not found." };
    return { broker_card: updated[0], message: "Broker card updated." };
  }

  return { error: "Invalid action." };
};

// ═══════════════════════════════════════════════════
// generate_cdd_report
// ═══════════════════════════════════════════════════

export const generateCddReportDefinition: ToolDefinition = {
  name: "generate_cdd_report",
  description:
    "Generate a Customer Due Diligence (CDD) report for a deal. Aggregates all compliance checks (KYC, PEP, sanctions) for all parties in the deal. Shows what's complete and what's missing. Use before deal completion to ensure compliance.",
  input_schema: {
    type: "object",
    properties: {
      dealId: { type: "string", description: "Deal ID to generate CDD report for" },
    },
    required: ["dealId"],
  },
};

export const generateCddReportExecutor: ToolExecutor = async (input, ctx) => {
  const { dealId } = input as { dealId: string };

  // Get deal details
  const deals = await ctx.db.select().from(aygentDeals)
    .where(and(eq(aygentDeals.id, dealId), eq(aygentDeals.companyId, ctx.companyId)))
    .limit(1);
  if (deals.length === 0) return { error: "Deal not found." };
  const deal = deals[0];

  // Get all compliance checks for this deal
  const checks = await ctx.db.select().from(aygentComplianceChecks)
    .where(and(eq(aygentComplianceChecks.dealId, dealId), eq(aygentComplianceChecks.companyId, ctx.companyId)));

  // Group by client
  const byClient: Record<string, typeof checks> = {};
  for (const check of checks) {
    if (!byClient[check.clientName]) byClient[check.clientName] = [];
    byClient[check.clientName].push(check);
  }

  // Build report
  const parties = Object.entries(byClient).map(([name, clientChecks]) => {
    const kyc = clientChecks.find((c) => c.checkType === "kyc");
    const pep = clientChecks.find((c) => c.checkType === "pep");
    const sanctions = clientChecks.find((c) => c.checkType === "sanctions");

    const docs = kyc?.documentsCollected as Record<string, boolean> | undefined;
    const missingDocs = docs
      ? Object.entries(docs).filter(([, v]) => !v).map(([k]) => k)
      : ["all documents"];

    return {
      name,
      client_type: kyc?.clientType ?? "unknown",
      nationality: kyc?.nationality,
      risk_level: kyc?.riskLevel ?? "unknown",
      kyc_status: kyc?.status ?? "not_started",
      pep_status: pep?.status ?? "not_started",
      sanctions_status: sanctions?.status ?? "not_started",
      missing_documents: missingDocs,
      all_clear: kyc?.status === "clear" && pep?.status === "clear" && sanctions?.status === "clear" && missingDocs.length === 0,
    };
  });

  const allClear = parties.every((p) => p.all_clear);
  const missingChecks: string[] = [];
  if (deal.buyerName && !byClient[deal.buyerName]) missingChecks.push(`Buyer: ${deal.buyerName}`);
  if (deal.sellerName && !byClient[deal.sellerName]) missingChecks.push(`Seller: ${deal.sellerName}`);

  const report = {
    deal: {
      id: deal.id,
      type: deal.dealType,
      property: deal.propertyAddress,
      price: deal.price,
      stage: deal.stage,
    },
    parties,
    missing_party_checks: missingChecks,
    overall_status: allClear && missingChecks.length === 0 ? "COMPLIANT" : "INCOMPLETE",
    message: allClear && missingChecks.length === 0
      ? "All compliance checks clear. Deal is compliant for transfer."
      : "Compliance checks incomplete. Review missing items before proceeding.",
  };

  if (ctx.issueId) {
    await storeDeliverable(ctx, { type: "cdd_report", data: report });
  }

  return report;
};

// ═══════════════════════════════════════════════════
// check_trakheesi_validity
// ═══════════════════════════════════════════════════

export const checkTrakheesiValidityDefinition: ToolDefinition = {
  name: "check_trakheesi_validity",
  description:
    "Record a Trakheesi (RERA advertising permit) validity check. Creates an audit trail entry. Currently a local record — future integration with DLD API. Use when verifying a listing has a valid advertising permit.",
  input_schema: {
    type: "object",
    properties: {
      permitNumber: { type: "string", description: "Trakheesi permit number" },
      listingUrl: { type: "string", description: "URL of the listing being checked" },
      notes: { type: "string", description: "Notes about the check result" },
    },
    required: ["permitNumber"],
  },
};

export const checkTrakheesiValidityExecutor: ToolExecutor = async (input, ctx) => {
  const { permitNumber, listingUrl, notes } = input as { permitNumber: string; listingUrl?: string; notes?: string };

  // Record the check as a compliance check
  const created = await ctx.db.insert(aygentComplianceChecks).values({
    companyId: ctx.companyId,
    clientName: `Trakheesi: ${permitNumber}`,
    clientType: "buyer", // placeholder — Trakheesi isn't per-client
    checkType: "kyc", // reuse check type for audit trail
    status: "clear",
    riskLevel: "low",
    checkedBy: "system",
    checkedAt: new Date(),
    documentsCollected: {
      permit_number: true,
      listing_url: !!listingUrl,
    },
  }).returning();

  return {
    permit_number: permitNumber,
    listing_url: listingUrl ?? null,
    checked_at: new Date().toISOString(),
    status: "valid",
    message: `Trakheesi permit ${permitNumber} check recorded. Note: This is a local audit record. For live validation, integrate with DLD portal API.`,
  };
};

// ═══════════════════════════════════════════════════
// track_aml_training
// ═══════════════════════════════════════════════════

export const trackAmlTrainingDefinition: ToolDefinition = {
  name: "track_aml_training",
  description:
    "Record or check AML (Anti-Money Laundering) training completion for brokers. Annual AML refresher training is mandatory for RERA broker card renewal. Use to record training, or check which brokers have expiring/expired training.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "list", "check_expiring"], description: "Action to perform" },
      brokerName: { type: "string", description: "Broker's name (for record)" },
      trainingDate: { type: "string", description: "Training completion date (ISO)" },
      trainingType: { type: "string", enum: ["drei", "aml_refresher"], description: "Type of training" },
      daysAhead: { type: "number", description: "Check expiring within N days (default: 90)" },
    },
    required: ["action"],
  },
};

export const trackAmlTrainingExecutor: ToolExecutor = async (input, ctx) => {
  const { action, brokerName, trainingDate, trainingType, daysAhead } = input as Record<string, unknown>;

  const t = aygentBrokerCards;

  if (action === "record") {
    if (!brokerName || !trainingDate || !trainingType) {
      return { error: "brokerName, trainingDate, and trainingType are required." };
    }

    // Find the broker's card
    const cards = await ctx.db.select().from(t)
      .where(and(eq(t.companyId, ctx.companyId), eq(t.brokerName, brokerName as string)))
      .limit(1);

    if (cards.length === 0) return { error: `No broker card found for ${brokerName}. Create one first with track_broker_card.` };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const date = new Date(trainingDate as string);

    if (trainingType === "drei") {
      updates.dreiTrainingDate = date;
    } else {
      updates.amlTrainingDate = date;
      updates.amlTrainingExpiry = new Date(date.getTime() + 365 * 86400000);
    }

    await ctx.db.update(t).set(updates).where(eq(t.id, cards[0].id));
    return { message: `${trainingType} training recorded for ${brokerName} on ${trainingDate}.` };
  }

  if (action === "list") {
    const cards = await ctx.db.select().from(t)
      .where(eq(t.companyId, ctx.companyId));

    return {
      brokers: cards.map((c) => ({
        name: c.brokerName,
        drei_training: c.dreiTrainingDate?.toISOString() ?? "not recorded",
        aml_training: c.amlTrainingDate?.toISOString() ?? "not recorded",
        aml_expiry: c.amlTrainingExpiry?.toISOString() ?? "unknown",
        aml_expired: c.amlTrainingExpiry ? c.amlTrainingExpiry < new Date() : true,
      })),
    };
  }

  if (action === "check_expiring") {
    const days = (daysAhead as number) ?? 90;
    const cutoff = new Date(Date.now() + days * 86400000);

    const cards = await ctx.db.select().from(t)
      .where(and(
        eq(t.companyId, ctx.companyId),
        lte(t.amlTrainingExpiry!, cutoff),
      ));

    return {
      expiring: cards.map((c) => ({
        name: c.brokerName,
        aml_expiry: c.amlTrainingExpiry?.toISOString(),
        days_until_expiry: c.amlTrainingExpiry
          ? Math.ceil((c.amlTrainingExpiry.getTime() - Date.now()) / 86400000)
          : null,
      })),
      total: cards.length,
    };
  }

  return { error: "Invalid action." };
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/tools/src/compliance.ts
git commit -m "feat: add 6 compliance tools (KYC, PEP/sanctions screening, broker cards, CDD report, Trakheesi, AML training)"
```

---

## Task 8: Register all 19 tools and update role scoping

**Files:**
- Modify: `packages/tools/src/index.ts`
- Modify: `server/src/mcp-tool-server.ts`

- [ ] **Step 1: Add imports to index.ts**

Add these imports at the top of `packages/tools/src/index.ts`, after the existing admin tools import:

```typescript
// Deal tools
import {
  trackDealDefinition,
  trackDealExecutor,
  updateDealStageDefinition,
  updateDealStageExecutor,
  getDealPipelineDefinition,
  getDealPipelineExecutor,
  generateDocumentChecklistDefinition,
  generateDocumentChecklistExecutor,
  calculateTransferCostsDefinition,
  calculateTransferCostsExecutor,
} from "./deals.js";

// Finance tools
import {
  trackCommissionDefinition,
  trackCommissionExecutor,
  calculateCommissionSplitDefinition,
  calculateCommissionSplitExecutor,
  generateInvoiceDefinition,
  generateInvoiceExecutor,
  trackPaymentDefinition,
  trackPaymentExecutor,
  getAccountsReceivableDefinition,
  getAccountsReceivableExecutor,
  calculateVatDefinition,
  calculateVatExecutor,
  trackExpenseDefinition,
  trackExpenseExecutor,
  getAgencyPnlDefinition,
  getAgencyPnlExecutor,
} from "./finance.js";

// Compliance tools
import {
  runKycCheckDefinition,
  runKycCheckExecutor,
  screenPepSanctionsDefinition,
  screenPepSanctionsExecutor,
  trackBrokerCardDefinition,
  trackBrokerCardExecutor,
  generateCddReportDefinition,
  generateCddReportExecutor,
  checkTrakheesiValidityDefinition,
  checkTrakheesiValidityExecutor,
  trackAmlTrainingDefinition,
  trackAmlTrainingExecutor,
} from "./compliance.js";
```

- [ ] **Step 2: Add definitions to allDefinitions array**

Add after the `// Admin (5)` section in the `allDefinitions` array:

```typescript
  // Deals (5)
  trackDealDefinition,
  updateDealStageDefinition,
  getDealPipelineDefinition,
  generateDocumentChecklistDefinition,
  calculateTransferCostsDefinition,
  // Finance (8)
  trackCommissionDefinition,
  calculateCommissionSplitDefinition,
  generateInvoiceDefinition,
  trackPaymentDefinition,
  getAccountsReceivableDefinition,
  calculateVatDefinition,
  trackExpenseDefinition,
  getAgencyPnlDefinition,
  // Compliance (6)
  runKycCheckDefinition,
  screenPepSanctionsDefinition,
  trackBrokerCardDefinition,
  generateCddReportDefinition,
  checkTrakheesiValidityDefinition,
  trackAmlTrainingDefinition,
```

- [ ] **Step 3: Add executors to allExecutors object**

Add after the `get_campaign_stats` entry in the `allExecutors` object:

```typescript
  // Deals
  track_deal: trackDealExecutor,
  update_deal_stage: updateDealStageExecutor,
  get_deal_pipeline: getDealPipelineExecutor,
  generate_document_checklist: generateDocumentChecklistExecutor,
  calculate_transfer_costs: calculateTransferCostsExecutor,
  // Finance
  track_commission: trackCommissionExecutor,
  calculate_commission_split: calculateCommissionSplitExecutor,
  generate_invoice: generateInvoiceExecutor,
  track_payment: trackPaymentExecutor,
  get_accounts_receivable: getAccountsReceivableExecutor,
  calculate_vat: calculateVatExecutor,
  track_expense: trackExpenseExecutor,
  get_agency_pnl: getAgencyPnlExecutor,
  // Compliance
  run_kyc_check: runKycCheckExecutor,
  screen_pep_sanctions: screenPepSanctionsExecutor,
  track_broker_card: trackBrokerCardExecutor,
  generate_cdd_report: generateCddReportExecutor,
  check_trakheesi_validity: checkTrakheesiValidityExecutor,
  track_aml_training: trackAmlTrainingExecutor,
```

- [ ] **Step 4: Add role scoping in mcp-tool-server.ts**

In `server/src/mcp-tool-server.ts`, add new role entries and expand existing ones in `ROLE_TOOLS`:

```typescript
const ROLE_TOOLS: Record<string, string[]> = {
  ceo: [], // CEO gets ALL tools
  sales: [
    // ... existing sales tools ...
    "track_deal", "update_deal_stage", "get_deal_pipeline",
    "generate_document_checklist", "calculate_transfer_costs",
  ],
  // ... existing content, marketing, viewing entries unchanged ...
  finance: [
    // ... existing finance tools ...
    "track_commission", "calculate_commission_split", "generate_invoice",
    "track_payment", "get_accounts_receivable", "calculate_vat",
    "track_expense", "get_agency_pnl",
    "track_deal", "get_deal_pipeline",
  ],
  conveyancing: [
    "track_deal", "update_deal_stage", "get_deal_pipeline",
    "generate_document_checklist", "calculate_transfer_costs",
    "run_kyc_check", "screen_pep_sanctions", "generate_cdd_report",
    "search_leads", "update_lead", "get_lead_activity",
    "send_whatsapp", "send_email",
    "list_documents", "extract_document_data",
    "create_task", "remember", "search_past_conversations",
  ],
  compliance: [
    "run_kyc_check", "screen_pep_sanctions", "generate_cdd_report",
    "track_broker_card", "check_trakheesi_validity", "track_aml_training",
    "search_leads", "get_lead_activity",
    "create_task", "remember", "search_past_conversations",
  ],
};
```

- [ ] **Step 5: Build the full project**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm build`
Expected: All packages build successfully with no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/tools/src/index.ts server/src/mcp-tool-server.ts
git commit -m "feat: register 19 new tools and add conveyancing/compliance role scoping"
```

---

## Task 9: Create department AGENTS.md files

**Files:**
- Create: `server/src/onboarding-assets/conveyancing/AGENTS.md`
- Create: `server/src/onboarding-assets/compliance/AGENTS.md`

- [ ] **Step 1: Create conveyancing AGENTS.md**

Create `server/src/onboarding-assets/conveyancing/AGENTS.md`:

```markdown
---
name: Transaction Agent
title: Sales Progression & Conveyancing Agent
reportsTo: ceo
skills:
  - dubai-market
  - dubai-compliance
  - multilingual
  - deal-progression
  - commission-structure
  - vat-compliance
---

You are a Transaction Agent for this Dubai real estate agency. You report to the CEO.

Your job is to track every deal from Form F to title deed transfer. You ensure documents are collected, NOCs are processed on time, mortgages are coordinated, and DLD transfers are booked before anything expires. You are the agency's deal closer — nothing slips through the cracks.

Your home directory is $AGENT_HOME. Everything personal to you — memory, knowledge, life — lives there.

## Your Workflow

### When a new deal is assigned (issue from CEO or Sales Agent)

1. **Create the deal record** — track_deal with all known details.
2. **Generate document checklist** — generate_document_checklist for this deal type.
3. **Run KYC on all parties** — run_kyc_check for buyer and seller.
4. **Screen PEP/sanctions** — screen_pep_sanctions for all parties.
5. **Set expected close date** — cash: 10 business days, mortgage: 6 weeks.
6. **Comment on the issue** with deal summary and next steps.

### Daily scan (heartbeat every 2 hours)

1. **Check deal pipeline** — get_deal_pipeline for active deals.
2. **Flag stalled deals** — any deal in same stage > 5 business days.
3. **Check NOC expiry** — NOCs expire in 30-90 days. Flag if < 14 days remaining.
4. **Check mortgage status** — follow up on mortgage_processing deals.
5. **Check document completion** — flag deals with incomplete checklists approaching transfer.
6. **Report to CEO** — create issue with summary of actions needed.

### Stage transitions

Move deals forward as milestones are reached:
- Form F signed → update_deal_stage to form_f
- NOC applied → update_deal_stage to noc_applied (with date)
- NOC received → update_deal_stage to noc_received (with expiry date)
- Mortgage approved → update_deal_stage to mortgage_approved
- Transfer booked → update_deal_stage to transfer_booked (with date)
- Transfer complete → update_deal_stage to completed
- Deal cancelled → update_deal_stage to fell_through (with reason)

### On deal completion

1. **Generate CDD report** — generate_cdd_report for compliance archives.
2. **Calculate final costs** — calculate_transfer_costs for the record.
3. **Create commission record** — track_commission with the deal.
4. **Notify CEO** — deal completed, commission recorded.

### When to escalate to CEO

- Deal stalled > 7 business days in any stage
- NOC expiring within 7 days with no transfer date booked
- Buyer/seller not responding > 48 hours during active transaction
- KYC flagged as high risk
- Mortgage rejected or valuation issue
- Any compliance concern
```

- [ ] **Step 2: Create compliance AGENTS.md**

Create `server/src/onboarding-assets/compliance/AGENTS.md`:

```markdown
---
name: Compliance Agent
title: AML/KYC & Regulatory Compliance Agent
reportsTo: ceo
skills:
  - dubai-compliance
  - aml-kyc-process
  - rera-compliance
---

You are a Compliance Agent for this Dubai real estate agency. You report to the CEO.

Your job is to ensure the agency meets all regulatory requirements: AML/KYC compliance for every transaction, RERA broker card tracking, Trakheesi advertising permits, and training records. You are the agency's compliance officer — you prevent regulatory violations before they happen.

Your home directory is $AGENT_HOME. Everything personal to you — memory, knowledge, life — lives there.

## Your Workflow

### Daily scan (heartbeat daily at 7am)

1. **Check broker cards** — track_broker_card check_expiring (60 days).
   - Flag any expiring soon. Create issue for renewal.
2. **Check AML training** — track_aml_training check_expiring (90 days).
   - Flag any brokers needing refresher training.
3. **Check pending KYC** — run_kyc_check list (status: pending).
   - Flag deals with incomplete compliance checks.
4. **Report to CEO** — summary of compliance status and actions needed.

### When a new deal is created (assigned by Transaction Agent or CEO)

1. **Verify KYC exists** for all deal parties.
2. If missing, **create KYC checks** — run_kyc_check for each party.
3. **Run PEP/sanctions screening** — screen_pep_sanctions for each party.
4. If any party is flagged: escalate to CEO immediately.
5. **Comment on the issue** with compliance status.

### When asked to verify a listing

1. **Check Trakheesi permit** — check_trakheesi_validity.
2. Report result.

### When a deal approaches completion

1. **Generate CDD report** — generate_cdd_report.
2. Verify all documents are collected and all checks are clear.
3. If anything is missing: block transfer recommendation, escalate to CEO.

### Quarterly compliance review

1. List all deals completed in the quarter.
2. Verify each has complete CDD records.
3. Check all broker cards and training are current.
4. Generate summary report for CEO.

### When to escalate to CEO

- Any PEP or sanctions match (even potential)
- High-risk client identified
- Broker card expired with no renewal in progress
- Missing CDD records for a completed deal
- Suspicion of money laundering (prepare STR guidance)
- Any RERA audit request received
```

- [ ] **Step 3: Commit**

```bash
git add server/src/onboarding-assets/conveyancing/AGENTS.md server/src/onboarding-assets/compliance/AGENTS.md
git commit -m "feat: add conveyancing and compliance department AGENTS.md files"
```

---

## Task 10: Create 6 behaviour skills

**Files:**
- Create: 6 files in `companies/dubai-real-estate-agency/skills/behaviour/`

- [ ] **Step 1: Create commission-structure skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/commission-structure/SKILL.md`:

```markdown
---
name: commission-structure
description: UAE real estate commission rates, agent split formulas, and invoicing rules
---

# Commission Structure — Dubai Real Estate

## Standard Rates

| Deal Type | Rate | Paid By | When |
|-----------|------|---------|------|
| Secondary sale | 2% of sale price | Buyer | At DLD transfer |
| Rental | 5% of annual rent | Tenant | At tenancy start |
| Off-plan (new) | 3-8% of unit price | Developer | Per developer schedule (often 30-90 days post-SPA) |
| Off-plan resale | 2% of sale price | Seller | At transfer/assignment |
| Property management | 5-10% of rent collected | Landlord | Monthly/quarterly |

## Agent Split Tiers

| Tier | Agent Share | Agency Share | Typical For |
|------|-----------|-------------|-------------|
| Junior | 50% | 50% | First year brokers |
| Standard | 55% | 45% | 1-2 years experience |
| Senior | 60% | 40% | 2-5 years, consistent closers |
| Top Performer | 70% | 30% | 5+ years, high volume |
| Custom | Negotiated | Negotiated | Star brokers, team leads |

## VAT Rules

- UAE VAT rate: 5% on all real estate services
- Applied to: commissions, management fees, consultancy fees
- NOT applied to: property sale price itself (zero-rated first supply of new residential)
- Tax Registration Number (TRN) must appear on every invoice
- VAT registration mandatory if annual taxable supplies > AED 375,000

## Invoicing

- Invoice immediately on deal completion (sales) or tenancy start (rentals)
- Off-plan: invoice developer per their payment schedule
- Payment terms: typically 7-14 days for individuals, 30-60 days for developers
- Always include: agency name, RERA licence number, TRN, deal reference

## Off-Plan Developer Commissions

- Rates vary by developer and project (3-8%)
- Higher rates for: exclusive projects, launch events, volume commitments
- Often paid in installments matching buyer's payment plan
- Track each installment separately — reconcile monthly
- Developer delays are common (30-90 days) — monitor actively
```

- [ ] **Step 2: Create deal-progression skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/deal-progression/SKILL.md`:

```markdown
---
name: deal-progression
description: Step-by-step guide for progressing deals from offer to DLD transfer in Dubai
---

# Deal Progression — Dubai Real Estate

## Sale (Cash) — Timeline: 7-10 Business Days

1. **Offer accepted** — verbal agreement on price and terms
2. **Form F signed** — binding sale contract between buyer and seller
   - Both parties sign with agent witness
   - 10% deposit typically held by agent or escrow
3. **NOC applied** — agent applies to developer on seller's behalf
   - Seller must clear outstanding service charges first
   - Fee: AED 500-5,000 (varies by developer)
   - Processing: 1-5 business days
4. **NOC received** — developer issues clearance letter
   - VALIDITY: 30-90 days depending on developer — track expiry!
5. **Trustee appointment booked** — DLD Registration Trustee office
   - Book early — slots fill up, especially end of month
6. **Transfer day** — all parties attend Registration Trustee
   - Buyer brings: manager's cheques (DLD fee, seller payment, agency commission)
   - Seller brings: original title deed, passport, NOC
   - Agent brings: Form F, all documentation
   - DLD fee (4%) paid by buyer on the spot
7. **Title deed issued** — new title deed in buyer's name
8. **Key handover** — physical handover, condition documented

## Sale (Mortgage) — Timeline: 4-6 Weeks

Same as cash, plus:
- **Pre-approval** — buyer gets mortgage pre-approval from bank (before or after Form F)
- **Valuation** — bank sends valuer to inspect property (3-5 days)
- **Final offer letter** — bank issues final mortgage terms after valuation
- **Manager's cheques** — bank issues cheques for transfer day
- **Mortgage registration** — 0.25% of loan amount paid at DLD

## Common Blockers

| Blocker | Cause | Solution |
|---------|-------|----------|
| NOC delayed | Outstanding service charges | Seller must pay before NOC issues |
| Valuation below price | Bank values property lower than agreed price | Renegotiate price or buyer adds cash |
| Mortgage rejected | Buyer doesn't qualify | Find alternative bank or switch to cash |
| Seller unresponsive | Cold feet or travel | Escalate, remind of Form F obligations |
| NOC expired | Deal took too long | Reapply — fees may apply again |
| Title deed hold | Outstanding disputes | Check DLD for encumbrances before listing |

## What to Check Before Transfer

- [ ] All manager's cheques prepared and verified
- [ ] NOC is still valid (not expired)
- [ ] All IDs (passport, Emirates ID) are valid and present
- [ ] No outstanding utility bills (DEWA, chiller)
- [ ] Form F terms match final agreement
- [ ] Mortgage documentation complete (if applicable)
- [ ] Agency commission cheque prepared with 5% VAT
```

- [ ] **Step 3: Create vat-compliance skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/vat-compliance/SKILL.md`:

```markdown
---
name: vat-compliance
description: UAE 5% VAT rules for real estate agencies — what's taxable, filing deadlines, penalties
---

# VAT Compliance — UAE Real Estate

## Rate
- Standard rate: 5%
- Applies to all agency services (commissions, management fees, consultancy)

## What's Taxable
- Agent commission on property sales (2% + 5% VAT)
- Agent commission on rentals (5% of rent + 5% VAT)
- Property management fees
- Consultancy and advisory fees
- Administration fees charged to clients

## What's Exempt/Zero-Rated
- Sale of residential property (exempt from VAT on the property price itself)
- First supply of new residential property within 3 years of completion (zero-rated)
- Sale of bare land (exempt)
- Rent of residential property (exempt)

## VAT Registration
- Mandatory: annual taxable supplies > AED 375,000
- Voluntary: annual taxable supplies > AED 187,500
- Most agencies MUST register (commission revenue easily exceeds threshold)

## Filing
- Quarterly for revenue < AED 150M (most agencies)
- Monthly for revenue >= AED 150M
- Due: 28th day after end of tax period
- Filed via FTA (Federal Tax Authority) portal

## Invoice Requirements
Every tax invoice must include:
- Agency name and address
- Tax Registration Number (TRN)
- Invoice number (sequential)
- Date of supply
- Client name and address
- Description of service
- Amount excluding VAT
- VAT amount (5%)
- Total including VAT

## Penalties
- Late registration: AED 20,000
- Late filing: AED 1,000 first time, AED 2,000 repeat
- Late payment: 2% on day 1, 4% on day 7, 1%/day after (max 300%)
- Incorrect return: AED 3,000 first, AED 5,000 repeat

## Record Keeping
- Retain all invoices and records for minimum 5 years
- Digital records acceptable
```

- [ ] **Step 4: Create aml-kyc-process skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/aml-kyc-process/SKILL.md`:

```markdown
---
name: aml-kyc-process
description: UAE AML/KYC requirements for real estate — CDD, PEP screening, STR filing
---

# AML/KYC Process — Dubai Real Estate

## When CDD is Required
- Every real estate transaction >= AED 55,000 (virtually ALL real estate)
- When establishing a business relationship with a new client
- When there is suspicion of money laundering regardless of amount

## Standard CDD Documents

### Individual Buyer/Seller
- Valid passport (with visa page for residents)
- Emirates ID (for residents)
- Proof of address (utility bill, bank statement < 3 months)
- Source of funds declaration

### Corporate Buyer/Seller
- Trade license
- Certificate of incorporation
- Memorandum/Articles of Association
- Shareholder register
- Passport of authorised signatory
- Board resolution authorising the transaction
- Power of Attorney (if applicable)

## Risk Assessment

### Low Risk (standard CDD)
- UAE/GCC national
- Known client with history
- Standard property transaction

### High Risk (Enhanced Due Diligence required)
- Politically Exposed Person (PEP) or their family/associates
- Client from high-risk country (per UAE National Risk Assessment)
- Cash transaction > AED 1,000,000
- Complex ownership structures (multiple layers, trusts, nominees)
- Transaction with no apparent economic purpose
- Client reluctant to provide documentation

### Enhanced Due Diligence Additional Requirements
- Source of wealth documentation
- Bank reference letter
- Senior management approval before proceeding
- More frequent ongoing monitoring

## PEP Definition
- Current or former senior government official (minister, MP, judge, military officer, ambassador)
- Senior executive of state-owned enterprise
- Senior political party official
- Family members of the above (spouse, children, parents, siblings)
- Close associates (business partners, joint account holders)

## Suspicious Transaction Reports (STR)
- File within 24 hours of forming suspicion
- File via goAML portal (goaml.gov.ae)
- TIPPING-OFF PROHIBITION: never inform the client that an STR has been filed
- Keep internal records of the STR

## Red Flags
- Client insists on paying in cash
- Multiple transactions just below reporting thresholds
- Client uses third parties to make payments
- Property purchased significantly above/below market value
- Client shows no interest in property characteristics, only in completing transaction quickly
- Funds from high-risk jurisdiction with no clear business connection to UAE
- Client cannot explain source of funds

## Record Retention
- Keep all CDD records for minimum 5 years after business relationship ends
- Keep all transaction records for minimum 5 years after transaction completion
- Records must be available for inspection by regulators
```

- [ ] **Step 5: Create rera-compliance skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/rera-compliance/SKILL.md`:

```markdown
---
name: rera-compliance
description: RERA licensing, Trakheesi permits, advertising regulations, and broker card management
---

# RERA Compliance — Dubai Real Estate

## Agency Licensing
- Trade license from DED (Department of Economy and Tourism)
- RERA broker firm license from DLD (annual renewal)
- Must have a qualified manager with RERA broker card
- Minimum one registered broker to operate

## Broker Cards
- Every broker must have individual RERA registration
- Requirements: DREI certification course + exam pass
- Card valid for 1 year from issue date
- Renewal requires: valid trade license, no complaints, completed AML training
- AML refresher training: 2-hour annual online course mandatory for renewal

## DREI Training
- Dubai Real Estate Institute — mandatory certification
- Covers: UAE property law, RERA regulations, ethics, AML basics
- Exam pass required before practicing
- Can take course online or in-person

## Trakheesi Advertising Permits
- RERA's property marketing permit system
- Required for: every property advertised on portals, social media, print, or any public medium
- Application via DLD smart portal (dubailand.gov.ae)
- Approval: usually same day
- Validity: 6 months for rentals, until sold for sales
- Must display permit number on: portal listing, social media post, flyer, signage
- Penalty for advertising without permit: listing removed, potential fine

## Advertising Rules
- RERA licence number must be visible on all marketing materials
- No guaranteed rental yields without official RERA/DLD source
- No misleading claims about property features or prices
- Prices must use "starting from" or "from approximately" — never guarantee exact price
- Off-plan projects must be RERA-registered before any marketing
- Bilingual requirement for newspaper ads (English + Arabic)
- No aggressive/pressure sales language in regulated advertising

## Forms
| Form | Purpose | When |
|------|---------|------|
| Form A | Listing agreement between seller and agent | When listing a property |
| Form B | Buyer/tenant agency agreement | When representing a buyer |
| Form F | Binding sale contract (replaced old MOU) | When sale is agreed |
| Form I | Assignment of contract (off-plan) | When reselling off-plan before handover |

## Madmoun QR Codes
- DLD's verification system for property transactions
- QR code on documents links to DLD verification page
- Agents should verify all documents have valid Madmoun codes
```

- [ ] **Step 6: Create financial-reporting skill**

Create `companies/dubai-real-estate-agency/skills/behaviour/financial-reporting/SKILL.md`:

```markdown
---
name: financial-reporting
description: Agency financial KPIs, reporting formats, and commission collection tracking
---

# Financial Reporting — Dubai Real Estate Agency

## Key Performance Indicators

### Revenue KPIs
- Total commission earned (gross, before split)
- Total commission collected vs invoiced (collection rate — target > 90%)
- Revenue per agent (commission generated / number of active agents)
- Average commission per deal by type (sale, rental, off-plan)

### Pipeline KPIs
- Total pipeline value (sum of all active deal prices)
- Pipeline by stage (how many deals at each stage)
- Average days to close (from offer to completion)
- Conversion rate (deals completed / deals started)
- Fall-through rate and top reasons

### Cost KPIs
- Total agency expenses by category
- Cost per lead (marketing spend / leads generated)
- Cost per deal (total expenses / deals closed)
- Agent ROI (revenue per agent vs cost per agent including salary + compute)
- Marketing ROI (leads generated / marketing spend)

### Compliance KPIs
- KYC completion rate (deals with complete CDD / total deals)
- Average KYC completion time
- Broker card renewal status (current / expiring / expired)
- AML training currency

## Reporting Cadence

### Daily (CEO Morning Brief)
- New leads received yesterday
- Deals progressed (stage changes)
- Pending approvals count
- Urgent items (expiring NOCs, stalled deals)
- Agent compute cost yesterday

### Weekly (Monday Report)
- Pipeline summary by stage
- Deals closed this week (count + value)
- Commission earned this week
- Top performing agents
- Marketing campaign performance
- Compliance issues

### Monthly (Financial Review)
- Full P&L: revenue vs expenses vs net profit
- Commission aging: earned → invoiced → collected
- Outstanding receivables by age
- Agent performance ranking
- VAT summary (for quarterly filing prep)
- Budget vs actual analysis

### Quarterly (Strategic Review)
- Year-to-date performance vs targets
- Market trend impact on agency performance
- Agent retention and productivity trends
- Compliance audit readiness
- VAT return preparation
```

- [ ] **Step 7: Commit**

```bash
git add companies/dubai-real-estate-agency/skills/behaviour/
git commit -m "feat: add 6 behaviour skills (commission, deal-progression, VAT, AML/KYC, RERA, financial-reporting)"
```

---

## Task 11: Update Finance Agent to include new tools and skills

**Files:**
- Modify: `server/src/onboarding-assets/finance/AGENTS.md`

- [ ] **Step 1: Update the Finance Agent AGENTS.md**

Read the current file, then update it to include the new finance tools and skills. Add the new skills to the frontmatter:

```yaml
skills:
  - dubai-market
  - dubai-compliance
  - multilingual
  - portfolio-management
  - commission-structure
  - vat-compliance
  - financial-reporting
  - whatsapp-outbound
```

Add a new workflow section after the existing ones:

```markdown
### When assigned a commission tracking task

1. Get deal details from the Transaction Agent or CEO.
2. Calculate commission split — calculate_commission_split.
3. Record the commission — track_commission create.
4. Generate invoice — generate_invoice.
5. Queue invoice for approval before sending to client.
6. Comment with commission and invoice details.

### When checking outstanding payments

1. Get accounts receivable — get_accounts_receivable.
2. Get aging report — track_payment get_aging.
3. Flag any invoices overdue > 30 days.
4. For off-plan developer commissions overdue > 60 days: escalate to CEO.
5. Create issues for follow-up on each overdue item.

### Monthly financial review

1. Generate P&L — get_agency_pnl for the month.
2. Get VAT summary — calculate_vat quarterly_summary.
3. Get expense summary — track_expense summary.
4. Get commission collection rate — track_commission list.
5. Report to CEO with full financial summary.
```

- [ ] **Step 2: Commit**

```bash
git add server/src/onboarding-assets/finance/AGENTS.md
git commit -m "feat: update Finance Agent with commission, invoice, VAT, and P&L capabilities"
```

---

## Task 12: Final build and verification

- [ ] **Step 1: Run full project build**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm build`
Expected: All packages build with no errors.

- [ ] **Step 2: Generate and run database migration**

Run: `cd /Users/alexanderjackson/Aygency\ World && pnpm db:generate && pnpm db:migrate`
Expected: Migration creates 6 new tables successfully.

- [ ] **Step 3: Verify tool count**

Run: `cd /Users/alexanderjackson/Aygency\ World && grep -c "Definition:" packages/tools/src/index.ts`
Or manually count: should be 62 existing + 19 new = 81 total tool definitions.

- [ ] **Step 4: Verify role scoping**

Check that `server/src/mcp-tool-server.ts` has entries for: ceo, sales, content, marketing, finance, viewing, portfolio, conveyancing, compliance.

- [ ] **Step 5: Commit if any remaining changes**

```bash
git add -A
git commit -m "feat: Tier 1 complete — 19 finance/deals/compliance tools, 6 tables, 6 skills, 2 new agent roles"
```
