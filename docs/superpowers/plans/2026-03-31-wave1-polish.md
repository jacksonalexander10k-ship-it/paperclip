# Wave 1: Daily Usage Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 features that make the daily WhatsApp approve-and-send loop production-ready: conversation view, edit-before-approve, 24h window tracking, outbound message storage, token refresh worker.

**Architecture:** All features layer onto existing infrastructure. No new services — extend approval-executor, webhook handler, credential service. One new table (whatsapp_windows). One new API endpoint (messages list). UI changes to approval cards and a new conversation drawer.

**Tech Stack:** Same as existing — Drizzle, Express, React, TanStack Query, Tailwind, Radix

**Spec:** `docs/superpowers/specs/2026-03-31-wave1-polish-design.md`

---

### Task 1: Outbound WhatsApp Message Storage

**Why first:** Features 1 (conversation view) depends on outbound messages being stored. Do this first so the conversation view shows both directions from day one.

**Files:**
- Modify: `server/src/services/approval-executor.ts`

- [ ] **Step 1: Read the approval executor**

Read `server/src/services/approval-executor.ts` to understand the `executeWhatsApp()` function and where to add the insert.

- [ ] **Step 2: Add outbound message storage**

After the successful 360dialog API call in `executeWhatsApp()`, insert a record into `aygent_whatsapp_messages`:

```typescript
import { aygentWhatsappMessages } from "@paperclipai/db";

// After successful send (response.ok check):
await db.insert(aygentWhatsappMessages).values({
  companyId: approval.companyId,
  agentId: approval.requestedByAgentId,
  chatJid: phone,
  messageId: `sent-${approval.id}-${Date.now()}`,
  fromMe: true,
  senderName: "Agent",
  senderPhone: credential.whatsappPhoneNumberId ?? "",
  content: message,
  status: "sent",
  timestamp: new Date(),
});
```

The function needs access to `db` — check how it's passed (it may need to be added to the executor factory function).

- [ ] **Step 3: Verify the schema import works**

Make sure `aygentWhatsappMessages` is exported from `@paperclipai/db`. Check `packages/db/src/schema/index.ts` for the export.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/approval-executor.ts
git commit -m "feat: store outbound WhatsApp messages after successful send"
```

---

### Task 2: WhatsApp Messages API Endpoint

**Files:**
- Modify: `server/src/routes/whatsapp-webhook.ts` (or create a new route file)

- [ ] **Step 1: Add messages list endpoint**

Add a new GET endpoint for fetching WhatsApp messages. Read `server/src/routes/whatsapp-webhook.ts` first to see how it's structured. If it only handles webhooks, create the endpoint in a suitable existing route file or add it there.

```typescript
// GET /companies/:companyId/whatsapp/messages?chatJid=phone&agentId=uuid
router.get("/companies/:companyId/whatsapp/messages", async (req, res) => {
  const { companyId } = req.params;
  assertCompanyAccess(req, companyId);

  const { chatJid, agentId } = req.query;
  if (!chatJid || typeof chatJid !== "string") {
    res.status(400).json({ error: "chatJid is required" });
    return;
  }

  const conditions = [
    eq(aygentWhatsappMessages.companyId, companyId),
    eq(aygentWhatsappMessages.chatJid, chatJid),
  ];
  if (agentId && typeof agentId === "string") {
    conditions.push(eq(aygentWhatsappMessages.agentId, agentId));
  }

  const messages = await db
    .select()
    .from(aygentWhatsappMessages)
    .where(and(...conditions))
    .orderBy(asc(aygentWhatsappMessages.timestamp));

  res.json(messages);
});
```

- [ ] **Step 2: Register the route if new file created**

If a new route file was created, export it from `server/src/routes/index.ts` and mount it in `server/src/app.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/ server/src/app.ts
git commit -m "feat: add WhatsApp messages list endpoint"
```

---

### Task 3: WhatsApp Conversation Drawer UI

**Files:**
- Create: `ui/src/components/WhatsAppConversationDrawer.tsx`
- Create: `ui/src/api/whatsapp.ts`

- [ ] **Step 1: Create WhatsApp API client**

Create `ui/src/api/whatsapp.ts`:

```typescript
import { api } from "./client";

export interface WhatsAppMessage {
  id: string;
  companyId: string;
  agentId: string | null;
  chatJid: string;
  messageId: string;
  fromMe: boolean;
  senderName: string | null;
  senderPhone: string | null;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  status: string | null;
  timestamp: string;
}

