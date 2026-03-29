---
name: market-monitoring
description: >
  Monitor DLD transactions, new project launches, price movements, and
  competitor activity. Report actionable insights to CEO.
  Use when: running scheduled market scans or when CEO requests market intelligence.
  Don't use when: responding to a specific lead enquiry (use project search instead).
---

# Market Monitoring Skill

## What to Monitor

### DLD Transactions (Daily)
- Scan `search_dld_transactions` for the agency's focus areas (from agency_context.identity.areas_focus).
- Track: transaction volume, average price per sqft, highest/lowest transactions.
- Compare to previous day/week/month.
- Flag: any transaction > AED 10M (high-value signal), any unusual volume spike.

### Price Movements (Weekly)
- Calculate average AED/sqft for each tracked area.
- Flag if any area moves > 5% in a single week (up or down).
- Report format: "[Area] avg price/sqft moved from AED X to AED Y (+Z%) this week."
- Context: "This is [above/below/in line with] the 3-month trend."

### New Project Launches (Continuous)
- Monitor news feeds via `get_news` for new RERA registrations and developer announcements.
- Use `web_search` as backup if news feeds miss a launch.
- For each new launch, capture: developer, project name, location, expected price range, payment plan highlights.
- Flag to CEO: "New launch: [Project] by [Developer] in [Area]. Starting from AED [X]. [Key selling point]."

### Listing Activity (Daily)
- For agencies with active `watch_listings` monitors: check for new matches.
- Report new listings that match the agency's inventory focus or client pipeline.
- Flag underpriced listings: "This [type] in [area] is listed AED X below market average — potential opportunity."

### Competitor Activity (Weekly)
- Scan new listings in tracked areas for other agencies' inventory.
- Track: are competitors listing in areas the agency is focused on? Any pricing patterns?
- Do NOT engage with competitor listings. Report observations only.

### News & Macro (Daily)
- Scan `get_news` for Dubai property news: regulatory changes, visa policy updates, infrastructure announcements.
- Flag anything that affects the agency's business: new metro line, new Golden Visa rules, developer policy changes.

## How to Report

### Morning Brief (to CEO, daily)
Include a market section in the CEO morning brief:
```
Market Update:
- DLD: [X] transactions yesterday in your focus areas. Avg AED [Y]/sqft.
- Notable: [One or two interesting transactions or trends].
- News: [One or two relevant headlines with source].
- Action: [One recommendation based on the data].
```

### Alert (immediate, when triggered)
For significant events, create an immediate alert to CEO:
- Price movement > 5% in a tracked area.
- New launch by a major developer in a focus area.
- Regulatory change affecting operations.
- Competitor activity that requires a response.

### Weekly Report (to CEO, Monday morning)
Comprehensive weekly summary:
- Transaction volume and price trends per focus area.
- New launches of the week.
- Pipeline impact: "X leads are interested in [area] — market data supports/contradicts their timing."
- Recommendations: "Consider pushing [area] inventory — prices are trending up and demand is strong."

## Data Integrity Rules
- Only report data that comes directly from tool results. Never fabricate statistics.
- If a data source returns empty or stale results, say so: "No DLD data available for [area] this week."
- Always cite the source: "Per DLD records", "Per Bayut listings", "Per [Publication] article."
- If data seems anomalous (e.g., a single transaction 50% above market), flag it as potentially anomalous rather than presenting it as a trend.

## Tools Used
- `search_dld_transactions` — real sale prices from DLD
- `search_listings` — live Bayut inventory
- `watch_listings` — automated listing alerts
- `get_news` — Dubai property news feeds
- `web_search` — fallback for missing data
- `analyze_investment` — deeper analysis when needed
- `search_projects` — project database lookup
- `get_project_details` — full project info
