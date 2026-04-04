# Aygency World — Complete Department, Skills & Tools Matrix

> Based on real Dubai RE agency operations (Betterhomes, Allsopp & Allsopp, fam Properties) mapped to AI agent capabilities.

---

## Current State (What We Have)

| Department | Agent Role | Tools | Skills | Status |
|---|---|---|---|---|
| **Sales** | Lead Agent (`sales`) | 14 lead pipeline + 10 communication + 7 search | lead-response, lead-qualification | Built |
| **Content** | Content Agent (`content`) | 9 content generation + 3 communication | content-instagram, content-pitch-deck, campaign-management | Built |
| **Marketing** | Market Intel Agent (`marketing`) | 7 search + 2 admin | market-monitoring | Built |
| **Viewings** | Viewing Agent (`viewing`) | 5 calendar + 3 communication | viewing-scheduling | Built |
| **Finance** | Portfolio Agent (`finance`) | 5 portfolio tools | portfolio-management | Partial — portfolio only, no actual finance |
| **Calling** | Call Agent (`calling`) | 3 call tools + lead tools | call-handling | Built |

**Total: 6 departments, ~62 tools, ~10 skills**

---

## Target State (What a Real Agency Needs)

### Department Map

```
CEO
├── 1. Sales Department
│   ├── Lead Agent(s) — inbound leads, qualification, follow-up
│   ├── Listing Agent — seller acquisition, Form A, property marketing
│   └── Off-Plan Agent — developer relationships, SPA tracking, payment plans
│
├── 2. Sales Progression / Conveyancing Department ← NEW
│   └── Transaction Agent — Form F, NOC, DLD transfer, mortgage coordination
│
├── 3. Marketing Department
│   ├── Content Agent — social media, pitch decks, landing pages
│   ├── Market Intel Agent — DLD monitoring, listings, news
│   └── Ads Agent — Facebook/Google campaigns, portal listings
│
├── 4. Property Management Department ← EXPANDED
│   ├── Leasing Agent — tenant sourcing, Ejari, renewals
│   ├── Portfolio Agent — landlord management, rent collection, settlements
│   └── Maintenance Agent — repair requests, contractor dispatch
│
├── 5. Finance Department ← NEW (currently just portfolio)
│   └── Finance Agent — commissions, invoicing, VAT, P&L, developer reconciliation
│
├── 6. Compliance Department ← NEW
│   └── Compliance Agent — AML/KYC, Trakheesi permits, broker cards, RERA
│
├── 7. Client Services Department ← NEW
│   ├── Viewing Agent — scheduling, confirmations, post-viewing follow-up
│   ├── Golden Visa Agent — eligibility, GDRFA, document tracking
│   └── Mortgage Liaison — bank comparison, pre-approval, valuation tracking
│
├── 8. Operations Department ← NEW
│   └── Ops Agent — CRM hygiene, reporting, document archiving
│
└── 9. Calling Department
    └── Call Agent — inbound/outbound calls, voicemail
```

---

## Department 1: SALES (Expanded)

### Current
- Lead Agent handles everything: inbound, qualification, follow-up, handoff

### What's Missing
A real agency has distinct sales functions that the current Lead Agent can't cover:

**Listing Acquisition** — Getting properties TO sell (seller-side)
**Off-Plan Sales** — Developer relationships, SPA management, payment plan tracking
**Deal Progression** — After Form F is signed, who tracks the deal to completion?

### New Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `create_listing` | Create property listing with photos, description, price, Trakheesi permit | High |
| `manage_listing` | Update listing status, price, featured status across portals | High |
| `get_listing_performance` | Views, leads, calls per listing from PF/Bayut | Medium |
| `track_deal` | Create deal record: parties, property, price, stage, documents, dates | High |
| `update_deal_stage` | Move deal through: MOU → NOC → Transfer → Completed | High |
| `get_deal_pipeline` | All active deals with stages, blockers, expected close dates | High |
| `manage_developer_relationship` | Track developer partners, commission rates, inventory access | Medium |
| `track_payment_plan` | Off-plan installment schedule tracking per buyer | Medium |

