---
name: tools/search-whatsapp
description: Search WhatsApp conversation history in AygentDesk for a phone number or lead
metadata:
  allowed-tools:
    - search_whatsapp
---

# Tool: Search WhatsApp

Search existing WhatsApp conversation history to check if we've spoken with a lead before.

## Usage

```bash
# Search by phone number
curl -s -X GET \
  "${AYGENTDESK_URL}/api/whatsapp/messages?phone=${PHONE}" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}"
```

## Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `phone` | Phone number (international format) | `+971501234567` |
| `leadId` | AygentDesk lead ID | `clx123abc` |
| `limit` | Max messages (default 20) | `10` |

## Example: Check conversation history for a phone number

```bash
curl -s "${AYGENTDESK_URL}/api/whatsapp/messages?phone=%2B971501234567&limit=10" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}"
```

Note: URL-encode the `+` in phone numbers as `%2B`.

## Response

```json
{
  "messages": [
    {
      "id": "msg_...",
      "chatJid": "971501234567@s.whatsapp.net",
      "content": "Hi, I'm interested in JVC apartments",
      "fromMe": false,
      "timestamp": "2026-03-29T14:30:00Z",
      "leadId": "clx123abc"
    },
    {
      "id": "msg_...",
      "content": "مرحباً، يسعدنا مساعدتك. هل لديك منطقة محددة في بالك؟",
      "fromMe": true,
      "timestamp": "2026-03-29T14:32:00Z"
    }
  ],
  "total": 2
}
```

`fromMe: false` = inbound (from lead). `fromMe: true` = outbound (sent by agency).

## When to Use This

Always call this before drafting a first response to:
1. Check if we've spoken before (avoids repeating "Hi, nice to meet you!")
2. Get context on what was already discussed
3. Detect their language from previous messages
4. See if any WhatsApp was already sent/queued

## Notes

- If no messages found, `"messages": []` — this is their first contact
- Messages are stored when WhatsApp is connected via AygentDesk integration
- If WhatsApp is not connected (Phase 1 demo), this will return empty — that is expected
