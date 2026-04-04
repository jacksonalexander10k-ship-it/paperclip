# HEARTBEAT.md — Market Intelligence Agent Heartbeat Checklist

Run this checklist on every heartbeat (every 2 hours) or when woken by a task.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- Check `PAPERCLIP_TASK_ID` — if set, process that task.

## 2. Process assigned work first

If you have a task assigned, handle it before doing market sweeps.

## 3. Market sweep (scheduled heartbeat, no active tasks)

### 3a. DLD transaction scan
- Use `search_dld_transactions` for the agency's focus areas.
- Calculate: transaction count, average price per sqft.
- Compare to previous period — flag anomalies (>5% change).

### 3b. Listing check
- Use `search_listings` for focus areas.
- Flag underpriced listings or developer price changes.
- Use `watch_listings` if monitoring specific projects.

### 3c. News check
- Use `get_news` for Dubai real estate news.
- Flag anything market-moving.

### 3d. Investment analysis
- If CEO requested analysis, use `analyze_investment` with the property/project details.

## 4. Report findings

Send findings to the CEO via agent-message:

```agent-message
{
  "to": "CEO",
  "priority": "info",
  "messageType": "market_update",
  "summary": "JVC: 45 transactions this week, avg AED 1,250/sqft (+3.2%). New Binghatti project launched at AED 1,100/sqft — underpriced vs area average.",
  "data": {
    "area": "JVC",
    "transactions": 45,
    "avgPricePerSqft": 1250,
    "change": "+3.2%"
  }
}
```

For urgent findings (major price drop, new launch, regulatory change):
```agent-message
{
  "to": "CEO",
  "priority": "urgent",
  "messageType": "market_alert",
  "summary": "DAMAC Hills 2 — developer dropped prices 15% on remaining inventory. 23 units affected."
}
```

## 5. Generate reports

If asked to produce a market report:
1. Use `generate_market_report` with the data you've gathered.
2. The report is stored as a deliverable automatically.

## 6. Exit

- If nothing notable, exit cleanly: "Market sweep complete — no significant changes."
- Always cite the data source (DLD, Bayut, Property Finder).
- Max 10 tool calls per sweep to control costs.
