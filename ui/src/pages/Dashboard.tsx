import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { analyticsApi } from "../api/analytics";
import { DailyCostChart, DailyRunsChart } from "../components/AnalyticsCharts";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { AgentStatusCard } from "../components/AgentStatusCard";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { Bot, CircleDot, ShieldCheck, LayoutDashboard, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent, Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding, openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: billingStatus } = useQuery({
    queryKey: ["billing-status", selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}/billing/status`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
  });

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const { data: analytics } = useQuery({
    queryKey: queryKeys.analytics(selectedCompanyId!, thirtyDaysAgo),
    queryFn: () => analyticsApi.summary(selectedCompanyId!, thirtyDaysAgo),
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const recentActivity = useMemo(() => (activity ?? []).slice(0, 8), [activity]);

  const runByAgentId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof liveRuns>[number]>();
    for (const run of liveRuns ?? []) {
      if (run.agentId) map.set(run.agentId, run);
    }
    return map;
  }, [liveRuns]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const i of issues ?? []) map.set(i.id, i);
    return map;
  }, [issues]);

  const pendingApprovalsByAgentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of approvals ?? []) {
      if ((a.status === "pending" || a.status === "revision_requested") && a.requestedByAgentId) {
        map.set(a.requestedByAgentId, (map.get(a.requestedByAgentId) ?? 0) + 1);
      }
    }
    return map;
  }, [approvals]);

  // Activity animation logic
  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter(
        (t) => t !== timer,
      );
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title ?? i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    return map;
  }, [issues, agents]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Aygency World. Set up your agency and hire your first agents to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const pendingApprovalCount =
    (data?.pendingApprovals ?? 0) + (data?.budgets?.pendingApprovals ?? 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-transparent text-muted-foreground border border-border/60 hover:border-border cursor-pointer"
            >
              ⌘K
            </button>
            <Button size="sm" className="text-[11.5px] h-7" onClick={() => openNewIssue()}>
              + New Task
            </Button>
          </>
        }
      />

      {/* .cbody — exact from C design: padding:16px 18px, gap:13px */}
      <div className="flex-1 overflow-y-auto p-[16px_18px] flex flex-col gap-[13px]">
        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {billingStatus && !billingStatus.active && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Your subscription has expired</p>
            <p className="text-xs text-muted-foreground mt-1">Agents are paused. Subscribe to resume operations.</p>
            <button
              className="mt-2 text-xs font-medium text-primary hover:underline"
              onClick={() => window.location.href = "/billing/checkout"}
            >
              Reactivate →
            </button>
          </div>
        )}

        {hasNoAgents && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-950/30 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Bot className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-100">
                You have no agents yet. Hire your first team to get started.
              </p>
            </div>
            <button
              onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
              className="text-sm font-medium text-amber-300 hover:text-amber-100 underline underline-offset-2 shrink-0"
            >
              Hire agents
            </button>
          </div>
        )}

        {data && (
          <>
            {data.budgets.activeIncidents > 0 && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-200">
                      {data.budgets.activeIncidents} active budget incident
                      {data.budgets.activeIncidents === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-red-300/70">
                      {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects
                      paused · {data.budgets.pendingApprovals} pending budget approvals
                    </p>
                  </div>
                </div>
                <Link to="/costs" className="text-sm underline underline-offset-2 text-red-200">
                  Open budgets
                </Link>
              </div>
            )}

            {/* .m3 — 3 metric cards */}
            <div className="grid grid-cols-3 gap-[10px]">
              <MetricCard
                icon={Bot}
                value={data.agents.running}
                label="Working Now"
                valueColor="green"
                to="/agents"
                description={<span>agents running</span>}
              />
              <MetricCard
                icon={ShieldCheck}
                value={pendingApprovalCount}
                label="Needs Approval"
                valueColor="amber"
                to="/approvals/pending"
                description={<span>awaiting your OK</span>}
              />
              <MetricCard
                icon={CircleDot}
                value={data.tasks.open}
                label="Open Tasks"
                to="/issues"
                description={
                  <span>
                    {data.tasks.inProgress} in progress
                    {data.tasks.blocked > 0 ? `, ${data.tasks.blocked} blocked` : ""}
                  </span>
                }
              />
            </div>

            {/* Your Team — .sec header + .ag2 grid */}
            {(agents ?? []).length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-[9px]">
                  Your Team
                </h3>
                <div className="grid grid-cols-2 gap-[8px]">
                  {(agents ?? []).filter((a: Agent) => a.status !== "terminated").map((agent: Agent, index: number) => {
                    const run = runByAgentId.get(agent.id);
                    const currentAction = run?.issueId
                      ? (issueById.get(run.issueId)?.title ?? null)
                      : null;
                    return (
                      <AgentStatusCard
                        key={agent.id}
                        agent={agent}
                        index={index}
                        isRunning={runByAgentId.has(agent.id)}
                        pendingApprovals={pendingApprovalsByAgentId.get(agent.id) ?? 0}
                        currentAction={currentAction}
                        lastActionAt={run?.startedAt ?? null}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <PluginSlotOutlet
              slotTypes={["dashboardWidget"]}
              context={{ companyId: selectedCompanyId }}
              className="grid gap-4 md:grid-cols-2"
              itemClassName="rounded-lg border bg-card p-4 shadow-sm"
            />

            {/* What Just Happened — .sec header + activity rows */}
            {recentActivity.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-[9px]">
                  What Just Happened
                </h3>
                <div className="flex flex-col gap-px">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
                <div className="pt-2">
                  <Link
                    to="/activity"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View full log →
                  </Link>
                </div>
              </div>
            )}

            {/* Trends — daily cost + runs charts */}
            {analytics && (
              <div>
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-[9px]">
                  Trends
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DailyCostChart data={analytics.trends.dailyCosts ?? []} />
                  <DailyRunsChart data={analytics.trends.dailyRuns ?? []} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
