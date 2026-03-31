# Aygency World — Implementation Roadmap

**Last updated:** 2026-03-31
**Current state:** Launch-ready. Self-serve flow complete. Deployment config ready.

Mark tasks: `[ ]` not started → `[x]` done

---

## What's Live

| Area | Status | Detail |
|------|--------|--------|
| Paperclip fork | Done | Running on port 3100, embedded Postgres, Vite dev server on 5173 |
| UI (C variation) | Done | Three-panel layout, 12+ pages, all navigation working |
| Onboarding wizard | Done | 2-step → creates company + agent → CEO Chat issue → CEO wakeup |
| CEO Chat | Done | Streaming Anthropic API, rich context, quick actions, approval cards, task delegation |
| Company template | Done | Dubai RE agency with 5 agent role templates (CEO, Sales, Content, Marketing, Finance) |
| Tools package | Done | 62 tools across 20 modules |
| MCP Tool Server | Done | Role-scoped filtering, standalone process |
| Skills | Done | 27 markdown files — 13 behaviour, 4 domain, 3 platform, catalog |
| DB schema | Done | 80+ schema files, 93+ migrations |
| Approval system | Done | Approve → Execute pipeline (360dialog WhatsApp, Gmail, Instagram) |
| Agent roles | Done | Role defaults (templates, heartbeat, icon, gradient, budget) auto-applied on creation |
| Webhook receiver | Done | WhatsApp inbound → store + create issues + route to agent |
| WhatsApp/360dialog | Done | Manual connect, webhook handler, UI component, real send on approval |
| Credentials | Done | Per-agent credential store with CRUD + lookup |
| Billing (Stripe) | Done | 4 tiers, 7-day trial, checkout, portal, webhook, subscription enforcement |
| Analytics | Done | Per-agent metrics, daily trends, task/approval stats via API |
| Landing page | Done | Hero, value props, agent showcase, pricing table |
| Sign-up flow | Done | Auth → Stripe checkout → onboarding → CEO Chat |
| Mobile nav | Done | Bottom nav with CEO Chat, Dashboard, Tasks, Team, Inbox |
| Broker API | Done | Scoped leads, action logging, help requests |
| Deployment | Done | Docker Compose + nginx + SSL + deploy script |

---

## Phase 1 — Demo ✅ COMPLETE

_(All items done — see git history)_

## Phase 2 — Alpha ✅ COMPLETE

- 2.1 Demo Data Seed ✅
- 2.2 Role-Based Agent Behaviour ✅
- 2.3 Approval Flow End-to-End ✅
- 2.4 CEO Chat Intelligence ✅
- 2.5 Webhook Receiver ✅
- 2.6 Multi-Tenant Credentials ✅
- 2.7 WhatsApp/360dialog ✅

## Phase 3 — Beta ✅ MOSTLY COMPLETE

- 3.1 MCP Tool Server ✅
- 3.3 Human Broker Integration ✅
- 3.4 Stripe Billing ✅
- 3.5 Analytics Dashboard ✅
- 3.7 Mobile Responsive ✅ (partial)

## Launch Readiness ✅ COMPLETE

- Approve → Execute pipeline ✅
- CEO first-run welcome brief ✅
- Stripe 7-day trial flow ✅
- Just-in-time integration prompts ✅
- Sign-up → billing → onboarding flow ✅
- Subscription enforcement ✅
- Landing page ✅
- Docker + nginx + SSL + deploy script ✅

---

## Architecture Decisions (from 2026-03-31 session)

### Agent Model
- Departments are hardcoded (Executive, Sales, Content, Marketing, Operations, Finance)
- Agents are flexible within departments — CEO assigns tools from pool of 62
- CEO can add/remove tools from any agent, including cross-department tools
- Predefined roles are just presets (default tool bundles) — CEO can modify
- Skills taught via: pre-built library (27), CEO extracts from conversation, owner writes directly
- Landing pages / pitch decks = template tools, not a Developer Agent. No Opus for customers.

### AI Model Strategy
- Gemini 2.5 Flash for everything non-customer-facing (free/near-free, better quality than Haiku)
- Sonnet only for final customer-facing output (WhatsApp drafts, CEO Chat, Instagram, emails)
- Sonnet receives pre-assembled context and writes ONLY the message ($0.10/run, not $0.35)
- Opus only for Scale/Enterprise tier (50 runs/month, "Deep Think" toggle in CEO Chat)
- Ollama (local) for routing/classification — add later when optimising at scale
- No Haiku anywhere — Gemini Flash is better quality AND cheaper

