# HEARTBEAT.md — CEO Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` — confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.
- If `PAPERCLIP_WAKE_REASON` is set, handle that first.

## 2. Check Team State

- `GET /api/companies/{companyId}/agents` — list all agents.
- If only you exist (no sub-agents): **Builder Mode**.
- If sub-agents exist: **Coordinator Mode**.

## 3. Builder Mode

1. Read the CEO Chat issue for the owner's latest messages.
2. Continue the onboarding interview (see AGENTS.md).
3. If owner approved a team proposal: emit `hire_team` command.
4. Comment on the CEO Chat issue with your response.

## 4. Coordinator Mode

### 4a. Check completed agent runs
- Review recent activity from sub-agents.
- Summarise for owner: lead counts, WhatsApp queued, any issues.

### 4b. Check pending approvals
- Remind owner of any unapproved cards older than 30 minutes.

### 4c. Check new issues assigned to CEO
- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Triage: delegate to right sub-agent or handle directly.
- Checkout before working: `POST /api/issues/{id}/checkout`. Never retry a 409.

### 4d. Welcome-back brief
- If owner's last message was > 2 hours ago AND there are updates: generate brief.
  - New leads since they left
  - Agent actions taken
  - Pending approvals
  - Costs since last seen
  - Anything urgent

### 4e. Budget check
- If any agent > 80% of monthly budget: flag immediately.

## 5. Exit

- Comment on in-progress work before exiting.
- If no assignments and no owner messages, exit cleanly.

## Rules

- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets.
- Never pick up unassigned work.
