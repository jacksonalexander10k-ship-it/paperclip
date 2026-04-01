# Wave 3b: Facebook Ads Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agents to create and manage Facebook ad campaigns, with lead form submissions automatically creating leads. Campaign launches go through the approval system.

**Architecture:** Facebook Marketing API tools in the tools package. Facebook Lead Ads webhook for inbound leads. Campaign approval type in the executor. OAuth credential storage for `ads_management` scope.

**Tech Stack:** Facebook Marketing API (REST), Express webhooks, existing approval system

---

### Task 1: Facebook Ads Credential Support

**Files:**
- Modify: `server/src/services/agent-credentials.ts` (if needed)
- Create: `server/src/routes/facebook-connect.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create Facebook OAuth connect route**

Create `server/src/routes/facebook-connect.ts` — a manual credential store endpoint (same pattern as WhatsApp connect). The agency connects their Facebook Ads account by providing their access token and ad account ID.

```typescript
// POST /agents/:agentId/connect/facebook — store credentials
// GET /agents/:agentId/connect/facebook — check connection status
// DELETE /agents/:agentId/connect/facebook — disconnect
```

Store as service type `"facebook"` in `aygent_agent_credentials` with:
- `accessToken` — Facebook access token with `ads_management`, `ads_read`, `leads_retrieval` scopes
- `providerAccountId` — Facebook Ad Account ID (act_XXXXX)

- [ ] **Step 2: Register and commit**

```bash
git add server/src/routes/facebook-connect.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat: Facebook Ads credential connect/disconnect endpoints"
```

---

### Task 2: Facebook Ads Service

**Files:**
- Create: `server/src/services/facebook-ads.ts`

- [ ] **Step 1: Create the Facebook Ads service**

Create `server/src/services/facebook-ads.ts` — wraps Facebook Marketing API calls.

Methods:
- `createCampaign(token, adAccountId, params)` — POST to `https://graph.facebook.com/v21.0/{adAccountId}/campaigns`
- `createAdSet(token, adAccountId, params)` — POST to `.../adsets`
- `createAd(token, adAccountId, params)` — POST to `.../ads`
- `createLeadForm(token, pageId, params)` — POST to `.../leadgen_forms`
- `getCampaignStats(token, campaignId)` — GET with fields=insights
- `pauseCampaign(token, campaignId)` — POST with status=PAUSED
- `updateBudget(token, adSetId, budget)` — POST with daily_budget

Each method is a thin wrapper around `fetch()` to the Facebook Graph API. Return the raw response data.

- [ ] **Step 2: Commit**

```bash
git add server/src/services/facebook-ads.ts
git commit -m "feat: Facebook Marketing API service — campaign, ad set, ad, lead form"
```

---

### Task 3: Facebook Lead Webhook

**Files:**
- Create: `server/src/routes/facebook-webhook.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create Facebook Lead webhook handler**

When someone fills out a Facebook Lead Ad form, Facebook sends a webhook. The handler should:

1. Verify the webhook signature (using `X-Hub-Signature-256` header + app secret)
2. Parse the lead data from the webhook payload
3. Fetch full lead details from Facebook Graph API: `GET /{leadId}?access_token=...&fields=...`
4. Create a lead in `aygent_leads` using `leadIngestionService`
5. Create a Paperclip issue for the Sales Agent

Facebook Lead webhook payload:
```json
{
  "object": "page",
  "entry": [{
    "id": "page_id",
    "time": 1234567890,
    "changes": [{
      "field": "leadgen",
      "value": {
        "form_id": "...",
        "leadgen_id": "...",
        "page_id": "...",
        "created_time": 1234567890
      }
    }]
  }]
}
```

Also handle the webhook verification GET request (same pattern as WhatsApp — `hub.mode`, `hub.verify_token`, `hub.challenge`).

- [ ] **Step 2: Register before auth middleware**

Mount in app.ts before auth (same as WhatsApp and Gmail webhooks).

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/facebook-webhook.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat: Facebook Lead Ads webhook — auto-create leads from ad form submissions"
```

---

### Task 4: Campaign Launch Approval Type

**Files:**
- Modify: `server/src/services/approval-executor.ts`

- [ ] **Step 1: Add campaign launch execution**

In the approval executor, add a handler for `launch_fb_campaign` approval type:

```typescript
case "launch_fb_campaign": {
  // Get Facebook credentials for the agent
  const fbCred = await credentials.getByAgentAndService(agentId, "facebook");
  if (!fbCred?.accessToken) {
    return { executed: false, action, blockedReason: "no_facebook_credentials" };
  }

  // Create campaign via Facebook API
  const { campaignName, objective, dailyBudget, targeting, creative } = payload;

  const campaign = await facebookAds.createCampaign(fbCred.accessToken, fbCred.providerAccountId, {
    name: campaignName,
    objective: objective ?? "LEAD_GENERATION",
    status: "ACTIVE",
    special_ad_categories: ["HOUSING"], // Required for real estate
  });

  // Create ad set with targeting + budget
  // Create ad with creative
  // Return result

  return { executed: true, action, result: campaign };
}
```

Also add `pause_fb_campaign` and `update_fb_budget` action types.

- [ ] **Step 2: Commit**

```bash
git add server/src/services/approval-executor.ts
git commit -m "feat: Facebook campaign launch/pause via approval executor"
```

---

### Task 5: Campaign Management Skill Update

**Files:**
- Modify: `skills/behaviour/facebook-ads.md`

- [ ] **Step 1: Add API tool references to the skill**

The existing `skills/behaviour/facebook-ads.md` (447 lines) is a comprehensive playbook. Add a section at the top with the actual API endpoints agents should use:

```markdown
## API Tools Available

### Create Campaign (via Approval)
To launch a Facebook campaign, create an approval request:
POST /companies/$COMPANY_ID/approvals
{
  "type": "launch_fb_campaign",
  "payload": {
    "campaignName": "JVC Off-Plan — Lead Gen",
    "objective": "LEAD_GENERATION",
    "dailyBudget": 15000, // AED cents
    "targeting": { ... },
    "creative": { ... }
  }
}

### Check Performance
GET /companies/$COMPANY_ID/facebook/campaigns/:id/stats

### Pause Campaign (via Approval)
POST /companies/$COMPANY_ID/approvals
{
  "type": "pause_fb_campaign",
  "payload": { "campaignId": "..." }
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/behaviour/facebook-ads.md
git commit -m "feat: update Facebook Ads skill with API tool references"
```
