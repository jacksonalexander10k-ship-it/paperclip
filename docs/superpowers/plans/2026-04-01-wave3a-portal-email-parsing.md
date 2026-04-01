# Wave 3a: Portal Email Parsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-import leads from Property Finder, Bayut, and Dubizzle notification emails. When a portal sends a lead notification to the agency's connected Gmail, parse it and create a lead record + Paperclip issue for the Sales Agent.

**Architecture:** Gmail Pub/Sub pushes notifications to a webhook endpoint. The webhook fetches the email via Gmail API, parses the portal-specific format, creates a lead, and assigns it to the Sales Agent via a Paperclip issue.

**Tech Stack:** Gmail API (REST), Express webhook endpoint, Drizzle ORM

---

### Task 1: Gmail Webhook Endpoint

**Files:**
- Create: `server/src/routes/gmail-webhook.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create the Gmail webhook handler**

Create `server/src/routes/gmail-webhook.ts`. This handles Gmail Pub/Sub push notifications.

Gmail Pub/Sub sends a POST with:
```json
{
  "message": {
    "data": "base64-encoded-json",
    "messageId": "...",
    "publishTime": "..."
  },
  "subscription": "projects/.../subscriptions/..."
}
```

The base64-decoded `data` contains: `{ "emailAddress": "agent@agency.com", "historyId": "12345" }`

The handler should:
1. Decode the base64 data to get `emailAddress` and `historyId`
2. Look up which agent owns this email via `agentCredentialService.findByGmailAddress(emailAddress)`
3. If no agent found, return 200 (ack the message, ignore)
4. Fetch recent emails using Gmail API (history.list or messages.list with the agent's access token)
5. For each new email, check if it matches a portal notification format
6. If it matches, parse the lead data and create a lead + issue

For now, implement steps 1-3 and stub steps 4-6 (we'll implement the parser in Task 2).

```typescript
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";

export function gmailWebhookRoutes(db: Db) {
  const router = Router();
  const credentials = agentCredentialService(db);

  // Gmail Pub/Sub push notification
  router.post("/webhook/gmail", async (req, res) => {
    try {
      const message = req.body?.message;
      if (!message?.data) {
        res.status(200).send("OK");
        return;
      }

      const decoded = JSON.parse(
        Buffer.from(message.data, "base64").toString("utf8"),
      );
      const { emailAddress, historyId } = decoded;

      if (!emailAddress) {
        res.status(200).send("OK");
        return;
      }

      // Find which agent owns this email
      const credential = await credentials.findByGmailAddress(emailAddress);
      if (!credential) {
        console.log(`[gmail-webhook] No agent found for ${emailAddress}`);
        res.status(200).send("OK");
        return;
      }

      // TODO: Fetch and parse emails (Task 2)
      console.log(`[gmail-webhook] Notification for ${emailAddress} (agent: ${credential.agentId}), historyId: ${historyId}`);

      res.status(200).send("OK");
    } catch (err) {
      console.error("[gmail-webhook] Error:", err);
      res.status(200).send("OK"); // Always ack to prevent retries
    }
  });

  return router;
}
```

IMPORTANT: This route must be mounted BEFORE auth middleware (like the WhatsApp webhook). Read how `whatsapp-webhook.ts` is mounted in `app.ts` — it's likely mounted at a different level than authenticated routes.

- [ ] **Step 2: Register the route**

Add to `server/src/routes/index.ts` and mount in `server/src/app.ts` before the auth middleware (same pattern as WhatsApp webhook).

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/gmail-webhook.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat: Gmail Pub/Sub webhook endpoint — receives push notifications"
```

---

### Task 2: Email Fetcher + Portal Parser

**Files:**
- Create: `server/src/services/gmail-fetcher.ts`
- Create: `server/src/services/portal-email-parser.ts`
- Modify: `server/src/routes/gmail-webhook.ts`

- [ ] **Step 1: Create Gmail email fetcher**

Create `server/src/services/gmail-fetcher.ts` — fetches recent emails from Gmail API using an agent's access token.

```typescript
export async function fetchRecentEmails(
  accessToken: string,
  afterHistoryId?: string,
  maxResults: number = 10,
): Promise<Array<{ id: string; subject: string; from: string; body: string; receivedAt: string }>> {
  // Use Gmail API: GET https://gmail.googleapis.com/gmail/v1/users/me/messages
  // With query: "is:unread newer_than:1h"
  // Then for each message: GET .../messages/{id}?format=full
  // Parse headers for Subject, From, Date
  // Parse body (base64url-decode the text/plain or text/html part)
}
```

Use the Gmail REST API directly (no SDK needed):
- List messages: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:1h&maxResults=10`
- Get message: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=full`
- Headers: `Authorization: Bearer {accessToken}`

- [ ] **Step 2: Create portal email parser**

Create `server/src/services/portal-email-parser.ts` — detects and parses portal notification emails.

Each portal has a recognizable sender and format:

**Property Finder:**
- From: contains "propertyfinder.ae" or "noreply@propertyfinder.ae"
- Subject: contains "New Lead" or "New Enquiry"
- Body format: Name, Phone, Email, Property reference, Message

**Bayut:**
- From: contains "bayut.com" or "leads@bayut.com"
- Subject: contains "New Lead" or "Enquiry"
- Body format: Similar — name, contact info, property link

**Dubizzle:**
- From: contains "dubizzle.com"
- Subject: contains "enquiry" or "lead"

