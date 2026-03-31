# Aygency World — Full Feature Inventory

Every capability available to a user in the application, listed exhaustively by area. This document is the source of truth for what the product can do.

---

## 1. ONBOARDING

### First-Run Wizard (shown on first visit or `?onboarding=1`)
- Enter agency name (text input, Enter to advance, Continue button)
- Name your first agent (text input)
- Choose agent role from grid (CEO / Marketing / General / Finance / Research / Tech — each with emoji + description)
- Step indicator pills (top-right)
- Creating animation (spinner → tick with "You're in." confirmation)
- Back button to return to step 1
- Auto-navigates to CEO Chat on success

---

## 2. SIDEBAR (persistent, all pages)

### Company Bar (top)
- Company brand colour dot
- Company name (truncated)
- Search button (⌘K) — opens command palette

### Top-level navigation
- **CEO Chat** → `/ceo-chat`
- **New Task** (button, not a page link) → opens New Task dialog
- **Dashboard** → `/dashboard` — shows live run count badge (green)
- **Inbox** → `/inbox` — shows unread count badge; red + alert icon if there are failed runs
- **Approvals** → `/approvals/pending` — shows pending approval count badge

### WORK section
- **Tasks** → `/issues`
- **Automations** → `/routines` — "Beta" amber badge
- **Deliverables** → `/deliverables`

### TEAM section (SidebarAgents)
- Lists every agent with status dot + name + role
- Clicking any agent → their detail page
- "Hire Agent" / "+ Agent" button at bottom of list

### AGENCY section
- **Live Activity** (button, not a link) — toggles slide-in real-time activity panel; shows live run count badge
- **Organisation** → `/org`
- **Budget** → `/costs`
- **Log** → `/activity`
- **Settings** → `/company/settings`

### Plugin slots
- Plugins can inject extra sidebar items and sidebar panel widgets

---

## 3. CEO CHAT (`/ceo-chat`)

### What you can do
- **Send a message** to the CEO agent (textarea, Enter to send, Shift+Enter for new line)
- **Send button** (blue, rounded) — disabled while streaming or input is empty
- **Quick action pills** (one click sends a pre-written message):
  - "Brief me" → "Give me a morning brief"
  - "What's pending?" → "What approvals are pending?"
  - "Pause all agents" → "Pause all agents immediately"
- **See the CEO's response stream in real-time** (text fills character by character with blinking cursor)
- **See typing indicator** (three bouncing dots while waiting for first token)
- **See your messages** (right-aligned blue bubble)
- **See CEO messages** (left-aligned dark bubble)
- **Approve or reject actions inline** — when the CEO requests an action, an approval card appears inside the chat bubble:
  - See action type label (Send WhatsApp / Send Email / Post to Instagram / Send Pitch Deck / Confirm Viewing)
  - See lead score badge (Score X/10)
  - See recipient name + phone
  - See full message preview
  - See context note
  - Click **[Approve]** — executes the action
  - Click **[Reject]** — declines the action
  - See "Approved" / "Rejected" confirmation text after acting
- **See CEO agent status** (top-right of header): Running / Responding / Paused / Idle with colour dot
- **Chat persists** — messages load from server on every visit; full history visible

---

## 4. DASHBOARD (`/dashboard`)

### What you can do
- **See "Working Now"** metric — count of agents currently running; click → goes to Team page
- **See "Awaiting Approval"** metric — count of pending approvals; click → goes to Approvals page
- **See "Open Tasks"** metric — open task count + in-progress + blocked breakdown; click → goes to Tasks page
- **See budget incident banner** — if any agents/projects are paused due to overspend: count of incidents, paused agents, paused projects, pending budget approvals; "Open budgets" link
- **See no-agents warning** — amber banner with "Hire agents" link when team is empty
- **Approve/reject pending actions** via Pending Approvals Banner (shown when approvals > 0):
  - Each pending approval as a compact row: icon + label + agent name + [Approve] [Decline]
  - "See all N approvals →" link
- **See Your Team** — a card per agent showing:
  - Agent avatar/initials
  - Name + role
  - Status (working / idle / paused)
  - What they're doing right now (current task title, live from server every 10s)
  - Pending approval count badge
- **See What Just Happened** — up to 8 most recent activity events:
  - Actor name + plain-English action + entity name + time ago
  - New events animate in with a highlight
  - Clicking a row → navigates to that entity
