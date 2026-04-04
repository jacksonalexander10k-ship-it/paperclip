# Tier 1: Finance, Deals & Compliance — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Scope:** 19 new tools, 6 new DB tables, 6 new skills, 2 new roles, 2 new department directories

---

## 1. Architecture

All new tools follow the existing pattern in `packages/tools/src/`:
- Each tool = a `ToolDefinition` (name, description, input_schema) + a `ToolExecutor` (async function)
- Executors receive `ToolContext` with `companyId`, `agentId`, `db`, `issueId`
- All queries scoped by `companyId` (multi-tenant)
- New DB tables in `packages/db/src/schema/` using Drizzle `pgTable`, exported from `index.ts`
- Tools registered in `packages/tools/src/index.ts` via `allDefinitions` + `allExecutors`
- Role scoping added to `ROLE_TOOLS` in `server/src/mcp-tool-server.ts`

No external API dependencies. All tools read/write to Aygency World's own Postgres DB.

---

## 2. New Database Tables

### 2.1 `aygent_deals`

Tracks every real estate transaction from offer to completion.

```
aygent_deals
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  lead_id         uuid FK → aygent_leads.id (set null) — the buyer/tenant
  agent_id        uuid FK → agents.id (set null) — assigned agent
  
  deal_type       text NOT NULL — 'sale' | 'rental' | 'offplan' | 'offplan_resale'
  stage           text NOT NULL default 'offer'
                  — offer → form_f → noc_applied → noc_received → mortgage_processing
                  → mortgage_approved → transfer_booked → transfer_complete
                  → completed | fell_through
  fell_through_reason text — if stage = fell_through

  property_address    text NOT NULL
  property_type       text — 'apartment' | 'villa' | 'townhouse' | 'office' | 'land'
  area                text — e.g. 'JVC', 'Downtown', 'Marina'
  developer           text — for off-plan
  project_name        text — for off-plan

  price               integer NOT NULL — sale price or annual rent in AED
  buyer_name          text
  buyer_phone         text
  buyer_email         text
  seller_name         text
  seller_phone        text

  form_f_date         timestamp — when Form F was signed
  noc_applied_date    timestamp
  noc_received_date   timestamp
  noc_expiry_date     timestamp — NOCs expire, must track
  mortgage_bank       text
  mortgage_status     text — 'pre_approved' | 'valuation' | 'final_offer' | 'cheques_ready'
  transfer_date       timestamp — booked DLD trustee appointment
  completion_date     timestamp — actual transfer completion

  documents_checklist jsonb default '{}' 
    — { "passport_buyer": true, "passport_seller": true, "title_deed": true,
        "noc": false, "form_f": true, "managers_cheques": false }

  expected_close_date timestamp
  notes               text

  created_at          timestamp NOT NULL default now()
  updated_at          timestamp NOT NULL default now()

INDEXES:
  (company_id, stage)
  (company_id, deal_type)
  (lead_id)
  (agent_id)
```

### 2.2 `aygent_commissions`

Tracks commission earned, invoiced, and collected per deal.

```
aygent_commissions
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  deal_id         uuid FK → aygent_deals.id (cascade)
  agent_id        uuid FK → agents.id (set null) — the broker who closed

  deal_type       text NOT NULL — mirrors deal.deal_type for quick queries
  gross_amount    integer NOT NULL — total commission in AED (e.g. 2% of sale price)
  commission_rate numeric(5,2) — the percentage applied (e.g. 2.00)

  agent_split_pct numeric(5,2) — broker's share percentage (e.g. 60.00)
  agent_amount    integer — broker's amount in AED
  agency_amount   integer — agency's share in AED

  vat_amount      integer — 5% VAT on gross_amount
  total_with_vat  integer — gross_amount + vat_amount

  status          text NOT NULL default 'earned'
                  — earned → invoiced → collected | overdue | written_off
  invoice_number  text — generated invoice reference
  invoice_date    timestamp
  due_date        timestamp
  paid_date       timestamp
  paid_amount     integer — partial payments supported

  source          text — 'buyer' | 'seller' | 'developer' | 'tenant' | 'landlord'
  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (deal_id)
  (agent_id)
```

