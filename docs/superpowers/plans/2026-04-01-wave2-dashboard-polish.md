# Wave 2: Dashboard Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unread badge on CEO Chat, mobile-optimized CEO Chat, batch approve, analytics charts.

**Architecture:** Mostly UI work. One new batch endpoint. One new read-state endpoint. Install recharts for charts. No new tables.

**Tech Stack:** React, TanStack Query, Tailwind, Recharts (new), Radix UI

---

### Task 1: CEO Chat Unread Badge

The `issue_read_states` table and `markRead` service method already exist. We need to:
1. Expose a read-state endpoint
2. Track unread count in sidebar badges
3. Mark as read when CEO Chat is viewed

**Files:**
- Modify: `server/src/routes/sidebar-badges.ts` — add unread CEO chat comment count
- Modify: `server/src/services/issues.ts` — expose a method to get unread count for CEO Chat issue
- Modify: `ui/src/pages/CeoChat.tsx` — call markRead on mount/focus
- Modify: `ui/src/components/Sidebar.tsx` — add badge to CEO Chat nav item
- Modify: `ui/src/components/MobileBottomNav.tsx` — add badge to CEO nav

- [ ] **Step 1: Add unread count to sidebar badges API**

Read `server/src/routes/sidebar-badges.ts` and `server/src/services/issues.ts`. The badges endpoint already returns `inbox`, `approvals`, `failedRuns`. Add a `ceoChatUnread` field.

Logic: Find the CEO Chat issue for the company (title contains "CEO Chat" or has a specific flag). Count comments created after the user's `lastReadAt` in `issue_read_states`. Return the count.

In `server/src/services/issues.ts`, add a method:
```typescript
getUnreadCommentCount: async (companyId: string, issueId: string, userId: string) => {
  // Get lastReadAt from issue_read_states
  // Count comments with createdAt > lastReadAt
  // Return count
}
```

Add an endpoint or modify the sidebar-badges route to include this count. The CEO Chat issue ID needs to be discoverable — either by querying issues with a known title pattern or storing it in company context.

- [ ] **Step 2: Mark as read on CEO Chat page view**

In `ui/src/pages/CeoChat.tsx`, add a `useEffect` that calls a mark-read endpoint when the page mounts and when new comments arrive:

```typescript
// POST /issues/:issueId/read
useEffect(() => {
  if (issueId) {
    issuesApi.markRead(issueId);
  }
}, [issueId, comments.length]);
```

Add this method to the issues API client if it doesn't exist.

- [ ] **Step 3: Add badge to sidebar**

In `ui/src/components/Sidebar.tsx`, fetch the badge count from the sidebar-badges response and add it to the CEO Chat nav item:

```tsx
<SidebarNavItem to="/ceo-chat" label="CEO Chat" icon={MessageSquare} badge={ceoChatUnread} />
```

Same in `MobileBottomNav.tsx`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: unread badge on CEO Chat — sidebar + mobile nav"
```

---

### Task 2: CEO Chat Mobile Optimization

Make CEO Chat work well on phones. Currently no mobile-specific styling.

**Files:**
- Modify: `ui/src/pages/CeoChat.tsx`

- [ ] **Step 1: Read the full CeoChat.tsx file**

Understand the complete layout structure before making changes.

- [ ] **Step 2: Add mobile-responsive styling**

Key changes:
- Message bubbles: `max-w-[75%] md:max-w-[75%] max-w-[88%]` (wider on mobile)
- Input bar: full width on mobile, safe area padding at bottom: `pb-[env(safe-area-inset-bottom)]`
- Quick action pills: horizontal scroll on mobile, wrap on desktop
- Hide PageHeader on mobile (CEO Chat should feel like a native chat app)
- Chat area: `h-[calc(100vh-env(safe-area-inset-bottom)-3.5rem)]` on mobile to account for bottom nav
- Font sizes: keep same (13px is fine on mobile)
- Touch targets: ensure approve/reject buttons are at least 44px tall (already enforced by CSS in index.css)

- [ ] **Step 3: Test responsive breakpoints**

Ensure the layout works at 375px (iPhone SE), 390px (iPhone 14), 428px (iPhone 14 Pro Max).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: mobile-optimized CEO Chat — full-width bubbles, safe area, responsive input"
```

