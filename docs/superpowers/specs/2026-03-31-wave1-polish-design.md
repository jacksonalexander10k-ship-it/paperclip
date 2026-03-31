# Wave 1: Daily Usage Polish — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Overview

Five features that matter most for agencies using the app daily. All centered around the WhatsApp approve-and-send flow — the core interaction loop.

---

## Feature 1: WhatsApp Conversation View

### Problem
Messages are stored in `aygent_whatsapp_messages` (inbound) but there's no UI to view them. When an owner sees an approval card for "follow up with Ahmed," they can't see the conversation history.

### Design
Add a conversation thread view accessible from:
- **Approval cards** — "View conversation" link below the message preview
- **Lead detail page** — "WhatsApp History" section (future, out of scope for now)

The view is a slide-out panel (right side drawer) showing chat bubbles:
- Inbound messages: left-aligned, muted background
- Outbound messages: right-aligned, primary-tinted background
- Each bubble: sender name, message text, timestamp, status (sent/delivered/read)
- Sorted chronologically, newest at bottom, auto-scroll to bottom

### API
New endpoint: `GET /companies/:companyId/whatsapp/messages?chatJid={phone}&agentId={agentId}`
- Returns messages for a specific chat, ordered by timestamp asc
- Scoped by company

### Data
Uses existing `aygent_whatsapp_messages` table. No schema changes. Once Feature 4 (outbound storage) is built, sent messages appear here too with `fromMe: true`.

---

## Feature 2: Edit-Before-Approve

### Problem
Owners want to tweak WhatsApp/email message content before approving. Currently it's approve-as-is or reject.

### Design
On the approval card (both in CEO Chat inline and the Approvals page):
- Add an "Edit" button alongside "Approve & Send" and "Decline"
- Clicking "Edit" makes the message field editable (textarea replaces the preview text)
- Owner edits the text, then clicks "Approve & Send" with the edited version
- The edited payload is sent to the approve endpoint

### API Change
The existing `POST /approvals/:id/approve` endpoint needs to accept an optional `editedPayload` body field. If present, the approval's payload is updated before execution.

```typescript
// Request body
{ editedPayload?: { message?: string } }
```

The executor reads from the (potentially updated) payload, so the edited message is what gets sent.

### UI Change
In `ApprovalCard.tsx` and the CEO Chat inline approval renderer:
- Add edit state toggle
- When editing: show textarea pre-filled with `payload.message`
- On "Approve & Send": pass `{ editedPayload: { message: editedText } }` to the approve mutation

---

## Feature 3: 24-Hour WhatsApp Window Tracking

### Problem
Meta's rules: after a lead's last reply, you have 24 hours to send free-form messages. After that, you MUST use an approved template. Violating this gets the number banned.

### Design

**New table: `aygent_whatsapp_windows`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| companyId | uuid | FK |
| agentId | uuid | FK |
| chatJid | text | Phone number / chat identifier |
| windowOpenedAt | timestamptz | When lead last replied |
| windowExpiresAt | timestamptz | openedAt + 24 hours |

Unique constraint on `(agentId, chatJid)` — one window per agent per chat.

**Window management:**
- When an inbound message is received (webhook handler), upsert the window: set `windowOpenedAt = now()`, `windowExpiresAt = now() + 24h`
- Before sending via approval executor, check if window is open:
  - Open → send free-form message (current behavior)
  - Closed → reject with note "Window closed. Use a template." (or auto-select a template if one matches)

**Approval card enhancement:**
- If window is closed when card is rendered, show a warning badge: "24h window closed — template required"
- Show a template selector dropdown instead of free-form message edit

### Templates
The `aygent_whatsapp_templates` table already exists with name, category, content, isDefault. Templates are pre-approved message formats. When the window is closed, the agent or owner selects a template and fills in variables.

For now, keep it simple: if window is closed, show the warning and let the owner pick a template from a dropdown. Auto-template selection is Phase 4.

---

## Feature 4: Outbound WhatsApp Storage

### Problem
When a WhatsApp message is sent via the approval executor, the sent message is not stored. The conversation view (Feature 1) only shows inbound messages.

### Design
After successfully sending via 360dialog in `approval-executor.ts`, insert a record into `aygent_whatsapp_messages` with `fromMe: true`.

```typescript
// After successful 360dialog send:
await db.insert(aygentWhatsappMessages).values({
  companyId,
  agentId,
  chatJid: phone,  // recipient phone
  messageId: response.messages?.[0]?.id ?? `sent-${Date.now()}`,
  fromMe: true,
  senderName: agentName,
  senderPhone: agentPhone,
  content: message,
  status: "sent",
  timestamp: new Date(),
});
```

This makes sent messages appear in the conversation view alongside inbound messages.

---

## Feature 5: Token Refresh Background Worker

### Problem
Gmail OAuth tokens expire every hour. WhatsApp (360dialog) API keys have longer lifespans but can still expire. Without automatic refresh, agents silently lose the ability to send messages.

### Design
A background interval (every 30 minutes) inside the existing Node.js server process:

1. Query `aygent_agent_credentials` for credentials expiring within 2 hours: `WHERE expiresAt < NOW() + INTERVAL '2 hours'`
2. For each expiring credential:
   - Gmail: use refresh_token to get a new access_token from Google OAuth
   - WhatsApp/360dialog: API keys don't expire the same way, but if `expiresAt` is set, attempt refresh
3. On success: update `accessToken` and `expiresAt` via `updateToken()`
4. On failure: log the error, create an escalation (push notification to owner: "Sarah's Gmail disconnected")

**Implementation:** Use `setInterval` in the server startup (same pattern as the heartbeat scheduler). The credential service already has `listExpiring()` and `updateToken()` methods.

**Gmail refresh flow:**
```typescript
const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: credential.refreshToken,
    grant_type: "refresh_token",
  }),
});
```
