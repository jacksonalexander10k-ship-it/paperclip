# Aygency World — Pricing & Business Model

**Last updated:** 2026-03-31

---

## The Value Proposition (What We Replace)

| Human Role | Monthly Cost (AED) | Aygency World Agent Equivalent |
|------------|-------------------|-------------------------------|
| Admin / coordinator | 5,000–8,000 | CEO Agent (delegation, briefs, reporting) |
| Junior salesperson | 8,000–12,000 | Sales Agent (lead response, qualification, follow-up) |
| Social media freelancer | 2,000–5,000 | Content Agent (Instagram, pitch decks, landing pages) |
| Media buyer | 10,000–15,000 | Marketing Agent (Facebook Ads, Google Ads, performance) |
| Finance / bookkeeper | 5,000–8,000 | Finance Agent (cost tracking, budgets, reporting) |
| Full back-office (3–4 people) | 25,000–40,000 | 5 agents on Growth tier |

**Our price must be dramatically less than one human hire.**

---

## Pricing Tiers

All prices in AED. Annual billing = 20% discount (2 months free).

| Tier | Agents | Monthly | Annual (per month) | Target Segment |
|------|--------|---------|-------------------|----------------|
| **Starter** | CEO + 2 | **AED 999** | AED 799 | Solo broker, 1–3 person shop |
| **Growth** | CEO + 4 | **AED 1,499** | AED 1,199 | Small agency, 5–10 brokers |
| **Scale** | CEO + 8 | **AED 2,499** | AED 1,999 | Established agency, 10–20 brokers |
| **Enterprise** | CEO + unlimited + white-label | **Custom** | Custom | 50+ brokers, sales-led |

**No per-agent add-ons. No compute metering. No overage fees.** One flat price per tier. Need more agents? Upgrade to the next tier. Need 15+? Enterprise.

CEO is always included — it's the core of the platform, not a billable agent.

### Why AED 999 Starter (Not AED 749)

AED 749 loses money on heavy users. AED 999:
- Still less than the cheapest hire in Dubai (AED 5,000+)
- Break-even on heavy use, profitable on average use
- Nobody choosing between us and a AED 5,000 employee cares about 999 vs 749
- Gives room for "Founding Agency" launch discount to 799 without destroying margins

### 7-Day Free Trial (Already Built)

Sign up → 7 days on Starter (CEO + 2 agents) → card required upfront → converts or cancels.

During trial: CEO sends morning briefs, Sales Agent responds to leads, approval cards flow. Enough to prove value.

---

## What's Included in All Tiers

- CEO Chat (streaming, approval cards, delegation)
- All agent roles (Sales, Content, Marketing, Finance, Viewing, Portfolio)
- WhatsApp integration (agency connects their own numbers via 360dialog)
- Facebook Ads integration (agency connects their own ad account)
- Dashboard + analytics
- Mobile access
- Approval system (approve, reject, edit-before-approve)
- WhatsApp conversation view (all agent messages visible in dashboard)

### What's NOT Included (Add-ons / Pass-through)

| Add-on | Cost | Notes |
|--------|------|-------|
| WhatsApp conversations | Pass-through (Meta fees) | ~AED 75/mo typical. Included in first 3 months, then billed |
| AI Video generation (Veo 3.1) | 5 videos/mo included, then AED 20/video | Prevents one agency eating margins |
| AI Calling (Phase 4) | Per-minute (Twilio cost + 20% margin) | Usage add-on |

### What's Absorbed (Not Charged)

- Claude API tokens — absorbed in tier price
- Gemini Flash API — absorbed (free/negligible)
- Image generation (Nanobana 2) — absorbed (~AED 11/mo, negligible)
- 360dialog platform fee — absorbed
- Infrastructure — absorbed

---

## AI Model Strategy (Cost Optimisation)

### The Full Model Landscape (Updated April 2026)

