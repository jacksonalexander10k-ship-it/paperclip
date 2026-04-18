# Bugs & inconsistencies — second walkthrough

Date: 2026-04-18
Tester: Claude (Playwright MCP, 1440×900 + 375×812 mobile)
State: after the 48-bug batch (commits `8a72571a → 25949614`)
Screenshots: `.playwright-mcp/v2-*.png`

---

## 🟢 Sanity — the prior fixes that verifiably landed

- **#4** "create task…" spinner gone on every past message (CeoChat `v2-07`)
- **#5** CEO refused to invent a lead: "I don't see a lead named John in our records — do you want me to create it? Drop his phone number and I'll queue Claire to reach out immediately." (`v2-08`) — the truth-rules prompt is doing its job
- **#13+14** Leads page — JOHN's bad email no longer rendered, score shows "—" not "★ 0" (`v2-05`)
- **#15** Stage chip row shows all 7 canonical stages with counts (`v2-05`)
- **#21+46** CEO Chat date pills grouped (TODAY / YESTERDAY / 16 APR) and only one is active (`v2-07`)
- **#22** Auto-reply rules default OFF (confirmed in code)
- **#23+24** Settings → Description is blank, Team summary is read-only, brand colour labelled "Default" with helper (`v2-15`)
- **#28+29** Nav says "Inbox" / "Team", page titles match (`v2-03`, `v2-09`)
- **#32** Sidebar section renamed "Workspace"
- **#33** Agent detail header reads "Assign task" (`v2-09`, `v2-21`)
- **#38** Avatar colours differ per agent (Claire blue vs Clive green vs Layla tan etc.) (`v2-06`)
- **#40** Properties stage chip row gone in empty state (`v2-12`)
- **#1** WebSocket: browser console reports 0 warnings, server confirms `handleUpgrade complete`
- **#12** Ghost "Sales/Operations/Marketing Manager" agents no longer appear in the /agents list

---

## 🔴 New / still-broken — critical

### B1. `/activity` page is drowned in pageview spam
File: [ui/src/pages/Activity.tsx](ui/src/pages/Activity.tsx)
`v2-02` — every row is `You viewed CEO Chat — 18 Apr at 12:54`. 20+ of them. My earlier fix only filtered the Dashboard's "Recent Activity" slice — the dedicated `/activity` page uses a different component and still shows all raw view events.
Fix: apply the same `type/action/name !== 'view…'` filter in the Activity page.

### B2. Dashboard "Recent Activity" STILL shows `You viewed CEO Chat` spam
File: [ui/src/pages/Dashboard.tsx](ui/src/pages/Dashboard.tsx)
My earlier filter didn't catch the actual event shape for these rows. 8× in a row visible on `v2-01`.
Fix: inspect the live event (look for `name: "viewed"`, `action: "view.chat"`, `category: "view"`) and broaden the filter. Confirmed the filter is NOT working today.

### B3. Leads: row is not clickable — no lead detail page
File: [ui/src/pages/Leads.tsx](ui/src/pages/Leads.tsx) (the `LeadRow` render)
Clicking anywhere on the JOHN row does nothing. There's no `/leads/:id` route either. That's a huge UX hole — you can't view a lead's WhatsApp thread, timeline, score history, notes, or edit the fields.
Fix: wrap the row (or at least the name cell) in a `<Link to={/JAC/leads/${lead.id}}>` and create a `LeadDetail` page (similar shape to `AgentDetail`).

### B4. `/JAC/properties/new` route clicks but renders the empty list view
File: [ui/src/App.tsx](ui/src/App.tsx) + [ui/src/pages/Properties.tsx](ui/src/pages/Properties.tsx)
Click "+ Add Property" → URL becomes `/JAC/properties/new` → page still shows "No sale properties yet" empty state. No modal, no form, no navigation. You can't actually add a property from the UI (`v2-13`).
Fix: add a `Route path="properties/new" element={<NewProperty />}` and build the `NewProperty` form page (or open a modal without changing URL). The existing Properties page doesn't even read the URL for a "new" mode.

### B5. Inbox "All" tab does nothing
File: [ui/src/pages/Approvals.tsx](ui/src/pages/Approvals.tsx)
Click "All" while on `/approvals/pending` → URL doesn't change, same empty state renders (`v2-04`). The tab isn't wired to navigate or toggle a filter.
Fix: make the "All" tab navigate to `/approvals/all` or toggle `showHistory` state.

