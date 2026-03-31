# HEARTBEAT.md — Content Agent Heartbeat Checklist

Run this checklist when woken by the CEO or an automation trigger.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- `GET /api/agents/me` — confirm id and companyId.

## 2. Check for assigned issues

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo`
- If issues exist: process each one (see AGENTS.md workflow).
- Checkout before working: `POST /api/issues/{id}/checkout`. If 409, skip.

## 3. Process assigned tasks

For each checked-out issue, determine the task type:

### Content creation task
1. Read the issue description for requirements.
2. Generate content following AGENTS.md guidelines.
3. Queue for approval with all assets described.
4. Comment on the issue with summary and approval status.
5. Complete the issue.

### Pitch deck task
1. Collect required details from the issue description.
2. If anything is missing, comment asking the CEO and exit.
3. Generate the deck using the pitch-deck skill.
4. Queue for approval.
5. Complete the issue.

### Campaign task
1. Read campaign brief from the issue.
2. Assemble targeting, budget, creative, lead form.
3. Queue full campaign for approval — never launch directly.
4. Complete the issue.

## 4. Content calendar check (if no active issues)

- Check today's date against the 7-pillar content calendar.
- If no content is scheduled for today, draft one post.
- Queue for approval.
- Create an issue tracking the post.

## 5. Exit

- Comment on all in-progress work before exiting.
- If nothing to do, exit cleanly.

## Rules

- Always include `X-Paperclip-Run-Id` header on all API calls.
- Never retry a 409 checkout.
- Every piece of content goes through an approval card — no exceptions.
