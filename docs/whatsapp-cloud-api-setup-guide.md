# WhatsApp Cloud API Direct Setup Guide for Multi-Tenant SaaS Platforms

> Complete practical guide for Aygency World. Researched April 2026.
> All information verified against Meta's current documentation and practitioner guides.

---

## Table of Contents

1. [Meta App Creation](#1-meta-app-creation)
2. [Meta Business Verification](#2-meta-business-verification)
3. [System User & Permanent Access Token](#3-system-user--permanent-access-token)
4. [WhatsApp Business Account (WABA)](#4-whatsapp-business-account-waba)
5. [Phone Number Registration](#5-phone-number-registration)
6. [Embedded Signup for Multi-Tenant Platforms](#6-embedded-signup-for-multi-tenant-platforms)
7. [Webhook Setup](#7-webhook-setup)
8. [Sending Messages](#8-sending-messages)
9. [Template Management](#9-template-management)
10. [Testing & Sandbox](#10-testing--sandbox)
11. [Rate Limits & Messaging Tiers](#11-rate-limits--messaging-tiers)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Costs & UAE Pricing](#13-costs--uae-pricing)
14. [Embedded Signup for ISVs/Platforms (Multi-Tenant)](#14-embedded-signup-for-isvs-platforms)

---

## 1. Meta App Creation

### Prerequisites
- A personal Facebook account (this becomes the admin)
- A Meta Business Manager account at business.facebook.com (or create one during setup)

### Step-by-Step

1. Go to **https://developers.facebook.com/** and log in with your Facebook credentials.

2. Click **My Apps** (top right) then **Create App**.

3. **Select App Type**: Choose **"Business"**. This is required for WhatsApp integration. Other app types (Consumer, Gaming, etc.) do not support WhatsApp.

4. **App Details**:
   - Display Name: e.g., "Aygency World WhatsApp"
   - App Contact Email: your business email
   - Business Portfolio: Select or create your Meta Business account
   - Click **Create App**

5. Re-enter your Facebook password when prompted.

6. You now have an **App ID** and **App Secret** (found in App Settings > Basic). Save both.

7. **Add WhatsApp Product**: Scroll down on the app dashboard, find the **WhatsApp** card, click **Set Up**.

8. You will be redirected to the **WhatsApp Getting Started** page. You can either:
   - Create a new Meta Business Account, or
   - Select an existing one

9. Meta automatically provisions:
   - A **WhatsApp Business Account (WABA)** linked to your app
   - A **test phone number** for development
   - A **temporary access token** (valid 24 hours only — see Section 3 for permanent tokens)

### Key IDs to Save
- **App ID**: Found in App Settings > Basic
- **App Secret**: Found in App Settings > Basic (click "Show")
- **Phone Number ID**: Found in WhatsApp > Getting Started
- **WhatsApp Business Account ID (WABA ID)**: Found in WhatsApp > Getting Started
- **Temporary Access Token**: Found in WhatsApp > Getting Started (expires in 24h)

### Required Permissions (for the app)
- `whatsapp_business_messaging` — send and receive messages
- `whatsapp_business_management` — manage phone numbers, templates, WABAs

---

## 2. Meta Business Verification

Business verification is **mandatory** to:
- Send messages to more than 250 unique users per day (Tier 0 limit)
- Register your own phone number (not just test number)
- Access production features

### Process

1. Go to **business.facebook.com** > **Settings** (gear icon) > **Business Info** > **Start Verification**

2. Meta asks for:
   - Legal business name (must match your trade license exactly)
   - Business address
   - Business phone number
   - Business website (must be live, with a privacy policy)

3. **Upload documents** (one of the following):
   - Business registration / trade license
   - Tax registration certificate
   - Utility bill showing business address
   - Bank statement showing business name

### UAE-Specific Documents

For UAE-based businesses (free zone or mainland):

| Entity Type | Accepted Document |
|-------------|-------------------|
| Free Zone LLC | Trade license from the free zone authority (IFZA, Meydan, DMCC, JAFZA, etc.) |
| Mainland LLC | DED (Department of Economic Development) trade license |
| Freelancer | Freelancer permit from the free zone |

**Specific requirements for UAE:**
- The trade license must be valid (not expired)
- Business name on the license must match your Meta Business Manager name exactly
- If your license is in Arabic only, you may need an English translation
- A utility bill (DEWA) or Ejari (tenancy contract) can serve as address proof
- Free zone licenses from IFZA, Meydan, Shams are all accepted

### Verification Methods

After document submission, Meta verifies via one of:
- **Phone call** to your business number (automated, with a verification code)
- **Email** to your domain email (e.g., admin@aygencyworld.com)
- **Domain verification** via DNS TXT record or meta-tag on your website

### Timeline
- Automated review: sometimes approved within **minutes**
- Manual review: typically **3-5 business days**
- If rejected: **2-4 weeks** for appeal

### Common Rejection Reasons and Fixes

| Rejection Reason | Fix |
|-----------------|-----|
| Business name doesn't match | Ensure your Meta Business name matches your trade license name character-for-character |
| Website doesn't match | Your website must be live, mention your business name, and have a privacy policy |
| Document quality | Upload high-resolution scans, not photos; ensure all text is legible |
| Document expired | Renew your trade license before applying |
| Not a recognized document | Use trade license, not MOA or shareholder certificates |
| Domain mismatch | Your business email domain must match your website domain |

---

## 3. System User & Permanent Access Token

The temporary token from the Getting Started page expires in **24 hours**. For production, you need a **permanent access token** via a System User.

### What is a System User?
A System User represents your application (not a person). It generates long-lived tokens that do not expire and are not tied to any individual's Facebook session.

### Step-by-Step

#### Step 1: Open Meta Business Settings
1. Go to **business.facebook.com**
2. Select your business
3. Click **Settings** (gear icon)

#### Step 2: Create a System User
1. Navigate to **Users > System Users**
2. Click **Add**
3. Enter a name (e.g., "Aygency World Production")
4. Select role: **Admin** (required for full WhatsApp access)
5. Click **Create System User**

#### Step 3: Assign Assets (CRITICAL — most commonly missed step)

Without this, the token will not work.

1. Select the system user you just created
2. Click **Assign Assets**
3. **Assign the App:**
   - Click "Apps" tab
   - Select your WhatsApp app
   - Enable **Full Control**
   - Click **Save Changes**
4. **Assign the WhatsApp Business Account:**
   - Go to **Accounts > WhatsApp Accounts** in Business Settings
   - Select your WABA
   - Click **Add People**
   - Select your system user
   - Enable **Full Control Access**
   - Click **Assign**

#### Step 4: Generate the Permanent Token
1. Go back to **Users > System Users**
2. Select your system user
3. Click **Generate New Token**
4. Select your App from the dropdown
5. **Set Token Expiry**: Choose "Never" for a permanent token
6. **Select Permissions** — check these two:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Click **Generate Token**
8. **COPY THE TOKEN IMMEDIATELY** — it is shown only once. Store it securely (e.g., in a secrets manager or encrypted env variable).

### Important Notes
- Permanent tokens do NOT expire, but they can be invalidated if:
  - The system user is deleted
  - Asset assignments are changed
  - The app is deleted
  - Business verification is revoked
- Never commit the token to source code
- Rotate tokens immediately if you suspect exposure
- For multi-tenant: you generate ONE system user token for your platform. Customer WABAs get their own tokens via Embedded Signup (see Section 6).

---

## 4. WhatsApp Business Account (WABA)

### What is a WABA?
A WABA (WhatsApp Business Account) is the container that holds phone numbers, message templates, and billing info. Think of it as the "workspace" for one business.

### Can One Meta App Have Multiple WABAs?
**Yes.** This is exactly how multi-tenant works:
- Your single Meta App (Aygency World) connects to **multiple WABAs** — one per agency customer
- Each WABA has its own phone numbers, templates, messaging limits, and billing
- Each WABA can be owned by the customer's own Meta Business Manager (via Embedded Signup)

### How WABAs Are Created for Multi-Tenant

There are two approaches:

#### Approach A: Embedded Signup (Recommended for SaaS)
- Customer goes through Embedded Signup flow in your UI
- Meta creates or connects the customer's WABA automatically
- Your platform gets an access token scoped to that WABA
- The customer owns their WABA; you have API access to it
- See Section 6 for full details

#### Approach B: Business Management API (Programmatic)
```
POST https://graph.facebook.com/v21.0/{business-id}/owned_whatsapp_business_accounts
```
- Requires `whatsapp_business_management` permission
- Creates a WABA owned by YOUR business (not the customer's)
- Less ideal for multi-tenant — customers don't own their data

### WABA Structure
```
Meta Business Manager (yours — Aygency World)
├── App: "Aygency World WhatsApp"
│
├── WABA: "Dubai Properties LLC" (Agency 1)
│   ├── Phone: +971 50 111 1111 (Sarah — Lead Agent)
│   ├── Phone: +971 55 222 2222 (Mohammed — Lead Agent)
│   └── Templates: hello_world, new_lead_welcome, followup_24h, ...
│
├── WABA: "Marina Homes Real Estate" (Agency 2)
│   ├── Phone: +971 50 333 3333
│   └── Templates: ...
│
└── WABA: "Palm Estates" (Agency 3)
    ├── Phone: +971 55 444 4444
    └── Templates: ...
```

---

## 5. Phone Number Registration

### Overview
Each WABA needs at least one registered phone number. The number must be able to receive SMS or voice calls for OTP verification.

### Requirements for the Phone Number
- Must be a valid phone number that can receive SMS or voice calls
- Cannot already be registered on WhatsApp (personal) or WhatsApp Business App
- If currently used on WhatsApp, you must delete the WhatsApp account first
- Virtual numbers (Twilio, etc.) work as long as they can receive SMS/voice
- The number does NOT need to be in the same country as your business

### Registration Process

#### Via Meta Dashboard (Manual)
1. Go to your App > WhatsApp > Getting Started
2. Click **Add Phone Number**
3. Enter the phone number with country code
4. Enter a display name (e.g., "Sarah from Dubai Properties")
5. Choose verification method: **SMS** or **Voice Call**
6. Enter the 6-digit OTP code received
7. Number is now registered and ready

#### Via API (Programmatic)
```bash
# Step 1: Request verification code
POST https://graph.facebook.com/v21.0/{phone-number-id}/request_code
{
  "code_method": "SMS",  # or "VOICE"
  "language": "en"
}

# Step 2: Verify the code
POST https://graph.facebook.com/v21.0/{phone-number-id}/verify_code
{
  "code": "123456"
}

# Step 3: Register the number
POST https://graph.facebook.com/v21.0/{phone-number-id}/register
{
  "messaging_product": "whatsapp",
  "pin": "123456"  # 6-digit PIN for two-step verification
}
```

### Display Name Rules
- Must represent your business accurately
- Cannot be a generic term (e.g., "Real Estate" alone)
- Must match or relate to your verified business name
- Meta reviews display names — approval takes minutes to hours
- If rejected, you can resubmit with corrections

### Phone Number for AI Agents (Aygency World specific)
Each AI agent (Sarah, Mohammed, Listings Agent, etc.) gets its own phone number:
- Agency buys the number (physical SIM, eSIM, or virtual via Twilio)
- Number is registered via Embedded Signup or API
- Stored in `agent_credentials` table with the agent's WABA phone_number_id
- Webhook demultiplexer routes inbound messages by `phone_number_id` to the correct agent

---

## 6. Embedded Signup for Multi-Tenant Platforms

Embedded Signup is Meta's official way for platforms like Aygency World to let customers connect their WhatsApp numbers without leaving your UI.

### How It Works (High-Level Flow)

```
1. Agency owner clicks "Connect WhatsApp" in Aygency World UI
2. Meta's JavaScript SDK opens a popup
3. Owner logs into their Facebook/Meta account
4. Owner selects or creates a Meta Business account
5. Owner creates or selects a WABA
6. Owner adds and verifies a phone number
7. Popup closes and returns data to your callback
8. Your backend receives: WABA ID, phone number ID, access token
9. You store these credentials and start sending/receiving messages
```

### Prerequisites
- Your Meta App must be set to **"Business" type**
- Your Meta Business must be **verified**
- Facebook Login must be added to your app
- Your app must have `whatsapp_business_management` and `whatsapp_business_messaging` permissions

### Implementation

#### Step 1: Include Facebook SDK
```html
<script async defer crossorigin="anonymous"
  src="https://connect.facebook.net/en_US/sdk.js">
</script>
```

#### Step 2: Initialize the SDK
```javascript
window.fbAsyncInit = function() {
  FB.init({
    appId: 'YOUR_APP_ID',
    autoLogAppEvents: true,
    xfbml: true,
    version: 'v21.0'
  });
};
```

#### Step 3: Launch Embedded Signup
```javascript
function launchWhatsAppSignup() {
  FB.login(function(response) {
    if (response.authResponse) {
      const code = response.authResponse.code;
      // Send this code to your backend to exchange for a token
      // Your backend calls: POST /oauth/access_token with this code
      // Returns: access_token scoped to the customer's WABA
    }
  }, {
    config_id: 'YOUR_CONFIG_ID', // Created in Facebook Login settings
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      setup: {
        // Optional: pre-fill business info
      },
      featureType: '',
      sessionInfoVersion: '3',
    }
  });
}
```

#### Step 4: Handle the Callback (Backend)
```javascript
// Exchange the code for an access token
const response = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?` +
  `client_id=${APP_ID}&` +
  `client_secret=${APP_SECRET}&` +
  `code=${code}`,
  { method: 'GET' }
);
const { access_token } = await response.json();

// This access_token is scoped to the customer's WABA
// Store it securely in your database
// Use it for all API calls on behalf of this customer
```

#### Step 5: Get WABA Details
```javascript
// After signup, use the debug_token endpoint or
// listen for the webhook event to get WABA ID and phone number ID

// Or query directly:
const wabaResponse = await fetch(
  `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts`,
  {
    headers: { 'Authorization': `Bearer ${access_token}` }
  }
);
```

### Config ID Setup
You need a "Configuration" in your Facebook Login settings:
1. Go to your App > Facebook Login > Settings
2. Create a new Configuration
3. Set the **Login Type** to "WhatsApp Embedded Signup"
4. Add the permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
5. Save — you get a **Config ID** to use in the SDK call

### What the Customer Experiences
1. They click a button in your UI
2. A Meta popup opens (similar to "Login with Facebook")
3. They log in to Facebook (or are already logged in)
4. They see a screen to select/create a Meta Business account
5. They see a screen to create a WABA or select an existing one
6. They enter their phone number and verify with OTP
7. Popup closes — done. Under 2 minutes.

### Token Management for Multi-Tenant
- Each customer's WABA gets its own access token via Embedded Signup
- Store tokens encrypted in your `agency_credentials` table
- Tokens from Embedded Signup are **long-lived** but can expire
- Subscribe to `account_update` webhooks to detect token issues
- Implement a token refresh mechanism

---

## 7. Webhook Setup

Webhooks are how your platform receives inbound messages, delivery receipts, template status updates, and account events.

### Overview of Webhook Features

| Feature | Details |
|---------|---------|
| Protocol | HTTPS with valid SSL (no self-signed certs) |
| Verification | GET request with hub.verify_token + hub.challenge |
| Notifications | POST requests with JSON payloads |
| Authentication | HMAC-SHA256 signature in `X-Hub-Signature-256` header |
| Retry | Exponential backoff for up to 7 days |
| Success | Must return HTTP 200 within 5-10 seconds |
| Delivery guarantee | At-least-once (you may get duplicates) |
| Ordering | NOT guaranteed (events may arrive out of order) |
| Payload size | Up to 3 MB |
| Configuration levels | Phone Number Webhook (primary), WABA Webhook (fallback) |

### Step 1: Create Your Webhook Endpoint

Your server must handle two types of requests:

#### Verification (GET) — happens once during setup
```javascript
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

#### Notifications (POST) — happens for every event
```javascript
app.post('/webhook/whatsapp', (req, res) => {
  // MUST respond 200 quickly (within 5-10 seconds)
  res.sendStatus(200);

  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        if (change.field === 'messages') {
          const value = change.value;
          const phoneNumberId = value.metadata.phone_number_id;

          // Route to correct tenant/agent by phone_number_id
          const messages = value.messages || [];
          const statuses = value.statuses || [];

          messages.forEach(msg => {
            // Handle inbound message
            // msg.from = sender's phone number
            // msg.text.body = message text
            // msg.type = 'text', 'image', 'document', etc.
          });

          statuses.forEach(status => {
            // Handle delivery receipts
            // status.status = 'sent', 'delivered', 'read', 'failed'
          });
        }
      });
    });
  }
});
```

### Step 2: Register Webhook in Meta Dashboard

1. Go to your App > WhatsApp > Configuration
2. Under **Webhook**, click **Edit**
3. Enter your **Callback URL**: `https://your-domain.com/webhook/whatsapp`
4. Enter your **Verify Token**: a secret string you define (e.g., `aygency_world_webhook_2026`)
5. Click **Verify and Save**
6. Meta sends a GET request to your URL — your endpoint must respond with the challenge

### Step 3: Subscribe to Events

After verification, subscribe to these webhook fields:

| Field | What It Provides |
|-------|-----------------|
| `messages` | Inbound messages, delivery receipts, message errors |
| `message_template_status_update` | Template approved, rejected, or paused |
| `phone_number_quality_update` | Quality rating changes (GREEN/YELLOW/RED) |
| `phone_number_name_update` | Display name approval status |
| `account_update` | Policy violations, restrictions, bans |
| `account_review_update` | Business verification status changes |
| `business_capability_update` | Changes to account capabilities |
| `security` | Security-related events |

### Step 4: Verify Webhook Signatures (CRITICAL for security)

Every POST from Meta includes an `X-Hub-Signature-256` header:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(req.rawBody) // MUST use raw body, before JSON parsing
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Critical**: You must verify against the **raw request body** (before any JSON parsing middleware). Use `express.raw()` or capture raw body in middleware.

### Multi-Tenant Webhook Routing

All inbound messages from ALL connected agencies hit your ONE webhook endpoint. Route by `phone_number_id`:

```javascript
// In your webhook handler:
const phoneNumberId = change.value.metadata.phone_number_id;

// Look up which agent/agency owns this number
const agent = await db.query(
  'SELECT agent_id, company_id FROM agent_credentials WHERE whatsapp_phone_number_id = $1',
  [phoneNumberId]
);

// Route to correct agent's task queue
await createPaperclipIssue({
  companyId: agent.company_id,
  assignee: agent.agent_id,
  title: `Inbound WhatsApp from ${senderName}`,
  description: messageBody
});
```

### Important: TLS Certificate Update (2026)

Meta is rolling out a new CA certificate (`meta-outbound-api-ca-2025-12.pem`). Your server MUST trust this certificate by April 2026 or webhook delivery will fail with TLS handshake errors. Add it to your server's trust store.

---

## 8. Sending Messages

All messages are sent via the same endpoint:

```
POST https://graph.facebook.com/v21.0/{phone-number-id}/messages
Authorization: Bearer {access-token}
Content-Type: application/json
```

### Text Message (free-form, within 24h window only)
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "971501234567",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Hi Ahmed! Thanks for reaching out about JVC properties."
  }
}
```

### Template Message (required outside 24h window)
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "template",
  "template": {
    "name": "new_lead_welcome",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Ahmed" },
          { "type": "text", "text": "Sarah" },
          { "type": "text", "text": "Dubai Properties" },
          { "type": "text", "text": "Binghatti Hills JVC" }
        ]
      }
    ]
  }
}
```

### Image Message
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "image",
  "image": {
    "link": "https://your-cdn.com/property-photo.jpg",
    "caption": "Binghatti Hills — 1BR starting from AED 800K"
  }
}
```

### Document Message
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "document",
  "document": {
    "link": "https://your-cdn.com/pitch-deck.pdf",
    "caption": "Binghatti Hills Pitch Deck",
    "filename": "binghatti-hills-pitch.pdf"
  }
}
```

### Interactive Buttons (within 24h window)
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Would you like to schedule a viewing?"
    },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": { "id": "yes_viewing", "title": "Yes, schedule" }
        },
        {
          "type": "reply",
          "reply": { "id": "more_info", "title": "More info first" }
        },
        {
          "type": "reply",
          "reply": { "id": "no_thanks", "title": "No thanks" }
        }
      ]
    }
  }
}
```

### Interactive List (within 24h window)
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "body": {
      "text": "Which area are you interested in?"
    },
    "action": {
      "button": "Choose Area",
      "sections": [
        {
          "title": "Popular Areas",
          "rows": [
            { "id": "jvc", "title": "JVC", "description": "Jumeirah Village Circle" },
            { "id": "downtown", "title": "Downtown", "description": "Downtown Dubai" },
            { "id": "marina", "title": "Marina", "description": "Dubai Marina" }
          ]
        }
      ]
    }
  }
}
```

### Location Message
```json
{
  "messaging_product": "whatsapp",
  "to": "971501234567",
  "type": "location",
  "location": {
    "longitude": 55.2744,
    "latitude": 25.1972,
    "name": "Binghatti Hills",
    "address": "JVC, Dubai, UAE"
  }
}
```

### API Response (Success)
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "971501234567", "wa_id": "971501234567" }],
  "messages": [{ "id": "wamid.HBgLMTIzNDU2Nzg5MAA..." }]
}
```

### The 24-Hour Window Rule
- When a customer sends you a message, a **24-hour messaging window** opens
- During this window: send any message type (text, image, interactive, etc.) — free
- After 24 hours of no customer reply: window closes
- To message them again: MUST use an approved **template message** (paid)
- Template messages can re-open the window if the customer replies

### Character/Content Limits
- Text messages: max 4,096 characters (but keep under 1,600 for readability)
- Interactive buttons: max 3 buttons, each title max 20 characters
- Interactive list: max 10 rows per section, max 10 sections
- Template body: max 1,024 characters
- Up to 10 buttons per template

---

## 9. Template Management

### Creating Templates via API

```bash
POST https://graph.facebook.com/v21.0/{waba-id}/message_templates

