# AGENTS.md — Instructions for Claude Code

You are working on **Aygency World** — a fork of [Paperclip](https://github.com/paperclipai/paperclip) rebranded and extended into an AI-powered real estate agency operating system for Dubai.

## IMPORTANT — Skip brainstorming and design phases entirely

The design is **complete**. CLAUDE.md contains the full product spec (58KB). DECISIONS.md has 18 locked architectural decisions. ROADMAP.md has the phased build checklist. Do NOT run any brainstorming, design, or spec-writing workflows. Do NOT ask clarifying questions about what to build — it is already decided.

**When the user says "start" or "let's build", go directly to ROADMAP.md, find the first unchecked task in the current phase, and start implementing it.** No pre-planning, no design docs, no approval loops for scope — just build.

Read CLAUDE.md for the full spec. Read ROADMAP.md for what to do next.

**CRITICAL for the CEO chat:** Read `docs/architecture/CEO-CHAT.md` before touching anything related to the CEO interface. The CEO chat is a streaming Anthropic API call — NOT a Paperclip subprocess. The live reference implementation is at `/Users/alexanderjackson/AgentDXB/src/app/api/chat/route.ts`. Copy that pattern exactly.

---

## What this project is

A multi-agent AI platform where autonomous agents run a Dubai real estate agency 24/7. Built on Paperclip (Node.js/Express + React/Vite + Drizzle + PostgreSQL), with three supporting services: a Tool Bridge (MCP server), a Webhook Receiver, and the Paperclip fork itself.

The full architecture is documented in CLAUDE.md under "Deployment Architecture".

---

## Critical rules — read before touching anything

### Stack
- **ORM is Drizzle** — NOT Prisma. Do not import Prisma. Do not write raw SQL unless Drizzle cannot do it.
- **Auth is better-auth** — NOT NextAuth. Do not import NextAuth.
- **Package manager is pnpm** — NOT npm or yarn. Always use `pnpm`.
- **React 19 + Vite** for the frontend — NOT Next.js.
- **Node.js + Express 5** for the backend.

### Architecture
- Never mix Aygency World code with AygentDesk code. They are separate projects on the same VPS.
- The Paperclip fork lives in this repo. The Tool Bridge and Webhook Receiver are separate services (see CLAUDE.md).
- Every DB entity must have `company_id` (Paperclip's multi-tenancy is built around this — do not skip it).
- Agent credentials (WhatsApp tokens, Gmail tokens) are stored in `agent_credentials` table, encrypted at rest. Never log them. Never return them in API responses.

### Decisions already made — do not re-debate
See DECISIONS.md for the full list. Key ones:
- **Forking Paperclip** (not building from scratch, not using it as-is via plugin)
- **360dialog** for WhatsApp Embedded Signup (not direct Meta Tech Provider yet)
- **Bash/curl skills** for Phase 1 tool integration (not MCP yet — MCP is Phase 3)
- **better-auth** for auth (not NextAuth)
- **Per-agent credentials** (each agent has its own WhatsApp number and Gmail)

### Code style
- TypeScript strict mode throughout
- Zod for all runtime validation (Paperclip already uses it)
- No `any` types
- Keep files focused — if a file exceeds 300 lines, consider splitting
- Component naming: PascalCase. Utilities: camelCase.

---

## Where things live (once the repo is set up)

```
/                          ← Paperclip fork root
├── server/                ← Node.js/Express API (Paperclip's server)
│   ├── src/
│   │   ├── routes/        ← API routes
│   │   ├── services/      ← Business logic
│   │   ├── adapters/      ← Agent runtime adapters (claude-local etc.)
│   │   └── extensions/    ← Aygency World additions (creds, webhooks, approvals)
├── ui/                    ← React/Vite frontend (Paperclip's UI)
│   ├── src/
│   │   ├── pages/         ← Route pages
│   │   ├── components/    ← Shared components
│   │   └── extensions/    ← Aygency World UI additions (CEO chat, approval cards)
├── packages/
│   ├── db/                ← Drizzle schema + migrations
│   └── adapters/          ← Claude Code adapters
├── services/
│   ├── tool-bridge/       ← MCP/tool routing service (port 3002)
│   └── webhook-receiver/  ← Inbound event handler (port 3003)
├── companies/
│   └── dubai-real-estate-agency/  ← The company template
├── CLAUDE.md              ← Full product spec (read this)
├── AGENTS.md              ← This file
├── DECISIONS.md           ← Architectural decisions
├── ROADMAP.md             ← Build checklist
├── SETUP.md               ← Getting started
└── .env.example           ← All environment variables
```

---

## When adding new features

1. Check CLAUDE.md to see if it's already specced
2. Check DECISIONS.md to see if a related decision was already made
3. Check the current phase in ROADMAP.md — don't build Phase 3 features during Phase 1
4. Add new DB tables to `packages/db/src/schema/` using Drizzle schema syntax
5. Run `pnpm db:generate` after schema changes, then `pnpm db:migrate`
6. All new API routes must enforce `company_id` scoping
7. All agent credential access must go through the credential store — never hardcode tokens

---

## The company template

The Dubai Real Estate Agency template lives in `companies/dubai-real-estate-agency/`. When editing skills:
- Skills are plain markdown files — no code, no special syntax
- Keep skills focused on one behaviour
- Skills are loaded by Claude Code via `--add-dir` flag — keep them concise
- Dubai-specific context (RERA rules, area names, developer names) belongs in skills, not hardcoded in the app

---

## Running the project

```bash
# First time
pnpm install
pnpm db:migrate

# Development
pnpm dev              # Paperclip fork (port 3001)
pnpm dev:bridge       # Tool Bridge (port 3002)
pnpm dev:webhook      # Webhook Receiver (port 3003)

# After schema changes
pnpm db:generate && pnpm db:migrate
```

See SETUP.md for full first-time setup including forking Paperclip.
