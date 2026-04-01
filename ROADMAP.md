# Aygency World — Implementation Roadmap

**Last updated:** 2026-04-01
**Current state:** Feature-complete. Deployed and live.

Mark tasks: `[ ]` not started → `[x]` done

---

## What's Live

| Area | Status | Detail |
|------|--------|--------|
| Paperclip fork | Done | Running on port 3100, embedded Postgres, Vite dev server on 5173 |
| UI (C variation) | Done | Three-panel layout, 15+ pages, all navigation working |
| Onboarding wizard | Done | 2-step → creates company + agent → CEO Chat issue → CEO wakeup |
| CEO Chat | Done | Streaming Anthropic API, rich context, quick actions, approval cards, task delegation, unread badge, mobile-optimized |
| Company template | Done | Dubai RE agency with 5 agent role templates (CEO, Sales, Content, Marketing, Finance) |
| Tools package | Done | 62 tools across 20 modules |
| MCP Tool Server | Done | Role-scoped filtering, standalone process |
| Skills | Done | 27+ markdown files — 13 behaviour, 4 domain, 3 platform, catalog |
| DB schema | Done | 80+ schema files, 93+ migrations |
| Approval system | Done | Approve → Execute pipeline (WhatsApp, email, Instagram, Facebook campaigns), batch approve, edit-before-approve |
| Agent roles | Done | Role defaults (templates, heartbeat, icon, gradient, budget) auto-applied on creation |
| WhatsApp/360dialog | Done | Connect, send on approval, inbound webhook, outbound message storage, conversation drawer, 24h window tracking |
| Properties page | Done | Card grid (PF-style), Sales/Rentals tabs, pipeline tracking, detail page, lead linking, agent skill |
| Portal email parsing | Done | Gmail Pub/Sub webhook, PF/Bayut/Dubizzle parser, auto-create leads |
| Facebook Ads | Done | Credential connect, Marketing API service, Lead Ads webhook, campaign launch/pause via approvals |
| Push notifications | Done | Web-push service, subscription management, fires on approvals/CEO messages/agent errors |
| Analytics | Done | Per-agent metrics, daily trends, recharts on Dashboard (cost + runs charts) |
| Leads API | Done | Full CRUD with filters (source, stage, score, search) |
| Credentials | Done | Per-agent credential store with CRUD + lookup + token refresh worker |
| Billing (Stripe) | Done | 4 tiers, 7-day trial, checkout, portal, webhook, subscription enforcement |
| Landing page | Done | Hero, value props, agent showcase, pricing table |
| Sign-up flow | Done | Auth → Stripe checkout → onboarding → CEO Chat |
| Mobile nav | Done | Bottom nav with CEO Chat (badge), Dashboard, Tasks, Team, Inbox |
| Deployment | Done | Docker Compose + nginx + SSL + deploy script, domain live |

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

## Phase 3 — Beta ✅ COMPLETE

- 3.1 MCP Tool Server ✅
- 3.3 Human Broker Integration ✅
- 3.4 Stripe Billing ✅
- 3.5 Analytics Dashboard ✅ (API + recharts)
- 3.7 Mobile Responsive ✅

## Post-Launch Polish ✅ COMPLETE

- [x] Properties page (card grid, pipeline, detail, lead linking)
- [x] WhatsApp conversation thread view (chat drawer from approval cards)
- [x] Edit-before-approve on approval cards
- [x] Batch approve (multi-select + approve all)
- [x] Outbound WhatsApp message storage
- [x] 24-hour WhatsApp window tracking + send blocking
- [x] CEO Chat unread badge (sidebar + mobile)
- [x] CEO Chat mobile-optimized
- [x] Analytics UI charts (recharts — daily cost + daily runs)
- [x] Token refresh background worker (30-min cycle)
- [x] Gmail Pub/Sub for Property Finder/Bayut/Dubizzle lead parsing
- [x] Leads CRUD API routes
- [x] Facebook Ads credential connect
- [x] Facebook Marketing API service
- [x] Facebook Lead Ads webhook
- [x] Campaign launch/pause via approval executor
- [x] PWA push notifications (subscription, service worker, event wiring)
- [x] Properties agent skill file

## Launch Readiness ✅ COMPLETE

- Approve → Execute pipeline ✅
- CEO first-run welcome brief ✅
- Stripe 7-day trial flow ✅
- Just-in-time integration prompts ✅
- Sign-up → billing → onboarding flow ✅
- Subscription enforcement ✅
- Landing page ✅
- Docker + nginx + SSL + deploy script ✅
- Domain + DNS ✅
- Deployment ✅

---

## Architecture Decisions

### Agent Model
- Departments are hardcoded (Executive, Sales, Content, Marketing, Operations, Finance)
- Agents are flexible within departments — CEO assigns tools from pool of 62
- CEO can add/remove tools from any agent, including cross-department tools
- Predefined roles are just presets (default tool bundles) — CEO can modify
- Skills taught via: pre-built library (27+), CEO extracts from conversation, owner writes directly

### AI Model Strategy
- Gemini 2.5 Flash for everything non-customer-facing (free/near-free, better quality than Haiku)
- Sonnet only for final customer-facing output (WhatsApp drafts, CEO Chat, Instagram, emails)
- Sonnet receives pre-assembled context and writes ONLY the message ($0.10/run, not $0.35)
- Opus only for Scale/Enterprise tier (50 runs/month, "Deep Think" toggle in CEO Chat)

### Event-Driven Architecture
- No heartbeat polling — agents only run when triggered by real events
- Scheduled: only 4 runs/day total (CEO morning brief, Content queue, Marketing check, Finance summary)
- Everything else: webhook triggers (new lead, WhatsApp reply, CEO message, escalation)

### WhatsApp / 360dialog
- 360dialog Partner Platform (€500/mo) — signed up, sandbox tested
- Embedded Signup via Connect Button for agency onboarding
- 24h window tracking enforced — blocks free-form sends after window expires
- All inbound + outbound messages stored in `aygent_whatsapp_messages`

### Pricing
- AED 999 / 1,499 / 2,499 / Custom (Starter / Growth / Scale / Enterprise)

---

## Remaining (optional, no priority)

- [ ] AI Calling (Twilio + Gemini Live — full rebuild for this stack)
- [ ] White-label enterprise tier
- [ ] Google Ads API (Search, Display, Performance Max)
- [ ] Gemini 2.5 Flash integration for non-customer-facing tasks
- [ ] Sonnet-only-for-final-output pipeline
- [ ] Opus "Deep Think" toggle for Scale/Enterprise
- [ ] Claude Code MCP config auto-generated per agent on heartbeat
