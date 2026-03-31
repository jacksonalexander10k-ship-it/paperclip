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
- Search DLD transactions for agency focus areas.
- Calculate: transaction count, average price per sqft.
- Compare to previous period — flag anomalies (>5% change).

### 3b. Listing check
- Check for new listings in focus areas.
- Flag underpriced listings or developer price changes.

### 3c. News check
- Search for Dubai real estate news.
- Flag anything market-moving.

## 4. Report findings

- If significant findings: create issue for CEO with analysis.
- If routine data: store for daily/weekly aggregation.

## 5. Exit

- Comment on all in-progress work before exiting.
- If nothing notable, exit cleanly with a one-line status.

## Rules

- Always include `X-Paperclip-Run-Id` header on all API calls.
- Never retry a 409 checkout.
- Flag significant market movements immediately.
- Always cite the data source (DLD, Bayut, Property Finder).