### B6. Claire's sidebar/detail avatar still shows "CL" — collides with Clive
File: [ui/src/pages/AgentDetail.tsx](ui/src/pages/AgentDetail.tsx) (header) + sidebar
`v2-09` header: Claire "CL"; `v2-08` sidebar: Clive "CL", Claire "CL". The collision-aware-initials change went into `team-grouping.ts` but the header avatar at `AgentDetail` still uses the plain algorithm (just first two letters of the name), and so does the sidebar badge. Only the `Agents` list (`v2-06`) picked up the new initials ("CS"/"CC"), not the sidebar/detail.
Fix: apply `agentInitials(name, role, collisionKeys)` in [ui/src/components/Sidebar.tsx](ui/src/components/Sidebar.tsx) agent list and the `AgentDetail` header. Build collisionKeys from the agent roster.

### B7. Agent page title says `Dashboard · <Name> · …` regardless of which tab
Files: [ui/src/pages/AgentDetail.tsx](ui/src/pages/AgentDetail.tsx) tab URL handler
Observed on `/agents/clive/schedule` → title "Dashboard · Clive · Agents · Aygency World" (`v2-21`). Same for `/saif/training` and `/claire/whatsapp`. The first segment is always "Dashboard" even when on Schedule/Training/Messages tabs.
Fix: derive the title prefix from the current tab (Home → Dashboard, Training → Training, etc.), not hardcoded.

### B8. Command Palette (⌘K) is missing most pages
File: [ui/src/components/CommandPalette.tsx](ui/src/components/CommandPalette.tsx)
`v2-17`: shows only "Create new task / Create new agent / Create new project" under Actions and "Dashboard / Tasks" under Pages. Missing CEO Chat, Inbox, Leads, Properties, Team, Knowledge Base, Settings, Activity, Comms, Costs, and every individual agent.
Also: **"Create new project"** action — Aygency has no project concept; this is legacy Paperclip copy leaking. "Search issues, agents, projects…" placeholder — same.
Fix: populate pages list from the actual sidebar nav; drop `project`/`issues` language; add each agent as a quick-jump item.

### B9. Mobile viewport has MORE content than desktop (Dashboard)
File: [ui/src/pages/Dashboard.tsx](ui/src/pages/Dashboard.tsx)
On 375×812, the dashboard shows TRENDS (Daily Cost 14-day chart, Agent Runs 14-day chart) and PERFORMANCE (Completion Rate / Run Success Rate 91% / Cost per task / Avg Runs per day). None of these appear on the 1440 desktop view (`v2-19` vs `v2-01`). Either they're hidden on desktop (bug) or only rendered on mobile (also bug — desktop should see at least the same content).
Fix: verify the conditional render. If it's intentional, desktop needs an equivalent dashboard section; if not, remove the hide-on-desktop logic.

### B10. Dashboard "Open Tasks 17 / 0 in progress" vs mobile Dashboard "33 tasks done"
`v2-01` shows `OPEN TASKS 17 / 0 in progress`. `v2-19` mobile shows `COMPLETION RATE 0 / 0 of 33 tasks done`. Where does 33 come from? Desktop says 17 open total. Mobile says 33 total. These numbers don't line up. One of them is counting differently (probably mobile counts closed + open, desktop counts only open).
Fix: unify the denominator.

### B11. Mobile bottom nav is missing Inbox, Leads, Properties, KB, Settings
File: [ui/src/components/MobileBottomNav.tsx](ui/src/components/MobileBottomNav.tsx)
Only 4 items: Home / CEO / Tasks / Team (`v2-19`). A broker on mobile can't reach Inbox (where approvals live!), Leads, Properties, KB, or Settings without… what, a hidden menu? None of those is in the bottom bar. Serious mobile UX gap.
Fix: either (a) add "More" overflow menu on mobile that exposes all sidebar items, or (b) rework bottom nav to the 4 most-used (Inbox has to be one).

### B12. Settings "Team summary" includes the ghost Manager agents we hid everywhere else
File: [ui/src/pages/CompanySettings.tsx](ui/src/pages/CompanySettings.tsx)
`v2-15`: Team summary reads `CEO + 7 agents — Sales Manager (general), Operations Manager (general), Tariq (operations), Claire (sales), Marketing Manager (general), Saif (content), Layla (operations)`.
But the Team page (`v2-06`) shows only 5 agents (5 real + CEO = 6). The ghost Manager agents were filtered from the UI list but re-appear in this summary. Inconsistent.
Fix: run the same `isGhostDepartmentManager` filter when computing the Team summary. The count would become "CEO + 4 agents".

---

## 🟠 New issues — behavioural / data