{
  "name": "new_lead_welcome",
  "language": "en",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Welcome to {{1}}!"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, this is {{2}} from {{3}}. Thanks for your interest in {{4}}! Would you like to see pricing and floor plans?"
    },
    {
      "type": "FOOTER",
      "text": "Reply STOP to unsubscribe"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Yes, send details"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Schedule a call"
        }
      ]
    }
  ]
}
```

### Template Categories

| Category | Use Case | Approval Speed | Cost (UAE) |
|----------|----------|----------------|------------|
| MARKETING | Promotions, project launches, broadcasts | Minutes to hours | Highest |
| UTILITY | Order updates, appointment reminders, follow-ups | Minutes | Lower |
| AUTHENTICATION | OTP codes, verification | Minutes | Lowest |

**Important**: If you categorize incorrectly (e.g., promotional content in UTILITY), Meta will reject the template.

### Checking Template Status

```bash
GET https://graph.facebook.com/v21.0/{waba-id}/message_templates?name=new_lead_welcome

# Response includes:
# status: "APPROVED", "PENDING", "REJECTED"
# rejected_reason: (if rejected) explains why
```

### Template Statuses
- **APPROVED**: Ready to use
- **PENDING**: Under Meta review
- **REJECTED**: Violated a policy — check `rejected_reason`
- **PAUSED**: Temporarily disabled due to quality issues (low engagement, high blocks)
- **DISABLED**: Permanently disabled

### Listing All Templates
```bash
GET https://graph.facebook.com/v21.0/{waba-id}/message_templates
```

### Deleting a Template
```bash
DELETE https://graph.facebook.com/v21.0/{waba-id}/message_templates?name=old_template
```

### Template Best Practices
- Always include `{{1}}` style variables for personalization
- Keep body under 1,024 characters
- Include an opt-out option in marketing templates (e.g., "Reply STOP")
- Do not use ALL CAPS, excessive punctuation, or misleading content
- Match the category to the content (marketing = marketing, not utility)
- Use the template library for pre-approved utility/authentication templates
- Templates are reviewed per-WABA — each agency submits their own

### Common Template Rejection Reasons
- Promotional content tagged as UTILITY
- Missing or incorrect placeholder formatting (`{{1}}` not `{1}`)
- Grammatical errors or unclear purpose
- Restricted keywords ("guaranteed returns", "100% profit")
- Too similar to an already-rejected template
- Content that violates WhatsApp Commerce Policy

---

## 10. Testing & Sandbox

### Meta's Test Phone Number

When you set up your app, Meta automatically provides:
- A **test phone number** (not a real number you own)
- A **Phone Number ID** for this test number
- Pre-approved test templates (e.g., `hello_world`)

### How to Test

1. Go to App > WhatsApp > Getting Started
2. Copy the **Temporary Access Token** and **Phone Number ID**
3. Add your personal WhatsApp number to the **allowed recipient list** (up to 5 numbers for testing)
4. Send a test message:

```bash
curl -X POST "https://graph.facebook.com/v21.0/{test-phone-number-id}/messages" \
  -H "Authorization: Bearer {temporary-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "YOUR_PERSONAL_WHATSAPP_NUMBER",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": { "code": "en_US" }
    }
  }'