- **"View full log →"** link to Activity page
- **Plugin dashboard widgets** — plugins can inject extra cards

---

## 5. YOUR TEAM (`/agents`)

### Filtering & viewing
- **Filter by status tab**: All / Active / Paused / Error (URL-driven, shareable)
- **Show terminated agents** — via Filters dropdown (checkbox)
- **Toggle list view** (flat list) vs **org tree view** (hierarchy with indentation) — desktop only; mobile always shows list
- **Agent count** shown ("X agents")

### Actions
- **[Hire Agent]** button → opens New Agent dialog

### List view — each agent row shows
- Status colour dot
- Agent name + role label + custom title
- **Live badge** (pulsing blue "Live(N)") → links directly to that live run — OR Status badge when idle
- AI model label (Claude / Codex / Gemini / OpenCode etc.)
- Last active time (relative)
- Status badge (active / paused / error / terminated)
- Click anywhere on row → agent detail page

### Org tree view
- Same columns as list view
- Agents indented under their manager
- Tree lines showing reporting hierarchy
- Expandable child groups

---

## 6. AGENT DETAIL (`/agents/[name]/[tab]`)

### Header actions
- **Click agent icon** → opens Icon Picker — choose from emoji/icon set
- **[Assign Task]** button → opens New Task dialog pre-assigned to this agent
- **[Wake Up]** button → manually triggers the agent's heartbeat right now; navigates to the new live run
- **[Pause] / [Resume]** button — toggles agent running state
- **Status badge** (active / paused / pending approval / error)
- **Live run link** (mobile) — "Live" pill → live run detail
- **⋯ More menu**:
  - Copy Agent ID to clipboard
  - Reset Sessions — clears all task memory/session state
  - Terminate — permanently removes the agent (destructive, confirmation dialog)

### Tabs

#### Dashboard tab
- **Latest Run card** (or "Live Run" if currently running):
  - Status badge + run ID + trigger source (Scheduled / Manual / Assigned / Automation)
  - Time ago
  - 2-3 line summary of what the run did
  - "View details →" link
  - Click card → run detail
- **4 mini charts** (last 14 days):
  - Run Activity (bar chart by day)
  - Issues by Priority (distribution)
  - Issues by Status (distribution)
  - Success Rate (pass/fail ratio)
- **Recent Issues** (up to 10):
  - Issue title + identifier + status badge
  - "See All →" link (filtered to this agent)
- **Costs section**:
  - Total input tokens / output tokens / cached tokens / total cost (from all-time runtime state)
  - Table of most recent 10 runs with cost: date, run ID, input tokens, output tokens, cost per run

#### Instructions tab
- **File tree panel** (left) — all instruction files (AGENTS.md, CLAUDE.md, custom .md files):
  - Click file to select and edit
  - Add new file (+ button, type path, Enter to create)
  - Delete selected file (button in toolbar)
  - Expandable directory tree
  - Drag to resize panel width
- **Markdown editor** (right):
  - Edit instruction file content (WYSIWYG markdown editor with toolbar)
  - Image upload (drag-and-drop or paste into editor)
  - Character/word count
- **Bundle mode selector**: Managed (files stored in Paperclip DB) vs External (files from disk path)
  - If External: set root path + entry file path
- **Entry file** selector — which file is the agent's primary instructions
- **Save / Cancel** buttons (sticky floating bar on desktop; fixed bottom bar on mobile) — appear when changes are made

#### Skills tab
- Lists all skills assigned to this agent
- Each skill: name, description, source (company / agent), whether it's read-only
- Add skill from company library
- Remove skill from agent

#### Configuration tab
- **AgentConfigForm fields** (adapter-specific):
  - Agent name
  - Role (CEO / CMO / CFO / Engineer / General etc.)
  - Custom title (free text)
  - Capabilities description (free text)
  - Adapter type selector (Claude / Codex / Gemini / OpenCode / Cursor / HTTP / Process etc.)
  - Model selector (list of available models for the chosen adapter — e.g. claude-opus-4-5, claude-sonnet-4-6)
  - Reports to (parent agent in hierarchy)
  - Heartbeat schedule — interval in minutes (how often the agent wakes up automatically)
  - Max run duration timeout
  - Environment variables (key=value pairs, API keys redacted in display)
    - Add environment variable
    - Edit environment variable value
    - Delete environment variable
    - Secret values (API_KEY, ACCESS_TOKEN, etc.) shown as `***REDACTED***`
  - Allowed tools list
  - Model temperature / max tokens (adapter-specific)
