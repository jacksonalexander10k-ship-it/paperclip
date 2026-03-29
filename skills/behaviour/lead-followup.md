---
name: lead-followup
description: >
  Follow-up cadence by lead score, stale lead reactivation, message variation,
  and when to stop pursuing.
  Use when: a lead has been contacted at least once and needs follow-up.
  Don't use when: the lead has opted out or is assigned to a human broker.
---

# Lead Follow-Up Skill

## Follow-Up Cadence by Score

| Lead Score | Frequency | Channel |
|-----------|-----------|---------|
| 8-10 (Hot) | Daily | WhatsApp (primary), call if no response after 2 days |
| 5-7 (Warm) | Every 48 hours | WhatsApp |
| 3-4 (Cool) | Weekly | WhatsApp or email |
| 1-2 (Cold) | Monthly drip | Email (automated campaign) |

## Message Variation Rules

Never send the same follow-up message twice to the same lead. Rotate through these angles:

### For Hot/Warm Leads (Score 5+)
1. **Project update**: "Quick update on [Project] — [new info: construction progress, price change, new unit release]."
2. **Market insight**: "Properties in [Area] moved X% this quarter. Good timing if you're still considering."
3. **Matching listing**: "Just saw a [type] in [area] that fits what you described — want me to send details?"
4. **Scarcity/urgency**: "Only [X] units left in the [bedroom type] you liked at [Project]. Thought you'd want to know."
5. **Soft check-in**: "Hi [Name], just checking in — any thoughts since we last spoke?"
6. **Value add**: Share a relevant article, market report, or investment analysis.

### For Cool/Cold Leads (Score 1-4)
1. **New project launch**: "New launch in [area] starting from AED [X]. Thought of you."
2. **Price drop alert**: "[Project] has adjusted pricing — worth another look."
3. **Market update**: Monthly area summary with key statistics.
4. **Seasonal hook**: "As we head into [season], here's what's happening in Dubai real estate."
5. **Event/exhibition**: "Dubai Property Show is coming up — interested in attending?"

## Timing Rules
- Send messages between 9am-9pm Dubai time only.
- Best response windows: 10am-12pm and 4pm-7pm Dubai time.
- Never follow up on Friday mornings (prayer time) or during major religious holidays (Eid, Ramadan iftar time).
- If the lead is in a different timezone (detected from phone country code), adjust accordingly.

## Stale Lead Reactivation

### Definitions
- **Stale**: No contact from the lead for 14+ days.
- **Dormant**: No contact for 30+ days.
- **Archived**: No contact for 90+ days despite follow-up attempts.

### Reactivation Strategy
**14 days (stale)**: Re-engage with a market update or new project launch relevant to their stated interest.
```
Hi [Name], hope you're well! Since we last spoke, [something relevant happened — new launch, price movement, construction milestone]. Still interested in [area/type]?
```

**30 days (dormant)**: Move to monthly drip campaign. Lower the pressure.
```
Hi [Name], just a quick market update for [area]. [One compelling stat]. Let me know if anything catches your eye.
```

**90 days (archived)**: One final reactivation attempt, then archive.
```
Hi [Name], it's been a while! A lot has changed in the Dubai market. If you're still interested, I'd be happy to share a quick update. If not, no worries at all.
```

After 90 days with no response to the reactivation message: archive the lead. Stop all outbound contact. The lead can be reactivated only if they initiate contact again.

## When to Stop Following Up

### Hard Stop (immediately cease contact)
- Lead replies "STOP", "unsubscribe", or any opt-out signal. Tag as opted-out.
- Lead explicitly says "Not interested", "Please stop messaging me." Tag as opted-out.
- Lead blocks the number (WhatsApp delivery fails).

### Soft Stop (pause and flag to CEO)
- 3 consecutive unanswered messages with no read receipts.
- 3 consecutive messages read but not replied to.
- Lead responds with hostility or annoyance.

When soft-stopping: flag to CEO with context. CEO decides whether to try a different angle, assign to a different agent, or archive.

## Follow-Up Approval Flow
- Follow-ups to leads with score < 6: can be auto-approved if configured.
- Follow-ups to leads with score >= 6: require approval via CEO Chat.
- Batch follow-ups: group all pending follow-ups and present as a batch approval card at 9am, 1pm, and 6pm.

## Tracking
- Log every follow-up attempt: timestamp, channel, message content, delivery status, read status.
- Track response rate per message angle — learn which angles work best for this agency's leads.
- Report follow-up statistics in the CEO morning brief: "[X] follow-ups sent, [Y] responses received, [Z] leads re-engaged."
