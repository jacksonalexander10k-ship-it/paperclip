# Aygency World — Self-Serve Launch Spec

**Date:** 2026-03-31
**Goal:** Make Aygency World ready for paying customers via self-serve sign-up.

## User Journey

```
Landing page → Sign up (email/password) → Enter card (Stripe Checkout, 7-day trial)
→ Onboarding wizard (agency name → first agent name + role)
→ CEO Chat opens → CEO sends welcome brief automatically
→ Owner talks to CEO → CEO proposes team → Owner approves → Agents hired
→ Agents run on heartbeats → Approvals appear in CEO Chat
→ Owner approves WhatsApp → "Connect WhatsApp to send this" prompt
→ Owner connects 360dialog → Message sends
→ Day 7: Stripe auto-bills or agents pause
```

## Work Items

### Item 1: Approve → Execute Pipeline

When an approval status changes to "approved", execute the real action.

**Changes:**
- `server/src/services/approvals.ts` — add `onApprove` hook after status update
- New file: `server/src/services/approval-executor.ts` — dispatches by action type:
  - `send_whatsapp` → load agent credentials → call 360dialog API (`POST https://waba.360dialog.io/v1/messages`)
  - `send_email` → load Gmail credentials → send via Gmail API
  - `post_instagram` → load Instagram token → post via Graph API
  - `hire_agent` → already handled by existing hire-hook
- If credentials missing → set approval status to `blocked_no_credentials`, return error to UI

**Payload expected in approval record:**
```json
{
  "action": "send_whatsapp",
  "to": "Ahmed Al Hashimi",
  "phone": "+971501234567",
  "message": "Hi Ahmed...",
  "lead_score": 7,
  "context": "Follow-up on JVC enquiry"
}
```

**360dialog send API:**
```
POST https://waba.360dialog.io/v1/messages
Header: D360-API-KEY: {agent's stored API key}
Body: { "to": "971501234567", "type": "text", "text": { "body": "..." } }
```

### Item 2: CEO First-Run Welcome Brief

When the onboarding wizard creates the CEO agent, immediately trigger a heartbeat.

**Changes:**
- `server/src/routes/companies.ts` (or wherever onboarding creates the company + agent) — after agent creation, call `heartbeat.wakeup(ceoAgent.id, { source: "onboarding", reason: "first_run" })`
- CEO's HEARTBEAT.md already handles Builder Mode (no sub-agents → greet owner, start interview)
- The CEO Chat issue must exist before the CEO runs — ensure the wizard creates it

**Result:** User finishes wizard → CEO Chat opens → within 30-60 seconds, CEO's welcome message streams in.

### Item 3: Stripe Trial Flow

Integrate Stripe Checkout into the sign-up flow with a 7-day free trial.

**Changes:**
- Billing service: add `createTrialCheckoutSession(companyId, successUrl, cancelUrl)` that creates a Starter plan checkout with `trial_period_days: 7`
- New DB columns or metadata on `companies` table: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus` (trialing | active | past_due | cancelled)
- Stripe webhook handler: update company subscription status on events:
  - `checkout.session.completed` → store customerId + subscriptionId, set status = "trialing"
  - `customer.subscription.updated` → update status
  - `invoice.payment_succeeded` → status = "active", resume agents if paused
  - `invoice.payment_failed` → status = "past_due", start 3-day grace
  - `customer.subscription.deleted` → status = "cancelled", pause all agents

### Item 4: Just-in-Time Integration Prompts

When approve → execute finds missing credentials, prompt the owner inline.

**Changes:**
- `approval-executor.ts`: when credentials not found, return `{ status: "blocked", reason: "no_whatsapp_credentials", agentId }` instead of failing silently
- Approval API response includes the block reason
- `ui/src/pages/CeoChat.tsx` InlineApprovalCard: if approval status is `blocked_no_credentials`, show the WhatsAppConnect component inline below the card with "Connect WhatsApp to send this"
- After connecting, show a "Retry" button that re-approves

### Item 5: Sign-Up → Billing → Onboarding Flow

Wire the full self-serve funnel as a sequence of pages.

**Flow:**
1. `/auth/sign-up` — email + password (better-auth)
2. `/billing/checkout` — Stripe Checkout (7-day trial, Starter plan)
3. `?onboarding=1` — Onboarding wizard (agency name → agent)
4. `/ceo-chat` — CEO Chat with welcome brief arriving

**Changes:**
- After sign-up success: redirect to billing checkout page
- Billing checkout page: call `POST /api/billing/checkout` → redirect to Stripe
- Stripe success callback URL: `/dashboard?onboarding=1` (triggers wizard)
- After wizard completes: navigate to `/ceo-chat`
- If user returns without completing: check `subscriptionStatus` and `hasCompletedOnboarding` to resume

### Item 6: Subscription Enforcement

Prevent agents from running when subscription is expired.

**Changes:**
- `server/src/services/heartbeat.ts` `tickTimers()`: before enqueueing a run, check company subscription status. If `cancelled` or `past_due` (beyond grace period) → skip, set agent status to "paused" with reason "subscription_expired"
- Dashboard: if subscription expired, show banner: "Your trial ended. Subscribe to keep your agents running." with CTA to Stripe Customer Portal
- CEO Chat continues to work (direct Anthropic API, not agent runtime) — this keeps the owner engaged even when agents are paused

### Item 7: Landing Page

Single-page marketing site at the root URL before auth.

**Content:**
- Hero: "Your AI agency. Always working." + subhead + CTA button
- 3 value props: "AI agents that work 24/7", "Approve everything before it sends", "One CEO, one chat, full control"
- Agent showcase: CEO, Lead Agent, Content Agent, Market Agent with icons
- Pricing table: Starter ($49), Growth ($99), Scale ($199), Enterprise (custom)
- FAQ: 3-4 common questions
- Sign-up CTA

**Implementation:** React route at `/` that renders before auth check. Or a static HTML page served by the server.

## What Already Works

- CEO Chat with streaming + real agency context + quick actions
- Approval cards in chat with approve/reject (uses real approval IDs)
- Agent creation with role defaults
- Heartbeat scheduler (30s tick loop, Claude Code spawning)
- WhatsApp webhook receiver
- 360dialog connect UI component
- Credential store (CRUD + lookup)
- MCP tool server (62 tools, role-scoped)
- Billing service (tiers, checkout, portal)
- Analytics API
- Mobile bottom nav with CEO Chat
- Demo seed data

## Deferred (ship without)

- Analytics UI charts
- WhatsApp conversation thread view
- Broker mobile UI
- Gmail Pub/Sub portal lead parsing
- 24-hour WhatsApp window tracking
- PWA push notifications
- AI Calling, Facebook Ads, Google Ads

## Build Order

| # | Item | Depends on |
|---|------|-----------|
| 1 | Approve → Execute pipeline | — |
| 2 | CEO first-run welcome brief | — |
| 3 | Stripe trial flow | — |
| 7 | Landing page | — |
| 4 | Just-in-time integration prompts | 1 |
| 5 | Sign-up → billing → onboarding flow | 3 |
| 6 | Subscription enforcement | 3 |

Items 1, 2, 3, 7 can be built in parallel.
