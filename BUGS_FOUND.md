# Bugs & Inconsistencies — Playwright walkthrough

Date: 2026-04-18
Tester: Claude (Playwright MCP, Chromium 1440×900)
Entry point: http://localhost:3002
Screenshots: `.playwright-mcp/shot*.png`

---

## 🔴 Critical — real-world breaks

### 1. WebSocket to `/events/ws` fails on **every** page load
```
ws://localhost:3002/api/companies/{uuid}/events/ws
→ WebSocket is closed before the connection is established
```
Logged 2× on every route (initial attempt + retry) from [ui/src/context/LiveUpdatesProvider.tsx:533](ui/src/context/LiveUpdatesProvider.tsx#L533).
Consequence: the "Live" indicator top‑right is a lie — no realtime events stream in, Activity rail never auto‑updates, approval cards won't pop in as promised.

### 2. CEO promises an action that never happens
12:57 — user said "I HAVE ASSIGNED LEADS TO CLAIRE GET HER TO REACH OUT". CEO replied "Got it. I've instructed Claire to clear her queue and begin outreach immediately. You'll see her message approval cards pop up shortly."
Outcome at 17:41:
 - Claire still **Idle/Resting**, last run 5h ago, never ran.
 - Claire's queue = 17 items, 0 done this week.
 - `/JAC/approvals/pending` = "No pending approvals."
The CEO→sub‑agent delegation is broken. Tasks land in the queue but nothing processes them.

### 3. Duplicate task storm in Claire + Clive queues
Claire (17 queued) and Clive (31 queued) each have multiple near‑identical rows:
 - "Initiate outreach to all newly assigned leads" (5h ago)
 - "Action newly assigned leads immediately" (1d ago)
 - "Process newly assigned leads immediately" (2d ago)
 - "Process assigned leads immediately" (2d ago)
 - "Process newly assigned leads immediately" (2d ago)  ← duplicate
CEO isn't deduplicating; queue processor isn't catching up either. The queue grows unboundedly.

### 4. "create task…" spinner is stuck
Screenshot the user flagged. The streaming tool‑call indicator stays rendered forever after the message completes. In DOM: 1 spinner + leftover text "create task". Fix: tie spinner visibility to `streamingState === 'running'`, clear on final chunk.

### 5. CEO hallucinates context
Latest CEO brief references "She is also queued to redraft a message to **Alex** following your exact template correction." There is no lead named Alex — only "JOHN". The CEO is inventing facts. (Also violates the `project_identity_preamble.md` memory: "never-invent-inventory".)

### 6. CEO recommends firing the canonical roster
"Tariq, Layla, and Saif have had zero runs in the last 30 days. I recommend removing them to save on base costs." These are canonical v1 roster agents. CEO doesn't know which agents are protected and which are hireable.

### 7. Dashboard "OPEN TASKS 17" vs "0 in progress"
If 17 are open, at least some should be "in progress" or at least explained. No dashboard click‑through when clicked. Metric is misleading.

### 8. Stale / mismatched company IDs in one session
WebSocket URLs flip between:
 - `ce7ec971-bcf8-4433-8cac-a156e2e6357f` (initial `/ceo-chat`)
 - `706a020a-9bcb-4434-bbe3-b2c795978374` (all subsequent pages)
Two different company IDs within the same session = state desync or wrong lookup. Verify `useCompanyId()` doesn't change across route transitions.

---

## 🟠 Functional inconsistencies

### 9. Agent status terminology drifts: `Idle` vs `Resting` vs `Active 0`
Same agent simultaneously shows "Idle" (header), "Resting" (body status line), "Active 0". Pick one vocabulary and stick to it.

### 10. Agent‑page tab set is non‑uniform
 - Claire: Home / **Messages** / Training / Schedule / Settings
 - Saif:   Home / **Messages** / Training / Schedule / Settings
 - Layla:  Home / Training / Schedule / Settings   ← no Messages tab
 - Tariq:  Home / Training / Schedule / Settings   ← no Messages tab
 - Clive:  Home / Training / Schedule / Settings   ← no Messages tab
Why can Claire & Saif send messages but Layla/Tariq/Clive can't? If it's by role, make the logic visible; if it's a bug, align all agents.

### 11. Clive "Idle" in header, "1 active — CEO Chat — In Progress (3d ago)" in body
Task has been "in progress" for 3 days. Either the run crashed and the status wasn't reconciled, or Clive is perpetually running one CEO Chat task. Kill‑stale‑run logic is missing.

### 12. Sidebar agent list ≠ All Agents list
Sidebar shows Clive, Saif, Layla, Tariq, Claire (5).
`/JAC/agents/all` lists 8: same five **plus** "Marketing Manager", "Operations Manager", "Sales Manager" — all Paused with "No runs yet". These three shouldn't exist (roster is fixed at 6+CEO). Likely stale seed data or a hidden "Manager" layer that isn't meant to be visible.

### 13. Lead card shows the literal word "JOHN" in the email column
In `/JAC/leads`, the one lead has phone `+971…` and **email: "JOHN"**. No validation on ingestion; placeholder/bad data leaks to the user‑facing pipeline.

### 14. Lead score "0" rendered as "★ 0"
Distinct from unscored. Show "—" or hide until scored; otherwise every new lead looks rated zero.

### 15. "Contacted 1" is the only stage chip shown
Other stages (Qualifying, Hot, Viewing, Closed, etc.) are absent. Either show all stages with 0 counts, or show none until there's data — but not one arbitrary stage.

### 16. Activity feed speaks engineer
Right rail shows `issue → read marked`, `agent → direct response`, `whatsapp → received`, `tool call` (no tool name). These are raw event types. Translate to user language: "Marked task read", "Claire replied", "WhatsApp arrived from +971…", "Claire used `send_whatsapp`".

### 17. Activity feed is global, not scoped
On Layla's page the Activity rail shows "Claire tool call" events. Right rail should scope to the agent/page context or clearly label it global.

### 18. Recent Activity on Dashboard spams "You viewed CEO Chat — just now" 4× in a row
Page‑view events shouldn't live in the business activity log — they're noise.

### 19. Dashboard recent activity phrasing: "Claire tool call Claire"
Subject **and** object are the same name. Reads as nonsense. Should be "Claire called `tool_name`" or "Claire → tool_name".

### 20. Properties `/properties` redirects to `/JAC/properties/sale` (singular), Leads redirects to `/JAC/leads`, CEO Chat is `/ceo-chat` (no prefix). URL prefix convention is inconsistent — some routes require the company prefix, others don't.

### 21. Date/time rendering is 5h off
Chat messages sent at local ~12:41 PM displayed as "17:41". Server is in UTC / different TZ than the browser. Either render with `toLocaleTimeString()` or adjust on the server side.

### 22. Date‑pill tabs show two active pills simultaneously
In CEO Chat header the pill row shows "18 Apr at 12:54" AND "16 Apr at 21:31" both highlighted. Only one conversation should be visually selected.

### 23. Auto‑reply mode default is ON on Claire
"Outbound messages send automatically without approval." contradicts CLAUDE.md ("Approval before external action"). Brand‑new hires should default to OFF until the user opts in.

### 24. Agency Description field is a dev/debug dump
Settings → Agency → Description contains:
```
Agency: Jackson Estaytes
Hired agents (in addition to CEO):
- Claire (sales)
- Saif (content)
```
Looks like a backend state dump, not something the user wrote. Also out of date (lists Saif as content, current role is "Creative & Marketing").

### 25. Brand colour = swatch + text input labelled "Auto"
What does "Auto" mean? If no pick → default green. Either show the current hex or remove the placeholder.

### 26. "Google Calendar — Calendar OAuth lands in Sprint 3" is internal roadmap text
On every agent's Connected Accounts card. Never leak sprint numbers to users.

### 27. "Push Notifications" → "Browser notifications → Enable" button with no post‑click feedback
(Untested click — confirm modal appears.)

### 28. Metrics card: "ACTIVE LEARNINGS 5 — 0 times applied"
"Active" but never applied means the agents aren't reading them. Confusing metric — rename to "Pending learnings" or "Ready learnings" and show apply rate.

### 29. Metrics card: "AGENT COMMS 0 messages today"
But Dashboard recent activity shows multiple Claire "tool call" events the same day. Comms counter is decoupled from activity log.

---

## 🟡 Naming / copy

### 30. Nav label "Inbox" → page heading "Approvals" → page title "Approvals · Aygency World"
Pick one: Inbox or Approvals. Three names for one feature.

### 31. Nav label "All Agents" → page heading "Your Team" → page title "Team · Aygency World"
Same inconsistency. Team vs All Agents vs Your Team.

### 32. Agent role chip casing: "Lead Agent", "CEO", "operations" (lowercase), "General", "Creative & Marketing". Inconsistent capitalization of department chips.

### 33. Browser tab titles briefly render as lowercase ("saif · Agents · Aygency World") before capitalising. Cache/resolve race.

### 34. Sidebar section "Agency" contains Knowledge Base + Settings. The word "Agency" overlaps with the product name "Aygency". Rename section to "Company" or "Workspace".

### 35. Button text: "+ Give Clive a task" / "+ Give Claire a task" — verb "give" feels odd in a CEO‑staff frame. "Assign" or "Delegate" would read better.

### 36. Empty state on Comms: "No agent chatter yet. Send a message to the CEO to see agents coordinate." — the right‑rail Comms panel should surface inter‑agent messages; user has to trigger it via CEO Chat. If that's the intent, say so more clearly ("Agents will chat here when CEO delegates a task").

### 37. `RUNS (30D)` / `SPEND (30D)` — terse acronym in ALL CAPS. Use "Runs · last 30 days" for clarity.

### 38. Dashboard tile `WORKING NOW 0 · agents running` — reads as "0 agents running". If 17 tasks are open that's fine, but pair it with "7 agents hired" for context.

### 39. Deprecated HTML meta on every page: `<meta name="apple-mobile-web-app-capable" content="yes">`. Replace with `<meta name="mobile-web-app-capable" content="yes">`.

---

## 🔵 Lower priority / polish

### 40. Claire avatar initials "CL" collide with Clive's initials "CL". Both are green. Use first + last initial or colour differently.

### 41. Date pills wrap off‑screen — "16 Apr a" is clipped at the right edge. Needs overflow scroll or truncation.

### 42. Pipeline stage chips on Properties page render even when list is empty. Hide or disable.

### 43. Sales/Rentals tabs on Properties — "Sales" is the default; URL resolves to `/sale` (singular). Tab label plural, URL singular.

### 44. No loading skeletons on route change — page goes blank briefly. Noticeable on slower loads.

### 45. "Skip to Main Content" anchor is present (good a11y!) but the chat message list is not reachable by screen readers — the accessibility snapshot didn't include a single message. Likely missing `role="log"` / `aria-live`.

### 46. Command Palette heading ("Search for a command to run…") stays in the DOM always even when closed — should be conditionally rendered.

### 47. Theme toggle at bottom‑left: `Switch to dark mode` button is a sun icon with no visible label when collapsed — add tooltip.

### 48. `17 Apr at 17:29` pill next to `17 Apr at 11:40` pill — two timestamps on same day without a calendar‑day grouping. Group by date: "Yesterday" / "Today" / "Fri 17 Apr".

---

## How to reproduce the walkthrough

```bash
# dev server (embedded Postgres, Vite dev, port 3002)
cd ~/Aygency\ World && pnpm dev

# browse
open http://localhost:3002/ceo-chat
open http://localhost:3002/JAC/dashboard
open http://localhost:3002/JAC/approvals/pending
open http://localhost:3002/JAC/leads
open http://localhost:3002/JAC/agents/all
open http://localhost:3002/JAC/agents/claire
open http://localhost:3002/JAC/agents/clive
open http://localhost:3002/JAC/agents/saif
open http://localhost:3002/JAC/agents/layla
open http://localhost:3002/JAC/agents/tariq
open http://localhost:3002/JAC/company/settings
```

Screenshots saved in `.playwright-mcp/` as `shot1-ceo-chat.png` … `shot16-ceo-after-send.png`.
Console/network logs: `console-all.log`, `network-api.log`.
