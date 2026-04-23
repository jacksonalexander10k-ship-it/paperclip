# Aygency World — Current Version

**Read this first when Claude Code opens this repo. It tells you which build state you're looking at.**

## Canonical machine

The authoritative copy lives on the machine where the dashboard was last verified working in the browser. If you're on a secondary machine and something looks wrong or outdated, the fix is:

```bash
git fetch origin
git pull origin main
git tag -l          # see the checkpoints
git checkout demo-latest  # jumps to the most recent demo-ready state
```

## How we identify "the correct version"

1. **Branch** — `main` on `origin` (https://github.com/jacksonalexander10k-ship-it/paperclip) is the source of truth.
2. **Tags** — we tag demo-ready checkpoints as `demo-YYYY-MM-DD` and `demo-latest` always points to the most recent one.
3. **This file** — updated every time we land a meaningful checkpoint. If the "Last checkpoint" date below is older than your local work, pull.

## Last checkpoint

_Updated 2026-04-23_

**What works in this build:**
- CEO Chat (Clive), single-agent chat, approval cards
- Team dashboard: expandable department cards (Leadership / Marketing / Operations / Sales), colors + order match sidebar
- Agents: Clive (CEO), Saif (Social Media Manager / Marketing), Claire (Sales Agent / Sales), Layla (Admin / Operations), Tariq (Data Analyst / Operations)
- WhatsApp outbound via Baileys with auto-approve per-agent toggle
- WhatsApp inbound: empty-body (`@lid` decrypt-failure) recovery reply shipped
- WhatsApp inbound: auto-link `@lid` inbound to recent outbound lead (privacy-mode recovery, ±10min window)
- Regression test: `server/src/__tests__/direct-agent-empty-body.test.ts` (3 tests, all pass)
- Runtime watchdog: `baileys-session-manager.ts` logs loud ERROR if inbound produces no draft within debounce+60s
- Dev endpoint: `POST /dev/simulate-inbound-whatsapp` (no auth) for end-to-end verification
- `pnpm dev:full` script that atomically kills port 3001, rebuilds UI, starts server

**Known issues / in-flight work:**
- Baileys + WhatsApp privacy-mode (`@lid`) is unreliable at scale — fine for 1-on-1 demos, breaks with parallel outreach to many leads. **Meta Cloud API migration is the permanent fix** (verification in progress).
- Deployment mode set to `local_trusted` in `.env` for this demo machine — no login screen. Change back to `authenticated` for production.
- `aygent_baileys_auth.creds_json` was cleared — re-scan the QR from the agent's settings page if WhatsApp is needed.

**Next up:**
- Meta Cloud API wiring (waiting on Meta Business Verification)
- In-UI "client simulator" chat so demos don't depend on a real phone