- **Permissions section**:
  - Toggle: "Can create new agents" — lets this agent hire new team members
  - Toggle: "Can assign tasks" — lets this agent assign tasks to others (auto-enabled for CEO / agent-creators)
- **API Keys section** (`KeysTab`):
  - List of all API keys for this agent
  - Create new key — generates token, copies to clipboard
  - Reveal / hide existing key value
  - Copy key to clipboard
  - Delete key
- **Configuration Revisions** (collapsible):
  - List of past config saves with: revision ID, date, source, changed fields
  - **[Restore]** button on each — rolls back to that revision
- **Save / Cancel** (sticky bar, appears when dirty)

#### History tab (runs)
- List of all past runs, newest first
- Each row:
  - Status icon + badge (succeeded / failed / running / timed out / cancelled)
  - Run ID (short)
  - Trigger source pill (Scheduled / Manual / Assigned / Automation) — colour-coded
  - Start time (relative)
  - Duration
  - Token usage + cost
- Click row → expands run detail (or navigates to run detail page)

#### Budget tab
- **BudgetPolicyCard** for this agent:
  - Current monthly spend vs limit (progress bar)
  - Utilisation percentage
  - Hard stop enabled toggle
  - Notify on threshold toggle
  - Edit monthly budget amount — number input, [Save] button
  - Status (ok / warning / hard stop / paused)

---

## 7. RUN DETAIL (`/agents/[name]/runs/[runId]`)

### What you can see
- **Status badge** (running / succeeded / failed / timed out / cancelled)
- **[Cancel]** button — cancel a currently running run
- **[Resume]** button — resume a "process lost" failed run from where it left off
- **[Retry]** button — retry a failed or timed-out run fresh
- **Start time + end time** (HH:MM:SS)
- **Duration** — live elapsed counter for running runs
- **Invocation source** (Scheduled / Manual / Assigned / Automation)
- **Exit code** (if non-zero, shown in red)
- **Token usage**: input / output / cached tokens + cost in $
- **Session ID** before and after the run (whether session was new or resumed)
- **Error message** (if failed)
- **stderr excerpt** (red, monospace)
- **stdout excerpt** (monospace)
- **Workspace operations panel** (if applicable): Worktree setup / Provision / Teardown / Worktree cleanup
  - Each operation: phase label + status badge + timestamp + command + working dir + branch/base ref/worktree path + stderr/stdout excerpts
  - "Show/hide full log" toggle → full timestamped log (stdout / stderr / system streams, colour-coded)
- **Issues touched by this run** — list of tasks this run interacted with; [Reset sessions for these issues] button
- **Claude re-auth flow**: "Login with Claude" button (if needed)
- **Run Transcript** — full streaming view of what the agent did:
  - Tool calls (name, arguments, result)
  - Text responses
  - Multiple transcript view modes (compact / full / raw)
  - Scroll-to-bottom button
  - Real-time updates if run is live (polls/streams events)

---

## 8. TASKS / ISSUES (`/issues`)

### Filtering
- **Search** (text input, URL-synced `?q=`) — searches titles
- **Status tabs**: Backlog / Todo / In Progress / In Review / Blocked / Done
- **Assignee filter** (dropdown) — filter by specific agent or unassigned
- **Project filter** (dropdown) — filter by project
- **Priority filter** — All / Urgent / High / Medium / Low / No priority
- **Filter by participant agent** (`?participantAgentId=`) — shows only tasks involving a specific agent

### Task list
- Each row:
  - Status icon (clickable to change status inline)
  - Title (truncated)
  - Live indicator (pulsing blue dot) if an agent is actively working on it
  - Priority icon
  - Assignee avatar + name
  - Project tag
  - Time ago (updated at)
  - Click → task detail

### Actions
- **[New Task]** button → New Task dialog

---

## 9. TASK DETAIL (`/issues/[identifier]`)

### Left panel
- **Inline title editor** — click to edit title, Enter to save
- **Description** — markdown editor, full WYSIWYG with image upload
- **Comment thread**:
  - Read all comments in chronological order
  - Add a new comment (markdown editor)
  - @mention agents or users
  - Assign next action to a specific agent from comment ("who handles this next?")
  - Activity tab (within comments) — full timeline of changes to this task
