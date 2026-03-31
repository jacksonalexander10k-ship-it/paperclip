---
name: whatsapp-outbound
description: >
  Rules and strategy for all outbound WhatsApp communication — first contact,
  follow-ups, broadcasts, template usage, and 24-hour window management.
  Use when: sending any WhatsApp message to a lead or client.
  Don't use when: handling inbound WhatsApp messages (use lead-response).
---

# WhatsApp Outbound Communication — Rules & Strategy

## The #1 Rule: 24-Hour Messaging Window

WhatsApp Business API enforces two messaging modes. NEVER violate these — Meta will ban the number.

### When You CAN Send Free-Form Messages
- The lead has replied to you within the last 24 hours
- The 24-hour window is OPEN
- You can say anything naturally — no template required
- Use `send_whatsapp` tool

### When You MUST Use a Template
- First contact with a new lead (never messaged before)
- Lead hasn't replied in 24+ hours (window CLOSED)
- Broadcast to multiple leads
- Use `use_whatsapp_template` tool — select the right template, fill in variables

### How to Check
Before every outbound message:
1. Check when the lead last replied to this agent's number
2. If < 24 hours ago → free-form OK
3. If > 24 hours ago or never → template required
4. If you try `send_whatsapp` with a closed window, the tool will reject it and tell you to use a template

---

## First Contact — New Leads

Every first message to a new lead MUST use a template. Choose based on lead source:

### From Facebook/Instagram Lead Ad
Template: `new_lead_welcome` or `property_details`
- Lead already showed interest in a specific project — reference it
- Fill variables: lead name, agent name, agency name, project name
- Keep it warm and specific — they just submitted a form, strike while hot

### From Property Finder / Bayut / Dubizzle
Template: `new_lead_welcome`
- Reference the specific listing they enquired about
- Respond as fast as possible — portal response speed affects agency ranking
- Target: under 5 minutes from lead entry

### From Website / Landing Page Form
Template: `new_lead_welcome` or `property_details`
- Reference what they were looking at on the website/landing page

### From Manual Entry / CSV Import
Template: `new_lead_welcome`
- Keep it general since we may not know their specific interest
- Focus on starting a conversation, not selling

---

## Follow-Up Strategy — Template Selection

When the 24-hour window closes and you need to re-engage:

### 24-Hour Follow-Up (lead was engaged but stopped replying)
Template: `followup_24h`
- Short, low-pressure, one question
- "Just checking in about [project]. Any questions I can help with?"

### 48-Hour Follow-Up (lead went quiet after initial interest)
Template: `followup_48h`
- Add new value — new availability, updated info, different angle
- "We have some new options for [area] that might interest you"

### 1-Week Follow-Up (lead has gone cold)
Template: `followup_48h` or a custom follow-up template
- Provide genuine value — market data, price change, new launch
- Don't just say "are you still interested?" — give them a reason to reply

### 30-Day Reactivation (stale lead)
Template: `stale_reactivation_30d`
- Reference something that changed since you last spoke
- New launches, price drops, market shifts
- This is the last attempt before archiving if no response

### The 3-Strike Rule
After 3 unanswered template messages with no reply:
- STOP messaging this lead
- Tag as `unresponsive`
- Move to passive nurture (monthly campaign only, not direct outbound)
- Flag to CEO: "Lead [name] has not responded to 3 follow-ups. Archiving from active outbound."

---

## During the 24-Hour Window — Conversation Rules

When the window is open and you're in a free-form conversation:

### Tone
- Match the lead's language (Arabic, English, Russian, etc.)
- Match their formality level — if they're casual, be casual; if formal, be formal
- Use the agent's persona (defined in agent config — e.g., "friendly, bilingual, concise")
- Sign messages with the agent's name: "— Sarah, Dubai Properties"

### Message Length
- Keep messages SHORT — 2-4 sentences max for each message
- Break long responses into 2 messages rather than one wall of text
- Use line breaks and spacing for readability
- WhatsApp is a chat, not an email — write like a human texting

### Media & Documents
- Send property images when relevant (renders, floor plans, photos)
- Send PDFs for: brochures, payment plans, pitch decks
- Send location pins for viewing addresses
- Send voice notes ONLY if the lead sends one first (match their communication style)

### Qualifying During Conversation
When the window is open, use it to qualify:
1. Budget: "What budget range are you considering?"
2. Timeline: "When are you looking to buy/move?"
3. Purpose: "Is this for investment or to live in?"
4. Area: "Any specific areas you're interested in?"
5. Financing: "Are you looking at mortgage or cash purchase?"

Don't ask all at once — spread across natural conversation. Extract answers from what they say naturally rather than interrogating them.

### Urgency Signals — Escalate Immediately
If the lead says any of these during conversation, create an escalation:
- "I want to buy" / "I'm ready" / "Let's proceed"
- "How do I pay?" / "Where do I sign?"
- "Can I see it today/tomorrow?"
- Mentions specific unit numbers or floor preferences
- Budget > AED 5M
- Score reaches 8+

→ Create escalation card immediately. Do not continue qualifying — this lead needs a human broker NOW.

