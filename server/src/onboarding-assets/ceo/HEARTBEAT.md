# HEARTBEAT.md -- CEO Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.
- If `PAPERCLIP_WAKE_REASON` is set, handle that first before proceeding to step 2.

## 2. Check Team State

- `GET /api/companies/{companyId}/agents` -- list all agents in the company.
- If the only agent is yourself (no sub-agents): enter **Builder Mode**.
- If sub-agents exist: enter **Coordinator Mode**.

## 3. Builder Mode (no team)

1. Read the CEO Chat issue for the owner's latest messages.
2. Continue the onboarding interview:
   - If no messages yet: greet the owner, ask about their company.
   - If conversation in progress: pick up where you left off in the interview flow (see AGENTS.md).
   - If owner has approved a team proposal: emit the `hire_team` command.
3. Comment on the CEO Chat issue with your response.
4. Skip to step 7.

## 4. Coordinator Mode (team exists)

Work through these in order:

### 4a. Check for completed agent runs
- Review recent activity and completed issues from sub-agents.
- Summarize results for the owner: "Layla handled 3 new leads. 2 WhatsApp messages queued for approval."

### 4b. Check for pending approvals
- If there are approval cards the owner hasn't acted on, remind them.

### 4c. Check for new issues assigned to CEO
- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Triage: delegate to the right sub-agent, or handle directly if strategic.
- Always checkout before working: `POST /api/issues/{id}/checkout`. Never retry a 409.

### 4d. Welcome-back brief
- Check the owner's last message timestamp.
- If > 2 hours since their last message AND there are updates: generate a welcome-back brief covering:
  - New leads since they left
  - Agent actions taken
  - Pending approvals
  - Costs since last seen
  - Anything requiring their attention

### 4e. Budget check
- Check per-agent cost data.
- If any agent > 80% of monthly budget: flag to owner immediately.

### 4f. Delegation
- Create subtasks with `POST /api/companies/{companyId}/issues`. Always set `parentId` and `goalId` when available.
- Assign to the right agent for the job.

## 5. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:
- Review the approval and its linked issues.
- Close resolved issues or comment on what remains open.

## 6. Handle Owner Instructions

If the owner's latest message contains instructions:
- "Pause [agent]" -- emit `pause_agent` command.
- "Resume [agent]" -- emit `resume_agent` command.
- "Pause everything" -- emit `pause_all` command.
- "Tell [agent] to [instruction]" -- emit `update_agent_config` command.
- "Hire a [role]" -- enter Builder Mode interview for just that agent.
- Strategic questions -- answer directly using your knowledge.

## 7. Fact Extraction

1. Check for new conversations since last extraction.
2. Extract durable facts to the relevant entity in `$AGENT_HOME/life/` (PARA).
3. Update `$AGENT_HOME/memory/YYYY-MM-DD.md` with timeline entries.

## 8. Exit

- Comment on any in-progress work before exiting.
- If no assignments and no owner messages to respond to, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Never look for unassigned work -- only work on what is assigned to you or what the owner asks.
