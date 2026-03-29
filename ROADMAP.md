# ROADMAP.md — Build Checklist

Work through phases in order. Don't start Phase 2 tasks while Phase 1 is incomplete. Each phase has a clear goal and a demo narrative.

Mark tasks: `[ ]` not started → `[~]` in progress → `[x]` done

---

## Phase 1 — Demo (target: 2–3 days)

**Goal:** Something impressive enough to show to a potential agency customer or investor. One agency, hardcoded credentials, agents visibly working end-to-end.

**Demo narrative:** "Here's a lead that just came in via WhatsApp. Watch the Lead Agent respond in Arabic in under 5 minutes, score the lead, and queue a message for your approval — all while you were on another call."

### Setup
- [x] Fork [paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- [x] Run Paperclip locally — verify it starts and the UI loads
- [x] Configure `.env` with Anthropic API key + hardcoded agency credentials
- [ ] Verify Claude Code spawns correctly as an agent

### Company Template (minimal)
- [x] Create `companies/dubai-real-estate-agency/COMPANY.md` — CEO + Lead Agent org chart
- [x] Write CEO agent config (`agents/ceo/AGENTS.md`, `HEARTBEAT.md`)
- [x] Write Lead Agent config (`agents/lead-agent/AGENTS.md`, `HEARTBEAT.md`)
- [x] Write `skills/lead-response.md` — how to respond to a new inbound lead
- [x] Write `skills/lead-qualification.md` — qualification questions sequence
- [x] Write `skills/dubai-compliance.md` — RERA rules, never guarantee yields
- [x] Write `skills/multilingual.md` — language detection, Arabic/Russian/English tone

### Skill-based tool integration (bash/curl → AygentDesk API)
- [x] Configure AygentDesk API endpoint as env var (`AYGENTDESK_URL`)
- [ ] Add AygentDesk API key as Paperclip secret for the demo company
- [x] Write skill: `skills/tools/search-leads.md` (curl to AygentDesk)
- [x] Write skill: `skills/tools/update-lead.md`
- [x] Write skill: `skills/tools/send-whatsapp.md`
- [x] Write skill: `skills/tools/search-whatsapp.md`
- [ ] Test: Lead Agent can search leads, update a lead, draft a WhatsApp via curl

### Demo flow test
- [ ] Manually create a fake inbound lead in Paperclip as an issue
- [ ] Trigger Lead Agent heartbeat
- [ ] Agent detects lead, runs qualification skill, drafts WhatsApp response
- [ ] Response visible in Paperclip's UI as a task completion
- [ ] CEO heartbeat runs, picks up result, generates brief

### Rebrand (minimal)
- [ ] Replace Paperclip logo with Aygency World logo
- [ ] Update product name in UI (title, nav, page headers)
- [ ] Update colour scheme to Aygency World palette

**Phase 1 complete when:** You can show the demo narrative above end-to-end.

---

## Phase 2 — Alpha (target: 1–2 weeks)

**Goal:** A real agency can sign up, connect their WhatsApp and Gmail, and have agents actually running on their real leads.

### CEO Chat UI
- [ ] Create `CEO Chat` persistent issue per company on first login
- [ ] Build CEO Chat React component — chat thread rendering from Paperclip comments API
- [ ] Render owner messages (left) and CEO messages (right) as chat bubbles
- [ ] Approval card component — WhatsApp send card (preview, approve/edit/reject)
- [ ] Approval card component — Email send card
- [ ] Approval card component — Instagram post card
- [ ] Approval card component — Lead escalation card
- [ ] Morning brief pinned card (parsed from CEO's daily summary comment)
- [ ] Quick action bar: "Brief me", "What's pending?", "Pause all agents"
- [ ] Unread indicator badge on CEO Chat nav item

### Onboarding wizard
- [ ] Step 1: Agency name, logo upload, focus area, size
- [ ] Step 2: Connect WhatsApp (paste credentials flow — manual for now)
- [ ] Step 2: Connect Gmail (Google OAuth)
- [ ] Step 3: CEO agent hired → CEO Chat opens
- [ ] CEO runs onboarding interview (4 strategic questions)
- [ ] CEO generates agent team proposal as approval card
- [ ] Owner approves → sub-agents created in Paperclip

### Demo mode
- [ ] Detect when no OAuth credentials connected
- [ ] Seed demo company data (12 fake leads, 1 week of agent activity, 3 pending approvals)
- [ ] Show demo morning brief from CEO
- [ ] Show 3 pending approval cards (WhatsApp, Instagram post, pitch deck)
- [ ] CTA: "Connect your real agency to go live"

### Agent credential store
- [ ] Create `agent_credentials` table in Drizzle schema
- [ ] Encrypt tokens at rest (AES-256)
- [ ] API: store, retrieve, update credentials per agent
- [ ] All tool calls load agent credentials before executing

### Webhook Receiver service
- [ ] Create `services/webhook-receiver/` Express service (port 3003)
- [ ] WhatsApp inbound webhook handler + Meta signature verification
- [ ] Webhook demultiplexer: `phone_number_id` → `agent_id` lookup → create Paperclip issue
- [ ] Gmail Push Notification handler (Google Cloud Pub/Sub)
- [ ] Parse Property Finder notification email format → lead record
- [ ] Parse Bayut notification email format → lead record
- [ ] Landing page form submission handler
- [ ] Retry logic for failed issue creation

### Token refresh worker
- [ ] Background job (every 30 min) checks tokens expiring within 24 hours
- [ ] Auto-refresh Gmail tokens using refresh token
- [ ] On refresh failure: pause agent + push notification to owner

### Push notifications (PWA)
- [ ] Service worker setup
- [ ] VAPID key configuration
- [ ] Notification triggers: approval pending batch, urgent escalation, morning brief ready
- [ ] Owner WhatsApp notification for urgent escalations (hot leads)

**Phase 2 complete when:** A real agency can sign up, connect their WhatsApp + Gmail, and receive a real inbound lead that the Lead Agent processes, scores, drafts a response for, and queues for approval.

---

## Phase 3 — Beta (target: 2–4 weeks)

**Goal:** Production-ready. Multiple agencies running. Billing active.

### MCP Server
- [ ] Create `services/tool-bridge/` MCP server (port 3002)
- [ ] Implement all 53 AygentDesk tools as MCP tool definitions
- [ ] Role-to-tool mapping enforcement (Lead Agent can't call post_to_instagram)
- [ ] Per-agency credential resolution from `agent_credentials` table
- [ ] Replace bash/curl skills with proper MCP tool calls in agent configs
- [ ] Test all 53 tools end-to-end

### All agent roles
- [ ] Content Agent — config + skills (generate_social_content, post_to_instagram, pitch decks)
- [ ] Market Intelligence Agent — config + skills (DLD monitoring, listing surveillance)
- [ ] Viewing Agent — config + skills (calendar, confirmations, post-viewing follow-up)
- [ ] Portfolio Agent — config + skills (landlord, tenancy, RERA rent)
- [ ] Call Agent — config + skills (Twilio + Gemini Live, inbound + outbound)

### Per-agent WhatsApp (full flow)
- [ ] Agent setup UI — "Connect WhatsApp" button during agent hire
- [ ] 360dialog ISV partner integration (replace manual paste with Embedded Signup)
- [ ] Per-agent webhook routing (demultiplexer handles all numbers)
- [ ] Per-broker WhatsApp (same flow, scoped to human broker profile)

### Human broker features
- [ ] Broker invite flow (email invite → profile setup → WhatsApp connect)
- [ ] Broker view (mobile-first, assigned leads only)
- [ ] Lead escalation → broker assignment flow
- [ ] Human action sync (WhatsApp logged, manual viewing captured)
- [ ] 2-hour follow-up if broker doesn't contact after assignment

### Multilingual
- [ ] Language detection on every inbound message
- [ ] Skill: Arabic tone and greeting rules
- [ ] Skill: Russian tone (metrics-first, direct)
- [ ] Translation toggle in approval cards
- [ ] Language stored and remembered per lead

### Stripe billing
- [ ] Stripe customer created on signup
- [ ] Subscription tiers: Starter / Growth / Scale
- [ ] Usage metering: agent runs reported to Stripe daily
- [ ] Budget cap enforcement (pause agent at 100%)
- [ ] 80% warning notification
- [ ] Failed payment → grace period → pause agents
- [ ] Customer billing portal (self-service)
- [ ] AI Calling add-on (Twilio usage pass-through)

### Analytics dashboard
- [ ] Lead pipeline velocity (time per stage)
- [ ] Response time metrics (actual vs 5-min target)
- [ ] Agent cost vs output (cost per lead, cost per viewing)
- [ ] Content performance (engagement per post)
- [ ] Conversion rate by lead source

### Auth & team access
- [ ] Manager role (full access except billing)
- [ ] Broker role (assigned leads only)
- [ ] Viewer role (read-only metrics)
- [ ] Team invite flow (email invite → role assignment)

**Phase 3 complete when:** Stripe is live, multiple real agencies are running, all 6 agent roles work, MCP replaces bash skills, billing is active.

---

## Phase 4 — Production features (ongoing)

- [ ] AI Calling Agent live (Twilio + Gemini 2.0 Flash Live)
- [ ] Property Finder email parsing (real-time lead ingestion)
- [ ] 360dialog → direct Meta Tech Provider migration (at 10+ agencies)
- [ ] White-label enterprise tier
- [ ] Gemini Embedding 2 for semantic lead-to-project matching
- [ ] Agency context auto-learning (agents update knowledge base from patterns observed)
- [ ] AygentDesk ↔ Aygency World shared lead database
- [ ] Mobile app (React Native or PWA upgrade)
- [ ] Arabic UI localisation

---

## Business actions (parallel to building)

- [ ] Sign up as 360dialog ISV partner — [360dialog.com/partners](https://360dialog.com/partners)
- [ ] Register business entity (free zone license — IFZA, Meydan, or Shams)
- [ ] Set up aygencyworld.com domain
- [ ] Build Privacy Policy + Terms of Service pages (required for Meta + Stripe)
- [ ] Set up Meta Business Manager + verify business
- [ ] Apply for Meta Tech Provider (when 10+ agencies live)
- [ ] Set up Stripe account
- [ ] Set up Google Cloud project (for Gmail Pub/Sub push notifications)
