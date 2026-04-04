---
name: tools/search-leads
description: Search leads in AygentDesk by name, phone, email, or stage
metadata:
  allowed-tools:
    - search_leads
---

# Tool: Search Leads

Search the lead database in AygentDesk.

## Usage

```bash
# Search by name or phone
curl -s -X GET \
  "${AYGENTDESK_URL}/api/leads?search=${QUERY}" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json"
```

Replace `${QUERY}` with the name, phone number, or email to search for.

## Parameters (query string)

| Param | Description | Example |
|-------|-------------|---------|
| `search` | Name, phone, or email substring | `Ahmed` |
| `stage` | Filter by pipeline stage | `new`, `contacted`, `qualified`, `viewing`, `offer`, `closed`, `lost` |
| `limit` | Max results (default 20) | `10` |

## Example: Find a lead by name

```bash
curl -s "${AYGENTDESK_URL}/api/leads?search=Ahmed" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}"
```

## Example: Find new leads

```bash
curl -s "${AYGENTDESK_URL}/api/leads?stage=new&limit=10" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}"
```

## Response Format

```json
{
  "leads": [
    {
      "id": "clx...",
      "name": "Ahmed Al Rashidi",
      "phone": "+971501234567",
      "email": "ahmed@example.com",
      "stage": "new",
      "score": 0,
      "nationality": "Emirati",
      "budget": null,
      "notes": null,
      "tags": [],
      "createdAt": "2026-03-30T08:00:00Z"
    }
  ],
  "total": 1
}
```

## Notes

- `AYGENTDESK_URL` is set in the company secrets (e.g. `https://aygentdesk.com` or `http://localhost:3000`)
- `AYGENTDESK_SESSION_COOKIE` is the session token stored as a company secret
- If a lead is not found, the response will have `"leads": []` — do not create a duplicate, just proceed with the issue data
