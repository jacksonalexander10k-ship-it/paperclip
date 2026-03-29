# Aygency World — AI-Powered Real Estate Agency Operating System

## Vision

Aygency World lets anyone run a fully operational Dubai real estate agency — with or without human staff. It is a multi-agent AI platform where autonomous agents handle lead management, content, market intelligence, viewings, portfolio management, and outbound calling around the clock. The agency owner runs everything through one interface: a CEO chat.

It is built on a fork of [Paperclip](https://github.com/paperclipai/paperclip) (open-source agent orchestration, Node.js + React), rebranded and extended with a Dubai real estate company template and AygentDesk's 53 real estate tools wired in as the skill layer.

**AygentDesk vs Aygency World — they are different products that complement each other:**

| | AygentDesk | Aygency World |
|--|--|--|
| Who | Individual broker | Agency owner |
| Model | Human-driven, reactive | AI-driven, autonomous |
| Interface | Chat with one AI | CEO chat + agency dashboard |
| Agents | 1 | 5–15+ |
| Tools | 53, direct access | 53, role-scoped via MCP |
| Pricing | Per user/month | Per agent/month |
| Stack | Next.js / TypeScript / Prisma | Paperclip fork (Node.js / React / Drizzle) |

**The upsell path:** Agency World owner buys the platform to run their agency operations. Their human brokers individually subscribe to AygentDesk as their personal assistant. Two products, two revenue streams, one ecosystem.

---

## Core Philosophy

- **Autonomous by default.** Agents run on heartbeats — continuously, without being prompted. The agency operates while the owner sleeps.
- **CEO as the interface.** The owner has one relationship: with the CEO agent. The CEO delegates down, reports up, and escalates when needed. The owner never talks directly to sub-agents.
- **Approval before external action.** No WhatsApp sent, no email fired, no Instagram post published without an explicit approval card in the CEO chat. Agents prepare — humans authorise.
- **Role-scoped tools.** Each agent accesses only the tools relevant to their role. The CEO has full visibility. Sub-agents get scoped subsets. A Content Agent cannot accidentally send a WhatsApp.
- **Dubai-first.** Every default, template, and tool is built for Dubai's off-plan and secondary real estate market. Not generic CRM, not generic AI — Dubai real estate specifically.

---

## The Four User Segments

### 1. Established Agency Owner (5–20 human brokers)
Already has a team but has leakage: leads going cold overnight, content posted inconsistently, market intel nobody has time to monitor, admin backlogs. Agency World is their **AI back-office department** — running 24/7 alongside the human team. Human brokers focus on viewings and closings. AI agents handle volume work.

**Pitch:** "Your brokers cost AED 15–30K/month each. This runs your entire back-office for less than one broker's salary."

### 2. Solo Broker / Small Agency (1–3 people)
Doing everything themselves. Can't scale without hiring. Agency World gives them their **first virtual team** — lead agent, content agent, market agent, all running in the background.

**Pitch:** "Your competitors have 10 people. You now have 10 agents."

### 3. Entrepreneur / Investor (starting from scratch)
Has capital and interest in Dubai real estate but no staff, no RERA team, no operational infrastructure. Agency World IS the entire operating company. Sign up, connect integrations, define focus, go live.

**Pitch:** "Start a Dubai real estate business this week, not in 6 months."

### 4. Enterprise Agency (50+ brokers, white-label)
Wants to deploy AI infrastructure internally under their own brand. Private AI division rebranded and integrated. Replaces admin, marketing, analyst headcount at scale.

**Pitch:** "Your private AI department, under your brand."

---

## How Paperclip Actually Works (Important Foundation)

Before architecture decisions, you need to understand exactly what Paperclip does under the hood — because it directly determines how everything is built.

**Paperclip does NOT call the Claude API directly.** It spawns Claude Code as a local OS process:
```
Paperclip server → executes: claude --model claude-sonnet-4-6 --add-dir /tmp/skills/ < prompt.md
```
It monitors stdout, streams output to a WebSocket for live viewing in the UI, and parses token usage from Claude's output. The agent runs like a local CLI process, not an API call.

**Skills are injected via `--add-dir`.** Paperclip symlinks skill markdown files into a temp directory and passes it to Claude Code. Skills are lazy-loaded — Claude only reads a skill's full content when it decides it's relevant. This keeps prompts small.

**Heartbeats are scheduled in-process.** A lightweight background scheduler inside the Node.js server polls for agents due to run. No external queue (like BullMQ) needed. Each heartbeat: creates a workspace, spawns Claude Code, monitors it, records cost, cleans up.

**Tasks flow via atomic checkout.** When CEO wants to delegate to Lead Agent, it creates an issue and assigns it. Lead Agent's heartbeat atomically claims the issue via a single SQL UPDATE. If two agents try to claim simultaneously, only one wins — conflict-free. This is how Paperclip prevents race conditions across agents.

**Agent sessions persist across heartbeats.** Claude Code session state is saved in `agentTaskSessions` so the agent doesn't restart cold — it resumes context from the previous run on the same task.

**Multi-tenancy is built in.** Every entity in Paperclip's DB has a `company_id` FK. Access checks on every route. Complete isolation between agencies.

**The UI is React 19 + Vite + Tailwind + Radix UI + TanStack Query.** Real-time updates via WebSocket (`/realtime` endpoint). The ORM is Drizzle (NOT Prisma — different from AygentDesk).

**What Paperclip does NOT have out of the box:**
- Webhook receivers for inbound events (WhatsApp, portal leads)
- A proper chat interface (it has an issues board, not a CEO chat)
- Per-tenant OAuth credential storage
- Approval card components
- An onboarding wizard
- Mobile-responsive views

These are exactly what we build on top.

---

## Deployment Architecture

Two separate services on the same VPS, plus two lightweight supporting services:

```
VPS (76.13.246.21)
│
├── AygentDesk (Next.js, port 3000)     ← unchanged, continues to run
├── Aygency World (Paperclip fork, port 3001)  ← new, main product
├── Tool Bridge / MCP Server (port 3002)       ← thin service, routes tool calls
├── Webhook Receiver (port 3003)               ← handles inbound events
│
└── Nginx
    ├── aygentdesk.com → :3000
    └── aygencyworld.com → :3001
```

**Why not combine AygentDesk and Aygency World?**
Different stacks (Next.js vs Node.js/Express), different databases (Prisma vs Drizzle), different deployment models. They share tools via the Tool Bridge — not code. Keep them separate.

**Docker Compose (prod):**
```yaml
services:
  aygency-world:     # Paperclip fork
  tool-bridge:       # MCP/tool routing service
  webhook-receiver:  # Inbound event handler
  postgres:          # Shared DB
  nginx:             # Reverse proxy
```

---

## Tool Integration — Options & Decision

The 53 AygentDesk tools need to be accessible to Aygency World agents. There are four ways to do this. We use Option B for the demo, then evolve to Option A for production.

### Option A — MCP Server (production architecture) ✅ LONG-TERM

Build a proper MCP (Model Context Protocol) server that exposes all 53 tools. Claude Code has native MCP support — configure each agent's Claude Code process to connect to it on startup.

```
Paperclip → spawns Claude Code
Claude Code → connects to MCP server (configured in claude_mcp_config.json)
MCP server → receives tool call + agencyId + role
MCP server → loads agency credentials from DB
MCP server → executes tool against AygentDesk API
MCP server → returns result to Claude Code
```

**Why this is right long-term:**
- Claude Code supports MCP natively and first-class
- Role-scoping is clean: the MCP server returns only the tools for that agent's role
- Any new tool added to AygentDesk automatically appears in Aygency World
- Debugging is clean — structured tool call logs
- The MCP server itself is ~200 lines of Node.js

### Option B — Markdown skills with bash/curl (demo architecture) ✅ DAY 1

Write skills as markdown files that instruct Claude to make HTTP calls to AygentDesk's existing API. Claude Code is excellent at running bash. Zero new infrastructure required.

```markdown
# search-leads.md
To search for leads, run this command:
curl -X POST $AYGENTDESK_URL/api/tools/search_leads \
  -H "Authorization: Bearer $AGENCY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{{query}}", "agencyId": "$AGENCY_ID"}'
Parse the JSON response and use the leads array.
```

**Why to start here:** Zero infrastructure. AygentDesk already exists and is running. Demo-ready in hours, not days. Build the proper MCP server in Phase 2 while the demo is already running.

### Option C — Shared npm package (not recommended now)
Extract tools into `@aygent/tools` package shared by both products. Requires significant AygentDesk refactoring — tools are tightly coupled to Next.js/Prisma. Worth doing in v2 but not now.

### Option D — Use Paperclip as-is via plugin (rejected)
Can't change the UI, onboarding, or branding. Kills the product vision entirely.

---

## The Tool Bridge / MCP Server

The Tool Bridge is a lightweight Node.js/Express service that acts as the bridge between Paperclip's Claude Code agents and AygentDesk's tool implementations.

### What it does
1. Receives a tool call: `{ tool: "send_whatsapp", agencyId: "uuid", role: "lead-agent", params: {...} }`
2. Verifies the calling agent's role is allowed to use this tool
3. Loads the agency's credentials from the DB (WhatsApp token, Gmail token, etc.)
4. Calls AygentDesk's internal API with those credentials
5. Returns the result

### Role-to-tool mapping (enforced at the bridge)
```
CEO:           all 53 tools (read-heavy, write-gated)
Lead Agent:    search_leads, update_lead, send_whatsapp, send_email, bulk_follow_up, tag_lead, match_deal_to_leads, get_follow_ups, reactivate_stale_leads
Content Agent: generate_social_content, post_to_instagram, generate_pitch_deck, generate_pitch_presentation, generate_landing_page, launch_campaign, create_drip_campaign, enroll_lead_in_campaign
Market Agent:  search_dld_transactions, search_listings, watch_listings, get_news, web_search, analyze_investment, search_projects, get_project_details, calculate_dld_fees
Viewing Agent: schedule_viewing, get_viewings, get_calendar, create_event, check_availability, send_whatsapp, send_email
Portfolio Agent: manage_landlord, manage_property, manage_tenancy, calculate_rera_rent, list_documents, create_portal, get_portal_activity, send_email
Call Agent:    make_call, inbound call handler, voicemail transcription
Social Agent:  search_instagram_dms, post_to_instagram, generate_social_content
```

---

## The Webhook Receiver Service

Paperclip has no built-in webhook receivers. This is a separate lightweight Express service that handles all inbound real-world events and translates them into Paperclip issues.

### What it handles

**WhatsApp inbound messages**
- Meta Cloud API sends a webhook POST for every inbound message to the agency number
- Receiver authenticates the signature, parses the message
- Creates a Paperclip issue: `{ title: "WhatsApp from Ahmed Al Hashimi", description: "...message...", projectId: "lead-inbox" }`
- Paperclip scheduler wakes Lead Agent on next heartbeat

**Property Finder / Bayut / Dubizzle leads**
- These portals email lead notifications to the agency's Gmail
- Gmail Push Notifications (not polling) deliver in real-time via webhook
- Receiver parses the structured email format from each portal
- Creates a lead record + Paperclip issue
- Lead Agent processes it immediately on next heartbeat (every 15 min)

**Landing page form submissions**
- AygentDesk generates landing pages with lead capture forms
- Form POST hits the webhook receiver
- Creates lead record + Paperclip issue

**Per-broker WhatsApp**
- Same pattern — each broker's connected number has its own webhook subscription

### Why a separate service?
Keeps inbound event handling fully decoupled from Paperclip. The receiver is dumb — it just translates external events into Paperclip tasks. If Paperclip is slow or restarting, events queue up in the receiver and retry. Clean separation of concerns.

---

## Database Architecture

Paperclip's embedded PostgreSQL + additional tables for Aygency World extensions. Uses Drizzle ORM (NOT Prisma).

### Paperclip's built-in tables (don't touch)
- `companies` — each agency is a company
- `agents` — each AI agent in the org chart
- `issues` — tasks/assignments between agents
- `heartbeat_runs` — log of every agent execution
- `cost_events` — token usage and dollar cost per run
- `activity_log` — immutable audit trail
- `agent_task_sessions` — persisted Claude session state

### Additional tables (Aygency World extensions)
```sql
-- Per-agency OAuth credentials (encrypted at rest)
agency_credentials (
  id, company_id, service (whatsapp|gmail|instagram|google_calendar),
  access_token (encrypted), refresh_token (encrypted),
  phone_number_id, expires_at, created_at
)

-- Agency knowledge base (CEO interview results + ongoing updates)
agency_context (
  id, company_id, key, value (jsonb), updated_at
)

-- Human brokers and their connected WhatsApp numbers
brokers (
  id, company_id, user_id, name, phone, whatsapp_phone_number_id,
  areas_focus, tone_preference, status (active|inactive)
)

-- Lead records
leads (
  id, company_id, name, phone, email, source, language,
  score (0-10), stage, assigned_broker_id,
  budget_min, budget_max, area_preference, property_type,
  timeline, financing_status, created_at, last_contact_at
)

-- Pending approvals queue
approvals (
  id, company_id, agent_id, type, payload (jsonb),
  status (pending|approved|rejected|edited),
  created_at, resolved_at, resolved_by
)

-- Escalations (high-priority, immediate notification)
escalations (
  id, company_id, agent_id, reason, lead_id,
  status (pending|resolved), notified_at, resolved_at
)

-- Inbound webhook events log
webhook_events (
  id, company_id, source, raw_payload (jsonb),
  processed (bool), issue_id, created_at
)

-- Notification log
notifications (
  id, company_id, user_id, channel (push|whatsapp|email),
  message, sent_at, read_at
)
```

---

## Authentication & Multi-Tenancy

### Auth system: better-auth (Paperclip's built-in)
Do NOT swap in NextAuth from AygentDesk. Different stack, different session model. Paperclip's `better-auth` handles agency owner accounts, sessions, and API keys natively.

### Roles
| Role | Access |
|------|--------|
| **Owner** | Full control — billing, agent management, all approvals, all leads |
| **Manager** | All agents, all leads, all approvals — but no billing |
| **Broker** | Their assigned leads only — view history, log actions, request CEO help |
| **Viewer** | Dashboard metrics only — read-only |

### Multi-tenancy
Every entity in the DB has `company_id`. Paperclip enforces this on every route. Agent API keys are scoped to `(agent_id, company_id)` — an agent in Agency A cannot access Agency B's data. Built in, not bolted on.

---

## Onboarding Flow (Hybrid Wizard + CEO Interview)

### Step 1 — Agency Basics (wizard, 60 seconds)
- Agency name + logo upload
- Focus area: Off-Plan / Rentals / Secondary / All
- Size: Solo / Small (2–5) / Medium (6–15) / Large (15+)
- Stored immediately in `agency_context`

### Step 2 — Connect Integrations (OAuth, 2 minutes)
- **WhatsApp** (required): Meta Business OAuth → `whatsapp_business_messaging` permission → token + phone number ID stored
- **Gmail** (required): Google OAuth → `gmail.readonly`, `gmail.send`, `gmail.modify` → tokens stored. On connection, immediately scans last 7 days for PF/Bayut/Dubizzle notification emails and imports any leads found.
- **Instagram** (optional): Meta OAuth (same App as WhatsApp) → `instagram_content_publish`, `instagram_manage_messages`
- **Google Calendar** (optional): same OAuth as Gmail → `calendar.events`

### Step 3 — CEO Is Hired
- CEO agent instantiated in Paperclip as a company
- Wizard closes. CEO Chat opens.
- CEO already knows the basics from step 1.
- CEO runs first heartbeat immediately — begins strategic onboarding interview:

```
CEO: "Hi, I've reviewed your agency setup. Before I recommend a team, I have a few quick questions.

What's your biggest challenge right now — generating leads, converting the ones you have, or managing existing landlord/tenant relationships?"

[Owner responds in chat]

CEO: "Got it. Which areas are you currently focused on, and which projects are you actively selling?"

[...]

CEO: "Based on what you've told me, here's the team I recommend:
- Lead Agent — handles all inbound enquiries, follow-ups, pipeline management
- Content Agent — daily Instagram posts, pitch decks, landing pages
- Market Intel Agent — monitors DLD, Bayut listings, flags opportunities

Shall I hire these three to get started?"

[Owner approves → agents created in Paperclip]
```

### Demo Mode (for users who skip OAuth)
Users who don't connect real credentials in step 2 enter Demo Mode:
- Pre-populated fake agency: 12 leads in pipeline, a week of agent activity already logged, 3 pending approval cards waiting
- Morning brief from the CEO summarising the demo agency's week
- First experience is a running agency — not an empty state
- Prominent CTA: "Connect your real agency to go live"

---

## The CEO Chat Interface

This is the most important UI addition. Paperclip's default UI is an issues board — not suitable. We build a proper chat interface on top of Paperclip's existing comment API.

### How it works technically
- One persistent Paperclip issue per agency: "CEO Chat" — never closed, never completed
- CEO agent writes all its responses as comments on this issue
- Owner's messages are also comments (role: "board")
- The CEO Chat React component renders these comments as a chat thread

### What it looks like
- Chat bubbles: owner messages left, CEO messages right
- Morning brief pinned as a card at the top of each day's section
- Inline approval cards rendered from structured JSON in comment bodies (see Approval System)
- Quick action shortcuts: "Brief me", "What's pending?", "Weekly report", "Pause all agents"
- Unread indicator badge in the nav

### The structured comment format
When CEO or a sub-agent writes a comment that contains an action, it includes a JSON block:

```json
{
  "type": "approval_required",
  "action": "send_whatsapp",
  "to": "Ahmed Al Hashimi",
  "phone": "+971501234567",
  "message": "Hi Ahmed! Following up on your interest in Binghatti Hills JVC...",
  "lead_id": "uuid",
  "lead_score": 7,
  "context": "Lead enquired 48h ago via Property Finder. No response to first message."
}
```

The CEO Chat component detects this JSON block and renders an approval card instead of raw text. The rest of the comment is rendered as normal markdown above the card.

---

## Approval System

Every outbound action requires an approval card in the CEO Chat. Agents never execute external actions unilaterally.

### Approval Card Types

| Type | Triggered by | Card shows |
|------|-------------|------------|
| WhatsApp Send | Lead Agent | Message preview, recipient name + number, lead score, lead context, conversation history button |
| Email Send | Lead/Portfolio Agent | Subject, body preview, recipient, any attachments |
| Instagram Post | Content Agent | Image preview, caption, hashtags, best time to post suggestion |
| Pitch Deck | Content Agent | PDF preview link, which lead to send to, personalisation notes |
| Viewing Confirmation | Viewing Agent | Date/time, property address, broker assigned, attendees |
| Campaign Launch | Content Agent | Sequence preview (all messages), enrolment list, schedule |
| Outbound Call List | Call Agent | List of leads to call, scripts used, estimated time |
| Lead Escalation | Lead Agent | Lead summary, score, why escalated, suggested broker to assign |

### Batch approvals
Routine approvals (WhatsApp follow-ups, content posts) batch up in the CEO Chat. Owner can bulk-approve all pending items or review individually. Urgent escalations (hot leads) appear immediately with push notification — not batched.

### Edit before approve
Owner can edit the message content directly in the approval card before approving. The edited version is what gets sent. Useful for personalisation or tone adjustments.

### Auto-approve rules (owner can configure)
For trusted routine actions, owner can set auto-approve guardrails:
- "Auto-approve WhatsApp follow-ups to leads with score < 6" (boilerplate nurture)
- "Auto-approve Instagram posts to queue, but require approval before publishing"
- "Auto-approve viewing confirmations when broker is assigned"

---

## Agent Roles & Tool Mapping

### CEO Agent
**Purpose:** Strategy, delegation, owner communication, morning briefs, escalation handling, agency-wide reporting.
**Heartbeat:** Every 4 hours — reviews agency state, synthesises brief, escalates blockers, adjusts sub-agent priorities based on owner instructions
**Delegates to:** All sub-agents via Paperclip's issue task system
**Tools:** All 53 (read access on everything; write access gated by approvals)

### Lead Agent
**Purpose:** Inbound lead capture, scoring, enrichment, follow-up sequences, pipeline management, lead-to-broker handoff.
**Heartbeat:** Every 15 minutes — highest frequency agent
**Tools:** `search_leads`, `update_lead`, `get_lead_activity`, `search_whatsapp`, `send_whatsapp`, `search_email`, `send_email`, `bulk_follow_up`, `reactivate_stale_leads`, `tag_lead`, `create_tag`, `match_deal_to_leads`, `get_follow_ups`, `set_guardrails`

### Content Agent
**Purpose:** Social media content, pitch decks, landing pages, drip campaign management.
**Heartbeat:** Daily at 9am — generates the day's content queue
**Tools:** `generate_social_content`, `post_to_instagram`, `generate_pitch_deck`, `generate_pitch_presentation`, `generate_landing_page`, `generate_content`, `launch_campaign`, `create_drip_campaign`, `enroll_lead_in_campaign`

### Market Intelligence Agent
**Purpose:** DLD transaction monitoring, listing surveillance, news aggregation, investment analysis, competitor tracking.
**Heartbeat:** Every hour
**Tools:** `search_dld_transactions`, `search_listings`, `watch_listings`, `get_news`, `web_search`, `analyze_investment`, `search_projects`, `get_project_details`, `calculate_dld_fees`

### Viewing Agent
**Purpose:** Viewing scheduling, calendar management, confirmation messages, post-viewing follow-up.
**Heartbeat:** Every 30 minutes
**Tools:** `schedule_viewing`, `get_viewings`, `get_calendar`, `create_event`, `check_availability`, `send_whatsapp`, `send_email`

### Portfolio Agent
**Purpose:** Landlord management, tenancy renewals, rent tracking, vacancy management, RERA rent calculations.
**Heartbeat:** Daily at 8am
**Tools:** `manage_landlord`, `manage_property`, `manage_tenancy`, `calculate_rera_rent`, `list_documents`, `create_portal`, `get_portal_activity`, `send_email`, `send_whatsapp`

### Call Agent
**Purpose:** Inbound call handling (Twilio + Gemini 2.0 Flash Live), outbound follow-up calls, voicemail drops.
**Heartbeat:** Reactive (inbound call trigger) + scheduled (outbound call list at 10am and 3pm)
**Tools:** `make_call`, inbound call webhook handler, voicemail transcription
**Notes:** AygentDesk already ships Twilio + Gemini Live AI calling. This is the same infrastructure. Inbound calls are answered in real-time by Gemini, transcript + summary stored against lead. Outbound call lists are batched and queued for owner approval before dialling.

### Social Media Agent (larger agencies, optional)
**Purpose:** Dedicated Instagram/LinkedIn DM monitoring and engagement.
**Heartbeat:** Every hour during business hours (8am–8pm Dubai)
**Tools:** `search_instagram_dms`, `post_to_instagram`, `generate_social_content`, `search_whatsapp`

---

## Agent-to-Agent Communication

### Delegation flow (CEO → sub-agent)
1. CEO heartbeat runs, reviews agency state
2. CEO decides Lead Agent needs to follow up with 10 leads who haven't responded in 48h
3. CEO creates a Paperclip issue: `{ assignee: "lead-agent", title: "48h follow-up batch", description: "Follow up with these 10 leads: [...IDs...]. Draft WhatsApp messages in their detected language. Queue for approval." }`
4. Lead Agent's next heartbeat atomically claims the issue (single SQL UPDATE — conflict-free)
5. Lead Agent executes, writes result as a comment: `{ status: "done", drafted: 8, queued_for_approval: 8, unresponsive: 2 }`
6. CEO reads the result on its next heartbeat, includes in morning brief

### Escalation flow (sub-agent → owner, bypassing CEO)
When a sub-agent detects something requiring immediate owner attention:
1. Creates an escalation record in `escalations` table
2. Webhook receiver pushes immediate notification to owner (push + WhatsApp to owner's personal number)
3. Escalation card appears at top of CEO Chat immediately
4. Owner responds in CEO Chat → CEO translates into instructions for the sub-agent

### Escalation triggers
- Lead score jumps to 9–10 after qualification
- Lead message contains: "ready to sign", "let's proceed", "how do I pay", "I want this"
- Call Agent completes a call with "viewing requested" outcome
- Portfolio Agent detects expired lease with no renewal in progress
- Budget cap at 80% for any agent

---

## Lead Ingestion — How Leads Enter the System

### Inbound channels

| Source | Mechanism |
|--------|-----------|
| **WhatsApp inbound** | Meta Cloud API webhook → Webhook Receiver → Paperclip issue → Lead Agent |
| **Property Finder** | Gmail Push Notification (real-time) → Webhook Receiver parses PF email format → lead record + issue |
| **Bayut** | Same — Bayut email notification parsing |
| **Dubizzle** | Same pattern |
| **Instagram DMs** | Meta Graph API webhook → Webhook Receiver → Lead Agent |
| **Landing page forms** | AygentDesk-generated pages POST to Webhook Receiver → lead + issue |
| **Manual entry** | Owner/broker adds via dashboard form |
| **CSV import** | Bulk import during onboarding — Lead Agent enriches each record |

### Lead enrichment on entry
When a new lead is created from any source, Lead Agent automatically:
1. Searches WhatsApp history for prior conversations (was this person a lead before?)
2. Checks DLD transactions for prior Dubai property purchases (high-intent signal)
3. Assigns initial score 0–10 based on: source quality, budget indicators, prior activity
4. Tags by source, area interest, property type, language detected
5. Determines which follow-up sequence to enter

### Portal response SLA
Property Finder and Bayut rank agents by response speed. Lead Agent targets **sub-5-minute response** to all portal leads. This is a significant competitive advantage — most agencies take hours.

---

## Per-Agent Identity: WhatsApp & Email

Every AI agent gets its own real-world identity — a name, a WhatsApp number, and an email address at the agency's own domain. Clients never interact with "the platform." They interact with "Sarah from Dubai Properties" on a real number from a real company email.

This is not the same as the old "per-broker WhatsApp" model. This applies to AI agents themselves — each hired agent gets its own communications identity.

### The identity model

```
Agency: Dubai Properties LLC
Domain: dubaiproperties.ae

CEO Agent         → no public comms (internal only)
Sarah (Lead, JVC) → +971 50 111 1111 | sarah@dubaiproperties.ae
Mohammed (Lead, Downtown) → +971 55 222 2222 | mohammed@dubaiproperties.ae
Listings Agent    → +971 50 333 3333 | listings@dubaiproperties.ae
Portfolio Agent   → +971 55 444 4444 | portfolio@dubaiproperties.ae
```

Each number and email is fully owned and controlled by the agency. Aygency World never provides or owns these — we just connect to them.

### The agency is responsible for sourcing numbers

Getting a WhatsApp number is easy and cheap:
- **Physical SIM (Dubai):** du or Etisalat SIM card — AED 50. Register with Meta.
- **Virtual number:** Twilio or similar virtual number provider — ~$5/month per number. No SIM needed.
- **eSIM:** Several services offer eSIMs for WhatsApp Business registration.

The agency buys one number per agent they hire. They own the number. If they leave Aygency World, they keep the number.

### What gets connected during agent hire

When the CEO hires a new agent, the setup screen asks:

```
Agent Name:  Sarah
Role:        Lead Agent — JVC & Sports City
Persona:     Friendly, bilingual (English + Arabic), concise

[ Connect WhatsApp ]   → Meta OAuth → phone number ID stored
[ Connect Gmail     ]  → Google OAuth → access + refresh token stored

→ Skip for now (agent works but WhatsApp/email disabled)
```

Both connections are standard OAuth flows. No credentials pasted manually (unless the agency prefers it). Agent is live once at least one communication channel is connected.

### What's stored per agent

```sql
agent_credentials (
  agent_id,
  type: "whatsapp" | "gmail",
  access_token (encrypted),
  refresh_token (encrypted),
  whatsapp_phone_number_id,   -- Meta's identifier for the number
  gmail_address,              -- e.g. sarah@dubaiproperties.ae
  connected_at,
  expires_at
)
```

Every tool call that involves sending a message loads the credentials for THAT agent, not the agency's master credentials.

---

## What Needs to Be Built for Per-Agent Comms

AygentDesk already has single-tenant WhatsApp + Gmail working. The new builds needed to make it work per-agent across multiple agencies:

### 1. Agent credential store
The `agent_credentials` table above. One row per agent per integration. Encrypted at rest. All tool calls query this before executing. ~1 hour to build.

### 2. Agent setup UI (connect integrations during hire)
When a new agent is created via the CEO chat or dashboard, a setup screen shows the OAuth connect buttons. Same OAuth flows as AygentDesk — just scoped to the agent being hired, not the whole account. ~1 day.

### 3. Webhook demultiplexer (most important new build)
Meta sends ALL inbound WhatsApp messages from ALL connected numbers to ONE webhook URL. You cannot register a separate webhook per number. When a message arrives, the payload contains `phone_number_id`. The demultiplexer resolves which agent owns that number and routes the message to that agent's Paperclip task queue.

```
Inbound POST → /webhook/whatsapp
  payload.phone_number_id = "12345678"

  → SELECT agent_id FROM agent_credentials
      WHERE whatsapp_phone_number_id = '12345678'
  → agent_id = "sarah-agent-uuid"
  → create Paperclip issue: assigned to sarah-agent, title: "Inbound WhatsApp from Ahmed"
  → Sarah's next heartbeat picks it up
```

Same logic for Gmail — Google sends push notifications to one endpoint, you identify the agent by the `emailAddress` in the notification, route accordingly. ~1 day.

### 4. Token refresh worker
Gmail tokens expire every hour. WhatsApp tokens have longer lifespans but also expire. A background job (runs every 30 minutes) checks for tokens expiring within 24 hours and refreshes them automatically.

If refresh fails (user revoked access, permissions changed):
- Agent pauses immediately
- Push notification to agency owner: "Sarah's WhatsApp disconnected — click to reconnect"
- Agent can still run but WhatsApp/email tools return an error until reconnected

~half a day to build.

### 5. Meta Tech Provider (Embedded Signup) — see section below

**Total dev time for items 1–4: ~3 days.** AygentDesk has 80% of the underlying code. It's restructuring, not rebuilding.

---

## Meta WhatsApp — The Full Strategy

### The tiered system

You do not go directly to Meta to get WhatsApp integration capability. Meta operates a three-tier system:

```
Meta
  ↓
BSP (Business Solution Provider) — e.g. 360dialog, Twilio, Bird
  ↓
ISV (Independent Software Vendor) — that's Aygency World
  ↓
End customers — the agencies connecting their numbers
```

Aygency World sits in the ISV tier. You partner with a BSP who already has Meta's trust and tech provider status. You piggyback on theirs. This means you can launch with full Embedded Signup capability — no waiting for Meta's own approval process.

---

### The right BSP: 360dialog

**360dialog** is the best option for Aygency World. They are an official WhatsApp BSP with a dedicated partner program built specifically for SaaS platforms.

**What you get as a 360dialog ISV partner:**
- Their Embedded Signup flow — agencies connect their WhatsApp number in under 2 minutes inside Aygency World's UI. No manual credential pasting.
- You own the customer relationship — Aygency World controls the product experience. 360dialog is invisible to end users.
- Multi-Partner Solution setup — Aygency World (ISV) + 360dialog (BSP) + Agency (customer) share WABA management. You create and manage WABAs for your customers.
- No need for a registered business to start the partner conversation

**Cost:** 360dialog charges ~$5–10/month per connected number on top of Meta's per-conversation fees. Pass this through in your agency subscription pricing.

**Sign up:** [360dialog.com/partners](https://360dialog.com/partners)

---

### The progression path

| Stage | Requirements | What you get |
|---|---|---|
| **ISV via 360dialog** (launch) | Sign up as 360dialog partner | Full Embedded Signup, can onboard agencies immediately |
| **Meta Tech Provider** (scale) | 10+ customers + 2,500 avg daily conversations | Your own embedded signup, direct Meta relationship, listed in Meta Partner Directory |

Launch as a 360dialog ISV. Graduate to direct Meta Tech Provider as you scale. No blocked launch, no 2–6 week approval wait.

---

### What Embedded Signup looks like for the agency

When an agency connects an agent's WhatsApp number in Aygency World:

1. They click "Connect WhatsApp" on the agent setup screen
2. A Meta OAuth popup opens (hosted by 360dialog, branded as Aygency World)
3. They log into their Meta Business account, select their WhatsApp Business number
4. Done — number connected in under 2 minutes
5. Aygency World stores the access token + phone number ID in `agent_credentials`
6. Webhook registered automatically for that number

No Meta developer portal. No API credentials to copy. No confusion.

---

### What this means technically

Instead of building against Meta's Graph API directly for the connection flow, Aygency World builds against 360dialog's API for onboarding. Once connected, the actual send/receive message calls can go direct to Meta's Graph API (using the access token obtained through 360dialog's flow) or via 360dialog's API — either works.

**AygentDesk** currently uses Meta's API directly (single-tenant). **Aygency World** uses 360dialog's partner API for the multi-tenant connection flow.

---

### Direct Meta Tech Provider (future)

Once you have 10+ agencies and meaningful message volume, apply for direct Meta Tech Provider status. Requirements at that point:

**1. Registered legal business entity**
- Free zone license (IFZA, Meydan, Shams) — 3–7 days, AED 5,000–12,000/year
- Or mainland DED license — 2–4 weeks, more expensive

**2. Verified Meta Business Manager**
- Upload trade license + passport
- Verification: 3–5 business days

**3. Live website with Privacy Policy + Terms of Service**
- aygencyworld.com must be live and describe the platform clearly

**4. Application**
- developers.facebook.com partner program
- Review: 2–6 weeks
- Benefits: own Embedded Signup, Meta Partner Directory listing, incentive programs

---

### Summary — what to do and when

| Action | When | Why |
|---|---|---|
| Sign up as 360dialog ISV partner | This week | Unlocks Embedded Signup immediately, no business registration needed |
| Build agent WhatsApp connect flow using 360dialog | Phase 2 | Smooth onboarding for agencies |
| Build paste-credentials fallback | Phase 1 | Backup for agencies who prefer manual setup |
| Register legal entity (free zone) | Before scaling | Needed for Meta Tech Provider application later |
| Apply for direct Meta Tech Provider | When at 10+ agencies | Graduate from 360dialog dependency |

---

## Full Lead Lifecycle

```
1. ENTRY
   WhatsApp / PF email / Bayut email / Instagram DM / form / manual
   → Lead created: name, phone, source, initial message
   → Auto-enrichment: DLD history, WhatsApp history, initial score

2. IMMEDIATE RESPONSE (target: < 5 minutes)
   Lead Agent drafts reply in detected language
   → Approval card in CEO Chat (or auto-approve if configured)
   → Message sent. Lead tagged "contacted"

3. QUALIFICATION (days 1–7)
   Lead Agent qualifies via WhatsApp conversation
   → Extracts: budget, area, property type, timeline, financing
   → Score updated. Route determined:
      Score 1–4: Nurture drip campaign (monthly touch)
      Score 5–7: Weekly follow-up sequence
      Score 8–10: Escalation → broker assignment

4. MATCHING
   Lead Agent runs match_deal_to_leads against current inventory
   → Suggests 2–3 matching projects/properties
   → Content Agent generates pitch deck if off-plan
   → Approval card: send pitch deck to lead?

5. VIEWING
   Lead expresses interest in visiting
   → Viewing Agent checks broker + lead availability
   → Proposes 3 time slots to lead via WhatsApp
   → Lead confirms → calendar event created, confirmation sent
   → Day before: reminder. Post-viewing: follow-up drafted.

6. NEGOTIATION / OFFER
   Human broker takes over (high-value relationship work)
   AI supports: DLD comparables, DLD fee calculation, payment plan doc
   Content Agent generates personalised proposal on request

7. DEAL CLOSED
   Broker marks deal as "closed" in dashboard
   → Lead status → "client"
   → CEO logs conversion in monthly metrics
   → If rental: Portfolio Agent creates landlord/tenancy records
   → Content Agent generates "just sold" Instagram post for approval

8. POST-DEAL
   Lead enters post-sale nurture (referral request, annual check-in)
   If rental: Portfolio Agent manages ongoing tenancy + renewals
```

---

## Human Broker Handoff Flow

### When AI escalates to human
Lead Agent escalates when:
- Lead score reaches 8+
- Lead explicitly asks to speak to a person
- Lead has been engaged 3+ weeks without committing
- Lead budget > AED 5M (premium buyer, requires human relationship)
- Call Agent flags "ready to view" from a live call

### The handoff
1. Lead Agent creates escalation card: lead summary, score, full conversation history, suggested broker
2. Owner approves in CEO Chat, assigns to broker
3. Assigned broker receives WhatsApp notification: lead name, phone, summary, context link
4. Lead tagged `assigned: sara`. Lead Agent stops auto-following up.
5. If broker doesn't contact within 2 hours → Lead Agent escalates back to CEO

### Human action sync (keeping the system current)
When a human broker takes action outside the platform:
- WhatsApp Cloud API logs ALL messages on the agency number — human and AI-drafted both flow through
- Google Calendar sync captures manually-booked viewings
- Broker logs manual actions via their broker view: "Called Ahmed — going to view Thursday"

---

## Multilingual Support

Dubai's buyer pool is international. Arabic, Russian, Chinese, and English are the dominant languages.

### Language detection
- Lead Agent detects language of every inbound message
- Responds in the same language by default
- Language stored on lead profile
- Approval cards show message in detected language with English translation toggle

### Launch languages
- Arabic, English, Russian (covers majority of Dubai market)
- Mandarin Chinese as Phase 2

### Tone by language
- **Arabic:** Formal, respectful, use titles ("Mr. Ahmed", "Ustaz")
- **Russian:** Direct, metrics-first (AED price, price per sqft, ROI %)
- **English:** Adapt to lead's tone — formal or casual based on their writing style
- **Chinese:** Formal, relationship-first, avoid aggressive sales language

---

## Owner Notification System

The owner is not always on the dashboard. Critical events must reach them on their phone.

### Channels
- **Push notification (PWA):** For approval batches, escalations, brief ready
- **WhatsApp to owner's personal number:** Urgent escalations only — hot leads, deal-ready signals
- **Email digest:** Weekly report, monthly cost summary

### Notification schedule
| Event | Channel | Timing |
|-------|---------|--------|
| Approval batch ready | Push | 9am, 1pm, 6pm |
| Hot lead escalation | WhatsApp + Push | Immediate |
| Morning brief ready | Push | 8am daily |
| Agent error or failure | Push | Immediate |
| Budget at 80% | Push + Email | Immediate |
| Weekly report | Email | Monday 8am |

---

## Agency Context & Memory System

Agents need to know specifics about THIS agency — not just generic Dubai knowledge.

### What gets stored
```
Agency Knowledge Base (agency_context table):
├── identity:    name, logo, RERA licence, areas of focus, established date
├── inventory:   active projects, developer relationships, exclusive listings
├── team:        human broker names, areas, WhatsApp numbers (for handoff routing)
├── tone:        formal/casual, language preference, emoji use, sign-off style
├── pricing:     typical deal sizes, commission rates, preferred payment plans
├── guardrails:  areas/projects never to mention, competitor blacklist
└── goals:       current month targets, priority leads, active campaigns
```

### How it's maintained
- **Seeded** by CEO onboarding interview (CEO extracts structured context from conversation)
- **Updated** via CEO Chat ("we just signed with DAMAC Hills 2 as an exclusive")
- **Auto-updated** when agents observe patterns (Lead Agent notices 80% of inbound is JVC → flags to CEO)
- **Accessed** by every agent on each heartbeat — injected into the Claude Code system prompt

---

## Dubai Compliance & Legal Guardrails

### RERA advertising rules
- No guaranteed rental yield figures without official RERA source
- Off-plan projects must be RERA-registered before marketing
- Agency RERA licence number stored in `agency_context`, appended to relevant outbound comms
- Lead Agent skill includes a compliance check: never quote prices as guaranteed, always use "starting from" or "from approximately"

### UAE Personal Data Protection Act (PDPA)
- All lead data encrypted at rest (`agency_credentials` encrypted, lead phone numbers hashed in logs)
- No cross-agency data sharing
- Data deletion: agency can request full wipe on cancellation
- WhatsApp opt-out: if lead replies "STOP", Lead Agent tags as opted-out and never contacts again

### Financial promotions
- Investment analysis outputs include configurable disclaimer
- No capital appreciation guarantees in automated communication
- All yield claims cite DLD source

---

## Cost Tracking & Budget Controls

Every agent heartbeat consumes Claude API tokens and costs real money. Owners need full visibility and hard controls.

### Per-agent tracking
- Every heartbeat logs: tokens in, tokens out, tools called, duration, cost USD
- Dashboard shows per-agent: cost today / cost this month / projected month-end
- Breakdown visible in agent detail view

### Budget controls
- **Per-agent monthly cap:** Set per agent (e.g., Lead Agent: $50/month)
- **Agency-wide monthly cap:** Hard ceiling across all agents
- **80% warning:** Push notification when approaching limit
- **100% hit:** Agent pauses gracefully, owner must raise cap to resume
- **Emergency pause:** One-click pause all agents from dashboard or via CEO Chat

### Cost transparency in CEO Chat
Morning brief always includes: "Your agency spent $14.20 yesterday. Lead Agent: $8.40, Content Agent: $3.20, Market Agent: $2.60."

---

## Skill File Format

Skills are the instruction sets that define agent behaviour. Plain markdown — no code, no special syntax. An actual skill looks like:

```markdown
---
name: lead-response
description: >
  Draft responses to new inbound leads within 5 minutes of enquiry.
  Use when: a new lead has just come in via WhatsApp, portal, or form.
  Don't use when: the lead is already qualified and assigned to a broker.
---

# Lead Response Skill

## Rules
- Respond in the same language the lead used
- First reply: max 3 sentences, never quote a specific price
- Always include the broker's name (from agency_context.team) in sign-off
- If lead asks "are you a bot?": "I'm [Name] from [Agency], happy to help!"
- Never send a second message before the lead replies to the first

## First response template
"Hi [Lead Name]! Thanks for reaching out about [property/area]. I'd love to find
you something that fits perfectly. Quick question — are you looking for
[Type A] or [Type B]? — [Broker Name], [Agency]"

## Qualification sequence (across 2–3 messages)
1. Budget range
2. Timeline (when are you looking to move or invest?)
3. Financing (cash or mortgage?)

## Escalation rule
If budget > AED 2M AND timeline < 3 months AND positive response:
→ Create escalation immediately (do not continue qualifying yourself)
```

Skills live in the company template repo and are symlinked into each agent's Claude Code session.

---

## The Company Template

The Dubai Real Estate Agency template is a fully configured, importable company package:

```
dubai-real-estate-agency/
├── COMPANY.md                    # Org chart, goals, governance, requirements
├── agents/
│   ├── ceo/
│   │   ├── AGENTS.md             # CEO role definition
│   │   ├── HEARTBEAT.md          # What CEO does each heartbeat
│   │   └── SOUL.md               # CEO personality and communication style
│   ├── lead-agent/
│   ├── content-agent/
│   ├── market-agent/
│   ├── viewing-agent/
│   ├── portfolio-agent/
│   └── call-agent/
├── skills/
│   ├── lead-response.md
│   ├── lead-qualification.md
│   ├── lead-handoff.md
│   ├── content-instagram.md
│   ├── content-pitch-deck.md
│   ├── market-dld-monitoring.md
│   ├── viewing-scheduling.md
│   ├── portfolio-tenancy.md
│   ├── call-inbound.md
│   ├── dubai-compliance.md       # RERA and PDPA rules
│   └── multilingual.md           # Language detection and tone rules
├── .paperclip.yaml               # Paperclip-specific metadata
└── README.md
```

Import command:
```bash
npx companies.sh add aygencyworld/companies/dubai-real-estate-agency
```

---

## The Dashboard (Paperclip UI — Rebranded + Extended)

Paperclip's React/Vite UI is the base. Rebranded to Aygency World visual identity. Key pages added or modified:

### Agency Overview (home)
- Live agent status grid (running / idle / waiting for approval / paused)
- Today's activity feed (real-time via WebSocket)
- Pending approvals badge count
- Key metrics: leads today, messages sent, viewings booked, cost today

### CEO Chat (new — biggest build)
- Full chat thread between owner and CEO
- Inline approval cards
- Morning brief pinned per day
- Quick action bar
- Unread message indicator

### Agent Cards / Org Chart
- Visual org chart (CEO at top, sub-agents below)
- Each agent: name, role, status, last run, cost today, tasks done today
- Click into agent: full run history, every tool call made, decisions taken, cost breakdown
- Hire / pause / resume / adjust instructions

### Approvals Queue
- All pending outbound actions across all agents
- Filter by: agent, type, lead, urgency
- Bulk approve / reject

### Leads
- Full lead database with pipeline view
- Lead detail: full conversation history, score, all agent activity on this lead
- Manual stage updates, broker assignment

### Analytics
- Lead pipeline velocity (time from entry to each stage)
- Response time metrics (actual vs target)
- Agent cost vs output (cost per lead, cost per viewing booked)
- Content performance (engagement per post)
- Conversion rate by source

### Broker View (simplified, mobile-first)
- Their assigned leads only
- Quick log: "Called Ahmed", "Viewing confirmed Thursday"
- Request from CEO: "I need a pitch deck for this lead"

---

## Integration Connection Flows

### WhatsApp Business (agency number)
1. Owner enters phone number
2. Redirect to Meta Business OAuth
3. Grant: `whatsapp_business_messaging`, `whatsapp_business_management`
4. Token + phone number ID stored encrypted in `agency_credentials`
5. Webhook registered for inbound messages
6. System sends "Your Aygency World is connected ✓" to the number

### Gmail
1. Google OAuth: `gmail.readonly`, `gmail.send`, `gmail.modify`
2. Tokens stored, refresh token for background access
3. Immediately scans last 7 days for portal notification emails → imports leads found
4. Gmail Push Notifications (Pub/Sub) registered for real-time inbound lead emails

### Google Calendar
1. Same OAuth as Gmail + `calendar.events` scope
2. Owner specifies which calendar to use
3. Viewing Agent gets read/write to that calendar

### Instagram
1. Meta OAuth (same App as WhatsApp): `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`

### Per-broker WhatsApp
Same Meta OAuth flow as agency number, done from broker's profile settings page.

---

## Billing & Subscription (Stripe)

### Tiers
| Tier | Included | Price (draft) |
|------|---------|------|
| Starter | CEO + 2 agents | TBD |
| Growth | CEO + 5 agents | TBD |
| Scale | CEO + 10 agents | TBD |
| Enterprise | Unlimited + white-label | Custom |

### What counts as usage
Each agent heartbeat = one run. Agent runs are metered and reported to Stripe daily for usage-based billing above the tier's included run count.

### AI Calling add-on
Twilio calls billed separately as usage add-on. Per-minute rate passed through at cost + margin. Shown as separate line on invoice.

### Stripe integration
- Subscription lifecycle: create, upgrade, downgrade, cancel
- Failed payment → 3-day grace period → agents pause
- Usage metering via Stripe Meters API
- Customer portal for self-service billing management

---

## Error Handling & Agent Recovery

| Failure type | Behaviour |
|-------------|-----------|
| Anthropic rate limit | Exponential backoff, retry up to 3x, alert owner if blocked > 1 hour |
| Tool call fails (e.g., WhatsApp rejects) | Log error, move to next task, include failure in CEO brief |
| Agent run > 5 minutes | Kill, log as timeout, CEO notified |
| OAuth token expired | Agent pauses, push notification sent, step-by-step reconnection flow shown |
| Budget cap reached | Agent pauses gracefully, owner notified |
| Paperclip process crash | Docker restart policy, CEO notified on recovery |

### Agent audit log
Every run logged: start/end time, tools called (in order), tokens consumed, cost, tasks completed, errors, approvals queued. Accessible in agent detail view. Used for debugging and compliance.

---

## Tech Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Base framework | [Paperclip](https://github.com/paperclipai/paperclip) fork | Node.js 20 + Express 5 + React 19 + Vite 6 |
| Agent runtime | Claude Code (local process) | Spawned by Paperclip's heartbeat scheduler |
| ORM | Drizzle 0.38 | NOT Prisma. Different from AygentDesk. |
| Database | PostgreSQL 17 | Embedded PGlite in dev, external in prod |
| UI components | Radix UI + Tailwind CSS 4 + Lucide | Paperclip's component library |
| State management | TanStack React Query 5 | Data fetching + caching |
| Real-time | WebSocket (`ws` package) | Live agent run streaming |
| Auth | better-auth 1.4 | Paperclip's built-in. NOT NextAuth. |
| Tool integration (demo) | Markdown skills + bash/curl | Claude Code calls AygentDesk API directly |
| Tool integration (prod) | MCP Server (port 3002) | Proper role-scoped tool routing |
| Webhook receiver | Express (port 3003) | Inbound WhatsApp, portal leads, form submissions |
| AI Calling | Twilio + Gemini 2.0 Flash Live | Already built in AygentDesk, reused here |
| Package manager | pnpm | Paperclip uses pnpm workspaces |
| Testing | Vitest + Playwright | Paperclip's existing test setup |
| Deployment | Docker + Nginx | Same VPS as AygentDesk |

---

## Build Sequence — Phased

### Phase 1 — Demo (2–3 days)
Goal: something impressive to show. Doesn't need to be multi-tenant.

1. Fork Paperclip, run it locally, verify it runs
2. Create Dubai Real Estate Agency COMPANY.md + CEO + Lead Agent
3. Write 3 skills as markdown with curl calls to AygentDesk API (hardcoded credentials, one agency)
4. Configure CEO heartbeat: assess state → delegate to Lead Agent
5. Configure Lead Agent heartbeat: check for new leads → draft responses → queue approvals
6. Manually trigger a lead → watch agents respond end-to-end
7. Rebrand Paperclip UI to Aygency World (logo, colours, product name)

**Demo narrative:** "Here's a lead that just came in. Watch the Lead Agent respond in Arabic in under 5 minutes, score the lead, and queue a WhatsApp for your approval — all while you were on another call."

### Phase 2 — Alpha (1–2 weeks)
Goal: real agency can use it.

1. CEO Chat React component (custom chat UI on top of Paperclip's comment API)
2. Approval card components (WhatsApp, email, Instagram, pitch deck)
3. Webhook receiver service (WhatsApp inbound, Gmail PF/Bayut parsing)
4. Onboarding wizard (3 steps) + CEO interview flow
5. Multi-tenant credential storage (each agency connects their own integrations)
6. Demo mode with pre-populated fake agency data
7. Push notifications (PWA service worker)
8. WhatsApp to owner's personal number for escalations

### Phase 3 — Beta (2–4 weeks)
Goal: production-ready.

1. MCP Server (replacing bash/curl skills, proper role-scoped tool routing)
2. All 6+ agent roles with complete skill sets
3. Per-broker WhatsApp (broker profile + OAuth)
4. Human broker handoff flow + broker view
5. Stripe billing integration
6. Full analytics dashboard
7. Cost tracking and budget controls
8. Multilingual support (Arabic, Russian)
9. Dubai compliance guardrails in skill files
10. Mobile-responsive CEO Chat view

### Phase 4 — Production features (ongoing)
1. AI Calling Agent (Twilio + Gemini Live — reuse AygentDesk's implementation)
2. Property Finder / Bayut email parsing (real-time lead ingestion from portals)
3. White-label enterprise tier
4. `agency_context` auto-learning (agents update knowledge base from observations)
5. Gemini Embedding 2 for semantic lead-to-project matching
6. AygentDesk ↔ Aygency World shared lead DB (unified view across both products)

---

## Key Open Decisions

- **Domain:** aygencyworld.com or agencyworld.ai or similar — TBD
- **Pricing:** Final numbers not set. Model is per-agent + usage overage.
- **Mobile app:** CEO Chat needs a mobile-responsive view minimum. Full native app is Phase 5+.
- **Shared DB:** Long-term, do AygentDesk and Aygency World share a lead/contact database? Probably yes — but complex to implement cleanly.
- **White-label depth:** Custom domain + branding? Custom agent names? Custom skill sets? Scoped to Enterprise tier.
- **AygentDesk tool extraction:** When to refactor AygentDesk's `tools.ts` into a shared `@aygent/tools` package that both products import cleanly. Probably v2.

---

## Brand

- **Product name:** Aygency World
- **Tagline (draft):** "Your AI agency. Always working."
- **Brand family:** Part of the "Aygent" ecosystem (AygentDesk + Aygency World)
- **Visual identity:** TBD — distinct from AygentDesk but shares the brand DNA
- **Domain:** TBD

---

## Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://aygencyworld.com

# AI
ANTHROPIC_API_KEY=          # All Claude Code agent runs
GEMINI_API_KEY=              # Gemini Embedding 2 for semantic search (Phase 4)

# AygentDesk Tool Bridge
AYGENTDESK_URL=https://aygentdesk.com
AYGENTDESK_INTERNAL_SECRET= # Shared secret for internal API calls

# Webhook Receiver
WEBHOOK_SECRET=              # Meta webhook verification token
GMAIL_PUBSUB_TOKEN=          # Google Pub/Sub push subscription token

# Push Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Per-agency integrations (stored encrypted in DB, not env vars)
# WhatsApp tokens, Gmail OAuth, Instagram tokens all stored in agency_credentials table
```

---

## Commands

```bash
# Development
pnpm dev              # Start Paperclip fork (API + UI, watch mode, port 3001)
pnpm dev:bridge       # Start Tool Bridge / MCP server (port 3002)
pnpm dev:webhook      # Start Webhook Receiver (port 3003)
pnpm build            # Production build

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio

# Company templates
npx companies.sh add aygencyworld/companies/dubai-real-estate-agency

# Testing
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright E2E

# Docker (prod)
docker-compose up -d  # Full stack: app + bridge + webhook + postgres + nginx
```

---

## Relationship to AygentDesk — The Full Picture

AygentDesk and Aygency World are different products that become more powerful together.

**AygentDesk** is what a broker uses personally — it's their AI assistant for their own deals. They talk to it in natural language and it helps them work faster.

**Aygency World** is what an agency owner buys to run the agency itself — autonomous agents operating departments 24/7, CEO chat for direction, approval cards for control.

**Where they connect:**
- The 53 AygentDesk tools become Aygency World's skill layer (via Tool Bridge / MCP)
- Long-term: shared lead database so an AygentDesk broker and an Aygency World agent don't work the same lead in isolation
- The upsell: agency owner buys Aygency World, then each of their human brokers subscribes to AygentDesk individually

**Two revenue streams from one Dubai real estate agency:**
1. Aygency World subscription (agency-level, owner pays)
2. AygentDesk subscriptions × number of human brokers