---

## Broadcasts — Mass Outbound

For sending to multiple leads at once (project launch, market update):

### Before Sending
1. Select template (must be approved by Meta — marketing category)
2. Filter target leads: by area interest, budget range, score, language, opt-in status
3. EXCLUDE: opted-out leads, leads with active broker assignment, leads contacted in last 7 days
4. Calculate cost estimate: lead count × ~$0.078 per marketing conversation
5. Create approval card for CEO with: template preview, lead count, cost estimate, target criteria

### Sending Rules
- Send in batches (50-100 at a time) to avoid rate limit issues
- Personalise every message — use lead name and relevant project/area in template variables
- Schedule broadcasts during Dubai business hours (9am-7pm GST) — never late night
- Maximum 1 broadcast per week to the same lead list (don't spam)

### After Sending
- Track: delivered count, read count, reply count, opt-out count
- Report to CEO: "Broadcast sent to 300 leads. 280 delivered, 95 read, 12 replied, 2 opted out."
- Leads who replied → their 24-hour window is now open → follow up with natural conversation
- Leads who opted out → tag immediately, never contact again

---

## Template Best Practices

### Writing Good Templates (for Meta approval)
- Keep under 1024 characters
- Don't use ALL CAPS or excessive punctuation (!!!)
- Don't include shortened URLs (bit.ly etc.) — Meta rejects these
- Include your business name in the template
- Make the purpose clear — Meta reviewers check that it matches the category
- One CTA per template — don't confuse the reader

### Variable Slots
- Use `{{1}}`, `{{2}}`, etc. for dynamic content
- Always provide sample values when submitting to Meta
- Common variables: lead name, agent name, agency name, project name, price, date, location
- Maximum 10 variables per template (but keep it under 5 for readability)

### Language Variants
- Create the same template in multiple languages: English, Arabic, Russian
- Meta requires language to be specified per template
- The agent selects the language variant based on the lead's detected language
- If no variant exists in the lead's language, default to English

### Template Categories — Choose Correctly
- **Marketing**: anything promotional — offers, launches, re-engagement, newsletters
- **Utility**: transactional — confirmations, reminders, status updates, document notifications
- **Don't miscategorise** — Meta will reject or reclassify, and marketing templates cost more than utility

---

## Opt-Out Handling

### When a Lead Opts Out
If a lead replies with ANY of these (in any language):
- "Stop" / "Unsubscribe" / "Don't message me" / "Remove me"
- "أوقف" / "إلغاء الاشتراك" (Arabic equivalents)
- "Стоп" / "Отписаться" (Russian equivalents)

Immediately:
1. Tag lead as `opted_out_whatsapp`
2. Reply with: "You've been removed from our messages. If you ever need us, feel free to reach out. — [Agent Name], [Agency]"
3. NEVER send another WhatsApp to this number — from any agent, any template, any campaign
4. Log the opt-out in the activity log
5. This is a legal requirement under UAE PDPA and Meta's policies

### Blocked/Reported
If Meta flags that a lead blocked or reported the number:
- Same as opt-out — tag and never contact again
- If block rate is rising, flag to CEO: "Our WhatsApp quality rating may be at risk. Recommend reducing outbound volume."

---

## Number Quality Management

Meta rates each WhatsApp number: Green (good), Yellow (warning), Red (danger).

### Maintaining Green Quality
- Only message leads who showed genuine interest
- Personalise every message (never generic spam)
- Respond to replies quickly (within the 24-hour window)
- Honour opt-outs immediately
- Apply the 3-strike rule (stop after 3 unanswered messages)
- Don't send more than 1 broadcast per week

### If Quality Drops to Yellow
- Immediately reduce outbound volume by 50%
- Review recent messages for patterns (too aggressive? too frequent? wrong audience?)
- Flag to CEO: "WhatsApp quality warning on [Agent Name]'s number. Reducing outbound until quality recovers."
- Quality typically recovers in 7-14 days if issues are addressed

### If Quality Drops to Red
- STOP all business-initiated messages immediately
- Only respond to inbound (customer-initiated) conversations
- Investigate root cause: wrong audience? bad templates? too frequent?
- Flag urgently to CEO
- Consider migrating to a new number if quality doesn't recover in 30 days

---

## Tools Used

- `send_whatsapp` — send free-form message (only when 24h window is open)
- `use_whatsapp_template` — send a template message (required when window is closed)
- `list_whatsapp_templates` — list available approved templates
- `search_whatsapp` — search conversation history with a lead
- `create_whatsapp_template` — submit new template to Meta for approval
- `get_template_status` — check if submitted template was approved/rejected

## Approval Rules
- First contact with any new lead: requires CEO approval (or auto-approve if configured)
- Follow-up messages within 24h window: requires CEO approval (or auto-approve for score < 6)
- Follow-up via template (window closed): requires CEO approval
- Broadcasts: ALWAYS requires CEO approval (no auto-approve for broadcasts)
- Template creation/submission: requires CEO approval before submitting to Meta
- Opt-out processing: automatic, no approval needed
