# HEARTBEAT.md — Market Intelligence Agent Heartbeat Checklist

Run this checklist on every heartbeat (every 2 hours) or when woken by a task.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- `GET /api/agents/me` — confirm id and companyId.

## 2. Check for assigned issues

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo`
- If issues exist: process each one (see AGENTS.md workflow).
- Checkout before working: `POST /api/issues/{id}/checkout`. If 409, skip.

## 3. Market sweep (if scheduled heartbeat)

### 3a. DLD transaction scan
- Search DLD transactions for agency focus areas (last 2 hours or since last run).
- Calculate: transaction count, average price per sqft, min/max.
- Compare to previous period — flag anomalies (>5% change).

### 3b. Listing check
- Check for new listings in focus areas.
- Flag underpriced listings (>10% below area average).
- Flag developer price changes on tracked projects.

### 3c. News check
- Search for Dubai real estate news in last 2 hours.
- Flag anything that could affect the agency's areas or clients.

## 4. Report findings

- If significant findings: create issue for CEO with analysis.
- If routine data: store for daily/weekly aggregation.
- Comment on any active research issues with new data.

## 5. Exit

- Comment on all in-progress work before exiting.
- If nothing notable, exit cleanly with a one-line status.

## Rules

- Always include `X-Paperclip-Run-Id` header on all API calls.
- Never retry a 409 checkout.
- Flag significant market movements immediately — don't wait for next report cycle.
- Data accuracy is critical — always cite the source (DLD, Bayut, Property Finder).