- **Attachments section** (`IssueDocumentsSection`):
  - Upload files by drag-and-drop or file picker
  - Download attached files
  - Delete attached files
  - View list of all attachments with filename, size, uploader
- **Deliverables / Work Products** (`IssueWorkspaceCard`):
  - Documents, Pull Requests, Branches, Preview URLs, Services, Files, Commits
  - Each with status badge and external link
- **Live run widget** — if an agent is currently running on this task, shows live activity

### Right panel (properties)
- **Status** — dropdown (Backlog / Todo / In Progress / In Review / Blocked / Done / Cancelled)
- **Priority** — dropdown (Urgent / High / Medium / Low / None)
- **Assignee** — agent or user picker
- **Project** — assign to a project
- **Labels/Tags** — add/remove tags
- **Parent issue** — link to parent task in hierarchy
- **Created at / Updated at** timestamps

### Header actions (⋯ More menu)
- Copy issue ID
- Copy issue URL
- Delete issue (destructive, with confirmation)

---

## 10. APPROVALS (`/approvals/pending` and `/approvals/all`)

### Filtering
- Tab: **Pending** (default) / **All**

### Approval list
- Each `ApprovalCard` shows:
  - Action type icon + label (Send WhatsApp / Send Email / Post to Instagram / Generate Report etc.)
  - Agent name who requested it
  - Time ago
  - Message preview / recipient / subject / content body
  - **[Approve]** button — executes the action
  - **[Decline]** button — rejects the action
  - Status badge for resolved items (approved / rejected / expired)

### Approval detail (`/approvals/[id]`)
- Full approval detail
- Full message/content preview
- Full context (which task, which agent, what triggered it)
- Comment thread — add a comment or revision request
- **[Approve]** / **[Decline]** / **[Request Revision]** buttons

---

## 11. INBOX (`/inbox`)

### Tab filters
- Everything / Approvals / Failed Runs / Issues I Touched / Join Requests / Alerts

### Work items
- **Pending approvals** (same as Approvals page but inline):
  - Swipe left to archive (mobile)
  - [Approve] / [Decline] inline buttons
- **Failed runs**:
  - Agent name + error message excerpt
  - [View run] link
  - [Dismiss] to clear from inbox
- **Issues I recently touched** (tasks the user commented on or modified):
  - Task title + status + time
  - Click → task detail
- **Join requests** (if someone wants to join the company):
  - Agent name + request type
  - [Accept] / [Reject]
- **Alerts** — budget incidents, system warnings

### Global inbox actions
- [Dismiss all] button
- Per-item [Mark read] / [Dismiss]
- Filter by agent (dropdown)

---

## 12. BUDGET (`/costs`)

### Overview metrics (top)
- Total spend (this week by default)
- Input tokens
- Output tokens
- Cost this week

### Tab: Overview
- **Date range picker** (presets: Today / This Week / This Month / Last 30 Days / Last 90 Days / custom)
- **Spend timeline** — daily spend chart
- **Spend by agent table**: agent name, input tokens, output tokens, cached tokens, cost

### Tab: Spend
- Breakdown cards by billing type (billed_cents, token_count etc.)
- Each card: type label, amount, token totals

### Tab: Budgets
- **Budget policy cards** (per agent or per project):
  - Policy name + scope (agent/project name)
  - Monthly limit amount
  - Current spend (progress bar with %)
  - Status: OK / Warning / Hard Stop / Paused
  - [Edit] — change monthly limit amount, hard stop toggle, notify toggle, [Save]
  - [Delete] — remove policy
- **Budget incident cards** (if any agents are currently over budget):
  - Agent/project name
  - Amount over limit
  - [Resolve] or [Adjust limit]
- **[Create Budget Policy]** button — set monthly limit for any agent or project

### Tab: AI Models
- Per-provider breakdown (Anthropic / OpenAI etc.):
  - Provider tabs with total tokens + total cost in tab label
  - Per-model rows: model name, input tokens, output tokens, cached tokens, cost
  - Expandable per-model detail

### Tab: Billing (Finance Events / Transactions)
- List of all financial events:
  - Direction (in/out arrow icon)
  - Amount ($)
  - Description / label
  - Time
- Quota windows — usage windows with start/end/current amount

---

## 13. AUTOMATIONS (`/routines`) ← Beta