### New Skills Needed

| Skill | Description |
|---|---|
| `listing-acquisition` | How to pitch sellers, prepare CMAs, set pricing, manage expectations |
| `off-plan-sales` | Payment plan explanations, developer USPs, OQOOD process, escrow rules |
| `deal-progression` | Step-by-step from Form F to title deed transfer |
| `objection-handling` | Common buyer/seller objections and responses (price, timing, market conditions) |

---

## Department 2: SALES PROGRESSION / CONVEYANCING (New)

This is the **biggest operational gap**. Every deal requires 10+ steps between MOU and transfer. Agencies lose deals here due to delays, missed documents, expired NOCs, etc.

### Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `create_form_f` | Draft Form F (binding sale contract) with all parties and terms | High |
| `track_noc` | Track NOC application: applied → in progress → issued → expired | High |
| `track_mortgage` | Track buyer's mortgage: pre-approval → valuation → final offer → cheques ready | High |
| `book_trustee_appointment` | Schedule DLD Registration Trustee appointment | Medium |
| `generate_document_checklist` | Per-deal checklist: passport copies, title deed, NOC, manager's cheques, etc. | High |
| `track_escrow_payment` | For off-plan: verify payment went to correct escrow account | Medium |
| `calculate_transfer_costs` | Full cost breakdown: DLD 4%, trustee AED 4K, NOC fee, agent commission, VAT | High (exists partially as `calculate_dld_fees`) |
| `track_power_of_attorney` | For absent parties: POA status, notarization, expiry | Low |
| `track_mortgage_discharge` | For sellers with existing mortgage: liability letter, discharge process | Medium |

### Skills Needed

| Skill | Description |
|---|---|
| `conveyancing-workflow` | Full step-by-step from offer to transfer, with timelines and common blockers |
| `document-requirements` | What documents are needed for each deal type (cash, mortgage, off-plan, commercial) |
| `trustee-process` | DLD Registration Trustee procedures, cheque requirements, appointment protocol |
| `mortgage-coordination` | Working with banks, understanding offer letters, valuation disputes |

---

## Department 3: MARKETING (Expanded)

### Current
- Content Agent and Market Intel Agent cover social media, pitch decks, DLD monitoring

### What's Missing
- Portal listing management (PF/Bayut/Dubizzle)
- Trakheesi permit applications
- Facebook/Google Ads (partially designed in CLAUDE.md but no tools built)

### New Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `apply_trakheesi_permit` | Apply for RERA advertising permit for a listing | High |
| `check_trakheesi_status` | Check permit approval status | High |
| `syndicate_listing` | Push listing to Property Finder, Bayut, Dubizzle via their APIs | Medium |
| `get_portal_analytics` | Listing performance metrics from portals | Medium |
| `create_fb_campaign` | Create Facebook/Instagram lead gen campaign | High (designed, not built) |
| `create_fb_ad_set` | Set targeting, budget, schedule | High |
| `create_fb_ad` | Attach creative + copy | High |
| `create_fb_lead_form` | Define instant form fields | High |
| `get_fb_campaign_stats` | Pull CPL, leads, spend, CTR | High |
| `pause_fb_campaign` | Pause running campaign | High |
| `update_fb_budget` | Adjust campaign budget | Medium |
| `schedule_photography` | Book photographer for listing | Low |

### New Skills Needed

| Skill | Description |
|---|---|
| `facebook-ads` | Campaign types, Dubai RE targeting, budget guidelines, optimization playbook (designed in CLAUDE.md) |
| `portal-optimization` | How to write high-performing PF/Bayut listings, photo guidelines, featured listings strategy |
| `trakheesi-compliance` | Permit rules, what requires a permit, renewal process |

---

## Department 4: PROPERTY MANAGEMENT (Expanded)

### Current
- Portfolio Agent handles landlord/property/tenancy CRUD + RERA rent calc

