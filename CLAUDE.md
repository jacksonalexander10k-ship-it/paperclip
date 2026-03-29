# Aygency World — AI-Powered Real Estate Agency Operating System

## Vision

Aygency World is a multi-agent AI platform that lets anyone run a fully operational Dubai real estate agency — with or without human staff. It is built on top of [Paperclip](https://github.com/paperclipai/paperclip) (open-source agent orchestration), forked and rebranded, with a Dubai real estate company template and AygentDesk's 53 real estate tools wired in as the skill layer.

Where **AygentDesk** is a super-powered personal assistant for individual brokers (reactive, chat-first, human drives), **Aygency World** is the agency operating system (autonomous, multi-agent, AI drives). They are complementary products:

- **AygentDesk** → B2C. Each broker's personal AI assistant. They talk to it, it executes.
- **Aygency World** → B2B. The agency owner buys it to run departments. Agents work 24/7 autonomously.

---

## Core Philosophy

- **Autonomous by default.** Agents run on heartbeats — continuously, without being prompted. The agency operates while the owner sleeps.
- **CEO as the interface.** The owner interacts with one agent: the CEO. The CEO delegates, reports, and escalates. The owner never talks directly to sub-agents.
- **Approval before external action.** No WhatsApp sent, no email fired, no Instagram post published without an explicit approval card in the CEO chat. Agents prepare — humans authorise.
- **Role-scoped tools.** Each agent has access only to the tools relevant to their role. The CEO has full visibility but delegates tool access on hire.
- **Dubai-first.** Every default, every template, every tool is built for the Dubai off-plan and secondary real estate market. Not generic CRM. Not generic AI. Dubai real estate, specifically.

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
Wants to deploy AI infrastructure internally under their own brand. Private AI division rebranded and integrated. Replaces admin, marketing, analyst headcount.

**Pitch:** "Your private AI department, under your brand."

---

## How It Works — End to End

### Step 1: Onboarding (Hybrid Wizard + CEO Chat)

A short 3-step wizard captures the essentials:

1. **Agency basics** — Name, logo, focus area (Off-Plan / Rentals / Secondary / All three), size (Solo / Small 2–5 / Medium 6–15 / Large 15+)
2. **Connect integrations** — WhatsApp number, Gmail account, Instagram (required to function; Google Calendar optional)
3. **CEO is hired** — A CEO agent is instantiated. The wizard closes. The CEO chat opens.

The CEO already knows the basics from step 1. It immediately begins a strategic onboarding interview in natural language:
- "What's your biggest challenge right now — lead volume, lead quality, or conversion?"
- "Which areas are you focused on? Which projects are you actively selling?"
- "Do you have any existing lead database I should be aware of?"
- "What does success look like for you in the first 30 days?"

Based on the conversation, the CEO proposes an agent org chart with roles, headcount per role, and rationale. The owner reviews and approves. Agents are hired.

### Step 2: Agency Runs Autonomously

Once agents are hired, they run on **heartbeats** — scheduled intervals:
- Lead Agent checks for new WhatsApp/email enquiries every 15 minutes. Drafts responses. Queues approvals.
- Market Agent pulls DLD transaction data and new Bayut listings every hour. Flags opportunities.
- Content Agent generates and queues Instagram/LinkedIn posts daily. Awaits publish approval.
- Viewing Agent monitors calendar, sends viewing confirmations, follows up post-viewing.
- Portfolio Agent tracks lease renewals, flags expiring tenancies, drafts landlord communications.

### Step 3: Owner Runs the Agency via CEO Chat

The CEO chat is the owner's primary interface. It surfaces:
- **Morning brief** — what happened overnight, what needs attention today
- **Approval cards** — pending outbound actions queued by agents
- **Escalations** — anything an agent flagged as requiring owner decision
- **Reports** — weekly pipeline, lead quality summary, content performance

Owner gives direction to the CEO in natural language:
> "Focus the lead agent on JVC under 2M this week."
> "We just listed a new property in Business Bay — tell the content agent to create a campaign."
> "How many leads did we convert last month?"

CEO translates direction into agent tasks and reports back.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Base | [Paperclip](https://github.com/paperclipai/paperclip) fork | Node.js server + React UI. Forked, rebranded. |
| Agent runtime | Claude Code via Anthropic API | Agents run Claude Sonnet 4 with role-specific skill sets |
| Skills | AygentDesk MCP server | All 53 AygentDesk tools exposed as MCP tools |
| Database | PostgreSQL (embedded in Paperclip, or external for prod) | Agents, orgs, tasks, goals, audit log |
| Queue | Built into Paperclip (heartbeats + task queue) | Per-agent scheduled runs |
| Frontend | React (Paperclip's UI, rebranded + extended) | Dashboard + CEO chat + approval cards |
| Auth | To be determined (Paperclip's auth or NextAuth) | Multi-tenant: each agency is isolated |
| Deployment | Docker / VPS | Same infra as AygentDesk |

---

## Lead Ingestion — How Leads Enter the System

This is the most critical operational piece. Without leads flowing in, the Lead Agent has nothing to work with. Aygency World must support all the ways Dubai agents currently receive enquiries:

### Inbound Channels

| Source | How it works |
|--------|-------------|
| **WhatsApp (inbound)** | Agency's WhatsApp Business number connected via Cloud API. Every inbound message is captured, sender identified as new or existing lead, Lead Agent processes. |
| **Property Finder** | PF sends lead notifications via email (standard for all Dubai agencies). Lead Agent's email watcher parses PF notification emails and auto-creates leads with name, phone, property interest. |
| **Bayut** | Same — Bayut sends email notifications per enquiry. Auto-parsed into leads. |
| **Dubizzle** | Same pattern — email notification parsing. |
| **Instagram DMs** | Meta Graph API. Lead Agent monitors DMs, identifies property enquiries, creates leads. |
| **Website / Landing Page** | AygentDesk's `generate_landing_page` creates pages with a lead capture form. Form submissions POST directly to the Lead Agent's queue. |
| **Manual entry** | Owner or broker adds a lead manually via dashboard form. |
| **CSV import** | Bulk import existing lead database during onboarding. |

### Lead Enrichment on Entry
When a new lead is created from any source, the Lead Agent automatically:
1. Searches WhatsApp history for prior conversations
2. Checks DLD transactions for prior purchases (high-intent signal)
3. Assigns initial score (0–10) based on budget, source, prior activity
4. Tags by source, area interest, property type
5. Routes to the appropriate follow-up sequence

---

## Multi-Tenant Credential Architecture

Each agency in Aygency World has its own WhatsApp number, Gmail account, Instagram, and Google Calendar. The MCP server must route all tool calls through the correct agency's credentials.

### How it works

Every agent run is scoped to an `agencyId`. The MCP server receives the `agencyId` in the request context and resolves the correct credentials from the database before executing any tool call.

```
Agent (Claude Code) → MCP Server
  Request: { tool: "send_whatsapp", agencyId: "agency_123", params: {...} }

MCP Server:
  1. Looks up agency_123 credentials in DB
  2. Loads WhatsApp token, phone number ID for that agency
  3. Executes tool call with agency-specific credentials
  4. Returns result
```

**Credentials stored per agency (encrypted at rest):**
- `whatsapp_access_token`, `whatsapp_phone_number_id`
- `gmail_access_token`, `gmail_refresh_token`
- `instagram_access_token`, `instagram_user_id`
- `google_calendar_access_token`, `google_calendar_refresh_token`

**Isolation guarantee:** No cross-agency data leakage. An agent in Agency A can never access Agency B's credentials, leads, or messages.

---

## Agency Context & Memory System

Each agency's agents need to know specifics about THAT agency — not just generic Dubai real estate knowledge. This is seeded during onboarding and maintained throughout.

### What gets stored as agency context

```
Agency Knowledge Base (persisted in DB, loaded into each agent run):
├── Identity: name, logo, RERA licence number, areas of focus
├── Inventory: active projects they sell, developer relationships, exclusive listings
├── Team: human broker names, their areas, their WhatsApp numbers (for handoff)
├── Tone: formal/casual, language preference, emoji use, response style
├── Pricing: typical deal sizes, commission rates, preferred payment plans
├── Guardrails: areas/projects to never mention, competitor blacklist
└── Goals: current month targets, priority leads, active campaigns
```

### How it's maintained
- Seeded by the CEO onboarding interview (CEO extracts structured data from the conversation)
- Updated via CEO chat ("we just added DAMAC Hills 2 to our portfolio")
- Automatically updated when agents observe patterns (Lead Agent notices 80% of leads are asking about JVC → flags to CEO)
- The `remember` tool writes to this context store

---

## AI Calling Agent

AygentDesk ships Twilio + Gemini 2.0 Flash Live for real-time AI voice calls. This is a natural 7th agent in Aygency World.

### Call Agent
**Purpose:** Inbound call handling, outbound follow-up calls, voicemail drops.
**Tools:** `make_call`, inbound call webhook handler, voicemail transcription
**Heartbeat:** Reactive (triggered by inbound call) + scheduled (outbound call list at 10am and 3pm)

**What it does:**
- **Inbound:** Answers calls to the agency number in real-time. Qualifies the lead (budget, area, timeline), books a viewing or schedules a callback with a human broker. Transcript + summary stored against the lead.
- **Outbound follow-up:** Calls leads who haven't responded to WhatsApp/email after 48 hours. Speaks naturally, re-engages, updates lead score.
- **Voicemail drop:** Leaves a pre-approved voicemail for cold leads without waiting for answer.

**Approval model:** Outbound call lists are queued for approval before dialling begins. Individual call transcripts are logged but not approval-gated (they already happened).

---

## Human Broker Handoff Flow

For established agencies with human brokers, the AI agents and human team must work together seamlessly.

### When AI escalates to human

The Lead Agent escalates a lead to a human broker when:
- Lead score reaches 8+ (highly qualified, high intent)
- Lead explicitly asks to speak to a person
- Lead has viewed 3+ properties and hasn't committed (needs human relationship)
- Lead budget > AED 5M (premium buyer, requires human touch)
- Call Agent flags "ready to view" from a live call

### The handoff
1. Lead Agent creates an escalation card in the CEO chat: lead summary, score, conversation history, suggested broker to assign
2. CEO (or owner) approves and assigns to a specific human broker
3. Assigned broker receives a WhatsApp notification: lead name, phone, summary, full context link
4. Lead is tagged "assigned: [broker name]" — Lead Agent stops auto-following up
5. If broker doesn't contact within 2 hours, Lead Agent escalates back to CEO

### Human action sync
When a human broker takes action outside the platform (sends a WhatsApp manually, books a viewing), the system captures it:
- WhatsApp Cloud API logs ALL messages on the agency number — human-sent and AI-drafted both flow through
- Google Calendar sync captures manually-booked viewings
- Broker can log manual actions via a simple "What did you do?" input in their broker view

---

## Owner Notification System

The owner is not always on the dashboard. They need to know when something requires attention.

### Notification channels
- **Push notification (PWA)** — approval pending, escalation raised, morning brief ready
- **WhatsApp to owner's personal number** — daily morning brief summary, urgent escalations only (not routine approvals)
- **Email digest** — weekly performance summary, cost report

### Notification rules
| Event | Channel | Timing |
|-------|---------|--------|
| Approval pending (routine) | Push | Batch at 9am, 1pm, 6pm |
| Urgent escalation (hot lead) | WhatsApp + Push | Immediate |
| Morning brief ready | Push | 8am daily |
| Agent error / failure | Push | Immediate |
| Monthly cost approaching budget | Push + Email | At 80% of budget |
| Weekly report | Email | Monday 8am |

---

## Demo Mode & First Wow Moment

New users must experience value within the first 10 minutes. A cold empty dashboard kills conversion.

### Demo Agency (pre-loaded on signup)
Every new signup gets a **pre-populated demo agency** running in the background:
- 12 fake leads in various pipeline stages
- A week of agent activity already logged (Lead Agent followed up 8 leads, Content Agent generated 3 posts, Market Agent flagged 2 DLD deals)
- 3 pending approval cards waiting in the CEO chat (a WhatsApp draft, an Instagram post, a pitch deck)
- A morning brief from the CEO summarising the demo agency's week

The user's first experience is seeing a fully-running agency — not an empty state. They read the morning brief, approve a WhatsApp, see the agent run log. Then the onboarding wizard asks: "Ready to connect your real agency?"

### First real win
Designed first milestone after connecting real credentials:
1. Lead Agent detects first real inbound WhatsApp enquiry
2. Lead Agent drafts a response
3. Approval card appears in CEO chat
4. Owner approves → message sent in under 60 seconds of enquiry
5. CEO chat: "Your Lead Agent just responded to Ahmed Al Hashimi's enquiry about JVC. That's your first AI-assisted lead response."

---

## Multilingual Support

Dubai's buyer pool is internationally diverse. Arabic, Russian, Chinese, and English are all active in the market. Agents communicating only in English lose significant volume.

### Language detection
- Lead Agent detects the language of every inbound message
- Responds in the same language by default
- Language is stored on the lead profile
- Approval cards show message in detected language with English translation toggle

### Supported languages at launch
Arabic, English, Russian — these three cover the majority of Dubai's buyer market. Chinese (Mandarin) as Phase 2.

### Tone adaptation
- Arabic: formal, respectful, titles used ("Mr. Ahmed", "Ustaz")
- Russian: direct, metrics-first (price per sqft, ROI percentage)
- English: varies — adapt to cues from the lead's writing style

---

## Dubai Compliance & Legal Guardrails

### RERA advertising rules
- No guaranteed rental yield figures without official RERA data source
- Off-plan projects must be RERA-registered before marketing
- Agent must hold valid RERA card number (stored in agency context, appended to relevant comms)
- Lead Agent skill set includes a compliance check before generating any marketing claim

### UAE Personal Data Protection Act (PDPA)
- All lead data encrypted at rest
- No cross-agency data sharing
- Data deletion API: agency can request full data wipe on cancellation
- WhatsApp opt-out: if lead replies "STOP", Lead Agent tags them as opted-out and never contacts again

### Financial promotions
- Investment analysis outputs include a standard disclaimer (configurable per agency)
- No price guarantees in any automated communication
- Capital appreciation claims require a DLD source citation

---

## Team Access & Permissions

For established agencies, human brokers need visibility into AI agent activity without having full owner-level control.

### Roles

| Role | What they can see | What they can do |
|------|------------------|-----------------|
| **Owner** | Everything | Full control, billing, hire/fire agents |
| **Manager** | All agents, all leads, all approvals | Approve actions, assign leads, adjust agent instructions |
| **Broker** | Their assigned leads only | View lead history, log manual actions, request CEO assistance |
| **Viewer** | Dashboard metrics only | Read-only, no actions |

### Broker view
Brokers get a simplified mobile-first view showing:
- Their assigned leads and conversation history
- Viewing schedule for today
- Quick log: "I called Ahmed — no answer", "Viewing confirmed for Thursday"
- Request help from CEO: "I need a pitch deck for this lead"

---

## Cost Tracking & Budget Controls

Every agent run consumes Claude API tokens. Owners need visibility and control.

### Per-agent cost tracking
- Every heartbeat run logs: tokens in, tokens out, tools called, duration, cost in USD
- Dashboard agent cards show: cost today / cost this month
- Monthly cost projection based on current run rate

### Budget controls
- Per-agent monthly budget cap (e.g., Lead Agent: $50/month max)
- Agency-wide monthly budget cap
- At 80% of budget: owner notified
- At 100%: agent pauses, owner must top up or raise cap
- Emergency pause: one-click pause all agents from dashboard

### Cost visibility
Owner sees a clear breakdown: "This month your agency has cost $127. Lead Agent: $62, Content Agent: $31, Market Agent: $18, CEO: $16."

---

## Property Finder & Dubizzle Integration

Property Finder is Dubai's #1 listing portal. Most agencies receive the majority of their leads via PF email notifications.

### Email-based lead parsing
PF, Bayut, and Dubizzle all send lead notification emails in structured formats. The Lead Agent's email watcher:
1. Monitors Gmail for emails from `@notification.propertyfinder.ae`, `@bayut.com`, `@dubizzle.com`
2. Parses name, phone, email, property enquired about, message
3. Creates lead record with source tagged
4. Triggers immediate follow-up sequence

### Portal-specific context
- Property Finder leads often come with the specific listing URL — stored on lead, used by Lead Agent to provide contextual follow-up
- Bayut leads may include the lead's other saved properties — intelligence for the Lead Agent
- Response SLA: PF and Bayut rank agents by response speed — Lead Agent targets sub-5-minute response to all portal leads

---

## The AygentDesk MCP Server (Tool Layer)

AygentDesk's 53 tools are the skill layer for Aygency World agents. They are exposed via an **MCP (Model Context Protocol) server** that Paperclip agents connect to via Claude Code.

This means:
- No rewriting tools — they already exist and are tested
- Each agent gets a filtered view (Lead Agent can't accidentally post to Instagram)
- New tools added to AygentDesk automatically become available in Aygency World

### MCP Server Architecture

```
Aygency World (Paperclip fork)
  └── Agent (Claude Code instance)
        └── connects to: AygentDesk MCP Server
              └── exposes: 53 tools scoped by agent role
```

The MCP server reads the agent's role from the connection context and returns only the tools for that role. CEO gets all tools (read-only on most). Sub-agents get role-scoped subsets.

---

## Agent Roles & Tool Mapping

### CEO Agent
**Purpose:** Strategy, delegation, owner communication, morning briefs, escalation handling.
**Tools:** All 53 (read access on everything, write access to task creation and memory)
**Heartbeat:** Every 4 hours — reviews agency state, generates brief, escalates blockers

### Lead Agent
**Purpose:** Inbound lead capture, scoring, follow-up, pipeline management.
**Tools:** `search_leads`, `update_lead`, `get_lead_activity`, `search_whatsapp`, `send_whatsapp`, `search_email`, `send_email`, `bulk_follow_up`, `reactivate_stale_leads`, `tag_lead`, `create_tag`, `match_deal_to_leads`, `get_follow_ups`
**Heartbeat:** Every 15 minutes — checks new inbound, drafts follow-ups, queues approvals

### Content Agent
**Purpose:** Social media, pitch decks, landing pages, campaign management.
**Tools:** `generate_social_content`, `post_to_instagram`, `generate_pitch_deck`, `generate_pitch_presentation`, `generate_landing_page`, `generate_content`, `launch_campaign`, `create_drip_campaign`, `enroll_lead_in_campaign`
**Heartbeat:** Daily at 9am — generates content queue for the day

### Market Intelligence Agent
**Purpose:** DLD transaction monitoring, listing surveillance, news, investment analysis.
**Tools:** `search_dld_transactions`, `search_listings`, `watch_listings`, `get_news`, `web_search`, `analyze_investment`, `search_projects`, `get_project_details`, `calculate_dld_fees`
**Heartbeat:** Every hour — scans DLD, flags new deals, monitors watched listings

### Viewing Agent
**Purpose:** Calendar management, viewing scheduling, confirmation and follow-up.
**Tools:** `schedule_viewing`, `get_viewings`, `get_calendar`, `create_event`, `check_availability`, `send_whatsapp`, `send_email`
**Heartbeat:** Every 30 minutes — checks upcoming viewings, sends reminders, follows up after viewings

### Portfolio Agent (Rental/Property Management)
**Purpose:** Landlord management, tenancy renewals, rent tracking, document management.
**Tools:** `manage_landlord`, `manage_property`, `manage_tenancy`, `calculate_rera_rent`, `list_documents`, `create_portal`, `get_portal_activity`, `send_email`, `send_whatsapp`
**Heartbeat:** Daily at 8am — checks expiring leases, flags renewals due, chases overdue rent

### Social Media Agent (optional, larger agencies)
**Purpose:** Dedicated Instagram/LinkedIn DM monitoring and engagement.
**Tools:** `search_instagram_dms`, `post_to_instagram`, `generate_social_content`, `search_whatsapp`
**Heartbeat:** Every hour during business hours

---

## The Company Template

The Dubai Real Estate Agency template lives in a fork of `paperclipai/companies`. It is a fully configured, importable company package:

```
dubai-real-estate-agency/
├── company.json          # Org chart: CEO + 5 default agents, goals, governance
├── skills/
│   ├── lead-management/  # Instructions for lead agent behaviour
│   ├── content/          # Content guidelines, tone of voice, brand rules
│   ├── market-intel/     # DLD monitoring patterns, what to flag
│   ├── viewings/         # Viewing etiquette, confirmation templates
│   └── portfolio/        # Tenancy management workflows
└── README.md
```

Import command:
```bash
npx companies.sh add aygencyworld/companies/dubai-real-estate-agency
```

---

## Approval System

Every outbound action is gated by an approval card in the CEO chat. Agents never send anything without authorisation.

### Approval Card Types

| Type | Triggered by | What it shows |
|------|-------------|---------------|
| WhatsApp Send | Lead Agent | Message preview, recipient, lead context, send / edit / reject |
| Email Send | Lead/Portfolio Agent | Subject, body preview, recipient, send / edit / reject |
| Instagram Post | Content Agent | Image preview, caption, hashtags, post / edit / reject |
| Pitch Deck | Content Agent | PDF preview link, send to lead / download / reject |
| Viewing Confirmation | Viewing Agent | Time, location, attendees, send / edit / reject |
| Campaign Launch | Content Agent | Sequence preview, enrolment list, launch / edit / reject |

Approvals batch up in the CEO chat as a morning queue. Owner can bulk-approve routine items or individually review edge cases.

---

## The Dashboard (Paperclip UI — Rebranded + Extended)

The Paperclip dashboard is the "office floor" view. Rebranded to Aygency World visual identity.

### Key Views

**Agency Overview (home)**
- Live agent status (running / idle / waiting for approval)
- Today's activity feed
- Pending approvals count (badge)
- Key metrics: leads today, messages sent, viewings booked

**CEO Chat**
- Full conversation history with CEO agent
- Inline approval cards
- Morning brief pinned at top of each day
- Quick action bar: "Brief me", "What's pending?", "Weekly report"

**Agent Cards (org chart view)**
- Each agent shown as a card: name, role, last run time, tasks completed today, cost today
- Click into any agent: full run history, tool calls made, decisions taken, cost breakdown
- Hire new agent / pause agent / adjust instructions

**Approvals Queue**
- Standalone view of all pending outbound actions
- Filter by agent, type, lead
- Bulk approve / reject

**Analytics**
- Lead pipeline velocity
- Response time metrics
- Content performance
- Agent cost vs. output

---

## Pricing Philosophy (To Be Finalised)

Pricing is not finalised but the model should reflect:
- **Per-agent pricing** — pay for the agents you run. Small agency = 3 agents. Large = 10+.
- **Usage component** — API calls (Claude, WhatsApp messages sent) pass through at cost + margin
- **Tiers aligned to segments:**
  - Starter (Solo) — CEO + 2 agents
  - Growth (Small agency) — CEO + 5 agents
  - Scale (Medium agency) — CEO + 10 agents + priority support
  - Enterprise — custom, white-label, dedicated infra

---

## Relationship to AygentDesk

| | AygentDesk | Aygency World |
|--|--|--|
| Who | Individual broker | Agency owner |
| Model | Human-driven, reactive | AI-driven, autonomous |
| Interface | Chat with one AI | CEO chat + dashboard |
| Agents | 1 | 5–15+ |
| Tools | 53, direct access | 53, role-scoped via MCP |
| Pricing | Per user/month | Per agent/month |
| Stack | Next.js / TypeScript / Prisma | Paperclip fork (Node.js / React) + AygentDesk MCP |

**The upsell path:** Agency World owner buys the platform. Their human brokers individually subscribe to AygentDesk. Two products, two revenue streams, one ecosystem.

---

## Build Sequence (Rough)

1. **Fork Paperclip** — clone repo, set up dev environment, verify it runs
2. **Build AygentDesk MCP Server** — expose 53 tools as MCP endpoints, role-scoped
3. **Create Dubai Real Estate Agency company template** — org chart, agent configs, skill sets
4. **Wire CEO chat** — extend Paperclip's chat UI, approval card components
5. **Onboarding wizard** — 3-step wizard + CEO interview flow
6. **Heartbeat configs** — per-agent schedules and trigger logic
7. **Rebrand UI** — Aygency World visual identity, replace Paperclip branding
8. **Approval system** — card components, queue view, bulk approve
9. **Dashboard extensions** — metrics, agent cards, analytics
10. **Auth + multi-tenancy** — each agency isolated, invite team members
11. **Deployment** — Docker, domain, production environment

---

## Per-Broker WhatsApp Numbers

In a real Dubai real estate agency, every broker has their own personal WhatsApp number they use with clients. The agency also has a central number used for advertising, portal leads, and branding. Aygency World must support both.

### Two-tier WhatsApp architecture

**Agency number (one per agency)**
- The public-facing number shown on ads, portals, website
- All portal leads (Property Finder, Bayut) come here first
- Lead Agent monitors this number and processes inbound enquiries
- Used for bulk campaigns, drip sequences, broadcast messages

**Broker numbers (one per human broker)**
- Each broker connects their own WhatsApp Business number during their profile setup
- Once a lead is assigned to a broker, the Lead Agent uses THAT broker's number for all subsequent communication — so the client always has a consistent, personal point of contact
- The AI drafts messages on behalf of the broker, broker approves, message sends FROM their number
- Client never knows AI was involved

### How broker WhatsApp is connected
1. Broker receives invite to join the agency on Aygency World
2. Broker profile setup: name, photo, areas, number
3. WhatsApp Business API connection (same OAuth flow as agency number)
4. Their number is stored against their broker profile
5. When Lead Agent assigns a follow-up to that broker's number, it routes through their credentials

### What this means for the AI
The Lead Agent doesn't just have one WhatsApp identity — it can operate as any connected number in the agency. When drafting a follow-up for a lead assigned to broker Sara, it composes the message in Sara's voice (based on her tone preferences in her broker profile), queues it for Sara's approval, and sends it from Sara's number.

---

## Complete Lead Lifecycle — Step by Step

This is the end-to-end flow of a lead from first contact to deal closed.

```
1. ENTRY
   └─ Inbound WhatsApp / PF email / Bayut email / Instagram DM / manual
   └─ Lead Agent creates lead record: name, phone, source, initial message
   └─ Auto-enrichment: DLD history check, WhatsApp history search, score 0–10

2. IMMEDIATE RESPONSE (< 5 minutes)
   └─ Lead Agent drafts reply in detected language
   └─ Approval card → Owner/Manager approves (or auto-approves if guardrail set)
   └─ Message sent. Lead tagged "contacted"

3. QUALIFICATION
   └─ Lead Agent conducts qualification via WhatsApp conversation
   └─ Extracts: budget, area preference, property type, timeline, financing status
   └─ Updates lead profile. Score recalculated.
   └─ Low score (1–4): enters nurture drip campaign
   └─ Medium score (5–7): weekly follow-up sequence
   └─ High score (8–10): escalation card to owner → assigned to broker

4. MATCHING
   └─ Lead Agent runs match_deal_to_leads across current inventory
   └─ Suggests 2–3 matching projects/properties
   └─ Content Agent generates project pitch deck (if off-plan)
   └─ Approval card: send pitch deck / property details to lead?

5. VIEWING
   └─ Lead expresses interest in visiting
   └─ Viewing Agent checks broker + lead availability via Google Calendar
   └─ Proposes 3 time slots to lead via WhatsApp
   └─ Lead confirms → Viewing Agent creates calendar event, sends confirmation
   └─ Day before: reminder sent. Post-viewing: follow-up drafted

6. NEGOTIATION / OFFER
   └─ Human broker takes over at this stage (high-value relationship work)
   └─ AI supports: DLD comparables for pricing, calculate_dld_fees, payment plan doc
   └─ Content Agent generates personalised proposal if needed

7. DEAL CLOSED
   └─ Owner/broker marks deal as "closed" in dashboard
   └─ Lead status updated to "client"
   └─ CEO logged the conversion. Adds to monthly metrics.
   └─ Portfolio Agent (if rental): creates landlord/tenancy records
   └─ Content Agent: generates "just sold" Instagram post for approval

8. POST-DEAL
   └─ Lead enters post-sale nurture sequence (referral request, annual check-in)
   └─ If rental: Portfolio Agent manages ongoing tenancy, renewals
```

---

## Agent-to-Agent Communication (Technical)

How does the CEO agent actually delegate to sub-agents? Paperclip handles this via its task system, but the specific implementation for Aygency World works like this:

### Task delegation flow
1. CEO agent runs its heartbeat
2. CEO assesses agency state (via tool calls: search_leads, get_viewings, etc.)
3. CEO creates tasks in Paperclip's task queue: `{ agent: "lead-agent", instruction: "Follow up with all leads tagged 'viewing-done' who haven't responded in 48h", priority: "high" }`
4. Lead Agent's next heartbeat picks up the task and executes it
5. Lead Agent posts result back as a task completion: `{ status: "done", summary: "Drafted 4 follow-up messages, 3 queued for approval, 1 lead marked unresponsive" }`
6. CEO reads task completions in its next run and synthesises for morning brief

### Direct escalation
When an agent needs immediate owner input (not next heartbeat), it creates an **escalation** — a high-priority item that triggers an immediate push notification and bypasses the batch approval queue.

Escalation triggers:
- Lead score jumps to 9–10 (hot lead)
- Inbound message contains keywords: "ready", "let's sign", "how do I pay"
- Call Agent completes a call with "viewing requested" outcome
- Portfolio Agent detects a lease expired with no renewal in place

---

## Integration Connection Flow (How Each OAuth Works)

### WhatsApp Business (agency number)
1. Owner enters their WhatsApp Business phone number
2. Aygency World redirects to Meta Business OAuth
3. Owner grants permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
4. Access token + phone number ID stored encrypted in DB
5. Webhook registered for inbound messages
6. Test: system sends "Your Aygency World is connected ✓" to the number

### Gmail
1. Owner clicks "Connect Gmail"
2. Google OAuth consent screen: `gmail.readonly`, `gmail.send`, `gmail.modify`
3. Tokens stored per agency. Refresh token used for background access.
4. Lead Agent immediately scans for any Property Finder / Bayut / Dubizzle notification emails in the last 7 days — imports any leads found

### Google Calendar
1. Connected alongside Gmail (same OAuth flow, additional scope: `calendar.events`)
2. Viewing Agent gets read/write access to the connected calendar
3. Agency can specify which calendar to use (useful if owner has personal + business calendars)

### Instagram
1. Connected via Meta Business OAuth (same App as WhatsApp)
2. Permissions: `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`
3. Content Agent can read DMs and publish posts/carousels

### Per-broker WhatsApp
Same Meta OAuth flow as agency number, but scoped to the individual broker's account. Broker does this from their own profile settings page.

---

## The Skill File Format

Skills are the instructions that define how each agent behaves. They live in the company template repository. This is what an actual skill file looks like:

```markdown
# lead-response.md (Lead Agent skill)

## Purpose
Draft responses to new inbound leads within 5 minutes of enquiry.

## Rules
- Always respond in the same language the lead used
- Never send a message longer than 3 sentences for the first reply
- Always include the agent's name (from agency context) in the sign-off
- Never quote a specific price in the first message — always say "let me check the latest availability for you"
- If lead asks "are you a bot?", respond: "I'm [Name] from [Agency], happy to help!"

## First response template
"Hi [Lead Name]! Thanks for reaching out about [Property/Area]. I'd love to share some options that match what you're looking for. Quick question — are you looking for [Type A] or [Type B]? — [Broker Name], [Agency Name]"

## Qualification sequence
After initial response, qualify in this order over 2–3 messages:
1. Budget range
2. Timeline (when are you looking to move/invest?)
3. Financing (cash or mortgage?)
4. Specific requirements (bedrooms, areas, floor preferences)

## Escalation rule
If lead responds positively AND has budget > AED 2M AND timeline < 3 months: create escalation card immediately.
```

Skills are plain Markdown — no code, no special syntax. The agent loads the skill as part of its system prompt on each run.

---

## Billing & Subscription (Stripe)

### Subscription model
Each agency has a monthly subscription that covers:
- Platform fee (per tier: Starter / Growth / Scale / Enterprise)
- Included agent-runs per month (e.g., Growth tier: 10,000 agent runs/month)
- Overage rate above the included runs

### What counts as an "agent run"
One heartbeat execution = one run. Most runs cost 500–2,000 Claude tokens. A Lead Agent running every 15 minutes = ~2,880 runs/month.

### Stripe integration
- Subscription managed via Stripe Billing
- Usage metering: agent runs reported to Stripe daily
- Failed payment → agents pause with 3-day grace period
- Downgrade: agents above the tier limit are paused (owner chooses which to keep)
- Upgrade: instant, agents resume immediately

### Add-on: AI Calling
Twilio calls are billed separately as a usage add-on. Cost per minute passed through at Twilio rate + margin. Shown as a separate line item on invoice.

---

## Error Handling & Agent Recovery

### What can go wrong
- **API rate limit hit** (Anthropic, WhatsApp, Gmail): agent pauses, retries with exponential backoff, alerts owner if blocked for >1 hour
- **Tool call fails** (e.g., WhatsApp rejects a message): agent logs the error, moves to next task, includes failure in next CEO brief
- **Agent runs longer than 5 minutes**: killed, logged as timeout, CEO notified
- **Credentials expired** (OAuth token expired): agent pauses, push notification sent to owner to reconnect, step-by-step reconnection flow in dashboard
- **Budget cap reached**: agent pauses gracefully, saves state, owner notified with "your Lead Agent budget is used up this month — raise cap to resume"

### Agent audit log
Every agent run is logged with:
- Start time, end time, duration
- Tools called (in order)
- Tokens consumed
- Tasks completed
- Errors encountered
- Messages drafted (not yet sent)
- Approvals queued

Full audit log is accessible in the agent detail view. Useful for debugging unexpected behaviour and for compliance.

---

## Data Model (Key Tables)

```
Agency — id, name, logo, focusArea, size, tier, stripeCustomerId, createdAt
  ↳ AgencyCredentials — agencyId, service (whatsapp|gmail|instagram), accessToken (encrypted), refreshToken
  ↳ AgencyContext — agencyId, key, value (agency knowledge base, JSON)
  ↳ Users — id, agencyId, role (owner|manager|broker|viewer), name, phone
  ↳ Agents — id, agencyId, role, name, instructions, heartbeatInterval, status, budgetCap
  ↳ AgentRuns — id, agentId, startedAt, completedAt, tokensUsed, costUsd, status, log
  ↳ Tasks — id, agencyId, fromAgentId, toAgentId, instruction, status, result
  ↳ Leads — id, agencyId, name, phone, email, language, score, stage, assignedBrokerId, source
  ↳ Approvals — id, agencyId, agentId, type, payload, status (pending|approved|rejected|edited)
  ↳ Escalations — id, agencyId, agentId, reason, leadId?, status, notifiedAt
  ↳ Notifications — id, agencyId, userId, channel, message, sentAt, readAt
```

---

## Key Decisions Still Open

- **Auth system** — use Paperclip's built-in auth or swap in NextAuth (familiar from AygentDesk)?
- **Database** — keep Paperclip's embedded Postgres or connect to a shared managed DB?
- **MCP server hosting** — standalone service alongside AygentDesk API, or embedded?
- **White-label for enterprise** — how deep? Custom domain, custom branding, custom agent names?
- **Mobile** — Paperclip is desktop-only. Do we add a mobile-responsive CEO chat view?
- **Pricing** — per-agent, flat monthly, usage-based, or hybrid?

---

## Brand

- **Product name:** Aygency World
- **Tagline (draft):** "Your AI agency. Always working."
- **Visual identity:** TBD — but should feel distinct from AygentDesk while sharing the "Aygent" brand family
- **Domain:** TBD

---

## Environment Variables (Expected)

```
# Core
DATABASE_URL=
REDIS_URL= (if added)

# AI
ANTHROPIC_API_KEY=         # All agents run on Claude via Anthropic API
GEMINI_API_KEY=            # Optional: Gemini Embedding 2 for semantic search

# AygentDesk MCP Server
AYGENTDESK_MCP_URL=        # URL of the AygentDesk MCP server
AYGENTDESK_MCP_SECRET=     # Shared secret for MCP auth

# Integrations (per-agency, stored in DB)
# WhatsApp, Gmail, Google Calendar, Instagram — OAuth tokens stored per agency

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## Commands

```bash
# Development
pnpm dev                   # Start Paperclip fork (API + UI, watch mode)
pnpm build                 # Production build

# Company templates
npx companies.sh add aygencyworld/companies/dubai-real-estate-agency

# Docker (prod)
docker-compose up -d       # Full stack
```
