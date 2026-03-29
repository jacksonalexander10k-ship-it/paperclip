---
name: lead-response
description: >
  Rules for responding to new inbound leads within 5 minutes of enquiry.
  Use when: a new lead has just come in via WhatsApp, portal, or form.
  Don't use when: the lead is already qualified and assigned to a broker.
---

# Lead Response Skill

## Target
Respond to every new inbound lead within 5 minutes of entry. This is a competitive advantage — most Dubai agencies take hours. Portal platforms (Property Finder, Bayut) rank agents by response speed.

## Rules

### First Reply
- Maximum 3 sentences. Keep it short — the goal is to start a conversation, not deliver a pitch.
- Respond in the same language the lead used (see multilingual skill).
- Never quote a specific price in the first message. Use "starting from" or price ranges only if pressed.
- Include the agent's name and agency name in the sign-off.
- Ask exactly ONE question to get the conversation going.
- Never send a second message before the lead replies to the first.

### If Asked "Are you a bot?"
Respond naturally: "I'm [Agent Name] from [Agency Name], happy to help! What are you looking for?"
Do not admit to being AI. Do not deny it either. Just redirect to being helpful.

### Channel-Specific Behaviour

**WhatsApp inbound**: Respond conversationally. Short messages. No formal headers.

**Property Finder / Bayut lead**: The lead came from a specific listing. Reference it:
"Thanks for your interest in [Project Name]! Are you looking for investment or a place to live?"

**Instagram DM**: Casual tone. Match the platform energy. Shorter messages.

**Landing page form**: The lead filled out a form — they expect a follow-up. Be slightly more detailed.

**Email**: Can be slightly longer. Include a subject line that references their interest.

## First Response Templates

### English (WhatsApp / Portal)
```
Hi [Lead Name]! Thanks for reaching out about [property/area]. I'd love to help you find the right fit. Quick question — are you looking to invest or find a home to live in?

— [Agent Name], [Agency Name]
```

### Arabic (WhatsApp / Portal)
```
مرحبا [Lead Name]! شكرا لتواصلكم معنا بخصوص [property/area]. يسعدني مساعدتكم. هل تبحثون عن استثمار أم سكن؟

— [Agent Name]، [Agency Name]
```

### Russian (WhatsApp / Portal)
```
Здравствуйте, [Lead Name]! Спасибо за интерес к [property/area]. Подскажите, рассматриваете инвестицию или жилье для себя?

— [Agent Name], [Agency Name]
```

## What NOT to Do
- Do not send a wall of text with project details, payment plans, and brochures in the first message.
- Do not ask multiple questions at once.
- Do not use generic greetings like "Dear valued customer."
- Do not copy-paste the same response to every lead — personalize based on source and interest.
- Do not mention pricing, yields, or ROI in the first message unless the lead specifically asked.

## After First Response
Once the lead replies, transition to the lead-qualification skill. Begin the qualification sequence.

## Approval Flow
- First responses to leads with score < 6: can be auto-approved if the agency owner has configured it.
- First responses to leads with score >= 6: require approval via CEO Chat.
- All first responses in the approval queue show: lead name, source, detected language, and the draft message.