| Model | Input (per 1M) | Output (per 1M) | Quality | Speed | Best for |
|-------|---------------|-----------------|---------|-------|----------|
| **Ollama (local)** | **$0** | **$0** | Good (Llama 4, Qwen 3) | Medium | Routing, classification, scoring — anything that doesn't need the best quality |
| **Gemini 3.1 Flash Lite** | **$0.25** | **$1.50** | Very good | **Extremely fast (382 tok/s)** | Context assembly, qualification flows, analysis, scheduling |
| **Gemini 2.5 Flash** | $0 (free 500 req/day) / $0.15 paid | $0 / $0.60 | Good | Fast | Fallback for free-tier tasks |
| **DeepSeek V3** | $0.27 | $1.10 | Good | Fast | General tasks, analysis, reporting |
| **Gemini 3.1 Pro** | **$2.00** | **$12.00** | **Excellent** | Medium | Customer-facing writing, agent heartbeats, CEO Chat |
| **Sonnet 4.6** | $3.00 | $15.00 | Excellent | Medium | Premium "Deep Think" mode (Scale/Enterprise only) |
| **Opus 4.6** | $15.00 | $75.00 | Best | Slow | Never use for agents — too expensive |

### Why Gemini 3.1 Pro Over Sonnet for Default Quality Tier

Research (April 2026 benchmarks):