### What you can do
- **See all automations** (recurring workflows/schedules)
- **[New Automation]** button → opens creation dialog:
  - Title (required)
  - Description (optional)
  - Schedule (cron expression or interval)
  - Assignee agent (dropdown)
  - Project (dropdown)
  - Concurrency policy: Allow / Skip / Queue
  - Catchup policy: Run missed / Skip missed
  - [Create] button
- **Edit automation** — click row → detail page:
  - Edit all fields above
  - Enable / Disable toggle
  - [Save] / [Cancel]
  - [Delete] button (destructive)
- **See status badge** (active / paused / error)
- **See last run time + next run time**

---

## 14. DELIVERABLES (`/deliverables`)

### What you can do
- **Filter by type**: All / Documents / Files / Pull Requests / Previews
- **See all work products** produced by agents across all tasks:
  - Each card: type icon + type label + name/title + status badge + task link + timestamp
  - External link to open document/PR/preview
  - Status: Active / Draft / Ready for Review / Approved / Merged / Closed / Failed / Archived / Changes Requested

---

## 15. ORGANISATION (`/org`)

### What you can see and do
- **Visual org hierarchy** — indented tree of all agents
- Same per-agent data as the Agents list: name, role, status dot, model, last active, status badge, live badge
- Click any agent → agent detail
- **Export company** button → `/company/export`
- **Import company** button → `/company/import`

### Company Export (`/company/export`)
- Download the full company configuration as a package file (JSON/ZIP)
- Includes agents, skills, configuration, goals, projects

### Company Import (`/company/import`)
- Upload a company package file
- Preview what will be imported
- [Import] button

---

## 16. GOALS (accessible via sidebar or navigation — currently not in primary sidebar but exists at `/goals`)

### What you can do
- **See goal tree** — hierarchical goals with parent/child relationships
- **[New Goal]** button → opens New Goal dialog:
  - Title
  - Description
  - Parent goal (optional, for nesting)
  - [Create]
- **Click goal** → goal detail:
  - Edit title/description
  - Add sub-goals
  - Link tasks to goal
  - See progress (% of linked tasks complete)
  - Delete goal

---

## 17. LOG / ACTIVITY (`/activity`)

### What you can do
- **See full activity log** — every event across the entire company
- **Filter by agent** (dropdown) — show only events from a specific agent
- Each row: actor name + plain-English action verb + entity name + time ago; clicking → entity detail
- Events include: task created/updated/commented, agent hired/paused/resumed/terminated, approval requested/approved/rejected, run woke up/stopped, budget updated, goal created/updated, cost logged, company updated

---

## 18. COMPANY SETTINGS (`/company/settings`)

### General section
- Edit company name (text input)
- Edit company description (text input, optional)
- [Save changes] (only visible when dirty)

### Appearance section
- **Upload logo** — file picker (PNG / JPEG / WEBP / GIF / SVG), uploads to server
- **Remove logo** button (if logo set)
- **Brand colour** — colour picker + hex input field + [Clear] button
- Live preview of company icon (generated pattern icon with the chosen colour/logo)

### Hiring section
- **Require board approval for new hires** toggle — when on, new agents stay pending until manually approved

### Invites section
- **[Generate OpenClaw Invite Prompt]** button — creates a short-lived invite token, builds an agent onboarding snippet, auto-copies to clipboard
- Invite prompt displayed in read-only textarea (tall, ~28rem)
- [Copy snippet] button

### Company Packages section
- **[Export]** button → company export page
- **[Import]** button → company import page

### Danger Zone
- **[Archive company]** button — confirmation dialog → hides company from sidebar (persists in DB, not deleted)

---

## 19. INSTANCE SETTINGS (`/instance/settings`)

### General tab
- **Censor username in logs** toggle — when on, replaces your OS username with `[user]` in all log output displayed in the UI (privacy feature)

### Experimental tab
- Various in-development feature flags

---

## 20. SKILLS LIBRARY (`/company/skills`)

### Company-wide skills
- See all skills available in this company
- Each skill: name, description, file path, source (built-in / custom)
- **Add custom skill** — create a new markdown skill file
- **Edit skill** content — markdown editor
- **Delete skill**
- Assign skills to agents (from agent detail Skills tab)

---

## 21. PLUGINS (`/plugins`)

### Plugin management
- **See installed plugins** — list with name, description, version, status badge (ready / installing / error / disabled)
- **Install plugin** from marketplace — name/URL input
- **Enable plugin** — activates plugin for this instance
- **Disable plugin** — deactivates but keeps installed
- **Uninstall plugin** — removes completely
- **See plugin error details** — modal with full error message if plugin failed to load
- **See plugin settings** per plugin — plugin-specific config UI (if plugin provides one)
- **Example plugins** shown if none installed