### 2.3 `aygent_invoices`

Standalone invoice records (not all invoices are commission — management fees, consultancy, etc.)

```
aygent_invoices
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  commission_id   uuid FK → aygent_commissions.id (set null) — link to commission if applicable
  deal_id         uuid FK → aygent_deals.id (set null)

  invoice_number  text NOT NULL — auto-generated: INV-2026-0001
  invoice_type    text NOT NULL — 'commission' | 'management_fee' | 'consultancy' | 'other'

  client_name     text NOT NULL
  client_email    text
  client_phone    text

  description     text NOT NULL
  amount          integer NOT NULL — amount in AED before VAT
  vat_amount      integer NOT NULL — 5% VAT
  total           integer NOT NULL — amount + vat

  status          text NOT NULL default 'draft'
                  — draft → sent → paid → overdue → cancelled
  due_date        timestamp
  sent_date       timestamp
  paid_date       timestamp
  paid_amount     integer default 0

  agency_name     text — from agency_context
  agency_rera     text — RERA licence number
  agency_trn      text — Tax Registration Number for VAT

  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (company_id, invoice_type)
```

### 2.4 `aygent_expenses`

Agency operational expenses for P&L tracking.

```
aygent_expenses
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)

  category        text NOT NULL
                  — 'marketing' | 'portals' | 'photography' | 'office' | 'salaries'
                  | 'transport' | 'technology' | 'licensing' | 'other'
  description     text NOT NULL
  amount          integer NOT NULL — in AED
  vat_amount      integer default 0
  date            timestamp NOT NULL
  recurring       text — null | 'monthly' | 'quarterly' | 'yearly'
  vendor          text

  created_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, category)
  (company_id, date)
```

### 2.5 `aygent_compliance_checks`

Audit trail for KYC/PEP/sanctions screening per transaction party.

```
aygent_compliance_checks
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)
  deal_id         uuid FK → aygent_deals.id (set null)
  lead_id         uuid FK → aygent_leads.id (set null)

  client_name     text NOT NULL
  client_type     text NOT NULL — 'buyer' | 'seller' | 'tenant' | 'landlord'
  nationality     text
  emirates_id     text
  passport_number text

  check_type      text NOT NULL — 'kyc' | 'pep' | 'sanctions' | 'enhanced_dd'
  status          text NOT NULL default 'pending'
                  — pending → clear → flagged → escalated → resolved
  
  documents_collected jsonb default '{}'
    — { "passport": true, "emirates_id": true, "visa": true, 
        "proof_of_funds": false, "source_of_wealth": false }

  risk_level      text — 'low' | 'medium' | 'high'
  flag_reason     text — if status = flagged
  resolution      text — how flagged items were resolved
  
  checked_by      text — agent name or "system"
  checked_at      timestamp
  expires_at      timestamp — CDD valid for 1 year, then re-check needed

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, check_type, status)
  (deal_id)
  (client_name)
```

### 2.6 `aygent_broker_cards`

Track RERA broker card status and training compliance for human brokers.

```
aygent_broker_cards
  id              uuid PK default random
  company_id      uuid FK → companies.id (cascade)

  broker_name     text NOT NULL
  rera_card_number text
  rera_brn        text — Broker Registration Number
  
  issue_date      timestamp
  expiry_date     timestamp
  status          text NOT NULL default 'active'
                  — active | expiring_soon | expired | suspended | pending

  drei_training_date    timestamp — when DREI certification was completed
  drei_certificate_id   text
  aml_training_date     timestamp — annual AML refresher
  aml_training_expiry   timestamp — +1 year from training date
  
  phone           text
  email           text
  areas_focus     jsonb.$type<string[]>() default []
  
  notes           text

  created_at      timestamp NOT NULL default now()
  updated_at      timestamp NOT NULL default now()

INDEXES:
  (company_id, status)
  (company_id, expiry_date)
```

---

## 3. New Tool Files

