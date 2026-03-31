# Phase 1 Design — CEO-Driven Agency Builder

**Date:** 2026-03-29
**Status:** Draft
**Goal:** Demo-ready. User talks to CEO, CEO builds the agency, one hired agent processes a real lead.

---

## Core Concept

The CEO agent is the company architect. The user describes their vision and pain points. The CEO interviews them, proposes an org structure tailored to their problems, and — on approval — hires the entire team. Hired agents then actually work.

The engine is generic (any company type). The default skin is Dubai real estate. Every demo, template, skill, and seed data speaks Dubai RE. The underlying architecture imposes no domain constraint.

---

## What Changed From the Original Plan

| Original ROADMAP Phase 1 | This Design |
|---|---|
| Hardcoded CEO + Lead Agent | CEO dynamically builds the org based on user interview |
| Fixed agent roles from a template | CEO proposes roles based on user's stated problems |
| bash/curl skills calling AygentDesk API | All 63 tools native inside Aygency World (copied from AygentDesk) |
| Tool Bridge service (port 3002) | Gone — tools are native functions |
| AYGENTDESK_URL dependency | Gone — fully self-contained |
| Static skill assignment | CEO assigns skills per agent at hire time |
| Org depth fixed | CEO decides depth based on company size (flat for small, layered for large) |

---

## Architecture

### 1. The CEO Agent

The only agent that exists at company creation. Two modes:

**Builder mode** (no team hired yet):
- Greets the user
- Asks about their company vision
- Asks what's broken — "What's your biggest challenge right now? What feels overwhelming?"
- May ask a sizing follow-up ("How many leads per week? How many people do you have?")
- Proposes a team tied directly to the stated problems — each agent justified by a pain point
- User approves/adjusts the team structure
- **Agent configuration step** (see "Two-Step Hiring" below)
- CEO emits structured `hire_team` command
- Confirms team is live, gives cost estimate

**Two-step hiring — structure then configuration:**

After the user approves the team structure, CEO walks through agent configuration before actually hiring. For each agent (or batch of similar agents):

> "Before I bring Layla on board — any specific instructions for how she should work?
> - Tone: warm and chatty, or straight to business?
> - Should she only recommend certain developers or projects?
> - Follow-up style: persistent or give space?
> - Any message templates you want her to use?
>
> Or I can set her up with best practices and you tweak later."

Three possible responses:
1. **"You decide"** — CEO writes the agent's instructions using interview context + skill defaults. Briefly summarises what it chose.
2. **User gives specifics** — "Only recommend Binghatti and Samana. Formal tone. Follow up once a week max. Here's our sign-off: [Name], Dubai Properties — RERA #12345." CEO incorporates verbatim.
3. **Mix** — "Friendly tone, but you handle the rest." CEO fills gaps.