```

### Test Number Limitations
- Can only send to numbers you've added to the allowed list
- Cannot receive inbound messages (for testing webhooks, you must use your own number)
- Temporary token expires every 24 hours
- Cannot test at scale (limited to 5 recipient numbers)

### Testing Webhooks Locally

Meta requires a publicly accessible HTTPS URL. For local development:

1. **ngrok** (most common): `ngrok http 3003` — gives you a public HTTPS URL
2. **Cloudflare Tunnel**: `cloudflared tunnel --url localhost:3003`
3. Update the webhook URL in Meta Dashboard each time the tunnel URL changes

**Gotcha**: Free ngrok URLs change every restart. Either pay for a fixed subdomain or use Cloudflare Tunnel with a permanent hostname.

### Testing Sequence for Aygency World
1. Send `hello_world` template to your phone — verify delivery
2. Reply from your phone — verify webhook receives the inbound message
3. Send a custom template — verify template rendering
4. Send media (image, document) — verify delivery
5. Test the 24h window: send a free-form text within the window
6. Test webhook signature verification
7. Test error handling (send to invalid number, expired token, etc.)

---

## 11. Rate Limits & Messaging Tiers

### The 5 Tier Levels (2026)

| Tier | Unique Users per 24h | Throughput | How to Reach |
|------|---------------------|------------|--------------|
| **Tier 0** | 250 | ~80 msg/sec | Unverified business — default starting point |
| **Tier 1** | 1,000 | ~80 msg/sec | After Meta Business verification |
| **Tier 2** | 10,000 | ~80 msg/sec | Consistently message near Tier 1 limit with good quality |
| **Tier 3** | 100,000 | ~80 msg/sec | Consistently message near Tier 2 limit with good quality |
| **Tier 4** | Unlimited | up to 1,000 msg/sec | Enterprise-level, stable quality history |

### Tier Progression Rules
- Meta checks for tier upgrades **every 6 hours** (changed from 24-48h in 2025)
- To upgrade: maintain **Medium or High quality rating** AND consistently send near your current limit over 7 days
- You cannot skip tiers — must progress 0 → 1 → 2 → 3 → 4
- Business verification is required to move from Tier 0 to Tier 1

### Portfolio Limits (Major Change — October 2025)

**Before October 2025**: Each phone number had its own tier. New numbers started at Tier 0.

**After October 2025**: Messaging limits are shared across ALL phone numbers in a Business Portfolio (Meta Business Manager). This means:
- If your existing number is at Tier 3, every new number you add **instantly inherits Tier 3**
- No more "warming up" new numbers
- BUT: poor performance on ANY number can drag down the ENTIRE portfolio

### Quality Rating

| Rating | Meaning | Impact |
|--------|---------|--------|
| **Green (High)** | Low block/report rate | Can tier up; full capacity |
| **Yellow (Medium)** | Moderate complaints | Can still tier up but at risk |
| **Red (Low)** | High block/report rate | Cannot tier up; may be reduced |

What affects quality:
- User blocks and spam reports
- Template quality score
- No specific thresholds published by Meta

**2026 change**: Red rating prevents tier advancement but no longer causes automatic immediate downgrade (gives time to correct).

### Frequency Capping (The Invisible Limit)

Since 2025, Meta limits how many **marketing** messages an individual user receives per day — **across ALL brands**. The limit is approximately **2 marketing templates per user per day** (total from all businesses, not just yours).

- Error code `131049` indicates the user is "saturated"
- This is NOT your fault — it means other businesses already messaged them
- Workaround: send at off-peak hours, focus on utility messages, personalize heavily

### Throughput Limits
- Default: **80 messages per second** (MPS) per phone number
- Tier 4 (Unlimited): up to **1,000 MPS**
- Throughput includes ALL message types (inbound + outbound)
- Error `130429` = throughput limit hit
- Error `131048` = spam rate limit (too many messages too fast)

### API Rate Limits
- **Business Management API**: 200 calls per hour per WABA
- **Cloud API (messages)**: 80 MPS default, 1,000 MPS at Unlimited tier
- **Template creation**: Limited — avoid creating/deleting templates rapidly

---

## 12. Common Pitfalls

### Account Bans & Restrictions

| Error Code | Meaning | Fix |
|-----------|---------|-----|
| 368 | Temporarily blocked for policy violations | Review Meta's Commerce & Business Policies; appeal via Business Support |
| 131031 | Account locked | Contact Meta support; usually requires identity verification |
| 130497 | Restricted from messaging users in this country | Check if marketing templates are paused for that market (e.g., US) |

**Ban prevention best practices:**
- Always get explicit opt-in before messaging
- Include STOP/unsubscribe option in every marketing message
- Never cold-spam — only message leads who have shown interest
- Personalize every message (use lead name, specific property/project)
- Stop after 3 unanswered messages to a lead
- Respond to inbound messages quickly (within the 24h window)
- Don't send repetitive identical templates
- Honour opt-outs IMMEDIATELY

### Template Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Template rejected | Wrong category, policy violation, formatting | Check rejection reason; fix and resubmit |
| Template paused | Low engagement or high block rate | Improve content quality; template auto-re-enables after quality improves |
| Error 132000 | Parameter count mismatch | Ensure component parameters match template definition exactly |
| Error 132001 | Template doesn't exist | Check name spelling, language code, and approval status |

### Webhook Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Webhooks not arriving | App not subscribed to WABA events | Go to App Dashboard > Webhooks > Subscribe to the correct WABA |
| "Shadow delivery" failure | Webhook URL verified but app not actually subscribed to the WABA | Must explicitly subscribe your app to each WABA via API or dashboard |
| TLS handshake failure (2026) | Missing new Meta CA certificate | Add `meta-outbound-api-ca-2025-12.pem` to your trust store |
| Duplicate events | At-least-once delivery | Implement idempotency using message IDs |
| Out-of-order events | No ordering guarantee | Use timestamps, not arrival order |

### Token Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Error 190 | Token expired | Use permanent token (System User), not temporary token |
| Error 10 | Permission denied | Verify token has `whatsapp_business_messaging` + `whatsapp_business_management` |
| Token suddenly invalid | Asset assignment changed or system user deleted | Re-assign assets and regenerate token |

### Other Common Issues
- **Error 131021**: Sender and recipient are the same number — use a different test number
- **Error 133006**: Phone number needs re-verification — re-verify via SMS/voice
- **Error 131045**: Phone number registration error — re-register the number
- **US marketing freeze**: Since April 2025, marketing templates to +1 numbers are NOT delivered. Only utility and authentication work for US numbers.

---

## 13. Costs & UAE Pricing

### Pricing Model (Effective July 1, 2025)

WhatsApp moved from **conversation-based pricing** to **per-message pricing**. You are charged when a template message is **delivered** (not sent).

### UAE-Specific Rates (As of April 2026)

| Category | Rate per Message (USD) | Notes |
|----------|----------------------|-------|
| **Marketing** | ~$0.0781 | Highest cost; for promotions, broadcasts, project launches |
| **Utility** | ~$0.0266 | For transactional updates, appointment confirmations |
| **Authentication** | ~$0.0232 | For OTP codes, verification |
| **Service** | **FREE** | Customer-initiated replies within 24h window |

**Notes on UAE rates:**
- Rates are based on the **recipient's phone country code** (+971), not your business location
- October 2025: increased marketing rates applied for UAE
- April 2026: AED now available as a billing currency
- Rates published by Meta change periodically — always verify at business.whatsapp.com/products/platform-pricing
- The first 1,000 service conversations per month per WABA were free (this was under the old conversation model; under per-message pricing, all service messages within 24h windows are free regardless of volume)

### Volume Tiers (Discounts for High-Volume Senders)

Effective April 1, 2026, Meta introduced volume-based discounts for utility and authentication messages:
- Higher volume = lower per-message rate
- Exact tier breakpoints published in Meta's rate card spreadsheet
- Marketing messages do NOT currently have volume discounts

### Cost Estimation for a Typical Dubai Agency

| Activity | Volume/Month | Category | Est. Cost |
|----------|-------------|----------|-----------|
| New lead first contact | 200 leads | Marketing | ~$15.62 |
| Follow-up messages | 100 | Utility | ~$2.66 |
| Viewing confirmations | 50 | Utility | ~$1.33 |
| Customer replies (within 24h) | 500 | Service | FREE |
| Project launch broadcast to 300 leads | 300 | Marketing | ~$23.43 |
| **Total** | | | **~$43/month** |

### Additional Costs Beyond Meta
- **BSP fees** (if using 360dialog or similar): $5-10/month per connected number
- **Phone number** (if virtual via Twilio): ~$5/month per number
- **If going direct (no BSP)**: No BSP fees, but you handle all infrastructure
- **Meta does NOT charge** for receiving messages or for the API itself — only for outbound template message delivery

### Billing Setup
- Billing is configured per WABA in Meta Business Manager
- Credit card required
- Charges appear on a monthly invoice
- Each agency (WABA) can have its own payment method
- Or the platform (Aygency World) can pay for all WABAs and pass costs through to agencies

---

## 14. Embedded Signup for ISVs/Platforms

### Does Aygency World Need Tech Provider Status?

**Short answer: No, not to launch.** But it helps for scale.

### The Three-Tier Path

| Level | Requirements | What You Get |
|-------|-------------|--------------|
| **ISV via BSP** (launch) | Partner with 360dialog or similar BSP | Co-branded Embedded Signup, BSP handles Meta relationship |
| **Meta Tech Provider** (growth) | Your own Meta App, verified business, technical review by Meta | Your own Embedded Signup (your brand only), more independence |
| **Meta Tech Partner** (scale) | 10+ clients, 2,500+ avg daily conversations | Directory listing, incentive programs, premium support |

### Important Deadline (Already Passed)

**All ISVs were required to enroll as Tech Providers with Meta by June 30, 2025.** This was a Meta mandate. If you missed this deadline, you likely need to apply now through the standard Tech Provider application or work with an existing BSP.

### Direct Access (No BSP) — What You Need

To use WhatsApp Cloud API directly without a BSP:
1. Create a Meta App (Section 1)
2. Complete Meta Business Verification (Section 2)
3. Your customers go through Embedded Signup in your UI (Section 6)
4. You handle all API calls, webhooks, and token management yourself
5. You pay Meta directly for message delivery (no BSP markup)

**Advantages of going direct:**
- No BSP fees ($5-10/month per number saved)
- Full control over the customer experience
- Direct relationship with Meta
- No dependency on a third party

**Disadvantages:**
- You handle all infrastructure, error handling, and support
- No fallback if Meta restricts your app
- Must manage TLS certificates, token refreshes, etc. yourself
- Embedded Signup setup is more complex without BSP scaffolding

### Tech Provider Application Process

1. Go to **developers.facebook.com** > Partner Programs
2. Submit application with:
   - Verified Meta Business Manager
   - Live platform/website with clear description
   - Privacy policy and Terms of Service
   - Demonstration video showing your platform's WhatsApp features
   - Temporary dashboard access for Meta reviewers
3. Meta reviews (2-6 weeks)
4. If approved: you get Tech Provider status, listed in partner directory

### Multi-Tenant Architecture Summary

```
Aygency World Platform
├── One Meta App (App ID: xxx)
├── One Webhook URL: https://aygencyworld.com/webhook/whatsapp
├── One System User (for platform-level operations)
│
├── Agency 1: Dubai Properties LLC
│   ├── WABA 1 (created via Embedded Signup)
│   ├── Token 1 (from Embedded Signup, stored encrypted)
│   ├── Phone: +971 50 111 1111 (phone_number_id: abc)
│   └── Phone: +971 55 222 2222 (phone_number_id: def)
│
├── Agency 2: Marina Homes
│   ├── WABA 2 (created via Embedded Signup)
│   ├── Token 2
│   └── Phone: +971 50 333 3333 (phone_number_id: ghi)
│
└── Webhook receives ALL messages for ALL agencies
    └── Routes by phone_number_id → correct agency → correct agent
