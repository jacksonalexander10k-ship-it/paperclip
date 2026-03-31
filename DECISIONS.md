# DECISIONS.md — Architectural Decisions

Every significant decision made during planning. Do not re-debate these without a strong reason. If a decision needs revisiting, note it here with context.

---

## Product

### D1 — Fork Paperclip, don't build from scratch
**Decision:** Fork [paperclipai/paperclip](https://github.com/paperclipai/paperclip) and extend it.
**Why:** Paperclip gives us agent orchestration, heartbeat scheduler, task checkout, cost tracking, activity log, org chart, multi-tenancy, and a React UI — all for free. Building this from scratch would take months.
**Trade-off:** We maintain a fork. If Paperclip makes breaking changes upstream, we have to merge carefully.

### D2 — Don't use Paperclip as-is via plugin
**Decision:** Fork it rather than use it as a black-box service + plugin.
**Why:** We need to replace the UI (CEO chat), add the onboarding wizard, add approval cards, and rebrand it. None of this is possible with the plugin system alone.

### D3 — Separate from AygentDesk (different codebase, different service)
**Decision:** Aygency World is a completely separate codebase and service from AygentDesk.
**Why:** Different tech stacks (Paperclip = Node.js/Drizzle vs AygentDesk = Next.js/Prisma). They share tools via the Tool Bridge — not code.

### D4 — CEO chat is the owner's primary interface
**Decision:** The owner never interacts with sub-agents directly. One relationship: owner ↔ CEO. CEO delegates down, reports up.
**Why:** Mirrors how a real agency works. Reduces cognitive overhead. Owner gives direction, not instructions to individual workers.

### D5 — Per-agent identity (each agent gets its own WhatsApp + email)
**Decision:** Each hired AI agent has its own WhatsApp number and email address at the agency's domain. Not shared numbers, not platform-provided numbers.
**Why:** Clients maintain a consistent point of contact ("Sarah from Dubai Properties"). The agency owns the numbers and the relationships. Aygency World has zero infrastructure liability for communications.

### D6 — Approval before every external action
**Decision:** No WhatsApp sent, no email fired, no Instagram post published without an approval card in the CEO chat.
**Why:** Trust and safety. Agents can make mistakes. Owners must stay in control of what goes out under their brand.

---

## Tech Stack

### D7 — better-auth (not NextAuth)
**Decision:** Use Paperclip's built-in `better-auth` for authentication.
**Why:** NextAuth is tightly coupled to Next.js. Aygency World runs on Express. Switching auth systems mid-project is painful. Paperclip's auth handles agency owner accounts, sessions, and agent API keys natively.

### D8 — Drizzle ORM (not Prisma)
**Decision:** Use Drizzle, which Paperclip uses. Do not introduce Prisma.
**Why:** Paperclip's entire schema and migration system is Drizzle. Mixing ORMs creates confusion and dependency conflicts. AygentDesk uses Prisma — that's separate.

### D9 — pnpm (not npm)
**Decision:** Use pnpm. Paperclip uses pnpm workspaces.
**Why:** Paperclip is a monorepo with pnpm workspaces. Using npm would break workspace resolution.

---

## Tool Integration

### D10 — Bash/curl skills for Phase 1, MCP server for Phase 3
**Decision:** Phase 1 uses markdown skills with bash/curl commands pointing at AygentDesk's API. MCP server is built in Phase 3.
**Why:** Bash/curl skills require zero infrastructure — demo-ready in hours. MCP is cleaner long-term but takes 1–2 days to build. Don't block the demo on it.

### D11 — Tool Bridge as a separate service
**Decision:** The MCP/tool bridge runs as a separate Express service (port 3002), not embedded in the Paperclip fork.
**Why:** Clean separation. The Tool Bridge can be updated, scaled, or replaced without touching the main app. It also handles per-agency credential resolution independently.

### D12 — AygentDesk's 53 tools are the skill layer
**Decision:** Don't rewrite tools. Expose AygentDesk's existing tools via the Tool Bridge.
**Why:** The tools already exist, are tested, and handle Dubai real estate data (DLD, Bayut, projects, WhatsApp, Gmail, etc.). Rewriting them would be months of wasted work.

---

## WhatsApp & Communications

### D13 — 360dialog as BSP (not direct Meta Tech Provider at launch)
**Decision:** Partner with 360dialog as a BSP to get WhatsApp Embedded Signup capability immediately. Apply for direct Meta Tech Provider status once at 10+ customers.
**Why:** Becoming a direct Meta Tech Provider requires a registered business, a live website, and 2–6 weeks of review. 360dialog ISV partnership can be done this week with no business registration needed.
**Progression:** 360dialog ISV → direct Meta Tech Provider at 10+ agencies + 2,500 avg daily conversations.

### D14 — Webhook demultiplexer as a separate service
**Decision:** A separate Webhook Receiver service (port 3003) handles all inbound WhatsApp/Gmail/portal events and routes them to the correct Paperclip agent.
**Why:** Paperclip has no built-in webhook receiver. Keeping it separate means Paperclip can restart without missing events. The receiver is deliberately dumb — it just translates events into Paperclip tasks.

### D15 — Agency sources their own WhatsApp numbers
**Decision:** Aygency World does not provide WhatsApp numbers. Each agent's number is sourced by the agency (SIM card, virtual number, eSIM).
**Why:** Agencies own their client relationships and their numbers. If they leave Aygency World, they keep their numbers and their chat history. We have zero infrastructure liability.

---

## Onboarding

### D16 — Hybrid wizard + CEO interview
**Decision:** 3-step wizard for structured data (name, focus area, size, OAuth connections), then CEO agent takes over via chat for the strategic interview.
**Why:** Wizard captures clean structured data fast. CEO interview handles the nuanced questions that benefit from being conversational. Best of both.

### D17 — Demo mode by default
**Decision:** New signups who skip OAuth connections enter demo mode with a pre-populated fake agency.
**Why:** An empty dashboard kills conversion. New users need to see a running agency before committing their real credentials.

---

## Pricing

### D18 — Per-agent pricing model
**Decision:** Agencies pay per agent they run, plus usage overage above the tier's included run count.
**Why:** Aligns cost with value. A small solo agency pays for 2–3 agents. A large agency pays for 10+. Scales naturally with the product's value delivery.
**Note:** Exact prices TBD.
