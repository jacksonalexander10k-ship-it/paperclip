---
name: tools/update-lead
description: Update a lead record in AygentDesk — score, stage, notes, tags
---

# Tool: Update Lead

Update a lead's record in AygentDesk after qualifying or interacting with them.

## Usage

```bash
curl -s -X PATCH \
  "${AYGENTDESK_URL}/api/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "score": 6,
    "stage": "contacted",
    "notes": "Arabic speaker, interested in JVC 1BR, budget AED 800K-1.2M, investor",
    "nationality": "Saudi",
    "budget": "800000-1200000"
  }'
```

## Updatable Fields

| Field | Type | Values |
|-------|------|--------|
| `score` | number | 0–10 |
| `stage` | string | `new`, `contacted`, `qualified`, `viewing`, `offer`, `closed`, `lost` |
| `notes` | string | Free text — append, don't overwrite previous notes |
| `nationality` | string | Detected from conversation |
| `budget` | string | Range as string e.g. "800000-1200000" |
| `tags` | string[] | Tags to set (replaces existing) |

## Example: Score and stage a new lead after first contact

```bash
curl -s -X PATCH \
  "${AYGENTDESK_URL}/api/leads/clx123abc" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "score": 5,
    "stage": "contacted",
    "notes": "Russian speaker. Interested in investment. Budget TBC. WhatsApp drafted 30 Mar 2026."
  }'
```

## Example: Update after qualification complete

```bash
curl -s -X PATCH \
  "${AYGENTDESK_URL}/api/leads/clx123abc" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "score": 8,
    "stage": "qualified",
    "budget": "2000000-3500000",
    "nationality": "Russian",
    "notes": "Cash buyer. Budget AED 2-3.5M. Timeline Q3 2026. Interested in Marina or Downtown. Golden Visa eligible. ESCALATE to CEO."
  }'
```

## Notes on Notes Field

Always append to notes rather than overwriting. Format new additions as:
```
[2026-03-30] Layla: Arabic speaker, interested in JVC 1BR, budget AED 800K-1.2M. WhatsApp drafted.
```

## Response

```json
{
  "id": "clx123abc",
  "name": "Ahmed Al Rashidi",
  "score": 6,
  "stage": "contacted",
  "updatedAt": "2026-03-30T09:15:00Z"
}
```

If `404`: Lead not found. Check the ID from the search-leads result.