What users can configure per agent:
- Personality and tone (formal, casual, chatty, direct)
- Developer/project restrictions (only recommend X, never mention Y)
- Follow-up cadence and templates ("use this exact message for first contact")
- Sign-off format and RERA licence number
- Language preferences (always reply in Arabic, or match the lead's language)
- Escalation thresholds (escalate at score 7 instead of default 8)
- Any custom rules ("never discuss prices over WhatsApp, always push to a call")

These are stored as part of the agent's `AGENTS.md` config, written by the CEO at hire time. The user changes them later by telling the CEO: "Tell Layla to stop recommending Danube projects." CEO updates Layla's instructions. If there's a manager layer, CEO tells the manager, manager updates the agent — chain of command respected.

**Coordinator mode** (team exists):
- Delegates tasks to agents via Paperclip issues
- Runs morning briefs
- Handles escalations
- Reports to the owner
- Can hire/fire/restructure on owner's instruction

**CEO system prompt includes:**
- The skill catalog (one-line descriptions of all available skills)
- The structured command format for hiring
- Dubai real estate domain knowledge (default context)
- Interview playbook (what to ask, how to size the org)

### 2. The Command Handler

A server-side module at `server/src/services/ceo-commands.ts`. Hooks into Paperclip's comment creation flow.

**Trigger:** When a comment is saved on any issue, check if it contains a ` ```paperclip-command ` block.

**Command format:**
```json
{
  "action": "hire_team",
  "departments": [
    {
      "name": "Sales",
      "agents": [
        {
          "name": "Layla",
          "role": "Lead Agent",
          "focus": "JVC & Sports City",
          "skills": ["lead-response", "lead-qualification", "lead-followup", "multilingual", "dubai-compliance"],
          "tools": ["search_leads", "update_lead", "get_lead_activity", "tag_lead", "get_follow_ups", "send_whatsapp", "search_whatsapp", "search_projects", "get_project_details"],
          "heartbeat_minutes": 15,
          "reports_to": null
        }
      ]
    }
  ]
}
```

**What the handler does:**
1. Parses JSON from the comment body
2. For each department: creates a Paperclip project
3. For each agent: creates a Paperclip agent record with:
   - Name, role description
   - Adapter config (claude-local)
   - Skill assignments (behaviour + tools) loaded from the skill library
   - Heartbeat schedule (routine + trigger)
   - Parent agent reference for hierarchy
4. Writes a confirmation comment back to the issue

**Hierarchy depth:** Flexible. CEO decides based on user's company size:
- Small (1-5 agents): flat — CEO → agents directly
- Medium (6-15 agents): one manager layer — CEO → department managers → agents
- Large (15+): deeper nesting as needed

**Error handling:** If agent creation fails, handler writes an error comment. CEO sees it on next heartbeat.

### 3. The Skill Library

Three layers of skills, all markdown files:

#### Layer 1 — Domain Knowledge (injected into every agent)

| Skill | What it contains |
|-------|-----------------|
| `dubai-market.md` | Areas, price ranges per sqft, developer tiers (Emaar/Nakheel/DAMAC etc.), Golden Visa rules, payment plan structures, key landmarks |
| `dubai-compliance.md` | RERA advertising rules, PDPA data rules, never guarantee yields, escrow rules, disclaimer templates, licence number requirements |
| `dubai-buyers.md` | Buyer personas by nationality (Russian = ROI numbers, Arabic = relationship first, Chinese = formal), language preferences, what matters to each |
| `multilingual.md` | Language detection rules, tone per language, greeting conventions, keep project/area names in original form |

#### Layer 2 — Behaviour Skills (assigned per role by CEO)

| Skill | When assigned |
|-------|--------------|
| `lead-response.md` | Lead agents — first reply rules, < 5 min target, max 3 sentences, never quote exact price first |
| `lead-qualification.md` | Lead agents — qualification sequence (budget → timeline → financing → area), scoring rubric, when to escalate |
| `lead-followup.md` | Lead agents — follow-up cadence (daily hot, weekly warm, monthly cold), re-engagement patterns, stale lead reactivation |
| `lead-handoff.md` | Lead agents — when to hand to human broker (score 8+, budget > 5M, explicit request), handoff protocol |
| `viewing-scheduling.md` | Viewing agents — propose 3 slots, confirmation flow, day-before reminder, post-viewing follow-up template |
| `content-instagram.md` | Content agents — content pillars, carousel structures, caption formula (hook-value-CTA), hashtag strategy, posting schedule |
| `content-pitch-deck.md` | Content agents — 3-step approval flow (collect details → confirm → generate), what data to include, personalisation per lead |
| `market-monitoring.md` | Market intel agents — what to watch (DLD transactions, new launches, price movements), how to report, alert thresholds |
| `portfolio-management.md` | Portfolio agents — tenancy lifecycle, renewal reminders 90/60/30 days, RERA rent increase calculations, vacancy alerts |
| `campaign-management.md` | Content/marketing agents — drip campaign design, enrolment rules, performance monitoring, when to pause |
| `call-handling.md` | Call agents — inbound script, outbound preparation, post-call logging, escalation triggers |

#### Layer 3 — Tool Skills (the 63 AygentDesk tools, native)

All 63 tools copied from AygentDesk (`/Users/alexanderjackson/AgentDXB/src/lib/ai/tools.ts`), adapted to Drizzle ORM where they touch the database. External API calls (WhatsApp, Gmail, Instagram, Bayut scraper, DLD, Tavily) remain largely unchanged.

**Grouped by function:**

| Group | Tools | Count |
|-------|-------|-------|
| Search & Intel | search_projects, get_project_details, search_listings, watch_listings, search_dld_transactions, scrape_dxb_transactions, get_building_analysis | 7 |
| Communication | search_whatsapp, send_whatsapp, search_email, send_email, search_instagram_dms, send_instagram_dm, post_to_instagram, list_whatsapp_templates, use_whatsapp_template, make_call | 10 |
| Lead Pipeline | search_leads, update_lead, get_lead_activity, tag_lead, untag_lead, create_tag, list_tags, get_follow_ups, bulk_follow_up, bulk_lead_action, reactivate_stale_leads, match_deal_to_leads, deduplicate_leads, merge_leads | 14 |
| Content Generation | generate_pitch_deck, generate_pitch_presentation, generate_landing_page, generate_social_content, generate_content, generate_market_report, launch_campaign, create_drip_campaign, enroll_lead_in_campaign | 9 |
| Calendar & Viewings | get_calendar, create_event, check_availability, schedule_viewing, get_viewings | 5 |
| Portfolio | manage_landlord, manage_property, manage_tenancy, calculate_rera_rent, calculate_dld_fees | 5 |
| Client & Docs | create_portal, get_portal_activity, list_documents, extract_document_data, scrape_url | 5 |
| Market & Admin | analyze_investment, web_search, get_news, get_campaign_stats, create_task, remember, set_guardrails | 7 |
| **Total** | | **63** |

**How tools are exposed to agents:**
Paperclip spawns Claude Code as a subprocess. Claude Code supports MCP natively. The 63 tools are registered as an MCP server that runs locally. When Paperclip spawns an agent, it generates a per-agent `claude_mcp_config.json` that only includes the tools assigned to that agent. The MCP server receives the tool call + agent context (company_id, agent_id) and executes it.

In Phase 1, a simpler approach: tools are written as markdown skill files (like AygentDesk's existing pattern) that instruct Claude to call a local API endpoint. The agent's `--add-dir` only includes the tool skill files assigned to it. This is functionally equivalent to MCP scoping but requires no MCP server — just markdown files and a thin Express API that executes the tool logic.

**Role scoping:** An agent can only use tools whose skill files are loaded into its session. A Lead Agent cannot call `post_to_instagram` because that skill file was never included in its `--add-dir`. Scoping happens at hire time, not at call time.

**The catalog** (`skills/catalog.md`) is what the CEO sees — a one-line description of each behaviour skill and tool group. CEO reads this to decide what to assign when hiring.

### 4. Database — AygentDesk Models Ported to Drizzle

The following Prisma models from AygentDesk are ported to Drizzle tables in Aygency World. All get `company_id` for multi-tenancy.

| Model | Purpose |
|-------|---------|
| `projects` | 1,800+ Dubai off-plan projects (seeded on setup) |
| `leads` | Lead records with scoring, staging, assignment |
| `activities` | Lead activity timeline (messages, calls, stage changes) |
| `tags`, `lead_tags` | Tagging system for leads |
| `whatsapp_messages` | WhatsApp message history per agent |
| `email_messages` | Email history per agent |
| `landlords` | Landlord records for portfolio management |
| `managed_properties` | Properties linked to landlords |
| `tenancies` | Tenancy records with rent history |
| `campaigns`, `campaign_enrollments` | Drip campaign management |
| `documents` | Document vault (contracts, passports, Ejari) |
| `portals`, `portal_activity` | Client-facing portals with engagement tracking |
| `dld_transactions` | DLD transaction cache |
| `tasks_reminders` | Scheduled tasks and reminders |
| `agent_credentials` | Per-agent OAuth tokens (WhatsApp, Gmail, Instagram, Calendar) — encrypted at rest |
| `agent_memory` | Per-agent memory store (the `remember` tool) |
| `guardrails` | Per-agent guardrail configuration |

Paperclip's existing tables (companies, agents, issues, heartbeat_runs, cost_events, etc.) remain untouched.

### 5. Live Activity Panel (UI)

A new UI component that makes agents feel alive. Visible alongside the org chart or as a sidebar/overlay. Shows real-time agent activity via Paperclip's existing WebSocket infrastructure.

**What it shows per agent:**

Each agent gets a card with:
- **Avatar + name + role** (e.g. Layla — Lead Agent, JVC)
- **Status indicator:** idle (grey pulse), thinking (amber pulse), working (green pulse), waiting for approval (blue pulse), paused (red)
- **Current action** (live-updating): "Searching projects in JVC...", "Drafting WhatsApp to Ahmed...", "Scoring lead: 6/10"
- **Last completed action** with timestamp: "Responded to lead — 2 min ago"
- **Today's stats:** leads handled, messages drafted, approvals pending

**Live activity feed:**

A scrolling feed (like a terminal or chat log) that shows what's happening across all agents in real-time:

```
14:32:01  Layla    picked up new lead: Ahmed Al Hashimi (JVC, 800K)
14:32:03  Layla    searching projects... found 4 matches
14:32:05  Layla    scoring lead... budget clear + area specific = 6/10
14:32:08  Layla    drafting WhatsApp response in English
14:32:10  Layla    ✓ approval queued — waiting for your OK
14:32:15  Omar     idle — no new Downtown leads
14:32:15  Noor     idle — no viewing requests
```

Each line is colour-coded by agent. Clickable to expand details.

**Design goals:**
- Should feel like watching a team work — not like reading logs
- Smooth animations: cards slide in when agents are hired, pulse when active, fade when idle
- The activity feed should auto-scroll but pause on hover
- Mobile-friendly: collapses to a compact status bar showing active agent count + pending approvals

**Technical implementation:**
- Built on Paperclip's existing `heartbeatRunEvents` and WebSocket live-events system
- Each heartbeat run already emits events (tool calls, outputs, status changes)
- The panel subscribes to these events and renders them as human-readable activity lines
- Agent status derived from: routine schedule (idle between heartbeats), active run (working), pending approval (waiting)

### 6. CEO Behaviours

**Cost preview at hire time:**
When CEO proposes a team, it includes a cost estimate:
> "These 3 agents will run approximately 150 heartbeats per day. Estimated daily cost: ~$12-15. Monthly estimate: ~$350-450."

Based on: heartbeat frequency x average tokens per run x Claude pricing. Rough but informative. Updated as agents are added or removed.

**Post-run reporting:**
After an agent completes a significant action (processes a lead, sends a message, creates content), CEO proactively reports on its next heartbeat:
> "Layla just handled her first lead — Ahmed Al Hashimi, JVC enquiry, scored 6/10. She drafted a WhatsApp and it's waiting for your approval."

This closes the loop. The user doesn't have to go check — the CEO tells them.

**Pause/resume commands:**
The command handler supports:

```json
{ "action": "pause_agent", "agent_name": "Layla" }
{ "action": "resume_agent", "agent_name": "Layla" }
{ "action": "pause_all" }
{ "action": "resume_all" }
```

User says "pause Layla" or "pause everything" → CEO emits the command → handler stops the agent's heartbeat schedule immediately. Resume restarts it. Safety valve for demos and production.

**Welcome-back briefing:**
When the owner opens the chat after a gap (> 2 hours since last message), CEO's next heartbeat detects this and proactively briefs:
> "Welcome back. While you were away:
> - Layla handled 4 new leads (2 JVC, 2 Sports City). 3 WhatsApp messages approved and sent. 1 pending your approval.
> - Omar had 1 Downtown enquiry, scored 8 — escalated for broker assignment.
> - Noor is idle, no viewing requests today.
> - Total spend today: $8.40.
>
> What would you like to focus on?"

### 7. Demo Flow

**Minute 0 — Empty company.**
User signs up. Only the CEO exists. Empty org chart.

**Minute 1 — The interview.**
> User: "I run a small agency in Dubai. Off-plan focus, JVC and Downtown. Two brokers, Sara and Mohammed. My biggest problem is leads going cold — I get 30-40 enquiries a week from Property Finder and Bayut but I can only follow up on maybe 10. The rest just die."

> CEO: "So you're losing 20-30 leads a week to slow follow-up. That's your biggest leak. Here's who I'd hire to fix it:
>
> **Layla — Lead Agent (JVC & Sports City)** — picks up every JVC enquiry within 5 minutes, qualifies in Arabic or English, follows up daily until they're viewing-ready or gone cold
>
> **Omar — Lead Agent (Downtown & Business Bay)** — same for Downtown
>
> **Noor — Viewing Coordinator** — once a lead is warm, books the viewing, sends confirmations and reminders, follows up after
>
> Sara gets the hot JVC leads for closings. Mohammed gets Downtown.
>
> That plugs your leak. Once lead flow is healthy, we add content and market intel. Start here?"

> User: "Go."

**Minute 1.5 — Agent configuration.**
CEO asks: "Any specific instructions for Layla, Omar, and Noor? Or shall I set them up with best practices?"
User: "Friendly tone, always greet in Arabic first then switch to their language. Use this sign-off: [Name], Dubai Properties — RERA #12345. You handle the rest."
CEO: "Got it. Estimated cost: ~$12/day for all three. Hiring now."

**Minute 2 — The org builds.**
CEO emits `hire_team` command. Server handler creates 3 agents. **The live activity panel lights up** — three agent cards slide in with green "Starting first shift" pulses. Org chart populates in real-time. The activity feed shows:
```
14:30:01  CEO      hired Layla — Lead Agent (JVC & Sports City)
14:30:02  CEO      hired Omar — Lead Agent (Downtown & Business Bay)
14:30:03  CEO      hired Noor — Viewing Coordinator
14:30:05  Layla    starting first shift...
14:30:05  Omar     starting first shift...
14:30:05  Noor     starting first shift...
```

**Minute 3 — A lead comes in.**
Presenter creates an issue simulating an inbound WhatsApp: "Hi, I'm interested in apartments in JVC, budget around 800K AED."

**Minute 4 — Layla works (audience watches in real-time).**
Layla's heartbeat fires. The activity panel shows each step live:
```
14:32:01  Layla    picked up new lead: Ahmed Al Hashimi
14:32:03  Layla    searching JVC projects under 800K...
14:32:05  Layla    found 4 matches — Binghatti Hills, Samana Golf Views, ...
14:32:06  Layla    scoring lead... budget clear + area specific = 6/10
14:32:08  Layla    drafting WhatsApp in English...
14:32:10  Layla    ✓ approval queued — waiting for your OK
```
Layla's card pulses blue (waiting for approval). The approval count badge increments.

**Minute 5 — Approval.**
Approval card appears in CEO chat. Presenter approves. Message "sent." Activity feed:
```
14:33:01  Layla    ✓ WhatsApp approved and sent to Ahmed Al Hashimi
```

**Minute 5.5 — CEO closes the loop.**
CEO's next heartbeat fires. CEO proactively reports:
> "Layla just handled her first lead — Ahmed Al Hashimi, JVC enquiry at 800K AED. Scored 6/10. WhatsApp sent. Omar and Noor standing by. Your agency is running."

**End.** The live activity panel shows all three agents — Layla green (just completed), Omar and Noor grey (idle, waiting for work). The whole thing took 5 minutes.

---

## Phase 1 Build Scope

### Must build:
1. **CEO agent config** — system prompt with interview playbook, two-step hiring flow, catalog, command format, cost estimation, post-run reporting, welcome-back briefing
2. **Command handler** — `server/src/services/ceo-commands.ts` — supports: `hire_team`, `pause_agent`, `resume_agent`, `pause_all`, `resume_all`, `update_agent_config`
3. **4 domain knowledge skills** — dubai-market, dubai-compliance, dubai-buyers, multilingual
4. **3 behaviour skills** — lead-response, lead-qualification, lead-followup
5. **Skill catalog** — one-line menu of all skills for CEO's prompt
6. **63 tools ported from AygentDesk** — copied from `AgentDXB/src/lib/ai/tools.ts`, Prisma → Drizzle where needed, external API calls kept as-is
7. **Database tables** — all AygentDesk models ported to Drizzle (projects, leads, activities, tags, WhatsApp messages, etc.)
8. **Project seed data** — 1,800 Dubai off-plan projects imported
9. **Live activity panel** — real-time agent status cards + scrolling activity feed, built on Paperclip's WebSocket infrastructure
10. **Demo flow** — manual issue creation triggers the full pipeline

### Not in Phase 1:
- CEO Chat UI (use Paperclip's existing issue/comment interface for the demo)
- Approval card rendering (approval is text-based in comments for now)
- Webhook receiver (leads created manually for demo)
- OAuth integration flows (credentials hardcoded in .env for demo)
- Rebrand (Paperclip UI as-is, rebranded in Phase 2)
- Push notifications
- Stripe billing

---

## Key Architectural Decisions (updates to DECISIONS.md)

### D10 (revised) — Native tools, not bash/curl or Tool Bridge
**Decision:** All 63 AygentDesk tools are copied into Aygency World as native functions. No Tool Bridge service. No AygentDesk API dependency.
**Why:** Removes network hop, removes dependency on AygentDesk being running, makes Aygency World fully self-contained. The tool code already exists — copy and adapt, don't rewrap.

### D19 (new) — CEO as company architect
**Decision:** The CEO agent interviews the user and dynamically builds the org structure. No hardcoded agent templates.
**Why:** Makes the product feel intelligent from first contact. The org is shaped by the user's actual problems, not a generic template. Also enables the generic engine (any company type) behind the Dubai RE skin.

### D20 (new) — Structured commands, not direct API calls
**Decision:** CEO emits structured JSON commands in comments. A server-side handler executes them.
**Why:** Keeps CEO's prompt focused on strategy. Server handler is testable, reliable, and retries cleanly. CEO doesn't need to know Paperclip's API schema.

### D21 (new) — Skills as role-scoping mechanism
**Decision:** Tool access is controlled by which skills are loaded into an agent's session at spawn time. No runtime permission checks.
**Why:** Simple, clean, impossible to bypass. If a skill isn't loaded, the agent doesn't know the tool exists.

### D22 (new) — Flexible org depth
**Decision:** CEO decides hierarchy depth based on company size. Flat for small, layered for large.
**Why:** A 3-agent agency doesn't need a management layer. A 15-agent agency does. Let the CEO be smart about it.

### D23 (new) — Generic engine, Dubai RE skin
**Decision:** The architecture supports any company type. Marketing, demos, and default skills are Dubai real estate only.
**Why:** Keeps the product focused for launch. Enables expansion to other verticals later without architectural changes.

### D24 (new) — Two-step hiring (structure then configuration)
**Decision:** CEO proposes team structure first, then walks through per-agent configuration before hiring. User can set personality, templates, restrictions, or say "you decide."
**Why:** Gives the user control over how their agents behave without requiring them to configure everything upfront. "You decide" is always an option. Configuration is stored in each agent's AGENTS.md and can be changed later via CEO chat.

### D25 (new) — Live activity panel
**Decision:** A real-time UI component showing agent status, current actions, and a scrolling activity feed.
**Why:** Agents working invisibly in the background isn't impressive in a demo. The audience needs to see activity happening. This is the "wow" that makes the product feel alive.

### D26 (new) — CEO proactive reporting
**Decision:** CEO proactively reports after agent actions and briefs the user on return after absence.
**Why:** The user shouldn't have to go check what happened. The CEO closes the loop — like a real CEO would walk into your office and say "here's what happened while you were out."
