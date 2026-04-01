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

## Phase 5 — Agent Intelligence (Continuous Learning)

Goal: Agents get smarter over time, specific to each agency. Every correction and outcome becomes a training signal.

### 5.1 Approval Feedback Loop
- [ ] `agent_learnings` table (company_id, agent_id, type, context, original, corrected, reason, created_at)
- [ ] Capture every edit-before-approve as a `correction` learning (diff between original and what owner sent)
- [ ] Capture every rejection as a `rejection` learning with the agent's original draft + any owner note
- [ ] On each agent run: inject last 10 relevant learnings into agent system prompt as "Previous corrections from your agency owner"
- [ ] Relevance filtering: match learnings by agent role + action type (WhatsApp tone corrections only injected when drafting WhatsApp, not pitch decks)
- [ ] Dashboard: "Agent Learnings" section in agent detail page — list all corrections with delete button
- [ ] CEO morning brief includes: "Your agents applied 6 learnings from your previous corrections yesterday"

### 5.2 Outcome Tracking
- [ ] Track WhatsApp message outcomes: sent → delivered → read → replied (from Meta webhook status updates)
- [ ] Track which follow-up sequences led to viewings booked (lead stage progression correlated to message history)
- [ ] Track content engagement: Instagram post likes/comments/saves pulled via Graph API
- [ ] Weekly outcome summary generated (Gemini Flash): "Messages under 3 sentences get 40% more replies. JVC leads respond better to Arabic. Price-first messages outperform feature-first by 2x."
- [ ] Outcome summary injected into relevant agent runs as "What's working for this agency"
- [ ] Dashboard: "What's Working" card on Analytics page showing top 5 patterns

### 5.3 Skill Evolution
- [ ] Agents can propose skill amendments based on accumulated learnings (structured JSON in task output)
- [ ] Skill amendment approval card in CEO Chat: shows current skill text, proposed change, evidence (N corrections or outcome data)
- [ ] Owner approves → skill markdown file updated automatically → all future runs use improved version
- [ ] Skill version history: track what changed and when, with rollback option
- [ ] Rate limit: max 1 skill amendment proposal per agent per week (prevent noise)

### 5.4 Learning Lifecycle Management
- [ ] Learning decay: learnings older than 90 days auto-flagged for review (may be stale)
- [ ] Weekly compaction (Gemini Flash): summarize 20+ raw corrections into 5 durable insights, archive originals
- [ ] Conflict detection: if owner approves a casual tone Monday and edits to formal Wednesday, flag the conflict in CEO Chat for clarification
- [ ] Learning export: agency can download all learnings as JSON (data portability)
- [ ] Cap: max 50 active learnings per agent (oldest auto-archived when exceeded)

---

## Phase 6 — Inter-Agent Communication

Goal: Agents coordinate directly instead of routing everything through CEO. The agency acts like a team, not 6 separate chatbots.

### 6.1 Agent Bulletin Board
- [ ] `agent_messages` table (id, company_id, from_agent_id, to_agent_id nullable for broadcast, type, message jsonb, read_by_agents jsonb, created_at, expires_at)
- [ ] Three message tiers:
  - **Structured alerts** (price drop, no-show, score change): direct JSON insert, no LLM cost
  - **Summaries & recommendations** ("here's what I noticed"): generated via Gemini Flash
  - **Client-facing or owner-facing content**: still Claude Sonnet only
- [ ] Each agent checks bulletin board at start of their run: "Any messages for me since my last run?"
- [ ] Rate limit: max 5 outbound messages per agent per run (prevents feedback loops)
- [ ] Messages expire after 48 hours (no stale context accumulation)
- [ ] All inter-agent messages visible to CEO agent (nothing hidden from the owner)

### 6.2 Cross-Agent Skill Triggers
- [ ] Skill files define when to notify other agents:
  - Market Agent: "When you detect a price movement >10% in any area, send a `price_alert` to Lead Agent and Content Agent"
  - Lead Agent: "When a lead no-shows for a viewing, send a `lead_downgrade` to Viewing Agent"
  - Content Agent: "When you publish a post about a project, send a `content_published` to Lead Agent so they can reference it in follow-ups"
  - Viewing Agent: "When a viewing is completed, send `viewing_outcome` to Lead Agent with the result"
  - Lead Agent: "When you identify 3+ leads interested in the same project, send a `demand_signal` to Content Agent"
- [ ] Trigger definitions are part of the skill file format — agents follow them like any other instruction
- [ ] New skill type: `coordination-triggers.md` per agent role, listing all send/receive patterns

### 6.3 Event-Driven Wake (Direct Trigger)
- [ ] When Agent A posts a high-priority message to Agent B, it can trigger an immediate run for Agent B
- [ ] Priority levels: `info` (read on next scheduled run), `action` (trigger immediate run), `urgent` (trigger run + notify owner)
- [ ] Only `action` and `urgent` messages trigger immediate runs — `info` waits for next heartbeat
- [ ] Cost guard: max 3 triggered runs per agent per day (prevent runaway agent-to-agent loops)
- [ ] Loop detection: if Agent A triggers B triggers A within 10 minutes, halt the chain and notify CEO

---

## Phase 7 — Agency Intelligence UX

