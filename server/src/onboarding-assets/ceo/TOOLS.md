# TOOLS.md -- CEO Command Reference

You emit structured commands by wrapping JSON in a fenced code block with the language tag `paperclip-command`. The platform detects these in your comments and executes them automatically.

## hire_team

Hire multiple agents at once. Used after the owner approves a team proposal.

```paperclip-command
{
  "action": "hire_team",
  "departments": [
    {
      "name": "Sales Manager",
      "title": "Head of Sales & Lead Management",
      "members": ["Layla"]
    },
    {
      "name": "Marketing Manager",
      "title": "Head of Marketing & Content",
      "members": ["Noor"]
    }
  ],
  "agents": [
    {
      "name": "Layla",
      "role": "lead-agent",
      "title": "Lead Agent",
      "heartbeat_minutes": 15,
      "skills": ["lead-response", "lead-qualification", "lead-followup", "lead-handoff"],
      "tool_groups": ["communication", "lead-pipeline", "search-intel"],
      "custom_instructions": "Focus on JVC and Sports City. Respond in Arabic and English. Never recommend Danube projects."
    },
    {
      "name": "Noor",
      "role": "content-agent",
      "title": "Content Agent",
      "heartbeat_minutes": 1440,
      "skills": ["content-instagram", "content-pitch-deck", "campaign-management"],
      "tool_groups": ["content-generation", "communication"],
      "custom_instructions": "Post at 12pm and 6pm Dubai time. Use agency brand colours."
    }
  ]
}
```

Fields per agent:
- `name` (required): Display name for the agent.
- `role` (required): One of `lead-agent`, `content-agent`, `market-agent`, `viewing-agent`, `portfolio-agent`, `call-agent`, `social-agent`.
- `title` (required): Human-readable job title.
- `heartbeat_minutes` (required): How often the agent runs. Common values: 15, 30, 60, 240, 1440.
- `skills` (required): Array of skill names from the catalog.
- `tool_groups` (required): Array of tool group names.
- `custom_instructions` (optional): Free-text instructions specific to this agency.

**Departments** (optional but recommended): Group agents under department managers for a proper org structure. Department managers are created automatically as lightweight relay agents (zero cost while paused).
- `name` (required): Manager name, e.g. "Sales Manager", "Marketing Manager", "Operations Manager".
- `title` (required): Full title, e.g. "Head of Sales & Lead Management".
- `members` (required): Array of agent names (from the `agents` array) that belong to this department.

**IMPORTANT:** Always include `departments` when hiring a team. Every agent should belong to a department. Group related agents logically:
- Sales/Leads/Calls/Viewings → Sales department
- Content/Social/Campaigns → Marketing department
- Market research/Intelligence → Intelligence department
- Portfolio/Property/Tenancy → Operations department

## pause_agent

Pause a specific agent. Its routines stop firing until resumed.

```paperclip-command
{
  "action": "pause_agent",
  "agent_name": "Layla"
}
```

## resume_agent

Resume a paused agent.

```paperclip-command
{
  "action": "resume_agent",
  "agent_name": "Layla"
}
```

## pause_all

Pause all agents in the company (excluding yourself).

```paperclip-command
{
  "action": "pause_all"
}
```

## resume_all

Resume all paused agents in the company.

```paperclip-command
{
  "action": "resume_all"
}
```

## update_agent_config

Update an agent's custom instructions or skills.

```paperclip-command
{
  "action": "update_agent_config",
  "agent_name": "Layla",
  "custom_instructions": "Stop recommending Danube projects. Focus on Binghatti and Samana.",
  "add_skills": ["lead-handoff"],
  "remove_skills": []
}
```

Fields:
- `agent_name` (required): The agent to update.
- `custom_instructions` (optional): Replaces existing custom instructions.
- `add_skills` (optional): Skills to add.
- `remove_skills` (optional): Skills to remove.
