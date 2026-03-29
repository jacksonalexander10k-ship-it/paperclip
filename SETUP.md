# SETUP.md — Getting Started

First-time setup for Aygency World. Follow this in order.

---

## Prerequisites

Make sure you have these installed before starting:

```bash
node --version    # Need v20+ (LTS)
pnpm --version    # Need v9+ (install: npm install -g pnpm)
git --version     # Any recent version
psql --version    # PostgreSQL 16 client
```

You also need:
- **Claude Code** installed: `npm install -g @anthropic-ai/claude-code`
- **Docker Desktop** (for running PostgreSQL + Redis locally)

---

## Step 1 — Fork and clone Paperclip

1. Go to [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip)
2. Click **Fork** → fork to your GitHub account
3. Clone your fork:

```bash
cd "/Users/alexanderjackson/Aygency World"
git clone https://github.com/YOUR_USERNAME/paperclip .
```

> Note: clone into the existing directory with `.` at the end. This repo's CLAUDE.md, AGENTS.md etc. will live alongside Paperclip's files.

4. Add upstream remote so you can pull Paperclip fixes later:

```bash
git remote add upstream https://github.com/paperclipai/paperclip.git
```

---

## Step 2 — Install dependencies

```bash
pnpm install
```

If pnpm complains about the workspace, make sure you're in the root of the repo (where `pnpm-workspace.yaml` lives).

---

## Step 3 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (marked with `# REQUIRED`):

- `ANTHROPIC_API_KEY` — get from [console.anthropic.com](https://console.anthropic.com)
- `DATABASE_URL` — PostgreSQL connection string (see Step 4)
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AYGENTDESK_URL` — your AygentDesk instance URL (e.g. `https://aygentdesk.com` or `http://localhost:3000` for dev)
- `AYGENTDESK_INTERNAL_SECRET` — a shared secret between Aygency World and AygentDesk (generate one)

Everything else can be left blank for Phase 1. You'll fill in 360dialog credentials, VAPID keys, Stripe etc. in later phases.

---

## Step 4 — Start the database

Start PostgreSQL and Redis with Docker:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port `5432` (or whatever's in `DATABASE_URL`)
- Redis on port `6379`

Check they're running:

```bash
docker-compose ps
```

---

## Step 5 — Run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

If you see errors about the schema, check that `DATABASE_URL` in `.env` points to the running Postgres container.

---

## Step 6 — Verify Claude Code works as an agent

Paperclip spawns Claude Code as a subprocess. Test it:

```bash
claude --version   # Should print the Claude Code version
```

Then check that Claude Code can authenticate:

```bash
claude auth status
```

If you're not authenticated, run `claude auth login` and follow the prompts.

---

## Step 7 — Start the dev servers

```bash
# Terminal 1 — Paperclip fork (main app, port 3001)
pnpm dev

# Terminal 2 — Tool Bridge / MCP server (port 3002) — Phase 3, skip for now
# pnpm dev:bridge

# Terminal 3 — Webhook Receiver (port 3003) — Phase 2, skip for now
# pnpm dev:webhook
```

Open `http://localhost:3001` — you should see the Paperclip UI loading.

---

## Step 8 — Create the demo company

Once the UI loads:

1. Sign up for an account (first account becomes admin)
2. Create a new company: `Dubai Real Estate Agency`
3. The company config lives at `companies/dubai-real-estate-agency/` — you'll build this out in Phase 1

---

## Step 9 — Add AygentDesk as the tool backend

In your `.env`, set:

```
AYGENTDESK_URL=https://aygentdesk.com
AYGENTDESK_INTERNAL_SECRET=your-shared-secret
```

The shared secret also needs to be set on the AygentDesk side (in AygentDesk's `.env` as `AYGENCY_WORLD_SECRET`). This authenticates tool calls so AygentDesk knows they're coming from a legitimate Aygency World agent.

Test the connection:

```bash
curl -H "Authorization: Bearer $AYGENTDESK_INTERNAL_SECRET" \
  $AYGENTDESK_URL/api/tools/ping
```

Should return `{"ok": true}`.

---

## Step 10 — Verify agent spawning

In Paperclip, trigger the demo heartbeat manually. The CEO agent should spawn a Claude Code process. Check the activity log in the UI — you should see a new run appear.

If the agent doesn't spawn, check:
1. `ANTHROPIC_API_KEY` is set in `.env`
2. Claude Code is on your `$PATH` (`which claude`)
3. The company config at `companies/dubai-real-estate-agency/` is set up

---

## Ongoing commands

```bash
# After Paperclip upstream changes
git fetch upstream
git merge upstream/main

# After schema changes
pnpm db:generate && pnpm db:migrate

# Run Drizzle Studio (DB browser)
pnpm db:studio

# Lint
pnpm lint

# Format
pnpm format
```

---

## Ports at a glance

| Service | Port | Command |
|---------|------|---------|
| Paperclip fork (main app) | 3001 | `pnpm dev` |
| Tool Bridge (MCP server) | 3002 | `pnpm dev:bridge` |
| Webhook Receiver | 3003 | `pnpm dev:webhook` |
| PostgreSQL | 5432 | Docker |
| Redis | 6379 | Docker |

---

## What to build next

See ROADMAP.md. Start at Phase 1 — the demo company template. Don't touch Phase 2 or Phase 3 until Phase 1 is running end-to-end.
