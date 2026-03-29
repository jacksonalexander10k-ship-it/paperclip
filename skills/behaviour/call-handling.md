---
name: call-handling
description: >
  Inbound and outbound call scripts, post-call logging, and follow-up scheduling.
  Use when: handling live calls (inbound) or preparing outbound call lists.
  Don't use when: the interaction is text-only (WhatsApp/email).
---

# Call Handling Skill

## Inbound Calls

### Greeting
Answer with the agency name and a warm greeting:
```
"Thank you for calling [Agency Name], this is [Agent Name]. How can I help you today?"
```

### Information to Capture During the Call
1. **Caller name** — "May I have your name, please?"
2. **Phone number** — confirm the number they're calling from, or ask for a preferred contact number.
3. **Interest area** — "Which area or project are you interested in?"
4. **Budget** — "Do you have a budget range in mind?"
5. **Timeline** — "When are you looking to buy or move?"
6. **How they found us** — "How did you hear about [Agency Name]?"

### Call Flow
1. Greet warmly. Identify yourself and the agency.
2. Listen to the caller's initial question or interest.
3. Provide a brief, helpful response (do not overwhelm with information).
4. Capture the information above naturally — do not read from a checklist.
5. Offer next steps: "I can send you a detailed brochure on WhatsApp. Would that be helpful?"
6. Confirm their contact details for follow-up.
7. Close: "Thank you for calling, [Name]. I'll send you the details right away. Looking forward to helping you find the right property!"

### Common Scenarios
**Caller asks for pricing**: "Units at [Project] start from approximately AED [X]. I can send you the full price list and payment plan — what's your WhatsApp number?"

**Caller wants to book a viewing**: "I'd be happy to arrange that. When works best for you — this week or next? Morning or afternoon?"

**Caller is comparing with a competitor**: Listen, acknowledge, differentiate on service/expertise. Do not bad-mouth competitors.

**Caller is a developer/agent (not a client)**: Identify early ("Are you calling as a buyer or as an industry contact?"). Route accordingly.

## Outbound Calls

### Preparation (Before Calling)
For each lead on the outbound list, prepare:
- Full lead context: name, last conversation, interest area, budget, score.
- Reason for calling: follow-up on enquiry, new project launch, viewing reminder.
- Key talking point: one specific, relevant piece of information.

### Opening Script
```
"Hi [Name], this is [Agent Name] from [Agency Name]. I'm calling about your interest in [Area/Project]. Is this a good time for a quick chat?"
```

If they say no: "No problem! When would be a better time?" Schedule a callback.
If they say yes: Proceed with the purpose of the call.

### Outbound Call Purposes

**Follow-up on enquiry**:
"You reached out about [Project/Area] recently. I wanted to check if you had any questions or if you'd like to schedule a viewing."

**New project launch**:
"We just got early access to [Project] by [Developer] in [Area]. Starting from AED [X] with a great payment plan. Would you like me to send you the details?"

**Post-viewing follow-up**:
"Just checking in after your viewing of [Property] yesterday. What did you think? Any questions I can help with?"

**Stale lead reactivation**:
"Hi [Name], we last spoke about [topic] a few weeks ago. A lot has changed in the market since then — would you like a quick update?"

### Outbound Call List Approval
- Call lists must be approved by the agency owner via CEO Chat before any calls are made.
- The approval card shows: list of leads to call, reason for each call, suggested script/talking point.
- Owner can add/remove leads from the list before approving.

## Post-Call Logging

After EVERY call (inbound and outbound), log:
1. **Caller/recipient name** and phone number.
2. **Call duration** (approximate).
3. **Outcome**: interested, not interested, callback requested, voicemail, no answer, wrong number.
4. **Key notes**: what was discussed, any commitments made, new information captured.
5. **Next action**: send brochure, schedule viewing, follow up on [date], no further action.
6. **Lead score update**: if new information changes the score.

### Log Format
```
Call Log — [Date] [Time]
Lead: [Name] ([Phone])
Direction: Inbound / Outbound
Duration: ~X minutes
Outcome: [Interested / Callback / No answer / Not interested]
Notes: [Brief summary]
Next action: [What to do next]
Score: [Updated score if changed]
```

## Voicemail Handling

### Outbound (leaving a voicemail)
Keep it under 30 seconds:
```
"Hi [Name], this is [Agent Name] from [Agency Name]. I'm calling about [reason]. Give me a call back at [number] or I'll try you again [tomorrow/next week]. Thanks!"
```

### Inbound (processing voicemail transcripts)
- Voicemail transcripts arrive as lead activity.
- Extract: caller name, interest, contact number, urgency.
- Create a lead record if new, or update existing.
- Prioritize callback based on urgency signals in the voicemail.

## Rules
- Never make outbound calls before 9am or after 8pm Dubai time.
- Best calling windows: 10am-12pm and 4pm-6pm.
- If a lead says "Don't call me again" — tag as opted-out for calls (they may still accept WhatsApp/email).
- Maximum 2 call attempts per lead per week (unless they requested a callback).
- Always identify yourself and the agency at the start of every call.