### What's Missing
- Tenant sourcing and screening
- Ejari registration
- Rent collection and cheque tracking
- Landlord settlement statements
- Maintenance request management
- Move-in/move-out inspections
- Holiday homes (separate sub-department)

### New Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `screen_tenant` | Run tenant screening: employment verification, reference check, ID verification | Medium |
| `register_ejari` | Register/renew tenancy contract with Ejari system | High |
| `track_rent_cheques` | Track PDCs: cheque number, date, amount, status (received/deposited/bounced) | High |
| `collect_rent_payment` | Record rent payment received, update ledger | High |
| `generate_landlord_statement` | Monthly/quarterly statement: gross rent, expenses, management fee, net payout | High |
| `create_maintenance_request` | Log maintenance request from tenant with priority and category | Medium |
| `dispatch_contractor` | Assign maintenance job to contractor, track completion | Medium |
| `conduct_inspection` | Generate inspection report with checklist items and photo references | Medium |
| `track_service_charges` | Monitor annual RERA service charge budgets per building | Low |
| `calculate_security_deposit` | Calculate and track tenant security deposits | Low |

### Holiday Homes Sub-tools (Phase 4+)

| Tool | Description | Priority |
|---|---|---|
| `manage_holiday_listing` | Manage Airbnb/Booking.com listing | Low |
| `set_dynamic_pricing` | Adjust nightly rates by season/demand | Low |
| `track_tourism_dirham` | Calculate and track Tourism Dirham obligation | Low |
| `schedule_turnover` | Book cleaning between guests | Low |

### New Skills Needed

| Skill | Description |
|---|---|
| `tenant-management` | Screening criteria, lease negotiation, renewal best practices |
| `ejari-process` | How to register, renew, and cancel Ejari contracts |
| `landlord-reporting` | Statement format, expense categorization, management fee calculation |
| `maintenance-triage` | How to categorize, prioritize, and route maintenance requests |
| `rent-collection` | Cheque management, bounced cheque protocol, arrears escalation |

---

## Department 5: FINANCE (New — Currently Just Portfolio)

This is the most critical missing department. No agency can operate without tracking money.

### Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `track_commission` | Record commission: deal ID, gross amount, agent split, agency split, status | Critical |
| `calculate_commission_split` | Apply split formula per deal type and agent tier | Critical |
| `generate_invoice` | Create tax invoice with 5% VAT for commission/management fee | Critical |
| `track_payment` | Record payment received/outstanding, due date, aging | Critical |
| `get_accounts_receivable` | Outstanding invoices by age (current, 30, 60, 90+ days) | High |
| `calculate_vat` | Calculate VAT on any amount, track quarterly VAT obligation | High |
| `generate_vat_return` | Summarize VAT collected vs VAT paid for FTA filing period | Medium |
| `get_agency_pnl` | Profit & loss: revenue (commissions + management fees) vs expenses | High |
| `track_expense` | Record agency expense: marketing, portals, salaries, office, etc. | High |
| `reconcile_developer_commission` | Match off-plan commission invoices to developer payments (often delayed 30-90 days) | High |
| `generate_broker_statement` | Per-broker: deals closed, commission earned, commission paid, balance | Medium |
| `manage_trust_account` | Track client deposits held in trust: received, held, released | Medium |
| `get_revenue_forecast` | Project commission income from active deal pipeline | Medium |

### Skills Needed

| Skill | Description |
|---|---|
| `commission-structure` | Standard rates: 2% secondary, 5% rental, 3-8% off-plan. Split formulas. When to invoice. |
| `vat-compliance` | UAE VAT rules for RE: what's taxable, what's exempt, filing deadlines, FTA portal |
| `financial-reporting` | P&L format, KPIs (revenue per agent, cost per deal, commission collection rate) |
| `developer-reconciliation` | How off-plan commission payment works, typical delays, escalation process |
| `trust-accounting` | Rules for holding client money, segregation requirements, audit trail |

---

## Department 6: COMPLIANCE (New)

