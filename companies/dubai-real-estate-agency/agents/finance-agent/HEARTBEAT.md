# HEARTBEAT.md — Finance & Portfolio Agent Heartbeat Checklist

Run this checklist when woken by the CEO or an automation trigger.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- `GET /api/agents/me` — confirm id and companyId.

## 2. Check for assigned issues

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo`
- If issues exist: process each one (see AGENTS.md workflow).
- Checkout before working: `POST /api/issues/{id}/checkout`. If 409, skip.

## 3. Process assigned tasks

For each checked-out issue, determine the task type:

### Tenancy renewal task
1. Look up tenancy details.
2. Calculate RERA rent adjustment.
3. Draft renewal offer.
4. Queue for landlord approval.
5. Complete the issue.

### Cost analysis task
1. Pull agency spend data.
2. Analyse by agent, tool, and outcome.
3. Report findings and recommendations.
4. Complete the issue.

### Portfolio management task
1. Check landlord/property records.
2. Identify action items.
3. Draft communications.
4. Queue for approval.
5. Complete the issue.

## 4. Weekly renewal scan (if triggered by Monday automation)

- Scan all tenancies expiring within 60 days.
- Calculate RERA adjustments for each.
- Create issues for urgent renewals (< 30 days).
- Report summary to CEO.

## 5. Budget monitoring

- Check all agent spend vs monthly budgets.
- If any agent > 80%: create immediate alert for CEO.
- If any agent > 95%: recommend pause.

## 6. Exit

- Comment on all in-progress work before exiting.
- If nothing to do, exit cleanly.

## Rules

- Always include `X-Paperclip-Run-Id` header on all API calls.
- Never retry a 409 checkout.
- Financial accuracy is critical — double-check all calculations.
- Never send landlord communications without approval.