---

## 22. NEW AGENT DIALOG (global, triggered from Sidebar + Agents page)

### Fields
- Agent name (required)
- Role (dropdown: CEO / CMO / CFO / CTO / Engineer / Designer / PM / QA / DevOps / Researcher / General)
- Adapter type (Claude / Codex / Gemini / OpenCode / Cursor / HTTP / Process / OpenClaw Gateway)
- Adapter-specific fields (model, heartbeat interval, environment variables)
- Reports to (parent agent dropdown)
- [Create] / [Cancel]

---

## 23. NEW TASK DIALOG (global, triggered from sidebar "New Task" button + agent detail)

### Fields
- Title (required)
- Description (markdown, optional)
- Status (dropdown)
- Priority (dropdown)
- Assignee (agent or user, optional — pre-filled if opened from agent detail)
- Project (optional)
- [Create] / [Cancel]

---

## 24. COMMAND PALETTE (⌘K / Search button)

- **Fuzzy search** across tasks, agents, pages
- Keyboard navigable (arrow keys, Enter to select, Esc to dismiss)
- Results grouped by type (pages, tasks, agents)

---

## 25. LIVE ACTIVITY PANEL (slide-in, toggle from sidebar)

- Real-time scrolling feed of everything happening across all agents
- Each line: timestamp + agent name + action description
- Colour-coded by agent
- Auto-scrolls; pauses on hover
- Dismiss/close button

---

## 26. AUTHENTICATION

### Sign in
- Email + password inputs
- [Sign In] button
- Error messages (wrong credentials, unverified email)

### Sign up
- Email + password + confirm password
- [Create Account] button

### Board Claim (`/board-claim`)
- For first-time admin setup
- Enter claim token → grants owner access to the instance

### CLI Auth (`/cli-auth/[token]`)
- Approve or deny a CLI tool trying to authenticate
- Shows what CLI is requesting, [Approve] / [Deny]

### Invite Landing (`/invite/[token]`)
- Accept an invitation to join a company
- Shows company name, inviter, [Accept Invitation] button

---

## 27. PROJECTS (accessible from issues + agent detail)

### Projects list
- See all projects
- Each: name, issue prefix, description, open task count, agent count
- Click → project detail

### Project Detail
- **Overview tab**: description, recent activity, metrics
- **Tasks tab**: filtered task list for this project (same filter/sort as main Tasks page)
- **Configuration tab**: edit project name, description, issue prefix
- **Budget tab**: project-level budget policy (same as agent budget, but scoped to project)
- **[New Task]** button (pre-assigned to this project)
- **[Delete project]** (destructive)

---

## 28. APPROVAL DETAIL (`/approvals/[id]`)

### What you can do
- See full approval details: action type, requesting agent, creation time, expiry time
- See full payload: recipient, message body, subject, attachments, context
- See linked task (if any)
- Add comment / revision request (markdown)
- See comment thread
- **[Approve]** — executes the action, marks approval as approved
- **[Decline]** — marks as rejected
- **[Request Revision]** — sends feedback back to the agent for them to revise before re-requesting

---

## 29. MOBILE-SPECIFIC UI

### Bottom Navigation Bar
- Dashboard / CEO Chat / Inbox / Agents / (more)
- Badge counts on Inbox and other items
- Active item highlighted

### Behaviour differences
- Agents list always shows flat list (no org tree toggle)
- Save/Cancel bars for agent config stick to bottom of screen above safe area
- Slide-in panel for live activity

---

## 30. GLOBAL BEHAVIOURS

### Toast notifications
- Success / error / info toasts appear top-right
- Auto-dismiss after a few seconds

### Unsaved changes guard
- Navigating away from agent Instructions or Configuration with unsaved changes triggers a browser "Leave page?" confirmation

### Auto-refresh / polling
- Dashboard: agents every 30s, live runs every 10s, approvals every 15s
- Approvals badge: every 15s
- Live runs count (sidebar): every 10s
- CEO Chat comments: every 15s
- CEO agent status: every 30s
- Run transcript (live): streams events in real-time

### Dark mode
- Full dark/light mode support (Tailwind dark: classes throughout)

### PWA
- Installable as a Progressive Web App on mobile
- Works offline for cached pages
