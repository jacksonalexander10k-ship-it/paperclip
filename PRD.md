# Product Requirements Document
## AI Agent Command Centre

**Purpose:** Designer reference — what the product does and how users interact with it.

---

## What It Is

A web application for managing a team of autonomous AI agents that run a business. Think of it as a control room: the user can see what every agent is doing in real time, approve or reject actions before they execute, assign work, monitor performance, and manage costs — all from one place.

The primary user is a business owner who has delegated operations to AI agents. They are not technical. They need to trust the system, stay in control, and react quickly when something needs their attention.

---

## The Core Loop

1. Agent does work autonomously in the background
2. Agent hits a decision point — needs to send a message, post something, make a hire
3. Agent pauses and requests the user's approval
4. User sees the request (badge on sidebar), reviews it, approves or rejects with one click
5. Agent continues

Everything else in the product supports this loop: visibility, configuration, auditability.

---

## Features

---

### Onboarding

First-time experience when a new user arrives:

- 3-step wizard: enter agency name → name first agent → pick agent role
- Role options: CEO, Marketing, Finance, Research, General, Tech (each with icon + description)
- Loading animation on completion → drops into CEO Chat automatically
- Can be re-triggered at any time

---

### Navigation

**Desktop sidebar** (always visible):
- Company name + brand colour dot at top, with a search/command button
- Top section: CEO Chat, New Task (action, not a link), Dashboard (with live run count), Inbox (with unread badge), Approvals (with pending count)
- Work section: Tasks, Automations, Deliverables
- Team section: list of every agent with status dot + name; "Hire Agent" button
- Agency section: Live Activity toggle, Team Structure, Budget, Activity Log, Settings
- At the bottom: Docs link, theme toggle, instance settings icon

**Mobile bottom navigation** (5 items): Home, Work, Create, Team, Inbox

**Multi-agency rail** (leftmost strip on desktop): icon per agency, drag to reorder, pulsing dot when agents are running, red dot when inbox has failures. Clicking switches the active agency.

**Command palette** (⌘K): search agents, tasks, pages, actions — keyboard-navigable

---

### CEO Chat

A direct chat interface with the top-level CEO agent:

- Freeform text input — user writes in plain English
- Agent responds in real time (streams character by character)
- Typing indicator while waiting
- Full conversation history persists across sessions
- Quick-action pills: "Brief me", "What's pending?", "Pause all agents"

**Inline approval cards** — when the CEO wants to take an action, a card appears inside the chat:
- Shows action type (Send WhatsApp / Send Email / Post to Instagram / etc.)
- Shows the full message or content preview
- Shows who it's going to, lead score, context note
- One-click Approve or Reject
- Confirms the outcome inline ("Approved" / "Rejected")

---

### Dashboard

The mission control overview. Opens by default.

**3 metric cards at the top:**
- Working Now — how many agents are running right now
- Needs Your OK — count of pending approvals
- Open Tasks — count of open tasks, with in-progress and blocked breakdown

Each card links to the relevant full page.

**Budget incident alert** (only shown when relevant): tells user an agent has been paused due to overspend, with a link to the Budget page.

**Pending Approvals section** (only shown when approvals exist): compact rows, each with the action label, requesting agent name, and Approve/Decline buttons inline. A "See all N" link goes to the full Approvals page.

**Your Team section**: a card per agent showing their avatar, name, role, current status, and what they're doing right now (live from server). Clicking goes to that agent's detail page.

**What Just Happened**: last 8 activity events in plain English (e.g. "Layla sent WhatsApp to Ahmed Al-Rashidi · 5 min ago"). New events animate in. Clicking a row goes to the relevant entity. Link to full Activity Log at the bottom.

---

### Your Team (Agents List)

A full list of every agent in the agency.

- Filter tabs: All / Active / Paused / Error
- Toggle between flat list view and org tree (hierarchy) view — desktop only
- Optional "Show terminated agents" filter

**List view per agent**: status dot, name + role + custom title, live badge (links directly to live run when running), AI model name, last active time, status badge

**Org tree view**: same info but indented under manager, with tree lines and expand/collapse

**Hire Agent button** → opens dialog to create a new agent

---

### Agent Detail

A full detail page for a single agent. Has tabs:

**Dashboard tab**
- Latest or current live run card: status, trigger source, 2-3 line summary of what it did, "View details" link
- 4 mini charts for last 14 days: Run Activity, Issues by Priority, Issues by Status, Success Rate
- Recent tasks list with status badges
- Cost breakdown: total tokens, total spend, last 10 runs with individual costs

**Instructions tab**
- Resizable file tree of instruction files (AGENTS.md, custom .md files)
- Click to open and edit any file in a markdown editor
- Add / delete instruction files

**Settings tab**
- Rename agent, change role, change title
- Change AI model/adapter
- Add/edit/delete API keys (masked, show last 4 chars)
- Change History — collapsible list of past config changes
- Permission toggles: Can hire team members, Can delegate tasks
- Reset Memory — clears agent session state
- Terminate agent (destructive, confirmation required)

**Runs tab**
- Full paginated list of every run: status, run ID, trigger, time, duration, cost
- Click any run → full step-by-step transcript