---

### Task 3: Batch Approve

Allow approving multiple pending approvals at once from the Approvals page.

**Files:**
- Modify: `server/src/routes/approvals.ts` — add batch approve endpoint
- Modify: `ui/src/api/approvals.ts` — add batch approve method
- Modify: `ui/src/pages/Approvals.tsx` — add multi-select + "Approve All" button

- [ ] **Step 1: Add batch approve endpoint**

In `server/src/routes/approvals.ts`, add:

```typescript
// POST /companies/:companyId/approvals/batch-approve
router.post("/companies/:companyId/approvals/batch-approve", async (req, res) => {
  const { companyId } = req.params;
  assertCompanyAccess(req, companyId);

  const { ids } = req.body; // string[]
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array required" });
    return;
  }

  const results = [];
  for (const id of ids) {
    try {
      const result = await approvalsSvc.approve(id, actorInfo);
      results.push({ id, status: "approved", applied: result.applied });
    } catch (err) {
      results.push({ id, status: "error", error: err.message });
    }
  }

  res.json({ results });
});
```

Sequential loop (not parallel) to avoid race conditions with the executor.

- [ ] **Step 2: Add batch approve to API client**

In `ui/src/api/approvals.ts`:
```typescript
batchApprove: (companyId: string, ids: string[]) =>
  api.post(`/companies/${companyId}/approvals/batch-approve`, { ids }),
```

- [ ] **Step 3: Add multi-select UI to Approvals page**

In `ui/src/pages/Approvals.tsx`:
- Add `selectedIds` state (Set<string>)
- Add checkbox on each pending approval card
- Add "Select All" / "Deselect All" toggle in the header
- Add "Approve Selected (N)" button that calls batchApprove
- After batch approve: invalidate approvals query, clear selection
- Show a small toast/banner with results: "5 approved, 1 failed"

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: batch approve — multi-select + approve all from Approvals page"
```

---

### Task 4: Analytics Charts

Install recharts and add trend charts to the Dashboard or a dedicated Analytics page.

**Files:**
- Modify: `ui/package.json` — add recharts
- Create: `ui/src/components/AnalyticsCharts.tsx` — chart components
- Modify: `ui/src/pages/Dashboard.tsx` or `ui/src/pages/Costs.tsx` — embed charts

- [ ] **Step 1: Install recharts**

```bash
cd "/Users/alexanderjackson/Aygency World"
pnpm add recharts --filter ui
```

- [ ] **Step 2: Create chart components**

Create `ui/src/components/AnalyticsCharts.tsx` with these charts:

**DailyCostChart** — Area chart showing daily spend over last 30 days
- X-axis: dates
- Y-axis: AED
- Fill: primary color with 10% opacity
- Line: primary color
- Tooltip: date + exact cost

**DailyRunsChart** — Bar chart showing daily runs (stacked: succeeded + failed)
- X-axis: dates
- Y-axis: run count
- Green bars: succeeded
- Red bars: failed
- Tooltip: date + counts

**AgentCostBreakdown** — Horizontal bar chart showing cost per agent
- Y-axis: agent names
- X-axis: cost in AED
- Bars colored with the agent gradient colors

All charts should:
- Use the app's CSS variables for colors (read from index.css)
- Be responsive (ResponsiveContainer from recharts)
- Match the dark theme (axis labels use muted-foreground color)
- Have card wrapper: `rounded-xl border border-border/50 bg-card/80 p-4`

- [ ] **Step 3: Fetch analytics data**

Create `ui/src/api/analytics.ts` (if it doesn't exist) or read the existing one. The endpoint is:
`GET /companies/:companyId/analytics?start=ISO&end=ISO`

Returns `{ trends: { dailyCosts, dailyRuns }, agents, totals }`.

- [ ] **Step 4: Embed charts in Dashboard**

Read `ui/src/pages/Dashboard.tsx`. Add the charts below the existing metric cards. The dashboard already has a layout — add charts as a new section.

Two charts side-by-side on desktop (grid-cols-2), stacked on mobile.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: analytics charts — daily cost trend, runs chart, agent cost breakdown"
```
