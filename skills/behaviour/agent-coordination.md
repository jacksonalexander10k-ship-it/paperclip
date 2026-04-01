---
name: agent-coordination
description: >
  Defines when and how agents communicate with each other.
  Use when: you have information another agent needs, or need information from another agent.
  Don't use when: the information is only relevant to your own tasks.
---

# Agent Coordination

You are part of a team of AI agents. You can send structured messages to other agents when you discover something they need to know. Messages you send will be delivered to the target agent on their next run (or immediately for urgent messages).

## How to Send a Message

Output a coordination block in your response:

```agent-message
{
  "to": "Sales Agent",
  "priority": "action",
  "messageType": "price_alert",
  "summary": "JVC 1BR prices dropped 12% this week based on DLD data",
  "data": {
    "area": "JVC",
    "propertyType": "1BR",
    "changePercent": -12,
    "period": "7d",
    "source": "DLD transactions"
  }
}
```

## Priority Levels

- **info** — Read on next scheduled run. Use for FYI updates, observations, non-urgent patterns.
- **action** — Triggers an immediate run for the target agent. Use when the information requires prompt action (price drop affecting active leads, lead behaviour change, content opportunity).
- **urgent** — Triggers immediate run AND notifies the agency owner. Use only for time-critical situations (hot lead signal, critical market event, system issue).

## When to Send Messages

### Sales Agent should notify:
- **Content Agent** when 3+ leads express interest in the same project → `demand_signal` (action)
- **Content Agent** when a lead requests a pitch deck → `deck_request` (info)
- **Market Agent** when a lead asks about pricing for a specific area → `pricing_query` (info)
- **Viewing Agent** when a lead is ready to view → `viewing_request` (action)
- **CEO** when a lead scores 8+ → `hot_lead` (urgent)

### Market Agent should notify:
- **Sales Agent** when prices drop >10% in any area → `price_alert` (action)
- **Sales Agent** when a new project launches → `new_launch` (action)
- **Content Agent** when a significant market event occurs → `market_event` (action)
- **CEO** when a competitor makes a major move → `competitor_alert` (info)

### Content Agent should notify:
- **Sales Agent** when a post about a specific project is published → `content_published` (info)
- **Sales Agent** when a post gets unusually high engagement → `engagement_spike` (info)
- **CEO** when content performance drops significantly → `performance_drop` (info)

### Viewing Agent should notify:
- **Sales Agent** when a lead no-shows → `viewing_noshow` (action)
- **Sales Agent** when a viewing is completed with positive feedback → `viewing_positive` (action)
- **Sales Agent** when a viewing is completed with negative feedback → `viewing_negative` (info)
- **Content Agent** when a property photographs well during viewing → `photo_opportunity` (info)

### Portfolio Agent should notify:
- **Sales Agent** when a landlord lists a new property → `new_listing` (action)
- **CEO** when a lease expires within 60 days without renewal → `lease_expiring` (urgent)
- **Content Agent** when a property becomes available → `availability_update` (info)

### Finance Agent should notify:
- **CEO** when any agent is at 80%+ of monthly budget → `budget_warning` (urgent)
- **CEO** when daily spend exceeds 2x the average → `spend_spike` (action)

## Rules

1. Only send messages that will lead to a **downstream action** the owner will eventually see. No chatter for the sake of chatter.
2. Maximum 5 outbound messages per run. Prioritise the most important ones.
3. Never send the same message type about the same subject twice within 24 hours.
4. Include enough data in the message for the receiving agent to act without asking follow-up questions.
5. Use `info` as the default priority. Only escalate to `action` when the receiving agent should act promptly. Only use `urgent` when the owner needs to know immediately.
6. All your messages are visible to the CEO agent and the agency owner. Write summaries as if a human will read them.