Legally mandatory. AML non-compliance = RERA license revocation + criminal penalties.

### Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `run_kyc_check` | Collect and verify client identity documents (passport, visa, Emirates ID) | Critical |
| `screen_pep` | Screen person against PEP (Politically Exposed Persons) databases | Critical |
| `screen_sanctions` | Check against UAE, UN, OFAC, EU sanctions lists | Critical |
| `file_str` | Prepare Suspicious Transaction Report for goAML portal | High |
| `track_broker_card` | Track RERA broker card: issue date, expiry, renewal status, DREI training | High |
| `check_trakheesi_validity` | Verify a Trakheesi advertising permit is valid | High |
| `generate_cdd_report` | Customer Due Diligence report per transaction | High |
| `track_aml_training` | Track annual AML refresher training completion per broker | Medium |
| `generate_aml_audit_report` | Annual AML audit report for DLD submission | Medium |
| `verify_escrow_account` | Confirm developer's escrow account is active and registered with RERA | Medium |

### Skills Needed

| Skill | Description |
|---|---|
| `aml-kyc-process` | UAE AML framework, CDD requirements, when enhanced due diligence is required |
| `rera-compliance` | Licensing rules, advertising regulations, form requirements |
| `sanctions-screening` | How to screen, what to do if match found, escalation protocol |
| `str-filing` | When to file, how to file via goAML, 24-hour deadline, tipping-off prohibition |
| `data-protection` | UAE PDPA requirements, consent management, data retention periods |

---

## Department 7: CLIENT SERVICES (New — Partially Exists)

### Current
- Viewing Agent handles scheduling

### What's Missing
- Golden Visa facilitation
- Mortgage advisory liaison
- Post-sale service

### Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `check_golden_visa_eligibility` | Assess if property meets Golden Visa criteria (AED 2M+, freehold, completed) | Medium |
| `track_golden_visa_application` | Track application stages: nomination → medical → biometrics → visa issued | Medium |
| `compare_mortgage_rates` | Compare current UAE bank mortgage rates and terms | Medium |
| `track_mortgage_application` | Track buyer's mortgage stages: pre-approval → valuation → offer → completion | Medium |
| `generate_cma` | Comparative Market Analysis: pull comparable transactions, calculate price range | High |
| `send_post_sale_survey` | Post-transaction feedback and referral request | Low |

### Skills Needed

| Skill | Description |
|---|---|
| `golden-visa` | Eligibility criteria, application process, required documents, timeline |
| `mortgage-basics` | UAE mortgage rules (50% LTV for expats on off-plan, 75% for completed), bank comparison approach |
| `valuation-methodology` | How to prepare a CMA, what data sources to use, how to present to clients |

---

## Department 8: OPERATIONS (New)

### Tools Needed

| Tool | Description | Priority |
|---|---|---|
| `generate_report` | Configurable agency-wide report: deals, leads, revenue, agent performance | High |
| `audit_crm_data` | Find data quality issues: leads without phone, stale pipeline, missing stages | Medium |
| `archive_deal_documents` | Archive completed deal documents per RERA 5-year retention requirement | Medium |
| `get_agent_performance` | Per-agent: deals closed, revenue, leads converted, response time, listings acquired | High |
| `manage_office_expense` | Track office-level expenses: rent, utilities, subscriptions | Medium |

### Skills Needed

| Skill | Description |
|---|---|
| `reporting-standards` | What KPIs matter, how to present data, weekly/monthly/quarterly cadence |
| `data-hygiene` | CRM cleanup rules, deduplication, stage progression policies |

---

## Priority Matrix — What to Build First

### Tier 1: Critical (Can't run an agency without these)

| What | Why | Effort |
|---|---|---|
| **Finance tools** (commission tracking, invoicing, VAT) | Agencies make money from commissions. No tracking = no business. | 3-5 days |
| **Deal tracking tools** (track_deal, update_deal_stage, get_deal_pipeline) | Every sale needs progression tracking from offer to transfer | 2-3 days |
| **Compliance tools** (KYC, PEP/sanctions screening, broker card tracking) | Legally mandatory. Non-compliance = license revocation | 3-4 days |

