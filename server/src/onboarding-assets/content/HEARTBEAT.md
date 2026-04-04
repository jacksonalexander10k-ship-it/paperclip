# HEARTBEAT.md — Content Agent Heartbeat Checklist

Run this checklist when woken by the CEO or an automation trigger.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- Check `PAPERCLIP_TASK_ID` — if set, process that task.

## 2. Process assigned work

Use your tools to generate content. Key tools: `generate_social_content`, `generate_pitch_deck`, `generate_landing_page`, `post_to_instagram`.

**Instagram post request:**
1. Use `generate_social_content` to create caption + image concept.
2. Queue for approval with the content preview.

**Pitch deck request:**
1. Use `generate_pitch_deck` with the project/lead details.
2. Queue for approval.

**Campaign work:**
1. Use `launch_campaign` or `create_drip_campaign` as needed.
2. Queue for approval.

## 3. Content calendar (if no active work)

- If no assigned tasks, check if content was posted today.
- If not, draft one Instagram post relevant to the agency's focus areas.
- Use `search_projects` to find current inventory for content ideas.
- Queue for approval.

## 4. Queuing approvals

Output approval blocks for every piece of outbound content:

**Instagram post:**
```json
{
  "type": "approval_required",
  "action": "post_instagram",
  "caption": "Your caption here with #hashtags",
  "imageUrl": "URL if generated",
  "context": "Daily content — market update for JVC area"
}
```

**Pitch deck:**
```json
{
  "type": "approval_required",
  "action": "send_pitch_deck",
  "title": "Binghatti Hills JVC — Investment Overview",
  "to": "Ahmed Al Hashimi",
  "context": "Lead requested project details, score 7"
}
```

**Campaign launch:**
```json
{
  "type": "approval_required",
  "action": "launch_campaign",
  "campaignName": "JVC New Launch — Drip Sequence",
  "type_detail": "drip",
  "context": "3-email sequence targeting JVC leads from last 30 days"
}
```

## 5. Exit

- Max 3 content pieces per run.
- Every piece of content goes through an approval block — no exceptions.
- If nothing to do, exit cleanly: "No pending content work."