**Header actions** (always visible):
- Click agent icon to change it (emoji/icon picker)
- Assign Task → opens new task dialog pre-assigned to this agent
- Wake Up → fires the agent immediately, navigates to new live run
- Pause / Resume toggle
- More menu: Copy ID, Reset Memory, Terminate

---

### Run Transcript

What an agent did during one execution, step by step:

- Header: agent name, run ID, status badge, start/end time, total cost, trigger
- Every step shown: tool calls with inputs + outputs, reasoning, messages, errors
- Expandable/collapsible tool blocks
- Links back to the task it was working on

---

### Tasks

The work queue for all agents.

- Filter by status: All / Backlog / To Do / In Progress / Done / Cancelled
- Filter by agent, by priority (Critical / High / Medium / Low)
- Each row: status icon, task title, assigned agent, priority, last updated
- Click row → task detail

**New Task dialog** (also accessible from sidebar and keyboard shortcut C):
- Title, description (markdown), assign to agent, priority, optional due date

---

### Approvals

All pending and historical approval requests in one place.

- Tabs: Pending / All
- Each card: action type with icon, full content preview, requesting agent, time requested
- Approve / Reject per card; optional reject reason
- Bulk select and act on multiple at once
- "All" tab shows resolved approvals with outcome + timestamp

---

### Inbox

Notification hub for anything that needs attention.

- Unread count badge in sidebar (turns red with alert dot when runs have failed)
- Failed run rows: agent name, error summary, time, link to transcript
- Mark as read / mark all read

---

### Automations

Recurring triggers that fire agents automatically (currently in Beta).

- List of active automations: name, trigger type, agent, schedule, status, last run
- Trigger types: Cron schedule (with human-readable preview), Webhook URL, Event type
- Create / edit / delete automations
- Enable/disable toggle per automation
- Run history per automation

---

### Deliverables

Files and artefacts produced by agent runs.

- List with name, file type (PDF / HTML / Report), producing agent, date, size
- In-browser preview (PDF, HTML)
- Download button
- Filter by type / agent
- Links back to the run that created it

---

### Budget & Costs

Spending controls and usage data.

**Summary tab**: total spend this month, spend by agent chart, budget utilisation bars, active incidents (paused agents/projects)

**Spending Limits tab**: budget rules with scope (per agent / per project / global), limit amount, current usage %, visual progress bars; create / edit / delete rules

**AI Usage tab**: token breakdown by model, cost per 1K tokens, usage over time chart

**Transactions tab**: full paginated ledger of every run with cost; CSV export

---

### Activity Log

Complete audit trail of everything that happened.

- Chronological feed, infinite scroll
- Plain-English events: "CEO sent WhatsApp to Ahmed · 12 min ago"
- Filter by agent, action type, date range
- Search
- Click any event → navigate to the entity it refers to

---

### Team Structure (Org Chart)

Visual hierarchy of the agent team.

- Interactive tree: agents indented under their manager
- Status dot per agent
- Click agent → agent detail
- Expand/collapse subtrees

---

### Agency Settings

Configuration for the agency.

- Agency name, issue prefix
- Brand colour picker
- Logo upload
- Integrations: list of connected services (WhatsApp, Gmail, Calendar, Instagram etc.) with connect/disconnect buttons
- Team members: invite by email, list with role + last active, remove button
- Danger zone: delete agency

---

### Live Activity Panel

A slide-in panel that shows what is happening right now without leaving the current page.

- Triggered from the "Live Activity" button in the sidebar
- Shows all currently running agent runs: agent name, current step, elapsed time
- Auto-refreshes every few seconds
- Remembers open/closed state across page loads

---

## Key User Journeys

### Morning check-in (60 seconds)
1. Open app → Dashboard
2. See metrics: "2 working, 1 needs OK, 5 open"
3. Pending Approvals banner shows 1 item: "Send WhatsApp to Ahmed"
4. Read preview → click Approve
5. Banner disappears
6. Skim "What Just Happened" — everything looks normal
7. Done

### Investigating a failure
1. Red dot appears on Inbox badge
2. Open Inbox — see failed run row with error summary
3. Click → Run Transcript — read exactly which step failed
4. Navigate to Agent Detail → Instructions — fix the instruction that caused it
5. Click Wake Up — agent re-runs
6. Watch Inbox: new run succeeds, badge clears

### Delegating a new project
1. Click New Task in sidebar
2. Set title, assign to agent, set priority
3. Create — task appears in Tasks page as "To Do"
4. Agent picks it up, runs, requests approval
5. Approval badge appears → approve
6. Task moves to Done → appears in Activity Log

### Managing a budget overage
1. Red budget incident banner on Dashboard
2. Click "Open budgets" → Budget page
3. See agent at 98% of $50 limit
4. Edit budget rule → increase to $100
5. Agent automatically resumes
6. Banner clears from Dashboard

---

## What the Interface Must Always Communicate

- **What is running right now** — visible from sidebar badge and Dashboard
- **What needs the user's attention** — approvals badge, inbox badge, always in view
- **What just happened** — activity feed, always one click away
- **Who did what** — every action attributed to a named agent, in plain language
- **How much it cost** — surfaced on agent detail, budget page, and transaction log