### Tier 2: High Value (Major operational improvement)

| What | Why | Effort |
|---|---|---|
| **Conveyancing tools** (Form F, NOC tracking, mortgage tracking) | This is where deals die — delays, missing docs, expired NOCs | 3-4 days |
| **Rent collection tools** (cheque tracking, landlord statements) | Property management agencies need this daily | 2-3 days |
| **Facebook Ads tools** | Already designed in CLAUDE.md, major lead gen channel | 2-3 days |
| **Ejari registration** | Every rental needs Ejari — currently fully manual | 1-2 days |
| **Trakheesi permit tools** | Required for every listing advertisement | 1-2 days |

### Tier 3: Growth Features (Scale and differentiation)

| What | Why | Effort |
|---|---|---|
| **Portal syndication** (PF/Bayut/Dubizzle APIs) | Auto-publish listings, pull analytics | 3-4 days |
| **Golden Visa facilitation** | Premium value-add service, differentiator | 2-3 days |
| **CMA generation** | Automated comparative market analysis | 2-3 days |
| **Agent performance reporting** | Essential for agencies with 5+ agents | 2-3 days |
| **Holiday homes tools** | Separate business line | 4-5 days |

### Tier 4: Enterprise (10+ broker agencies)

| What | Why | Effort |
|---|---|---|
| **HR tools** (broker onboarding, DREI tracking, visa tracking) | Only needed when hiring at scale | 3-4 days |
| **AML audit report generation** | Annual requirement, manual until scale | 2-3 days |
| **Developer commission reconciliation** | Complex but critical for off-plan-heavy agencies | 2-3 days |
| **Trust account management** | Regulated requirement for holding client deposits | 2-3 days |

---

## New Tool Count Summary

| Department | New Tools | Existing Tools | Total |
|---|---|---|---|
| Sales (expanded) | 8 | 24 (lead + communication + search) | 32 |
| Sales Progression | 9 | 1 (calculate_dld_fees partial overlap) | 10 |
| Marketing (expanded) | 12 | 16 (content + search) | 28 |
| Property Management | 10 + 4 holiday homes | 5 (portfolio) | 19 |
| Finance | 13 | 0 | 13 |
| Compliance | 10 | 0 | 10 |
| Client Services | 6 | 5 (calendar/viewings) | 11 |
| Operations | 5 | 2 (remember, create_task) | 7 |
| Calling | 0 | 3 | 3 |
| **Total** | **77 new** | **62 existing** | **~130 tools** |

## New Skill Count Summary

| Department | New Skills | Existing Skills |
|---|---|---|
| Sales | 4 | 2 (lead-response, lead-qualification) |
| Sales Progression | 4 | 0 |
| Marketing | 3 | 3 (content-instagram, content-pitch-deck, campaign-management) |
| Property Management | 5 | 1 (portfolio-management) |
| Finance | 5 | 0 |
| Compliance | 5 | 1 (dubai-compliance partial) |
| Client Services | 3 | 1 (viewing-scheduling) |
| Operations | 2 | 0 |
| **Total** | **31 new** | **8 existing** |

---

## Domain Skills (Shared Across All Agents)

These already exist and apply agency-wide:
- `dubai-market` — areas, pricing, developers, Golden Visa, payment plans
- `dubai-compliance` — RERA advertising, PDPA, opt-out, disclaimers
- `multilingual` — language detection, tone by language

New domain skills needed:
- `dubai-transactions` — DLD process, forms (A/B/F), transfer steps, fees
- `dubai-regulatory` — RERA licensing, AML framework, Trakheesi, Ejari
- `dubai-finance` — Commission structures, VAT rules, trust accounts

---

## Role Enum Additions Needed

Current `AGENT_ROLES` has: ceo, sales, content, marketing, viewing, finance, calling, general

