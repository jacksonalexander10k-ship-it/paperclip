---
name: lead-handoff
description: >
  When and how to escalate a lead to a human broker. Handoff protocol,
  broker notification, and post-handoff monitoring.
  Use when: a lead meets escalation criteria and needs human attention.
  Don't use when: the lead is still in early qualification (score < 8).
---

# Lead Handoff Skill

## When to Hand Off to a Human Broker

### Automatic Escalation Triggers
- Lead score reaches 8 or higher after qualification.
- Lead explicitly asks to speak to a person: "Can I talk to someone?", "I want to meet an agent."
- Lead has been actively engaged for 3+ weeks without progressing past qualification stage.
- Budget exceeds AED 5,000,000 — premium buyers require human relationship building.
- Call Agent flags "ready to view" or "wants to proceed" from a live call.
- Lead requests a physical viewing of a specific property.
- Lead mentions legal/contract questions that require licensed human guidance.

### CEO-Directed Handoff
The agency owner can manually assign any lead to a broker via CEO Chat at any time, regardless of score.

## Handoff Protocol

### Step 1: Create Escalation Card
Draft an escalation card for the CEO Chat containing:
- **Lead summary**: Name, phone, email, nationality, language, source.
- **Score**: Current score with breakdown of how it was calculated.
- **Interest**: Budget range, area preference, property type, timeline, financing status.
- **Conversation history**: Summary of all messages exchanged (not full transcript — concise summary).
- **Matching projects**: Any projects already matched or discussed.
- **Suggested broker**: Based on area expertise, language match, and current workload (from agency_context.team).
- **Reason for escalation**: Which trigger was met.

### Step 2: Wait for Owner Approval
Do not proceed until the agency owner approves the handoff and confirms the broker assignment in CEO Chat. The owner may:
- Approve the suggested broker.
- Assign a different broker.
- Request more qualification before handoff.
- Handle the lead themselves.

### Step 3: Notify the Broker
Once approved, send the assigned broker:
- WhatsApp notification with: lead name, phone number, brief context, and a link to the full lead profile.
- Include the most relevant detail: "Ahmed, AED 3M budget, looking for 2BR in Dubai Hills, cash buyer, wants to view this week."
- Do not dump the entire conversation history in the notification — keep it actionable.

### Step 4: Tag and Release
- Tag the lead as `assigned:[broker-name]`.
- Lead Agent stops all automated follow-up for this lead.
- Inform the lead (if appropriate): "I've connected you with [Broker Name], our specialist for [area]. They'll be reaching out shortly!"

### Step 5: Monitor the Handoff
- If the assigned broker does not contact the lead within 2 hours: escalate back to CEO Chat.
  ```
  "[Broker Name] hasn't contacted [Lead Name] yet — it's been 2 hours since assignment. Should I reassign or send a reminder?"
  ```
- If the broker contacts but the lead goes cold after handoff: flag to CEO after 48 hours of no activity.

## Broker Selection Criteria

When suggesting a broker, rank by:
1. **Area expertise**: Does the broker specialize in the lead's area of interest?
2. **Language match**: Can the broker communicate in the lead's language?
3. **Current workload**: How many active leads does this broker have? Avoid overloading.
4. **Track record**: Conversion rate for similar lead profiles.
5. **Availability**: Is the broker active today or on leave?

## Post-Handoff Monitoring

### What Lead Agent Still Does
- Monitors the WhatsApp conversation (if on the agency number) for activity signals.
- Tracks whether a viewing is booked within 7 days of handoff.
- Alerts CEO if no progress is visible after 1 week.

### What Lead Agent Does NOT Do
- Does not send any messages to the lead after handoff.
- Does not interfere with the broker's relationship.
- Does not re-score or re-qualify the lead unless asked by CEO.

## Reverse Handoff (Broker Back to AI)

If a broker determines a lead is not ready (score was overestimated, lead went cold):
- Broker logs "return to nurture" in the broker view.
- Lead is untagged from the broker and returned to the Lead Agent's pipeline.
- Lead Agent resumes automated follow-up at the appropriate cadence based on updated score.
- Lead score is adjusted downward with the reason logged.
