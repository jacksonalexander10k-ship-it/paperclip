---
name: campaign-management
description: >
  Design and manage drip campaigns, enrolment rules, performance monitoring,
  and when to pause campaigns.
  Use when: setting up automated nurture sequences, email campaigns, or WhatsApp drip series.
  Don't use when: sending one-off messages to individual leads.
---

# Campaign Management Skill

## Campaign Types

### Welcome Series (New Leads)
Trigger: Lead enters pipeline from any source.
Sequence (5 messages over 14 days):
1. Day 0: "Welcome! Here's what we can help you with." (Immediate)
2. Day 2: "Here's a quick guide to buying property in Dubai." (Educational)
3. Day 5: "This week's top 3 projects in [lead's area of interest]." (Value)
4. Day 9: "Quick question — are you still looking?" (Re-engagement)
5. Day 14: "Here's your personalized market snapshot for [area]." (Data-driven)

### Nurture Series (Cool Leads, Score 1-4)
Trigger: Lead scored 1-4 after qualification. Monthly cadence.
Sequence (ongoing, monthly):
1. Month 1: Market update for their area of interest.
2. Month 2: New project launch relevant to their profile.
3. Month 3: Investment insight (ROI data, Golden Visa update).
4. Month 4: "Anything changed? We're here when you're ready."
5. Repeat with fresh content. Never send the same message twice.

### Re-Engagement Series (Stale Leads)
Trigger: No contact for 30+ days.
Sequence (3 messages over 21 days):
1. Day 0: Market update with one compelling stat.
2. Day 7: New listing or project that matches their profile.
3. Day 14: "Last check-in — let me know if anything interests you."
If no response after all 3: archive the lead.

### Post-Deal Series (Closed Clients)
Trigger: Deal marked as closed.
Sequence:
1. Week 1: "Congratulations on your new property! Here's what to expect next."
2. Month 1: "How's everything going with [property]?"
3. Month 3: "Know anyone else looking in Dubai? We'd love to help them too." (Referral ask)
4. Month 6: Market update for their area + portfolio value check.
5. Annual: Anniversary check-in + market comparison.

## Enrolment Rules

### Hard Rules (never violate)
- Only enrol leads with status "active." Never enrol opted-out or archived leads.
- One campaign per lead at a time. If a lead qualifies for multiple campaigns, prioritize the most relevant.
- Remove from campaign immediately if: lead opts out, lead is assigned to a broker, lead score changes to 8+ (they need personal attention, not automation).
- Never enrol a lead in a campaign if they have had human contact in the last 7 days.

### Priority Order (if conflicts)
1. Re-engagement (stale leads need attention first)
2. Welcome series (new leads must be onboarded)
3. Nurture series (ongoing relationship building)
4. Post-deal series (lower urgency)

## Performance Monitoring

### Metrics to Track Per Campaign
- **Open rate**: % of messages read (WhatsApp read receipts, email opens).
- **Reply rate**: % of messages that receive a response.
- **Click rate**: % of links clicked (if applicable).
- **Conversion rate**: % of enrolled leads that progress to next pipeline stage.
- **Unsubscribe rate**: % that opt out during the campaign.

### Reporting (Weekly to CEO)
```
Campaign Performance:
- Welcome Series: 45 leads enrolled, 62% open rate, 18% reply rate
- Nurture: 120 leads, 38% open rate, 5% reply rate
- Re-engagement: 30 leads, 25% open rate, 8% reply rate — 3 leads reactivated
```

### When to Pause a Campaign
- Open rate drops below 10% for 3 consecutive sends.
- Unsubscribe rate exceeds 5% for any single send.
- Reply rate drops to 0% for 3 consecutive sends.
- Flag to CEO: "The [Campaign Name] campaign is underperforming. Open rate: X%. Recommend pausing and revising the content."

## Message Personalization

Every campaign message must include:
- Lead's first name.
- Reference to their stated interest (area, property type, or budget range).
- Relevant, current data (not stale statistics).
- The agent's name and contact info in the sign-off.

Never send generic, un-personalized campaign messages. If there is not enough data to personalize, skip that lead for that send.

## Approval Flow
- New campaign creation: requires CEO approval (campaign structure, target audience, message sequence).
- Individual campaign messages: can be auto-approved if the campaign itself was approved.
- Campaign pause/termination: requires CEO approval.
- Enrolment changes (adding/removing leads): automatic per rules above, no approval needed.

## Tools Used
- `create_drip_campaign` — create new campaign sequences
- `enroll_lead_in_campaign` — add leads to campaigns
- `launch_campaign` — activate a campaign
- `get_campaign_stats` — performance metrics
- `send_whatsapp` — WhatsApp campaign messages
- `send_email` — email campaign messages