### 3.1 `packages/tools/src/finance.ts` (8 tools)

**track_commission**
- Action-based: `create | update | list | get`
- Create: requires deal_id, gross_amount, commission_rate, agent_split_pct, source
- Auto-calculates: agent_amount, agency_amount, vat_amount (5%), total_with_vat
- List: filter by status (earned/invoiced/collected/overdue), agent_id, date range
- Returns: commission record with all calculated fields

**calculate_commission_split**
- Pure calculation, no DB write
- Input: price, deal_type, commission_rate (optional — uses defaults if not provided)
- Defaults: sale=2%, rental=5% of annual rent, offplan=5% (from developer)
- Input: agent_tier (optional: 'junior'=50%, 'senior'=60%, 'top'=70%, custom percentage)
- Returns: { gross, agent_share, agency_share, vat, total }

**generate_invoice**
- Creates invoice record with auto-generated invoice_number (INV-YYYY-NNNN)
- Input: invoice_type, client_name, description, amount, due_date
- Auto-calculates VAT at 5%
- Loads agency_name, agency_rera, agency_trn from agency_context (companySecrets or similar)
- Returns: full invoice record
- Stores as deliverable (issueId) for approval card rendering

**track_payment**
- Action-based: `record | list_outstanding | get_aging`
- Record: invoice_id, amount_paid, payment_date → updates invoice status
- List outstanding: all invoices with status != paid, ordered by due_date
- Get aging: group outstanding invoices by age bucket (current, 30d, 60d, 90d+)
- Returns: summary with total_outstanding, by_age_bucket

**get_accounts_receivable**
- Read-only aggregation
- Returns: total outstanding, broken down by: invoice_type, age_bucket, client
- Includes: overdue count, average days outstanding

**calculate_vat**
- Pure calculation
- Input: amount, is_inclusive (bool — is VAT already included?)
- Returns: { net_amount, vat_amount, gross_amount, vat_rate: 5 }
- Also: `quarterly_summary` action — sum all invoices for a date range, output VAT collected vs VAT paid on expenses

**track_expense**
- Action-based: `create | list | summary`
- Create: category, description, amount, date, recurring, vendor
- List: filter by category, date range
- Summary: group by category for date range, total expenses

