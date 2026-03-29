---
name: tools/send-whatsapp
description: Queue a WhatsApp message for owner approval — NEVER sends directly
---

# Tool: Send WhatsApp (Approval Queue)

This tool does NOT send WhatsApp messages directly. It creates an approval card in the CEO chat for the owner to review, edit, and approve before sending.

**NEVER send WhatsApp without owner approval. Ever.**

## Usage

```bash
curl -s -X POST \
  "${AYGENTDESK_URL}/api/whatsapp/queue" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+971501234567",
    "message": "السلام عليكم أحمد، شكراً على تواصلك. يسعدنا مساعدتك في إيجاد العقار المناسب. هل لديك منطقة محددة في بالك؟",
    "leadId": "clx123abc",
    "language": "arabic",
    "context": "First response to new lead. Score: 5. Interest: JVC 1BR."
  }'
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Phone number in international format |
| `message` | Yes | The full message text to send |
| `leadId` | No | Link this WhatsApp to a lead record |
| `language` | No | Language of the message (for display) |
| `context` | No | Brief context shown to owner in approval card |

## Response

```json
{
  "approvalId": "appr_...",
  "status": "pending_approval",
  "message": "WhatsApp queued for owner approval. Not sent yet."
}
```

The approval card appears in the owner's CEO chat with:
- Preview of the message
- Recipient name + number
- Edit / Approve / Reject buttons

## After Calling This Tool

After queuing the WhatsApp:
1. Comment on the Paperclip issue: "WhatsApp drafted and queued for approval — pending owner review."
2. Do NOT wait for approval — complete the issue. The CEO will follow up when the owner approves.

## Example: Queue a first-contact Arabic message

```bash
curl -s -X POST \
  "${AYGENTDESK_URL}/api/whatsapp/queue" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+971501234567",
    "message": "السلام عليكم، شكراً على تواصلك معنا. يسعدنا مساعدتك في إيجاد العقار المثالي في دبي. ما هي المنطقة التي تفضلها؟",
    "leadId": "clx123abc",
    "language": "arabic",
    "context": "New lead from WhatsApp. First contact. Score: 4. Interest: Dubai property investment."
  }'
```

## Example: Queue a follow-up English message

```bash
curl -s -X POST \
  "${AYGENTDESK_URL}/api/whatsapp/queue" \
  -H "Authorization: Bearer ${AYGENTDESK_SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+447911123456",
    "message": "Hi Sarah, following up on your enquiry about JVC. Based on your budget of AED 800K-1.2M, I have a few options that might interest you. Would you be available for a quick call this week?",
    "leadId": "clx456def",
    "language": "english",
    "context": "Follow-up after qualification. Score: 7. Budget confirmed AED 800K-1.2M. Timeline 6 months. Cash buyer."
  }'
```

## Phase 1 Note

In the Phase 1 demo, AygentDesk's WhatsApp queue endpoint may not exist yet. In that case, log the queued message as a Paperclip comment instead:

```
**WhatsApp Queued (Pending Approval)**
To: +971501234567 (Ahmed Al Rashidi)
Language: Arabic
Message:
السلام عليكم، شكراً على تواصلك معنا...

Context: New lead, Score 5, first contact.
```

The CEO will present this to the owner as an approval card.