```

### Key Technical Decisions for Aygency World

1. **Go direct to Meta** (no BSP) — saves $5-10/number/month, full control
2. **One Meta App** serves all agencies — standard SaaS pattern
3. **Embedded Signup** for agency onboarding — under 2 minutes per agency
4. **One webhook endpoint** with phone_number_id routing — simple and scalable
5. **System User token** for platform operations — permanent, no expiry
6. **Per-WABA tokens** from Embedded Signup for per-agency operations
7. **Store tokens encrypted** in `agency_credentials` table
8. **Subscribe to quality + template status webhooks** — proactive monitoring

---

## Quick Reference: Essential API Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Send message | POST | `https://graph.facebook.com/v21.0/{phone-number-id}/messages` |
| Create template | POST | `https://graph.facebook.com/v21.0/{waba-id}/message_templates` |
| List templates | GET | `https://graph.facebook.com/v21.0/{waba-id}/message_templates` |
| Delete template | DELETE | `https://graph.facebook.com/v21.0/{waba-id}/message_templates?name={name}` |
| Register phone | POST | `https://graph.facebook.com/v21.0/{phone-number-id}/register` |
| Request OTP | POST | `https://graph.facebook.com/v21.0/{phone-number-id}/request_code` |
| Verify OTP | POST | `https://graph.facebook.com/v21.0/{phone-number-id}/verify_code` |
| Get business profile | GET | `https://graph.facebook.com/v21.0/{phone-number-id}/whatsapp_business_profile` |
| Upload media | POST | `https://graph.facebook.com/v21.0/{phone-number-id}/media` |
| Get media URL | GET | `https://graph.facebook.com/v21.0/{media-id}` |