### B13. Claire is still `Last run 10h ago` despite freshly-issued CEO tasks
Server logs show the CEO handler is now calling `heartbeat.wakeup(assignee)` on every new task (the #2/3/6 fix), but Claire's "Last run" timestamp on her detail page isn't updating. Two possibilities:
- (a) `wakeup()` succeeds but something else (billing check, heartbeat policy disabled, sales-agent policy mismatch) blocks the actual run from starting.
- (b) `wakeup()` returns a skipped/deduplicated record without starting a run.
Needs a run-log drill-down: click "Show all 17" on Claire's queue → see which tasks have associated heartbeat runs, which don't.

### B14. Claire's existing queue of 17 still contains the 2-day-old dupes
The #3 dedup prevents NEW dupes from being created, but the queue was already polluted. No cleanup job runs those down.
Fix: ship a one-shot migration/CLI command `pnpm db:dedup-open-tasks` that merges existing exact-title duplicates within the same assignee.

### B15. CEO message on `v2-07` still says "She is also queued to redraft a message to **Alex** following your exact template correction"
That's a persisted message from before the truth-rules prompt landed. The hallucination is frozen in the chat history. No action needed in code, but worth noting we should mark pre-fix messages with an info pill ("older CEO messages may reference leads that no longer exist") or just delete the test data.

### B16. Claire "Last run 10h ago" but her last known action preview is "Hi John, my WhatsApp didn't quit..." at 12:59 (the Messages tab, `v2-10`)
Two sources of truth for "last activity" — heartbeat runs table vs WhatsApp messages table. They disagree. The "Last run" header should probably read `Last active`, derived from MAX(heartbeat.finishedAt, whatsapp.sentAt).

### B17. Auto-reply mode is ON by default on Claire's agent page
`v2-09` — toggle shows green/enabled with copy "Outbound messages send automatically without approval." My #22 fix changed the default for newly-created RULES to disabled, but this is a different toggle: the agent-level master `autoReplyMode` flag. Still defaults ON, contradicting "Approval before external action" (CLAUDE.md).
Fix: default `autoReplyMode` to `false` for new agents too. Existing agents keep their current value.

### B18. Agent Home page "Last run 10h ago" vs header "Last run 10h ago" vs body `17 queued · 0 done this week`
`v2-09` — Clive showed `1 active — CEO Chat — In Progress 3d ago` when I tested earlier, and nobody reconciled it. The earlier dead-man-switch fix (#11) was read-time only (add stale subtitle); the actual state isn't being written back to `in_progress → failed`. Stale runs linger forever.
Fix: run a startup+interval sweeper that updates `status = 'failed'` where `heartbeat_runs.status='in_progress' AND updatedAt < now() - interval '15 minutes'`.

### B19. Working hours default is `midnight to midnight`
`v2-21` — Clive's Schedule tab. Dropdown says "midnight" → "midnight" with no indication whether that means "always-on" or "zero-hour window". The UI isn't explicit.
Fix: render "Always on (24 h)" when start === end, and add a clearer help text.

### B20. Dashboard "Working Now 0 / of 8 agents idle"
`v2-01` — but the Team page lists only 5 agents (ghost managers hidden). "of 8 agents" again includes ghosts. Same inconsistency as B12.
Fix: Working Now denominator should count only non-ghost agents.

---

## 🟡 UX / copy — smaller but real

### B21. "Agency" card heading in Settings (`v2-15`)
Settings page first card still titled "Agency". My earlier sidebar rename made "Workspace" the top-level section — the card heading should match ("Workspace" or just remove the heading — it's the first card and context is obvious).

### B22. CEO Chat empty state suggestions are stale from a demo
`v2-07`/`v2-08` chip suggestions: "Show me the hottest leads", "What should I focus on today?", "Draft a follow-up message" + the quick-action pills: "Brief me", "What's pending?", "Pause all agents", "Show budget", "Find leads". These are identical every session — no personalisation. Also "Show budget" when the agency has $0.00 spend is pointless.
Fix: hide irrelevant suggestions (e.g. hide "Show budget" when spend === 0), and rotate / personalise based on recent activity.

### B23. Messages preview truncation breaks mid-word
`v2-10`: "Hi John, my WhatsApp didn't quit…" — ellipsis after "quit" suggests the preview cuts mid-sentence. Preview truncation should respect word boundaries or use `text-overflow: ellipsis` + single line.

### B24. Chat JOHN avatar is a generic silhouette image
`v2-10` — both chats show the same grey silhouette. Should be initials or the lead's WhatsApp profile photo if available.

### B25. WhatsApp inbox uses `/whatsapp` in the URL but the tab label says "Messages"
`v2-10` — tab renders as "Messages", URL is `/agents/claire/whatsapp`. Internally inconsistent.
Fix: rename the URL to `/messages` (and keep a redirect from `/whatsapp`).

### B26. Command palette placeholder "Search issues, agents, projects…"
`v2-17` — mentions "issues" and "projects" which don't exist in the Aygency user model. Should be "Search tasks, agents, leads…" or similar.

### B27. Keyboard focus never visible on tabs
Throughout: agent tabs, date pills, sidebar items — no visible focus ring when tabbing. Accessibility regression.
Fix: add `focus-visible` styles to all interactive controls.

### B28. "YOUR TEAM" dashboard section header vs "Team" sidebar label
`v2-01` — section header still reads "YOUR TEAM" (caps). Earlier I renamed the sidebar item to "Team" — dashboard didn't follow.

### B29. Recent Activity cards look visually identical to pageviews — no hierarchy
Even once the pageview spam is filtered, tool calls / WhatsApp messages / comments all render as a single-line text row. A little iconography + colour per event type would scan better.

### B30. No back button on agent detail
`v2-09` — header has Pause / Assign task / ⋯ but no back-to-Team button. Rely on sidebar or browser back. Minor, but a visible "← Team" would help.

### B31. Properties filter button has no attached filter UI
`v2-12` — "Filter" button in header. Clicking it (not tested in this pass) needs verification; if it opens a panel, fine; if nothing happens, bug.

### B32. Settings "Require your approval before hiring new agents" toggle sits outside the Agency card
`v2-15` — the toggle appears below "Save changes" and connections appear next. Visual grouping is off — it looks orphaned.

### B33. KB page says "drag and drop files here" but has no dashed drop-zone outline
`v2-14` — the drop target is implicit (presumably the whole content area). Users don't know where to drop.
Fix: render a bordered drop zone.

### B34. Agent detail shows "Active 0" next to a green dot
`v2-09` — green dot + "ACTIVE 0". Green suggests running, but value is zero. Colour semantically wrong when count === 0.
Fix: grey dot when 0 active, green when ≥ 1.

### B35. No sticky dashboard header
Scrolling the dashboard loses the "Dashboard" heading + ⌘K + New Task controls. Minor; the persistent sidebar already serves this, but a sticky mobile top bar is missing.

### B36. `Connected` badge in Claire's Messages header never explains what
`v2-10` — green dot + "Connected". Connected to whom/what? WhatsApp? The agent? Tooltip needed.

### B37. Clive's `Last run 2d ago` on the agent header vs "1 active — In Progress" earlier
Earlier walkthrough (bug 11) showed `1 active — CEO Chat — In Progress (3d ago)` on Clive. Now after my fixes the agent shows "Last run 2d ago" in the header but I can't confirm the Active block cleared (#11 was read-time only). Until the dead-man switch actually writes `failed`, these will continue to diverge.

---

## 🔵 Lower priority / future

### B38. Command palette doesn't close on outside click (needs verification)
### B39. No tooltip on "AW" initials in the very top-left company switcher
### B40. No visible "Hire Agent" entry point from Team empty state (though Hire Agent button is top-right)
### B41. Dashboard tile click doesn't navigate ("OPEN TASKS 17" should link to /tasks or similar)
### B42. No breadcrumbs on most pages — only the agent detail has one
### B43. `17m ago`, `14m ago`, `17m ago`, `45m ago` in Recent Activity are not grouped by time (e.g. "Earlier today", "Yesterday")
### B44. Profile menu (bottom-left "AJ" avatar) not tested — may lack logout / switch company
### B45. Agent "Skills" toggles don't give any confirmation feedback when toggled
### B46. "Save changes" button on Settings doesn't visually disable when form is clean
### B47. No character count on Settings → Description textarea

---

## Summary

Prior batch (48/48) holds up visually on most surfaces. The spots that regressed or were never fully closed:

1. **Pageview spam is still visible** on both the Dashboard "Recent Activity" and on the dedicated `/activity` page — filter shape is wrong.
2. **Leads aren't clickable** — no lead detail page exists.
3. **Add Property doesn't work** — form page missing.
4. **Inbox "All" tab is dead.**
5. **Mobile bottom nav is incomplete** — Inbox/Leads/Properties/KB/Settings unreachable.
6. **Agent tab title + Messages/URL mismatch.**
7. **Sidebar + agent-detail avatars still use the colliding initials.**
8. **Command palette lists only a fraction of pages + leaks Paperclip vocab.**
9. **Claire's heartbeat still says last run 10h ago** — the wakeup fix may be no-opping for her role/policy; needs a drill-down.
10. **Team summary still counts ghost Managers** → desktop dashboard "of 8 agents" conflicts with mobile "of 5 agents".

Everything above is fixable. The big ones (B3 leads detail, B4 add-property form, B8 command palette, B11 mobile nav) are mostly missing surfaces rather than broken surfaces — they need to be BUILT, not debugged.