export const whatsappApi = {
  messages: (companyId: string, chatJid: string, agentId?: string) => {
    const params = new URLSearchParams({ chatJid });
    if (agentId) params.set("agentId", agentId);
    return api.get<WhatsAppMessage[]>(
      `/companies/${companyId}/whatsapp/messages?${params}`,
    );
  },
};
```

- [ ] **Step 2: Create conversation drawer component**

Create `ui/src/components/WhatsAppConversationDrawer.tsx`. Read existing drawer/dialog patterns in the codebase first (check `ui/src/components/ui/` for Sheet or Dialog components from Radix).

The drawer should:
- Accept props: `open`, `onClose`, `chatJid`, `agentId`, `contactName`
- Fetch messages using `whatsappApi.messages()`
- Render as a right-side slide-out panel (use Radix Sheet if available, or a fixed-position div)
- Chat bubbles:
  - Inbound (fromMe=false): left-aligned, `bg-accent rounded-xl rounded-tl-sm p-3`
  - Outbound (fromMe=true): right-aligned, `bg-primary/10 rounded-xl rounded-tr-sm p-3`
  - Each: sender name (11px, muted), message text (13px), timestamp (10px, muted)
- Auto-scroll to bottom on open
- "No messages yet" empty state
- Header: contact name + phone number + close button

- [ ] **Step 3: Add query keys for whatsapp**

Add to `ui/src/lib/queryKeys.ts`:

```typescript
whatsapp: {
  messages: (companyId: string, chatJid: string, agentId?: string) =>
    ["whatsapp", "messages", companyId, chatJid, agentId] as const,
},
```

- [ ] **Step 4: Wire drawer into approval cards**

Open the CEO Chat approval renderer in `ui/src/pages/CeoChat.tsx`. Find where approval cards render for `send_whatsapp` type. Add a "View conversation" button that opens the drawer with the lead's phone number as `chatJid`.

Also open `ui/src/components/ApprovalCard.tsx` and add the same button for WhatsApp-type approvals on the Approvals page.

- [ ] **Step 5: Commit**

```bash
git add ui/src/api/whatsapp.ts ui/src/components/WhatsAppConversationDrawer.tsx ui/src/pages/CeoChat.tsx ui/src/components/ApprovalCard.tsx ui/src/lib/queryKeys.ts
git commit -m "feat: WhatsApp conversation drawer — view chat history from approval cards"
```

---

### Task 4: Edit-Before-Approve

**Files:**
- Modify: `server/src/routes/approvals.ts`
- Modify: `server/src/services/approvals.ts`
- Modify: `ui/src/pages/CeoChat.tsx`
- Modify: `ui/src/components/ApprovalCard.tsx`

- [ ] **Step 1: Backend — accept editedPayload on approve**

Read `server/src/routes/approvals.ts` and `server/src/services/approvals.ts`. Find the approve endpoint and the `approve()` service method.

Modify the approve flow: if `req.body.editedPayload` is provided, merge it into the approval's payload before executing.

In the route handler (`POST /approvals/:id/approve`):
```typescript
const { editedPayload } = req.body;
const approval = await approvalsSvc.approve(id, actorInfo, editedPayload);
```

In the service `approve()` method, before calling the executor:
```typescript
if (editedPayload) {
  // Merge edited fields into existing payload
  const updatedPayload = { ...approval.payload, ...editedPayload };
  await db.update(approvals).set({ payload: updatedPayload }).where(eq(approvals.id, id));
  approval.payload = updatedPayload;
}
```

- [ ] **Step 2: UI — add edit mode to CEO Chat approval cards**

In `ui/src/pages/CeoChat.tsx`, find the inline approval card renderer. Add:
- `isEditing` state per approval
- "Edit" button alongside "Approve & Send" and "Decline"
- When editing: replace the message preview with a `<textarea>` pre-filled with `payload.message`
- "Approve & Send" button sends `{ editedPayload: { message: editedText } }` to the approve endpoint
- "Cancel" button reverts to preview mode

- [ ] **Step 3: UI — add edit mode to ApprovalCard component**

Same pattern in `ui/src/components/ApprovalCard.tsx` for the Approvals page.

- [ ] **Step 4: Update the approve API call in the frontend**

Find where the approve mutation is called in the UI (likely in the approval API client or inline in the components). Ensure it passes `editedPayload` in the POST body.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/approvals.ts server/src/services/approvals.ts ui/src/pages/CeoChat.tsx ui/src/components/ApprovalCard.tsx
git commit -m "feat: edit-before-approve — edit message content in approval cards"
```

---

### Task 5: 24-Hour WhatsApp Window Tracking

**Files:**
- Create: `packages/db/src/schema/aygent-whatsapp-windows.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `server/src/routes/whatsapp-webhook.ts`
- Modify: `server/src/services/approval-executor.ts`

- [ ] **Step 1: Create window tracking table**

Create `packages/db/src/schema/aygent-whatsapp-windows.ts`:

```typescript
import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents as agentsTable } from "./agents.js";

export const aygentWhatsappWindows = pgTable(
  "aygent_whatsapp_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
    chatJid: text("chat_jid").notNull(),
    windowOpenedAt: timestamp("window_opened_at", { withTimezone: true }).notNull(),
    windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    uniqueAgentChat: unique("aygent_whatsapp_windows_unique").on(table.agentId, table.chatJid),
    companyIdx: index("aygent_whatsapp_windows_company_idx").on(table.companyId),
  }),
);
```

Export from schema index. Generate and run migration.

- [ ] **Step 2: Upsert window on inbound message**

In `server/src/routes/whatsapp-webhook.ts`, after inserting the inbound message, upsert the window:

```typescript
import { aygentWhatsappWindows } from "@paperclipai/db";