**Base URL**: `https://graph.facebook.com/v21.0/`
**Auth Header**: `Authorization: Bearer {access-token}`
**Content-Type**: `application/json`

---

## Sources

- [GyanSys: Complete WhatsApp Cloud API Setup Manual](https://gyansys.com/whatsapp-cloud-api-setup/)
- [WhatsBoost: How to Become a WhatsApp Partner (Meta ISV)](https://whatsboost.in/blog/how-to-become-a-whatsapp-partner-meta-isv-step-by-step-guide-for-agencies-tech-providers-saas-builders)
- [Anjok Technologies: Permanent Access Token Guide 2026](https://anjoktechnologies.in/blog/-whatsapp-cloud-api-permanent-access-token-step-by-step-system-user-2026-complete-correct-guide-by-anjok-technologies)
- [NOEM.AI: Permanent Access Token Guide](https://noem.ai/help/creating-a-permanent-access-token-for-whatsapp-business-api)
- [Chatarmin: WhatsApp Cloud API Guide 2026](https://chatarmin.com/en/blog/whatsapp-cloudapi)
- [Chatarmin: WhatsApp Messaging Limits 2026](https://chatarmin.com/en/blog/whats-app-messaging-limits)
- [Hookdeck: Guide to WhatsApp Webhooks](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- [WASenderApi: Multi-Tenant WhatsApp Architecture Guide](https://wasenderapi.com/blog/how-to-build-a-white-label-whatsapp-marketing-platform-infrastructure-architecture-guide)
- [WeTarseel: WhatsApp API Pricing 2026](https://wetarseel.ai/whatsapp-api-pricing-all-you-need-to-know-in-2026/)
- [FlowCall: WhatsApp Business API Pricing 2026](https://www.flowcall.co/blog/whatsapp-business-api-pricing-2026)
- [GreenAds Global: WhatsApp API Pricing Dubai 2026](https://www.greenadsglobal.com/post/whatsapp-api-pricing-uae)
- [Heltar: All Meta WhatsApp Error Codes Troubleshooting Guide](https://www.heltar.com/blogs/all-meta-error-codes-explained-along-with-complete-troubleshooting-guide-2025-cm69x5e0k000710xtwup66500)
- [3Sigma: WhatsApp Cloud API Account Bans & Best Practices](https://help.3sigmacrm.com/whatsapp-cloud-api-account-bans-setup-requirements-and-best-practices)
- [Meta Official: WhatsApp Business Platform Pricing](https://business.whatsapp.com/products/platform-pricing)
- [Meta Official: Embedded Signup Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [FreJun: Embedded Signup for WhatsApp Business Guide](https://frejun.com/whatsapp-business-embedded-signup-guide/)