**get_agency_pnl**
- Read-only aggregation
- Input: period (month/quarter/year), date
- Calculates:
  - Revenue: sum of collected commissions + management fees
  - Expenses: sum of aygent_expenses + agent compute costs (from Paperclip's cost_events)
  - Net profit: revenue - expenses
  - Per-agent ROI: revenue generated vs compute cost per agent
- Returns: structured P&L report

### 3.2 `packages/tools/src/deals.ts` (5 tools)

**track_deal**
- Action-based: `create | update | get | list`
- Create: requires deal_type, property_address, price, buyer_name; optional: lead_id, seller_name, area, developer
- Sets initial stage to 'offer', generates documents_checklist based on deal_type
- Update: deal_id + any fields to change (stage transitions validated)
- List: filter by stage, deal_type, agent_id, date range
- Get: full deal with all fields + linked commission + compliance checks

**update_deal_stage**
- Dedicated stage transition tool (simpler than full update)
- Input: deal_id, new_stage, notes (optional), date fields (e.g. noc_received_date)
- Validates stage transitions (can't skip from offer to transfer_complete)
- Valid transitions:
  - offer → form_f
  - form_f → noc_applied
  - noc_applied → noc_received
  - noc_received → mortgage_processing (if mortgage) OR transfer_booked (if cash)
  - mortgage_processing → mortgage_approved
  - mortgage_approved → transfer_booked
  - transfer_booked → transfer_complete
  - transfer_complete → completed
  - ANY → fell_through (with reason required)
- On completion: auto-creates commission record if not exists
- Returns: updated deal with new stage

**get_deal_pipeline**
- Read-only pipeline view
- Input: optional filters (deal_type, agent_id)
- Returns: deals grouped by stage with counts
  - { offer: [{...}, {...}], form_f: [{...}], noc_applied: [...], ... }
  - Summary: total_active, total_value, avg_days_in_pipeline, bottleneck_stage

**generate_document_checklist**
- Returns required documents for a deal type
- Input: deal_type, is_mortgage (bool)
- Sale (cash): passport_buyer, passport_seller, title_deed, form_f, noc, managers_cheques
- Sale (mortgage): + mortgage_pre_approval, valuation_report, final_offer_letter, insurance
- Offplan: passport_buyer, spa, oqood_registration, payment_receipts, escrow_confirmation
- Rental: passport_tenant, visa, emirates_id, employment_letter, tenancy_contract, ejari
- Returns: checklist as object with all items defaulting to false
- Optionally: deal_id to save checklist to the deal record

**calculate_transfer_costs**
- Enhanced version of existing `calculate_dld_fees` with full deal context
- Input: price, deal_type, is_mortgage, mortgage_amount, commission_rate
- Returns comprehensive breakdown:
  - DLD transfer fee: 4% of price + AED 580 admin
  - Title deed issuance: AED 4,200
  - NOC fee: AED 500-5,000 (varies by developer, input or default AED 1,000)
  - Mortgage registration: 0.25% of loan amount (if mortgage)
  - Agent commission: commission_rate% of price + 5% VAT
  - Buyer total, Seller total, Grand total
- Stores as deliverable for rendering in approval cards

### 3.3 `packages/tools/src/compliance.ts` (6 tools)

**run_kyc_check**
- Action-based: `create | update | get | list`
- Create: client_name, client_type, deal_id (optional), lead_id (optional)
- Generates document requirements based on client_type and transaction value
- Default risk_level: 'low' unless nationality in high-risk list or transaction > AED 1M
- Update: mark documents as collected, update status
- List: filter by status, deal_id, check_type

**screen_pep_sanctions**
- Creates a compliance_check record with check_type 'pep' and 'sanctions'
- Input: client_name, nationality, passport_number, emirates_id
- Since no external API: records that screening was performed, sets status to 'clear' by default
- Agent notes field for manual screening results
- If risk_level is 'high' or agent flags: status → 'flagged', creates escalation to CEO
- Placeholder for future API integration (ComplyAdvantage, Refinitiv)

**track_broker_card**
- Action-based: `create | update | list | check_expiring`
- Create: broker_name, rera_card_number, issue_date, expiry_date
- Check_expiring: returns all cards expiring within N days (default 90)
- Auto-sets status to 'expiring_soon' when within 60 days of expiry
- Returns: broker card details with days_until_expiry

**generate_cdd_report**
- Generates a Customer Due Diligence summary for a deal
- Input: deal_id
- Aggregates: all compliance_checks for that deal's parties
- Returns structured report:
  - Deal summary (type, price, parties)
  - Per-party: KYC status, documents collected, PEP/sanctions screening result, risk level
  - Overall risk assessment
  - Missing items (what still needs to be done)
- Stores as deliverable for approval card / document archiving

**check_trakheesi_validity**
- Stub: records that a Trakheesi permit check was requested
- Input: permit_number, listing_url (optional)
- Returns: { permit_number, checked_at, status: "valid" } — placeholder for future DLD API integration
- Logs the check in activity log for audit trail

**track_aml_training**
- Action-based: `record | list | check_expiring`
- Record: broker_name, training_date, training_type ('drei' | 'aml_refresher')
- Updates the corresponding broker_card record
- Check_expiring: brokers whose AML training expires within N days
- Returns: training status per broker with days_until_expiry

---

## 4. Role Scoping Updates

### 4.1 New entries in `ROLE_TOOLS` (mcp-tool-server.ts)

```typescript
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
```

### 4.2 Expand existing roles

```typescript
// Add deal tools to sales role
sales: [
  ...existing,
  "track_deal", "update_deal_stage", "get_deal_pipeline",
  "generate_document_checklist", "calculate_transfer_costs",
],

// Add finance tools to finance role
finance: [
  ...existing,
  "track_commission", "calculate_commission_split", "generate_invoice",
  "track_payment", "get_accounts_receivable", "calculate_vat",
  "track_expense", "get_agency_pnl",
  "track_deal", "get_deal_pipeline", // read-only deal access
],
```

### 4.3 CEO gets everything (no changes — empty array = all tools)

---

## 5. New Role Enums

Add to `AGENT_ROLES` in `packages/shared/src/constants.ts`:

```typescript
"conveyancing",  // Sales Progression / Transaction Agent
"compliance",    // AML/KYC/RERA Compliance Agent
```

Add to `AGENT_ROLE_LABELS`:

```typescript
conveyancing: "Conveyancing",
compliance: "Compliance",
```

---

## 6. New Department Directories

### 6.1 `server/src/onboarding-assets/conveyancing/AGENTS.md`

Defines the Transaction Agent role:
- Reports to: CEO
- Purpose: Track every deal from Form F to title deed transfer. Ensure documents are collected, NOCs processed, mortgages coordinated, and DLD transfers booked on time.
- Heartbeat: Every 2 hours — checks for deals approaching deadlines, expiring NOCs, stalled mortgages
- Tool groups: Deals, Compliance (subset), Communication (send only), Documents
- Skills: deal-progression, document-requirements, conveyancing-workflow, mortgage-coordination

### 6.2 `server/src/onboarding-assets/compliance/AGENTS.md`

Defines the Compliance Agent role:
- Reports to: CEO
- Purpose: Ensure AML/KYC compliance for every transaction, track broker RERA cards and training, verify Trakheesi permits.
- Heartbeat: Daily at 7am — checks for expiring broker cards, overdue KYC, deals missing compliance checks
- Tool groups: Compliance, Search (read-only)
- Skills: aml-kyc-process, rera-compliance, sanctions-screening, data-protection

---

## 7. New Skills (6 markdown files)

Location: `companies/dubai-real-estate-agency/skills/behaviour/`

### 7.1 `commission-structure.md`
- Standard UAE commission rates by deal type
- Sale (secondary): 2% from buyer, sometimes 1% from seller
- Rental: 5% of annual rent from tenant
- Off-plan: 3-8% from developer (varies by developer, project, volume)
- Off-plan resale: 2% from seller
- Property management fee: 5-10% of collected rent
- Agent split tiers: junior 50%, senior 60%, top performer 70%, custom negotiated
- When to invoice: on transfer completion (sales), on tenancy start (rentals), per developer schedule (off-plan)
- VAT: 5% on all commissions and fees. Agency must be VAT-registered if annual revenue > AED 375K.

### 7.2 `deal-progression.md`
- Step-by-step guide for each deal type
- Sale (cash): offer accepted → Form F signed → NOC applied → NOC received → trustee appointment booked → transfer day (cheques, ID, title deed) → completed
- Sale (mortgage): same + pre-approval → valuation → final offer letter → manager's cheques → transfer
- Timeline: cash 7-10 business days, mortgage 4-6 weeks
- Common blockers: NOC delayed (service charges outstanding), mortgage valuation below price, seller POA issues
- NOC validity: typically 30-90 days, must track expiry
- What to check before transfer: all cheques ready, NOC valid, all IDs present, no outstanding fees

### 7.3 `vat-compliance.md`
- UAE VAT rate: 5% on all real estate services
- Taxable: commissions, management fees, consultancy fees, admin fees
- Exempt: sale/transfer of residential property (zero-rated first supply of new residential)
- FTA filing: quarterly for revenue < AED 150M, monthly for larger
- Tax Registration Number (TRN): required on all invoices
- Record keeping: 5 years minimum
- Penalties: late filing AED 1,000 first time, AED 2,000 repeat

### 7.4 `aml-kyc-process.md`
- When CDD is required: every transaction >= AED 55,000 (virtually all real estate)
- Standard CDD documents: passport, visa, Emirates ID, proof of address
- Enhanced Due Diligence triggers: PEP, high-risk nationality, cash transaction > AED 1M, complex ownership structures
- EDD additional: source of funds documentation, source of wealth, senior management approval
- PEP definition: current or former government official, their family members, close associates
- High-risk countries: per UAE National Risk Assessment (updated periodically)
- Record retention: 5 years after business relationship ends
- STR filing: within 24 hours of suspicion via goAML portal. Tipping-off prohibition.
- Annual AML audit: submit to DLD for license renewal

### 7.5 `rera-compliance.md`
- Agency licensing: trade license + RERA broker firm license (annual renewal)
- Broker cards: individual RERA registration per broker, valid 1 year
- DREI training: mandatory certification course before practicing
- AML refresher: 2-hour annual course required for card renewal
- Trakheesi: RERA's property marketing permit system
  - Required for: every listing advertised on any portal or social media
  - Application: via DLD portal, usually approved same day
  - Validity: 6 months (rental) or until property is sold/rented
  - Penalty for missing permit: listing removed from portals, potential fine
- Form requirements: Form A (listing), Form B (buyer), Form F (sale contract) all mandatory
- Advertising rules: no guaranteed returns, "starting from" pricing, RERA license number visible

### 7.6 `financial-reporting.md`
- KPIs to track:
  - Revenue: total commission collected, management fees collected
  - Pipeline value: total value of active deals by stage
  - Collection rate: invoiced vs collected (target > 90%)
  - Cost per lead: marketing spend / leads generated
  - Cost per deal: total expenses / deals closed
  - Agent ROI: revenue per agent vs cost per agent (salary + compute)
  - Average days to close: from offer to completion
- Reporting cadence: daily brief (pending approvals, new leads), weekly (pipeline, performance), monthly (P&L, agent review)
- Commission aging: flag outstanding > 30 days (normal for off-plan), escalate > 90 days

---

## 8. Migration

One new migration file adding all 6 tables. Standard Drizzle migration via `pnpm db:generate && pnpm db:migrate`.

---

## 9. What This Does NOT Include

- No external API integrations (KYC/PEP screening is local record-keeping only)
- No invoice PDF generation (text-based invoice record, not a rendered PDF)
- No Trakheesi API integration (manual check recording only)
- No DLD portal integration (deal tracking is manual stage updates)
- No automatic deal creation from lead stage changes (agents do this manually)
- No rent collection tools (Tier 2 — property management expansion)
- No landlord settlement statements (Tier 2)
- No Facebook Ads tools (Tier 2)

These are all planned for subsequent tiers.

---

## 10. Files Changed/Created Summary

### New files (create):
1. `packages/db/src/schema/aygent-deals.ts`
2. `packages/db/src/schema/aygent-commissions.ts`
3. `packages/db/src/schema/aygent-invoices.ts`
4. `packages/db/src/schema/aygent-expenses.ts`
5. `packages/db/src/schema/aygent-compliance-checks.ts`
6. `packages/db/src/schema/aygent-broker-cards.ts`
7. `packages/tools/src/finance.ts`
8. `packages/tools/src/deals.ts`
9. `packages/tools/src/compliance.ts`
10. `server/src/onboarding-assets/conveyancing/AGENTS.md`
11. `server/src/onboarding-assets/compliance/AGENTS.md`
12. `companies/dubai-real-estate-agency/skills/behaviour/commission-structure.md`
13. `companies/dubai-real-estate-agency/skills/behaviour/deal-progression.md`
14. `companies/dubai-real-estate-agency/skills/behaviour/vat-compliance.md`
15. `companies/dubai-real-estate-agency/skills/behaviour/aml-kyc-process.md`
16. `companies/dubai-real-estate-agency/skills/behaviour/rera-compliance.md`
17. `companies/dubai-real-estate-agency/skills/behaviour/financial-reporting.md`

### Modified files (edit):
18. `packages/db/src/schema/index.ts` — add exports for 6 new tables
19. `packages/shared/src/constants.ts` — add 'conveyancing', 'compliance' to AGENT_ROLES + labels
20. `packages/tools/src/index.ts` — import + register 19 new tools
21. `server/src/mcp-tool-server.ts` — add conveyancing/compliance role scoping, expand sales/finance scoping
22. One new Drizzle migration file (auto-generated)