const now = new Date();
const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

await db
  .insert(aygentWhatsappWindows)
  .values({
    companyId: agent.companyId,
    agentId: agent.id,
    chatJid: senderPhone,
    windowOpenedAt: now,
    windowExpiresAt: expiresAt,
  })
  .onConflictDoUpdate({
    target: [aygentWhatsappWindows.agentId, aygentWhatsappWindows.chatJid],
    set: { windowOpenedAt: now, windowExpiresAt: expiresAt },
  });
```

- [ ] **Step 3: Check window before sending**

In `server/src/services/approval-executor.ts`, before the 360dialog API call in `executeWhatsApp()`:

```typescript
// Check 24h window
const window = await db
  .select()
  .from(aygentWhatsappWindows)
  .where(
    and(
      eq(aygentWhatsappWindows.agentId, agentId),
      eq(aygentWhatsappWindows.chatJid, phone),
    ),
  )
  .limit(1);

const windowOpen = window[0] && new Date(window[0].windowExpiresAt) > new Date();

if (!windowOpen) {
  return {
    executed: false,
    action: "send_whatsapp",
    blockedReason: "whatsapp_window_closed",
    error: "24-hour messaging window closed. Use a template message.",
  };
}
```

- [ ] **Step 4: Show window status on approval cards**

In the UI approval card renderers, add a check: when rendering a `send_whatsapp` approval, query whether the window is open for that phone number. If closed, show a warning badge.

Add a lightweight endpoint: `GET /companies/:companyId/whatsapp/window-status?chatJid=phone&agentId=uuid` that returns `{ open: boolean, expiresAt: string | null }`.

- [ ] **Step 5: Generate migration, commit**

```bash
pnpm db:generate && pnpm db:migrate
git add packages/db/src/schema/ server/src/routes/ server/src/services/
git commit -m "feat: 24h WhatsApp window tracking — block sends after window expires"
```

---

### Task 6: Token Refresh Background Worker

**Files:**
- Create: `server/src/workers/token-refresh.ts`
- Modify: `server/src/index.ts` (or wherever the server starts)

- [ ] **Step 1: Create token refresh worker**

Create `server/src/workers/token-refresh.ts`:

```typescript
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";

export function startTokenRefreshWorker(db: Db) {
  const credentials = agentCredentialService(db);
  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  async function refreshExpiring() {
    try {
      const expiring = await credentials.listExpiring(120); // expiring within 2 hours

      for (const cred of expiring) {
        try {
          if (cred.service === "gmail" && cred.refreshToken) {
            const response = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID ?? "",
                client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
                refresh_token: cred.refreshToken,
                grant_type: "refresh_token",
              }),
            });

            if (response.ok) {
              const data = await response.json() as { access_token: string; expires_in: number };
              const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
              await credentials.updateToken(cred.id, data.access_token, newExpiresAt);
              console.log(`  ✓ Refreshed Gmail token for credential ${cred.id}`);
            } else {
              console.error(`  ✗ Failed to refresh Gmail token for ${cred.id}: ${response.status}`);
              // TODO: create escalation notification for owner
            }
          }
          // 360dialog API keys typically don't expire via OAuth refresh
          // but if expiresAt is set, log a warning
          if (cred.service === "whatsapp" && !cred.refreshToken) {
            console.warn(`  ⚠ WhatsApp credential ${cred.id} expiring but no refresh mechanism`);
          }
        } catch (err) {
          console.error(`  ✗ Token refresh failed for credential ${cred.id}:`, err);
        }
      }

      if (expiring.length > 0) {
        console.log(`Token refresh: processed ${expiring.length} expiring credentials`);
      }
    } catch (err) {
      console.error("Token refresh worker error:", err);
    }
  }

  // Run immediately on startup, then every 30 minutes
  refreshExpiring();
  const interval = setInterval(refreshExpiring, INTERVAL_MS);

  return { stop: () => clearInterval(interval) };
}
```

- [ ] **Step 2: Start the worker in server startup**

Read `server/src/index.ts` to find where the server starts. After the server is listening, start the worker:

```typescript
import { startTokenRefreshWorker } from "./workers/token-refresh.js";

// After server.listen():
const tokenRefreshWorker = startTokenRefreshWorker(db);
```

- [ ] **Step 3: Verify the credential service methods exist**

Read `server/src/services/agent-credentials.ts` and confirm `listExpiring()` and `updateToken()` methods exist and match the expected signatures.

- [ ] **Step 4: Commit**

```bash
git add server/src/workers/token-refresh.ts server/src/index.ts
git commit -m "feat: background token refresh worker — auto-renew expiring Gmail tokens"
```

---

## Summary

| Task | Feature | Complexity |
|------|---------|------------|
| 1 | Outbound message storage | Small — add INSERT after send |
| 2 | Messages API endpoint | Small — one GET route |
| 3 | Conversation drawer UI | Medium — new component + wiring |
| 4 | Edit-before-approve | Medium — backend + UI changes |
| 5 | 24h window tracking | Medium — new table + enforcement |
| 6 | Token refresh worker | Small — background interval |
