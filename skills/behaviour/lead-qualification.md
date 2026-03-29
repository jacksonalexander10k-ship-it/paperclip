---
name: lead-qualification
description: >
  Qualify leads over 2-3 messages. Extract budget, timeline, financing, area,
  and property type. Score 0-10. Escalate when thresholds are met.
  Use when: a lead has responded to the first message and a conversation is active.
  Don't use when: the lead is already qualified and assigned to a broker.
---

# Lead Qualification Skill

## Qualification Sequence

Collect information over 2-3 natural messages. Never send a questionnaire — make it conversational.

### Information to Extract (in priority order)
1. **Budget range**: "What budget are you working with?" or "Do you have a price range in mind?"
2. **Timeline**: "When are you looking to move or invest?" — within 3 months, 6 months, 12+ months
3. **Financing**: "Are you looking at a cash purchase or mortgage?" — cash, mortgage pre-approved, mortgage needed, undecided
4. **Area preference**: If not already stated from the source listing. "Any areas you're focused on?"
5. **Property type**: Apartment, villa, townhouse, penthouse, plot. "What type of property interests you?"

### Conversational Flow
- Ask ONE question per message. Wait for a response.
- If the lead volunteers information unprompted, acknowledge it and skip that question.
- If the lead is evasive about budget: "Just to make sure I'm showing you the right options — are you looking in the 1-2M range, 2-5M, or higher?"
- If the lead says "I'm just looking": "No problem at all! Are you more interested in investment returns or finding a place to live? That'll help me point you to the best areas."

### Additional Signals to Capture (without asking directly)
- Nationality/language (detected from messages)
- Whether they are already in Dubai or abroad
- Family size (if mentioned)
- Previous Dubai property ownership (check DLD history)
- Specific project mentions (indicates research level)

## Lead Scoring Rubric (0-10)

### Base Score by Source (starting point)
| Source | Base Score |
|--------|-----------|
| Referral from existing client | 7 |
| Property Finder / Bayut enquiry | 5 |
| Instagram DM | 4 |
| Landing page form | 4 |
| WhatsApp inbound (unknown) | 3 |
| Cold outreach response | 2 |

### Score Modifiers (add to base)
| Signal | Modifier |
|--------|----------|
| Specific budget stated (e.g., "2-3M AED") | +2 |
| Vague budget ("depends", "flexible") | +0 |
| Timeline < 3 months | +2 |
| Timeline 3-6 months | +1 |
| Timeline > 12 months | +0 |
| Cash buyer | +1 |
| Mortgage pre-approved | +1 |
| Mortgage needed (not yet started) | +0 |
| Prior DLD transaction history (has bought before) | +2 |
| Specific project/area mentioned | +1 |
| Asked about payment plans or fees | +1 |
| Requested a viewing | +2 |

### Score cap: 10. Score floor: 0.

### Score-to-Action Mapping
| Score | Classification | Action |
|-------|---------------|--------|
| 8-10 | Hot | Escalate to human broker immediately. Daily follow-up until handoff. |
| 5-7 | Warm | Active qualification. Follow up every 48 hours. Match to projects. |
| 3-4 | Cool | Weekly follow-up. Nurture with content and market updates. |
| 1-2 | Cold | Monthly drip campaign. Reactivate on new launches or price changes. |
| 0 | Unqualified | Log and archive. Do not actively pursue. |

## Escalation Triggers (Immediate)

Escalate to CEO Chat with an escalation card when ANY of these occur:
- Lead score reaches 8 or higher.
- Budget stated as > AED 5,000,000 (premium buyer — requires human relationship).
- Lead explicitly says: "I want to speak to someone", "Can I talk to a person?", "I'm ready to buy."
- Lead uses buying signals: "ready to sign", "let's proceed", "how do I pay", "I want this unit", "book it."
- Lead has been engaged for 3+ weeks without progressing past qualification.

## After Qualification

Once the lead is qualified (score assigned, key info captured):
1. Update the lead record with all captured data.
2. Run `match_deal_to_leads` to find matching projects/listings.
3. Present 2-3 matching options to the lead (not more — too many causes decision paralysis).
4. If off-plan match: queue Content Agent to generate pitch deck.
5. If score >= 8: create escalation for broker handoff.
6. If score 5-7: continue follow-up cadence per lead-followup skill.

## What NOT to Do
- Never ask all 5 questions in a single message.
- Never push for budget if the lead is clearly uncomfortable — use ranges instead.
- Never qualify and sell simultaneously. Qualification is about listening, not pitching.
- Never change a lead's score without logging the reason.