The parser should return:
```typescript
interface ParsedLead {
  source: "property_finder" | "bayut" | "dubizzle" | "unknown";
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  propertyRef: string | null;
}
```

Use regex patterns to extract fields. Keep it simple — parse the text/plain body. These emails have fairly consistent formats.

If the email doesn't match any portal format, return `null` (not a portal email, ignore it).

- [ ] **Step 3: Wire parser into webhook handler**

Update `server/src/routes/gmail-webhook.ts` to:
1. Call `fetchRecentEmails()` with the agent's access token
2. For each email, call the parser
3. If a lead is parsed, create it (Task 3)

- [ ] **Step 4: Commit**

```bash
git add server/src/services/gmail-fetcher.ts server/src/services/portal-email-parser.ts server/src/routes/gmail-webhook.ts
git commit -m "feat: Gmail email fetcher + portal notification parser (PF/Bayut/Dubizzle)"
```

---

### Task 3: Auto-Create Leads from Parsed Emails

**Files:**
- Create: `server/src/services/lead-ingestion.ts`
- Modify: `server/src/routes/gmail-webhook.ts`

- [ ] **Step 1: Create lead ingestion service**

Create `server/src/services/lead-ingestion.ts` — creates a lead record and a Paperclip issue from a parsed portal email.

```typescript
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentLeads, issues, agents as agentsTable } from "@paperclipai/db";

export function leadIngestionService(db: Db) {
  return {
    ingestFromPortal: async (
      companyId: string,
      agentId: string,
      parsed: {
        source: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        message: string | null;
        propertyRef: string | null;
      },
    ) => {
      // Check for duplicate (same phone or email within company)
      if (parsed.phone) {
        const existing = await db
          .select({ id: aygentLeads.id })
          .from(aygentLeads)
          .where(
            and(
              eq(aygentLeads.companyId, companyId),
              eq(aygentLeads.phone, parsed.phone),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          console.log(`[lead-ingestion] Duplicate phone ${parsed.phone}, skipping`);
          return null;
        }
      }

      // Create lead
      const [lead] = await db
        .insert(aygentLeads)
        .values({
          companyId,
          agentId,
          name: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          source: parsed.source,
          stage: "lead",
          score: 5, // Default medium score for portal leads
          notes: parsed.message
            ? `Portal enquiry: ${parsed.message}${parsed.propertyRef ? `\nProperty: ${parsed.propertyRef}` : ""}`
            : null,
        })
        .returning();

      // Create Paperclip issue for the Sales Agent to process
      // Find the Sales/Lead agent for this company
      const salesAgent = await db
        .select({ id: agentsTable.id })
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.companyId, companyId),
            eq(agentsTable.role, "lead"),
            eq(agentsTable.status, "active"),
          ),
        )
        .limit(1);

      const assigneeId = salesAgent[0]?.id ?? agentId;

      const [issue] = await db
        .insert(issues)
        .values({
          companyId,
          title: `New ${parsed.source.replace("_", " ")} lead: ${parsed.name ?? "Unknown"}`,
          description: [
            `**Source:** ${parsed.source}`,
            parsed.name ? `**Name:** ${parsed.name}` : null,
            parsed.phone ? `**Phone:** ${parsed.phone}` : null,
            parsed.email ? `**Email:** ${parsed.email}` : null,
            parsed.message ? `**Message:** ${parsed.message}` : null,
            parsed.propertyRef ? `**Property:** ${parsed.propertyRef}` : null,
            "",
            "Respond within 5 minutes. Qualify: budget, area, timeline, financing.",
          ]
            .filter(Boolean)
            .join("\n"),
          status: "todo",
          priority: "high",
          assigneeAgentId: assigneeId,
          originKind: "webhook",
        })
        .returning();

      console.log(
        `[lead-ingestion] Created lead ${lead!.id} + issue ${issue!.id} from ${parsed.source}`,
      );

      return { lead: lead!, issue: issue! };
    },
  };
}
```

- [ ] **Step 2: Wire into webhook handler**

Update `server/src/routes/gmail-webhook.ts` to call `leadIngestionService.ingestFromPortal()` for each successfully parsed email.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/lead-ingestion.ts server/src/routes/gmail-webhook.ts
git commit -m "feat: auto-create leads from parsed portal emails — PF/Bayut/Dubizzle"
```

---

### Task 4: Leads API Routes

The `aygent_leads` table exists but has no API routes. Properties page links to leads — we need a basic CRUD API.

**Files:**
- Create: `server/src/services/leads.ts`
- Create: `server/src/routes/leads.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create leads service**

Create `server/src/services/leads.ts` with:
- `list(companyId, filters?)` — list leads with optional filters: source, stage, score range, search query
- `getById(companyId, leadId)` — single lead
- `create(companyId, data)` — create lead
- `update(companyId, leadId, data)` — update lead fields
- `remove(companyId, leadId)` — soft delete

Follow the same pattern as `server/src/services/properties.ts`.

- [ ] **Step 2: Create leads routes**

Create `server/src/routes/leads.ts` with standard CRUD endpoints:
- `GET /companies/:companyId/leads` — list with filters
- `GET /companies/:companyId/leads/:leadId` — get by id
- `POST /companies/:companyId/leads` — create
- `PATCH /companies/:companyId/leads/:leadId` — update
- `DELETE /companies/:companyId/leads/:leadId` — soft delete

Register in routes/index.ts and mount in app.ts.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/leads.ts server/src/routes/leads.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat: leads CRUD API routes"
```