**Needs adding:**
- `conveyancing` — Sales Progression / Transaction Agent
- `compliance` — AML/KYC/RERA Compliance Agent
- `leasing` — Tenant sourcing, Ejari, renewals
- `maintenance` — Repair requests, contractor dispatch
- `operations` — Reporting, CRM hygiene, document archiving
- `offplan` — Developer relationships, SPA/OQOOD tracking
- `mortgage` — Bank liaison, application tracking
- `goldenvisa` — Visa facilitation

---

## Department Slug Additions Needed

Current departments: ceo, sales, content, marketing, finance

**Needs adding:**
- `conveyancing` — Sales Progression
- `compliance` — AML/KYC/Regulatory
- `property-management` — Expanded from current finance/portfolio
- `client-services` — Viewings, Golden Visa, Mortgage
- `operations` — Reporting, Admin, CRM
- `calling` — Already exists as role but no department directory

---

## Key Insight: Not All Departments Need Agents on Day 1

The beauty of the CEO delegation model is that departments can be **hired progressively**. The CEO recommends departments during onboarding based on agency size:

| Agency Size | Recommended Departments |
|---|---|
| Solo broker | Sales + Marketing (2 agents) |
| Small (2-5 people) | Sales + Marketing + Property Management (3-4 agents) |
| Medium (6-15 people) | Sales + Marketing + PM + Finance + Conveyancing (5-7 agents) |
| Large (15+) | All departments (8-12 agents) |
| Enterprise (50+) | All departments + Compliance + Operations + multiple agents per dept |

The tools and skills exist in the system — agents just get scoped access to the ones they need.

---

## Build Status (Updated 2026-04-04)

### BUILT

| Item | Status | Tools | Notes |
|---|---|---|---|
| Finance tools (commission, invoice, VAT, P&L, expenses) | DONE | 8 | finance.ts |
| Deal tracking (pipeline, stage transitions, document checklists) | DONE | 5 | deals.ts |
| Compliance (KYC, PEP/sanctions, broker cards, CDD, Trakheesi, AML) | DONE | 6 | compliance.ts |
| Rent collection (cheque tracking, payments, landlord statements) | DONE | 3 | property-management.ts |
| Maintenance requests | DONE | 1 | property-management.ts |
| Tenant screening | DONE | 1 | property-management.ts |
| Agent performance reporting | DONE | 1 | operations.ts |
| Conveyancing department | DONE | — | AGENTS.md + role scoping |
| Compliance department | DONE | — | AGENTS.md + role scoping |
| Calling department wiring | DONE | — | AGENTS.md + role scoping (tools existed) |
| 8 new skills | DONE | — | commission-structure, deal-progression, vat-compliance, aml-kyc-process, rera-compliance, financial-reporting, tenant-management, rent-collection |

**Current totals: 87 tools, 40 tables, 17 skills, 9 departments**

### DEFERRED (build when real API integrations exist)

| Item | Reason | Build When |
|---|---|---|
| Facebook Ads (7 tools) | No Meta Marketing API connected | Meta API integration |
| Listing management (4 tools) | No PF/Bayut syndication API | Portal API integration |
| Trakheesi permit application | No DLD portal API | DLD API access |
| Portal syndication | No portal APIs | PF/Bayut partnership |
| Golden Visa tracking (2 tools) | Nice-to-have, not blocking | Client demand |
| CMA generation | analyze_investment covers most | Client demand |
| Holiday homes (4 tools) | Separate business line | Phase 4+ |
| HR tools | Only for 10+ broker agencies | Enterprise tier |
| Operations reporting (audit_crm, generate_report) | get_agent_performance is the critical one | Scale |

### STILL NEEDED (real operations gaps)

| Item | Priority | Reason |
|---|---|---|
| Ejari registration tool | Medium | Every rental needs it, field exists but no dedicated tool |
| Developer commission reconciliation | Medium | Off-plan commissions delayed 30-90 days, need tracking |
| Trust account management | Medium | Regulated requirement for client deposits |
| Operations department (AGENTS.md) | Low | CEO covers most of this currently |
