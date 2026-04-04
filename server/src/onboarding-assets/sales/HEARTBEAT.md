# HEARTBEAT.md — Sales Agent Heartbeat Checklist

Run this checklist when woken by a task assignment or automation.

## 0. Load your tools FIRST

Your real estate tools are provided via MCP. They are deferred tools — you MUST fetch them before use:

```
ToolSearch: "select:mcp__aygent-tools__search_leads,mcp__aygent-tools__update_lead,mcp__aygent-tools__send_whatsapp,mcp__aygent-tools__search_whatsapp,mcp__aygent-tools__get_follow_ups,mcp__aygent-tools__search_past_conversations"
```

Do this as your FIRST action every heartbeat. Once fetched, these tools are available for the rest of the session.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- Check `PAPERCLIP_TASK_ID` — if set, this is the issue you should process.

## 2. Process assigned work

Use `mcp__aygent-tools__search_leads` to check your pipeline. If woken for a specific issue, handle it first.

**New lead from portal/WhatsApp:**
1. Use `mcp__aygent-tools__search_leads` to find the lead record.
2. Use `mcp__aygent-tools__search_past_conversations` to check if this person contacted before.
3. Draft a response in their detected language.
4. Queue for approval (see format below).

**Follow-up needed:**
1. Use `mcp__aygent-tools__get_follow_ups` to find leads needing follow-up.
2. Draft a WhatsApp message for each (max 5 per run).
3. Queue each for approval.

**Stale lead re-engagement (if no active work):**
1. Use `mcp__aygent-tools__search_leads` with no filters, look for leads last contacted > 14 days ago with score >= 5.
2. Draft a re-engagement message.
3. Queue for approval.

## 3. Queuing approvals

When you need to send a WhatsApp, email, or any outbound action, output an approval block. The system will create a pending approval for the owner to review.

**WhatsApp approval:**
```json
{
  "type": "approval_required",
  "action": "send_whatsapp",
  "to": "Ahmed Al Hashimi",
  "phone": "971501234567",
  "message": "Hi Ahmed, this is Sarah from 10k Properties...",
  "lead_score": 7,
  "context": "New lead from Property Finder, enquired about JVC 2BR"
}
```

**Email approval:**
```json
{
  "type": "approval_required",
  "action": "send_email",
  "to": "ahmed@example.com",
  "subject": "Your Property Enquiry — 10k Properties",
  "body": "Dear Ahmed...",
  "context": "Follow-up email after WhatsApp went unanswered for 48h"
}
```

You can output multiple approval blocks in one run. Each becomes a separate approval card.

## 4. Updating leads

- Use `mcp__aygent-tools__update_lead` to change stage, score, or notes after qualifying.
- Use `mcp__aygent-tools__tag_lead` to categorise (e.g. "cash_buyer", "investor", "jvc").

## 5. Exit

- If nothing to do, exit cleanly with a one-line status: "No pending work."
- Never send messages directly — always queue via approval blocks.
- Max 5 approval blocks per run to avoid flooding the owner.
- Max 3 tool calls per lead before escalating to CEO via an agent-message block.

## Escalation

If you're stuck or a lead needs human attention:
```agent-message
{
  "to": "CEO",
  "priority": "action",
  "messageType": "escalation",
  "summary": "Lead Ahmed Al Hashimi (score 9) requesting urgent viewing — needs broker assignment"
}
```