### Event-Driven Architecture
- No heartbeat polling — agents only run when triggered by real events
- Scheduled: only 4 runs/day total (CEO morning brief, Content queue, Marketing check, Finance summary)
- Everything else: webhook triggers (new lead, WhatsApp reply, CEO message, escalation)
- Routing decisions made in Node.js code or Gemini Flash — never spawn Sonnet to check if there's work

### WhatsApp / 360dialog
- 360dialog Partner Platform (€500/mo) — signed up, sandbox tested
- Embedded Signup via Connect Button for agency onboarding
- Max 3 numbers before Meta Tech Provider registration (covers demo/early agencies)
- Phone app disconnects when number connects to API — all messages visible in dashboard only
- whatsapp_messages table stores all inbound/outbound (zero AI cost)

### Pricing
- AED 999 / 1,499 / 2,499 / Custom (Starter / Growth / Scale / Enterprise)
- See PRICING-AND-BUSINESS-MODEL.md for full breakdown

---

## Remaining (post-launch polish)

### UI Polish
- [ ] Analytics UI charts (data available via API)
- [ ] WhatsApp conversation thread view (messages stored, need chat bubbles UI)
- [ ] CEO Chat full-screen on mobile
- [ ] Broker mobile UI view
- [ ] Unread message badge on CEO Chat sidebar
- [ ] Edit-before-approve on approval cards
- [ ] Batch approve in right panel

### Integration Polish
- [ ] Outbound WhatsApp message storage in DB (copy sent messages)
- [ ] 24-hour WhatsApp window tracking + template fallback
- [ ] Gmail Pub/Sub for Property Finder/Bayut lead parsing
- [ ] Token refresh background worker (30-min cycle)
- [ ] Claude Code MCP config auto-generated per agent on heartbeat
- [ ] Per-agency credential injection in MCP server

### AI Model Integration
- [ ] Gemini 2.5 Flash integration for non-customer-facing tasks
- [ ] Sonnet-only-for-final-output pipeline (pre-assemble context, Sonnet writes message only)
- [ ] Event-driven agent triggers (replace heartbeat polling with webhook + cron)
- [ ] Opus "Deep Think" toggle for Scale/Enterprise CEO Chat

### Phase 4 — Future Features

**4.1 — Facebook & Google Ads (agent-managed, agency's own account)**
- [ ] OAuth connect flow: agency connects their Facebook Ads account (Settings → Integrations)
- [ ] Store Facebook ad account token in `agent_credentials` (`ads_management`, `ads_read`, `leads_retrieval`)
- [ ] Marketing Agent: create campaigns, ad sets, ads via Facebook Marketing API
- [ ] Marketing Agent: generate ad images with Nanobana 2 (Google Imagen)
- [ ] Marketing Agent: generate ad videos with Veo 3.1
- [ ] Marketing Agent: write ad copy (headlines, primary text, descriptions) via Claude
- [ ] Campaign approval cards in CEO Chat (full preview: targeting, budget, creative, estimated results)
- [ ] Facebook Leads webhook: lead submits form → webhook receiver → create lead + issue → Sales Agent responds
- [ ] Marketing Agent: daily performance monitoring, auto-pause underperformers, budget reallocation
- [ ] Performance reporting in CEO morning brief (CPL, spend, leads, CTR)
- [ ] Google Ads API (Search, Display, Performance Max) — same pattern, separate OAuth

**4.2 — AI Calling**
- [ ] Reuse AygentDesk's Twilio + Gemini 2.0 Flash Live implementation
- [ ] Inbound call handling with real-time AI response
- [ ] Outbound call lists with owner approval before dialling
- [ ] Call transcripts stored against lead records

**4.3 — Portal Email Parsing**
- [ ] Property Finder email notification parsing (real-time via Gmail Push)
- [ ] Bayut email parsing
- [ ] Dubizzle email parsing
- [ ] Auto-create lead + assign to Sales agent

**4.4 — Advanced Features**
- [ ] White-label enterprise tier
- [ ] Agency context auto-learning
- [ ] Gemini Embedding 2 for semantic lead-to-project matching
- [ ] AygentDesk ↔ Aygency World shared lead DB
- [ ] PWA push notifications

---

## Deployment Checklist

- [ ] Register domain (aygencyworld.com)
- [ ] Point DNS A record to VPS (76.13.246.21)
- [ ] Copy `.env.production.example` → `.env.production`, fill values
- [ ] Run `./scripts/deploy.sh ssl` (get Let's Encrypt cert)
- [ ] Run `./scripts/deploy.sh deploy` (build + start)
- [ ] Run `./scripts/deploy.sh seed` (optional demo data)
- [ ] Configure Stripe webhook URL in Stripe Dashboard
- [ ] Configure 360dialog webhook URL
- [ ] Test full flow: sign up → checkout → onboarding → CEO Chat → approve WhatsApp
