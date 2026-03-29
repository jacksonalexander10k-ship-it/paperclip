# HEARTBEAT.md — Lead Agent Heartbeat Checklist

Run this checklist on every heartbeat (every 15 minutes).

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- `GET /api/agents/me` — confirm id and companyId.

## 2. Check for assigned issues

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo`
- If issues exist: process each one (see AGENTS.md workflow).
- Checkout before working: `POST /api/issues/{id}/checkout`. If 409, skip — another run claimed it.

## 3. Process the issue

For each checked-out issue:

1. Read the issue title and description — understand what lead event triggered this.
2. Follow the workflow in AGENTS.md.
3. Comment with your result summary.
4. Mark issue complete: `POST /api/issues/{id}/complete`.

## 4. Check for stale leads (if no active issues)

- If no assigned issues: scan for leads last updated > 14 days ago with score ≥ 5.
- Draft a re-engagement message.
- Queue for approval.
- Create a follow-up issue for the CEO to review.

## 5. Exit

- Always comment before completing an issue.
- If nothing to do, exit cleanly with a one-line status.

## Rules

- Always include `X-Paperclip-Run-Id` header on all API calls.
- Never retry a 409 checkout — just skip.
- Never send WhatsApp directly — always queue via approval card.
- Max 3 tool calls per lead before escalating to CEO if stuck.