Goal: Make inter-agent coordination and learning visible to the owner. If they can't see it, it doesn't exist.

### 7.1 Agency Activity Feed
- [ ] New "Agency Activity" real-time feed component (WebSocket-driven, like existing Live Activity panel)
- [ ] Shows inter-agent messages as a timeline:
  ```
  Market Agent → Lead Agent           2 min ago
  "JVC 1BR prices dropped 12% (DLD data). You have 6 leads interested in JVC."

  Lead Agent                          1 min ago
  "Cross-referenced pipeline. Drafting re-engagement messages for 4 leads."

  Lead Agent → Content Agent          1 min ago
  "Need a JVC price-drop visual for Instagram."
  ```
- [ ] Feed entries link to resulting approval cards when applicable ("4 approval cards pending from this chain → [Review]")
- [ ] Filter by: agent, message type, time range
- [ ] Accessible from existing Live Activity sidebar panel (add tab: "Agent Comms")

### 7.2 Agency Insight Cards
- [ ] New notification/card type: "Agency Insight" — displayed in CEO Chat and as push notification
- [ ] Triggered when agents coordinate to produce a compound insight:
  ```
  Your agents connected two things:

  Market Agent found: Creek Harbour prices dropped 12%
  Lead Agent found: 6 leads stalled on Creek Harbour pricing

  → 4 re-engagement messages drafted
  → 1 Instagram post queued

  [Review All]   [Approve All]
  ```
- [ ] Insight detection: when an agent run was triggered by another agent's message AND produced approval cards, generate an insight card
- [ ] Insight cards appear at top of CEO Chat (above regular messages) with distinct styling
- [ ] Push notification: "Your agents figured something out" — taps through to the insight card

### 7.3 Agent Network Graph
- [ ] Visual network on Organisation page: agents as nodes, lines between agents that communicate
- [ ] Lines pulse/animate when a message is sent (WebSocket-driven)
- [ ] Line thickness = message volume between those two agents (last 7 days)
- [ ] Hover on a line → see last 3 messages between those agents
- [ ] Click a node → agent detail page
- [ ] Real-time: when a demo event triggers agent coordination, the graph lights up live
- [ ] Mobile: simplified list view showing "Agent A → Agent B: message" (graph is desktop only)

### 7.4 CEO Brief Enhancement
- [ ] Morning brief narrative format: connected story instead of isolated agent updates
- [ ] Brief includes: "Your agents coordinated N times yesterday" with top 3 examples
- [ ] Brief includes: "Your agents applied N learnings from your corrections" with examples of improved output
- [ ] Brief includes: cross-agent insights that were acted on ("Market Agent's price alert led to 4 re-engagement messages, 2 of which got replies")

### 7.5 Agent Learning Dashboard
- [ ] Agent detail page: new "Learning" tab showing all corrections, outcomes, and compacted insights for that agent
- [ ] Per-learning: show original draft, owner's edit, date, and how many times that learning has been applied since
- [ ] Delete button per learning (owner can remove bad learnings)
- [ ] "What I've Learned" summary card at top of the tab (Gemini Flash generated): "This agent has learned: use formal greetings for Arabic leads, lead with payment plans, keep messages under 3 sentences..."
- [ ] Agency-wide learning stats on Analytics page: total corrections, total learnings active, learnings applied this week

---

## Phase 8 — Advanced Intelligence (Future)

### 8.1 Cross-Agency Learning (anonymized, with consent)
- [ ] Opt-in: agencies can contribute anonymized patterns to a shared intelligence pool
- [ ] Aggregate insights: "Agencies in JVC see best response rates on Tuesday mornings", "Russian-speaking leads convert 2x with sub-3-minute response"
- [ ] New agencies benefit from day 1 — bootstrapped with proven patterns from the network
- [ ] Privacy: no lead data, no message content, no agency identity — only statistical patterns
- [ ] Competitive moat: every new agency makes every existing agency smarter

### 8.2 Predictive Agent Actions
- [ ] Agents anticipate instead of react: "Based on 3 months of data, this lead is likely to go cold in 48 hours — suggest pre-emptive follow-up"
- [ ] Content Agent predicts best posting times from engagement history (not generic best practices)
- [ ] Market Agent predicts price trends from DLD transaction velocity
- [ ] CEO brief includes forward-looking: "3 leads at risk of going cold this week" + recommended actions

### 8.3 Self-Optimizing Agent Teams
- [ ] CEO agent periodically reviews inter-agent communication patterns and suggests org chart changes
- [ ] "Lead Agent is sending 80% of messages to Content Agent — consider hiring a dedicated Sales Support Agent"
- [ ] "Viewing Agent has had zero communication in 2 weeks — your agency may not need this role yet"
- [ ] Team composition recommendations based on agency size, lead volume, and actual usage patterns

---

## Remaining (no priority)

- [ ] AI Calling (Twilio + Gemini Live — full rebuild for this stack)
- [ ] White-label enterprise tier
- [ ] Google Ads API (Search, Display, Performance Max)
- [ ] Gemini 2.5 Flash integration for non-customer-facing tasks
- [ ] Sonnet-only-for-final-output pipeline
- [ ] Opus "Deep Think" toggle for Scale/Enterprise
- [ ] Claude Code MCP config auto-generated per agent on heartbeat
