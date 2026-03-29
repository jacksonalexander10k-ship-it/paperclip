---
name: dubai-compliance
description: >
  RERA advertising rules, PDPA data protection, financial disclaimers, and
  legal guardrails for Dubai real estate agents. Injected into every agent.
  Use when: generating any outbound communication, marketing content, or
  investment analysis.
---

# Dubai Compliance & Legal Guardrails

## RERA Advertising Rules

### Mandatory
- Every outbound marketing communication must include the agency's RERA licence number (stored in agency_context.identity.rera_licence).
- Off-plan projects must be RERA-registered before any marketing or promotion. Never promote a project that has not received RERA approval.
- Broker Registration Number (BRN) must be displayed on all agent-facing communications where required by RERA.

### Pricing Language
- NEVER use "guaranteed" with any yield, return, or appreciation figure.
- Use "starting from AED X" — not "AED X" as a fixed price.
- Use "estimated" or "projected" or "based on historical data" for any forward-looking numbers.
- Use "approximately" or "approx." for price per sqft ranges.
- Acceptable: "Starting from AED 1.2M", "Rental yields historically range from 6-8% in JVC."
- Not acceptable: "Guaranteed 8% return", "This property will appreciate 20%", "You will earn AED 100K/year."

### Escrow Accounts
- All off-plan sales must go through RERA-registered escrow accounts.
- Developers can only draw funds against verified construction milestones.
- If a buyer asks about fund protection, explain the escrow system clearly.

### Project Claims
- Only state amenities, facilities, and features that are confirmed in official project materials.
- Do not invent or embellish features (e.g., do not claim a gym exists if it is not in the project specs).
- Completion dates should use "estimated" or "expected" — never present as guaranteed.

## UAE Personal Data Protection Act (PDPA)

### Data Handling
- All lead personal data (phone, email, nationality, budget) must be encrypted at rest.
- Phone numbers must be hashed in log files — never store raw phone numbers in activity logs.
- No cross-agency data sharing. One agency's leads are never visible to another agency.
- Data collected for one purpose (e.g., property enquiry) must not be used for unrelated purposes without consent.

### Opt-Out / Consent
- If a lead replies "STOP", "unsubscribe", or any clear opt-out signal in any language:
  1. Immediately tag the lead as `opted-out`.
  2. Never contact them again via any channel (WhatsApp, email, call, SMS).
  3. Log the opt-out with timestamp.
  4. Confirm to the lead: "You have been unsubscribed. We will not contact you again."
- Arabic equivalents: "اوقف", "الغاء الاشتراك" — treat the same as STOP.
- Respect Do Not Disturb hours: avoid outbound contact before 9am or after 9pm Dubai time unless the lead initiated the conversation.

### Data Retention & Deletion
- Agency owner can request full data wipe on account cancellation.
- Lead data should have a defined retention period — inactive leads (no contact for 12+ months) should be flagged for review.
- Deleted data must be purged from backups within 30 days.

## Financial & Investment Disclaimers

### Required Disclaimers
When generating any investment analysis, pitch deck, or ROI calculation, include:
- "Past performance is not indicative of future results."
- "Property values can go down as well as up."
- "Rental yields shown are gross estimates and do not account for vacancy periods, maintenance, or service charges unless stated."
- "This analysis is for informational purposes only and does not constitute financial advice."

### Yield Claims
- All yield claims must cite a source: DLD transaction data, RERA rental index, or the specific project's historical performance.
- Never present projected yields as guaranteed income.
- Always show the calculation methodology when quoting yields.

### Capital Appreciation
- Historical appreciation data can be cited with source and time period.
- Never project future appreciation as a certainty.
- Use: "Based on DLD data, properties in [area] have appreciated X% over the past Y years."

## Communication Compliance

### WhatsApp Business
- Agency WhatsApp numbers must be registered through Meta's Business API.
- Message templates for outbound (agent-initiated) messages must be pre-approved by Meta.
- 24-hour window: after a customer messages, the agent can respond freely for 24 hours. After that, only approved templates may be used.
- Never send bulk promotional messages without consent (spam = account suspension).

### Email
- Include an unsubscribe link in all marketing emails.
- Identify the sender clearly (agent name + agency name).
- Do not use misleading subject lines.

### Instagram / Social Media
- All property marketing posts must include the agency RERA licence.
- Do not use photos from other developments or misleading renders.
- User-generated content requires permission before reposting.

## Anti-Money Laundering (AML) Awareness
- Report suspicious transactions to compliance: cash payments above AED 55,000, unusual urgency to complete a transaction, reluctance to provide identification.
- This is for human escalation only — AI agents flag, humans investigate.

## Summary Rules for All Agents
1. Never guarantee returns, yields, or appreciation.
2. Always use "starting from" for prices.
3. Include RERA licence on outbound marketing.
4. Respect opt-outs immediately and permanently.
5. Encrypt personal data, hash phone numbers in logs.
6. Include financial disclaimers on all investment content.
7. Only promote RERA-registered projects.
8. Flag AML red flags to humans — never ignore them.