- **Writing quality:** Sonnet 4.6 has a slight edge in emotionally nuanced, personal writing. Gemini 3.1 Pro is stronger in structured, informative content. For real estate messages (professional, data-driven, factual), both are excellent — Gemini is arguably better.
- **Reasoning:** Gemini 3.1 Pro leads significantly on ARC-AGI-2, GPQA Diamond, and HLE (18-25 point gaps). Doubled reasoning performance over Gemini 3.0.
- **Tool use:** Gemini 3.1 Pro has a "customtools" variant that prioritises registered tools over generic fallback — perfect for our MCP tool setup. Suppresses bash fallback, actively chooses registered functions.
- **Multimodal:** Native text/image/audio/video/PDF in one model. Useful for reading property brochures, analysing listing photos.
- **Context window:** 1M tokens input, 64K output. More than enough.
- **Cost:** 24% cheaper than Sonnet on input, 20% cheaper on output. Compounds across thousands of runs.
- **Rate limits:** More generous than Anthropic at paid tiers. 30K RPM system limit on Vertex AI.
- **Knowledge work (one caveat):** Sonnet 4.6 leads on GDPval-AA (Elo 1,633 vs Gemini's 1,317) for expert-level tasks like financial modelling. But our agents write WhatsApp messages, not research papers.
- **Agent reliability (one caveat):** Sonnet has marginally better multi-step tool chain reliability. For our use case (2-5 tool calls per heartbeat, not 20+ step chains), this doesn't matter.

**Verdict:** Gemini 3.1 Pro is the right default. Better reasoning, better tool use, native multimodal, 24% cheaper. Keep Sonnet as premium "Deep Think" for owners who want the absolute best on a specific question.

### The Four-Tier Model Strategy

**Tier 1 — FREE (Ollama local, $0)**
Run Llama 4 Scout 17B or Qwen 3 8B locally on your VPS. Zero API cost. Handles:
- Event routing: "what type of event is this? which agent handles it?"
- Lead scoring: "score 1-10 based on these signals"
- Classification: "is this a new lead, a follow-up, or spam?"
- Template selection: "which WhatsApp template fits this situation?"
- Simple decisions: "does this need a human or can the agent handle it?"

Cost: $0. Just CPU/GPU on your VPS. One $40/mo GPU instance runs thousands of requests/day.

**Tier 2 — CHEAP (Gemini 3.1 Flash Lite, ~$0.002 per run)**
For tasks that need intelligence but aren't customer-facing:
- Morning brief data assembly and summarisation
- Lead qualification flows (structured Q&A)
- Ad performance analysis and recommendations
- Content queue planning and scheduling
- Agency context updates
- Report generation

382 tokens/sec — 2.5x faster than Gemini 2.5 Flash. Quality benchmarks score well above median for its price tier (Intelligence Index: 34 vs median 19). 1M token context window.

Cost: ~$0.002 per run average.

**Tier 3 — QUALITY (Gemini 3.1 Pro, ~$0.016 per run)**
For output that a customer or the agency owner will read:
- WhatsApp message drafting (leads read this)
- CEO Chat responses (owner reads this)
- Instagram post captions (public)
- Pitch deck content (client-facing)
- Email drafts (leads/landlords read this)
- Full agent heartbeats with tool use

Cost: ~$0.016 per run (~2K input, 1K output tokens). 24% cheaper than Sonnet.

**Tier 4 — PREMIUM (Sonnet 4.6, ~$0.021 per run) — Scale/Enterprise only**
For "Deep Think" mode — owner toggles this in CEO Chat for specific questions:
- Complex investment analysis
- Multi-property comparison strategy
- Nuanced negotiation advice
- 50 runs/month on Scale, unlimited on Enterprise

### Optimised: Gemini Pro Only Writes the Final Message

Instead of a full session for every agent run:

```
OLD (expensive):
  Event → Sonnet session → reads context → reasons → decides → writes message → $0.35

NEW (cheap):
  Event → Ollama routes it (free)
  → Gemini 3.1 Flash Lite assembles context + decides action ($0.002)
  → IF message needed: Gemini 3.1 Pro writes ONLY the message ($0.016)
  → Total: $0.018 instead of $0.35 — 95% cost reduction
```

Gemini Pro never reads the full context. It receives a pre-assembled brief: "Write a WhatsApp follow-up to Ahmed, budget AED 1.2M, interested in JVC, speaks Arabic, last contact 48h ago." Gemini Pro writes the message and nothing else.

### The Task-to-Model Map

| Task | Tier | Model | Cost/run |
|------|------|-------|----------|
| Event routing / classification | 1 (Free) | Ollama (Llama 4 Scout) | $0 |
| Lead scoring | 1 (Free) | Ollama | $0 |
| Template selection | 1 (Free) | Ollama | $0 |
| "Is this spam?" check | 1 (Free) | Ollama | $0 |
| Morning brief assembly | 2 (Cheap) | Gemini 3.1 Flash Lite | $0.002 |
| Lead qualification flow | 2 (Cheap) | Gemini 3.1 Flash Lite | $0.002 |
| Ad performance analysis | 2 (Cheap) | Gemini 3.1 Flash Lite | $0.003 |
| Content queue planning | 2 (Cheap) | Gemini 3.1 Flash Lite | $0.002 |
| Report generation | 2 (Cheap) | Gemini 3.1 Flash Lite | $0.003 |
| Complex strategy (CEO delegation) | 3 (Quality) | Gemini 3.1 Pro | $0.016 |
| WhatsApp message draft | 3 (Quality) | Gemini 3.1 Pro | $0.016 |
| CEO Chat response | 3 (Quality) | Gemini 3.1 Pro | $0.016 |
| Instagram caption | 3 (Quality) | Gemini 3.1 Pro | $0.016 |
| Pitch deck content | 3 (Quality) | Gemini 3.1 Pro | $0.020 |
| Email draft | 3 (Quality) | Gemini 3.1 Pro | $0.016 |
| Deep Think (CEO, on-demand) | 4 (Premium) | Sonnet 4.6 | $0.021 |

### No Heartbeat Polling — Event-Driven Only

Agents do NOT run on timers checking for work. They are event-driven:

| Agent | Triggered by | Scheduled |
|-------|-------------|-----------|
| CEO | Owner message, escalation from sub-agent | 1x daily morning brief (8am) |
| Sales | New lead webhook, WhatsApp reply webhook, CEO delegation | None |
| Content | CEO request, issue created | 1x daily content queue (9am) |
| Marketing | CEO request, budget alert | 1x daily ad performance check |
| Finance | CEO request | 1x daily cost summary (8am) |
| Viewing | Lead requests viewing, CEO delegates | None |
| Portfolio | CEO delegates | 1x daily renewal check (cron, not AI) |

**Total scheduled AI runs per day across ALL agents: 4.**
Everything else is triggered by real events. If nothing happens, nothing runs, nothing costs.

### Ollama Infrastructure Cost

Run Ollama on a dedicated GPU instance alongside your VPS:

| Provider | GPU | Cost/mo | Handles |
|----------|-----|---------|---------|
| Hetzner (GPU) | RTX 3090 | ~$120/mo | Thousands of requests/day, all Tier 1 tasks |
| Lambda Labs | A10 | ~$150/mo | Same |
| RunPod | RTX 4090 | ~$180/mo | Same, faster |

Or run on your existing VPS CPU-only (slower but works for classification tasks). $0 extra.

At 50 agencies: $120/mo for a GPU instance handling ALL Tier 1 routing for every agency. That's $2.40/agency/month for unlimited free AI routing.

---

## Cost Per Agency — With Gemini 3.1 Model Optimisation

### How Every Agent Run Actually Works

```
Event arrives (webhook, CEO message, scheduled cron)
  → Ollama classifies + routes (FREE)
  → Gemini 3.1 Flash Lite assembles context + decides action (~$0.002)
  → IF customer-facing output needed:
      Gemini 3.1 Pro writes ONLY the message with pre-assembled context ($0.016)
  → IF no output needed (just internal state update):
      Done. Total cost: $0.002
```

### Starter Tier (CEO + 2 Agents)

**Light Use** — Solo broker, 2–3 leads/day, occasional CEO chat

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (CEO chat × 3/day, WA drafts × 5/day = 240 runs @ $0.016) | $4 |
| Gemini 3.1 Flash Lite (routing, scoring, brief = 300 runs @ $0.002) | $1 |
| Ollama (classification, all routing) | $0 |
| WhatsApp (Meta fees) | $10 |
| Image generation | $2 |
| 360dialog share (10 agencies) | $55 |
| Infrastructure + Ollama GPU share | $7 |
| **Total USD** | **$79** |
| **Total AED** | **~AED 290** |
| **Revenue AED** | **999** |
| **Margin** | **AED 709 (71%)** |

**Average Use** — Active agency, 5 leads/day, daily CEO interaction

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (CEO × 8/day, WA × 10/day, content × 2/day = 600 runs @ $0.016) | $10 |
| Gemini 3.1 Flash Lite (700 runs @ $0.002) | $2 |
| Ollama | $0 |
| WhatsApp (Meta fees) | $20 |
| Image generation | $3 |
| 360dialog share | $55 |
| Infrastructure share | $7 |
| **Total USD** | **$97** |
| **Total AED** | **~AED 356** |
| **Revenue AED** | **999** |
| **Margin** | **AED 643 (64%)** |

**Heavy Use** — Busy agency, 10+ leads/day, constant CEO chat

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (CEO × 15/day, WA × 20/day, content × 4/day = 1,170 runs @ $0.016) | $19 |
| Gemini 3.1 Flash Lite (1,500 runs @ $0.002) | $3 |
| Ollama | $0 |
| WhatsApp (Meta fees) | $40 |
| Image generation | $5 |
| 360dialog share | $55 |
| Infrastructure share | $7 |
| **Total USD** | **$129** |
| **Total AED** | **~AED 473** |
| **Revenue AED** | **999** |
| **Margin** | **AED 526 (53%)** |

**Starter verdict: 53% margin even on heavy users.** Gemini 3.1 eliminates the thin-margin risk entirely.

### Growth Tier (CEO + 4 Agents) — THE MONEY MAKER

**Average Use** — 4 agents active, 8 leads/day, content + marketing running

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (all customer-facing across 5 agents = 900 runs @ $0.016) | $15 |
| Gemini 3.1 Flash Lite (1,200 runs @ $0.002) | $3 |
| Ollama | $0 |
| WhatsApp (Meta, 3 numbers) | $40 |
| Image generation | $5 |
| Video generation (3 videos) | $30 |
| 360dialog share | $55 |
| Infrastructure share | $7 |
| **Total USD** | **$155** |
| **Total AED** | **~AED 569** |
| **Revenue AED** | **1,499** |
| **Margin** | **AED 930 (62%)** |

**Heavy Use** — All 4 agents active, 15+ leads/day

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (1,800 runs @ $0.016) | $29 |
| Gemini 3.1 Flash Lite (2,500 runs @ $0.002) | $5 |
| Ollama | $0 |
| WhatsApp + images + video | $85 |
| 360dialog + infra | $62 |
| **Total USD** | **$181** |
| **Total AED** | **~AED 664** |
| **Revenue AED** | **1,499** |
| **Margin** | **AED 835 (56%)** |

**Growth verdict: 56% margin even on heavy users.** vs 17% with Sonnet.

### Scale Tier (CEO + 8 Agents)

**Average Use**

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (1,500 runs @ $0.016) | $24 |
| Gemini 3.1 Flash Lite (2,000 runs @ $0.002) | $4 |
| Ollama | $0 |
| WhatsApp + images + video | $75 |
| 360dialog + infra | $62 |
| **Total USD** | **$165** |
| **Total AED** | **~AED 605** |
| **Revenue AED** | **2,499** |
| **Margin** | **AED 1,894 (76%)** |

**Heavy Use**

| Cost | Monthly |
|------|---------|
| Gemini 3.1 Pro (3,000 runs @ $0.016) | $48 |
| Gemini 3.1 Flash Lite (4,000 runs @ $0.002) | $8 |
| Ollama | $0 |
| WhatsApp + images + video | $120 |
| 360dialog + infra | $62 |
| **Total USD** | **$238** |
| **Total AED** | **~AED 873** |
| **Revenue AED** | **2,499** |
| **Margin** | **AED 1,626 (65%)** |

### Summary — All Tiers, All Scenarios (Gemini 3.1 vs old Sonnet strategy)

| | Starter (AED 999) | Growth (AED 1,499) | Scale (AED 2,499) |
|--|--|--|--|
| **Light use margin** | **71%** (was 63%) | **73%** (was 60%) | **80%** (was 66%) |
| **Average use margin** | **64%** (was 45%) | **62%** (was 43%) | **76%** (was 56%) |
| **Heavy use margin** | **53%** (was 15%) | **56%** (was 17%) | **65%** (was 30%) |

**Every tier is massively profitable.** The Gemini 3.1 switch turns heavy users from margin risk (15%) to strong profit (53%). The four-tier model strategy (Ollama free → Flash Lite cheap → Gemini Pro quality → Sonnet premium) is the key.

---

## Revenue Projections

### Year 1 — Ramp to 50 Agencies

| Month | Starter | Growth | Scale | MRR (AED) |
|-------|---------|--------|-------|-----------|
| 1–3 | 5 | 0 | 0 | 4,995 |
| 4–6 | 10 | 5 | 0 | 17,485 |
| 7–9 | 15 | 12 | 3 | 40,482 |
| 10–12 | 15 | 20 | 10 | 69,965 |

**Month 12 MRR: ~AED 70,000 ($19,000)**

### Year 1 — Costs at Month 12 (45 agencies, Gemini 3.1 strategy)

| Cost | Monthly (AED) |
|------|--------------|
| Gemini 3.1 Pro API (quality tier, all agencies) | 4,500 |
| Gemini 3.1 Flash Lite API (cheap tier) | 550 |
| Sonnet API (Deep Think, Scale/Enterprise only) | 500 |
| Ollama GPU instance | 450 |
| 360dialog | 2,000 |
| WhatsApp (Meta, all agencies) | 3,500 |
| Image/video generation | 2,000 |
| VPS infrastructure | 750 |
| **Total** | **14,250** |

**Month 12: AED 70,000 revenue − AED 14,250 costs = AED 55,750 gross margin (80%)**

vs old Sonnet strategy: AED 37,750 costs, 46% margin. Gemini 3.1 saves AED 23,500/month.

### The AygentDesk Cross-Sell (Revenue Multiplier)

Each Aygency World agency has human brokers. Each broker is a potential AygentDesk subscriber at AED 199/mo.

| | Agencies | Avg brokers each | AygentDesk subs | Additional MRR (AED) |
|--|--|--|--|--|
| Month 6 | 15 | 6 | 30 (33% adoption) | 5,970 |
| Month 12 | 45 | 8 | 120 (33% adoption) | 23,880 |

**Month 12 combined MRR: AED 70,000 + AED 23,880 = AED 93,880 ($25,600)**

---

## Fixed Costs (Not Per-Agency)

| Cost | Monthly (AED) | Notes |
|------|--------------|-------|
| 360dialog Partner Platform | 2,000 | Fixed regardless of agency count |
| VPS (DigitalOcean / Hetzner) | 550–750 | Scale as needed |
| Domain + SSL | 15 | Negligible |
| Stripe fees (2.9% + 30c) | ~2% of revenue | |
| Your time | 0 (founder) | Until you hire |
| **Total fixed** | **~AED 2,750/mo** |

Break-even on fixed costs alone: 3 Starter agencies.

---

## Pricing Page Structure

### Displayed to Customer

| | Starter | Growth (RECOMMENDED) | Scale |
|--|--|--|--|
| | **AED 999/mo** | **AED 1,499/mo** | **AED 2,499/mo** |
| AI Agents | CEO + 2 | CEO + 4 | CEO + 8 |
| CEO Chat | Yes | Yes | Yes |
| WhatsApp Integration | Yes | Yes | Yes |
| Facebook Ads Management | — | Yes | Yes |
| AI Image Generation | Yes | Yes | Yes |
| AI Video Generation | — | 5/month | 20/month |
| Analytics Dashboard | Basic | Full | Full + API |
| Broker Access | — | 5 brokers | Unlimited |
| Support | Email | Priority | Dedicated |

### What's NOT on the pricing page

- No mention of tokens, API calls, or models
- No per-message fees (absorbed)
- No complexity — flat monthly fee, that's it
- Customer thinks: "AED 999 for my AI team" — not "how many tokens will I use"

---

## Launch Strategy

### Founding Agency Offer (First 20 Agencies)

"Lock in AED 799/mo for life on any tier" (20% below launch price).

| Tier | Launch | Founding Agency |
|------|--------|----------------|
| Starter | 999 | **799** |
| Growth | 1,499 | **1,199** |
| Scale | 2,499 | **1,999** |

Creates urgency. First 20 agencies get grandfathered pricing forever. After 20 slots filled, full price.

### Price Increases (6–12 Months Out)

Once you have case studies and proven ROI:

| Tier | Launch | Future |
|------|--------|--------|
| Starter | 999 | 1,299 |
| Growth | 1,499 | 1,999 |
| Scale | 2,499 | 3,499 |

Existing customers grandfathered. New customers pay more. Standard SaaS playbook.

---

## How Agents Work

### Departments (Hardcoded)

Every agent belongs to a department. These are fixed — they organise the agency and determine defaults.

| Department | Default Tools | Default Skills | Default Schedule |
|-----------|--------------|---------------|-----------------|
| **Executive** | All 62 (read access) | delegation, morning-brief, escalation | 1x daily + event-driven |
| **Sales** | leads, WhatsApp, email, follow-ups, tagging | lead-response, lead-qualification, lead-handoff | Event-driven only |
| **Content** | social, pitch decks, landing pages, campaigns | content-instagram, content-pitch-deck, copywriting | 1x daily + on-demand |
| **Marketing** | ads, analytics, DLD, listings, news | facebook-ads, market-analysis, campaign-optimisation | 1x daily + on-demand |
| **Operations** | calendar, viewings, documents, portals | viewing-scheduling, portfolio-management | Event-driven only |
| **Finance** | costs, budgets, billing | cost-reporting, budget-alerts | 1x daily |

Departments can't be created or deleted by the user. They're the fixed structure.

### Hiring — Flexible Within Departments

The owner tells the CEO what they need. The CEO hires into the right department with appropriate customisation.

```
Owner: "I need someone to handle our off-plan leads"
CEO creates:
  Name: Layla
  Department: Sales
  Tools: [default Sales tools]
  Skills: [default Sales skills]
  Instructions: "Handle off-plan leads. Focus on JVC, Sports City, Dubai Hills."
```

The CEO can customise any agent after hiring:
- **Add tools** from any department (Sales agent can get `post_to_instagram` if needed)
- **Remove tools** (Sales agent can lose email access if owner prefers WhatsApp only)
- **Custom instructions** (language preferences, area focus, tone, blacklists)
- Only the CEO can modify tool access — agents cannot give themselves new tools

### Why More Agents = Better

Two agents can only think about two things at once. When events pile up:

- **2 agents:** New lead waits while Sales agent finishes a pitch deck
- **4 agents:** Lead handled immediately, pitch deck separate, Instagram post queued, all concurrent
- **8 agents:** Dedicated agents per function, specialised context, instant response to everything

The product sells the upgrade naturally. Owners feel the bottleneck and upgrade.

### Skills — How Agents Learn

Skills are markdown files that teach agents HOW to do things. Not what they CAN do (that's tools) but how they SHOULD do it.

**Three ways skills get created:**

1. **Pre-built (shipped with platform):** 27 skills covering Dubai RE compliance, lead handling, multilingual tone, RERA rules. Every agency gets these by default.

2. **CEO extracts from conversation:**
   ```
   Owner: "When a lead mentions investment, always ask about rental yield target"
   CEO: "Got it. I'll add that as a skill for the Sales team."
   → Creates investment-qualifier.md, assigns to Sales agents
   ```

3. **Owner writes directly:** Settings → Agent → Skills. Plain text, system wraps it as markdown.

### Landing Pages, Pitch Decks, Websites

These are NOT built by a "Developer Agent." They're tools that existing agents call:
- `generate_landing_page` — template + Sonnet writes copy ($0.10)
- `generate_pitch_deck` — template + Sonnet writes content ($0.15)
- `generate_pitch_presentation` — template + Sonnet writes narrative ($0.15)

Pre-built templates for Dubai RE (project launch, developer showcase, broker profile, open house). Agent picks the right template and fills in content. No Opus needed. Can't be abused — it's template filling, not code generation.

### Opus Access (Premium Feature)

Opus is reserved for rare, high-stakes moments:

| Tier | Opus Access |
|------|------------|
| Starter | None |
| Growth | None |
| Scale | 50 Opus runs/month (CEO strategy, complex analysis) |
| Enterprise | Unlimited |

At $1.20/run, 50 runs = $60/month. Absorbed into Scale margin. Differentiates premium tiers.

Owner can toggle "Deep Think" in CEO Chat for a specific question → that response uses Opus.

---

## WhatsApp Integration (360dialog)

### Current Status

- 360dialog Partner Platform signed up (€500/mo)
- Sandbox API key active, test messages sent and received
- Webhook route built (`/webhook/whatsapp`)
- Up to 3 WhatsApp numbers before Meta Tech Provider registration

### How Agencies Connect

Agency connects WhatsApp via 360dialog Embedded Signup:
1. Owner clicks "Connect WhatsApp" on agent setup screen
2. 360dialog Connect Button popup opens
3. Agency logs into Meta Business, selects their number
4. Popup closes → `channel_created` webhook fires
5. Server generates API key via Partner API → stores in `agent_credentials`
6. Agent is live on WhatsApp

### Per-Number Limits (Meta)

| Tier | Daily Limit | How to Reach |
|------|------------|-------------|
| Unverified | 250 conversations/day | Starting point |
| Tier 1 | 1,000/day | Verify Meta Business account |
| Tier 2 | 10,000/day | Green quality rating sustained |
| Tier 3 | 100,000/day | High volume + Green |

250/day is plenty for any agency starting out. Auto-upgrades as volume grows.

### Message Visibility

The owner CANNOT see WhatsApp messages on a phone — connecting to the API disconnects the phone app. All messages are visible in the Aygency World dashboard:
- Click into any agent → see all their WhatsApp conversations
- Full chat thread per lead: messages in/out, timestamps, delivery/read status
- Stored in `whatsapp_messages` table (zero extra AI cost — just data)

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Value metric | Per tier (flat) | Simple, no surprises, upgrade for more agents |
| Starter price | AED 999 | Below any human hire, profitable on average use |
| Growth price | AED 1,499 | CEO + 4 agents, replaces 3–4 human roles at 10% of the cost |
| Model strategy | Sonnet (customer-facing) + Gemini Flash (everything else) | Cuts AI costs 50–60% |
| Heartbeat model | Event-driven, not polling | Eliminates idle AI spend |
| WhatsApp costs | Absorbed initially, pass-through later | Reduces friction at signup |
| Video generation | Capped per tier + overage | Prevents cost blowout |
| Trial | 7 days, card required | Filters serious buyers |
| Currency | AED (primary), USD (secondary) | Dubai market, local mental model |
| Annual discount | 20% | Standard, encourages commitment |
