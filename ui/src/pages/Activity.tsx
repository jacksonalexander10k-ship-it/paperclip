import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatClockTime } from "../lib/format-time";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "Activity" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const runningAgents = useMemo(() => {
    if (!liveRuns || liveRuns.length === 0) return [];
    const seen = new Set<string>();
    const results: typeof liveRuns = [];
    for (const run of liveRuns) {
      if (!seen.has(run.agentId)) {
        seen.add(run.agentId);
        results.push(run);
      }
    }
    return results;
  }, [liveRuns]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title ?? i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    for (const g of goals ?? []) map.set(`goal:${g.id}`, g.title);
    return map;
  }, [issues, agents, projects, goals]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select a company to view the activity log." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  // Hide low-signal internal events from the user-facing feed.
  // tool_call, direct_response, raw inbound WhatsApp logs are internal plumbing.
  // Show only business-relevant events: messages sent, approvals, leads, hires, deals.
  const NOISY_ACTIONS = new Set([
    "agent.tool_call",
    "tool_call",
    "agent.direct_response",
    "agent.heartbeat_started",
    "agent.heartbeat_completed",
    "whatsapp.received",
    "agent.run_started",
    "agent.run_completed",
    // Read-marker / pageview bookkeeping events — UI signals, not business events.
    "issue.read_marked",
    "comment.read_marked",
    "pageview",
    "view",
  ]);
  const cleaned = data?.filter((e) => {
    const action = String(e.action ?? "").toLowerCase();
    if (NOISY_ACTIONS.has(action)) return false;
    // Any *.read_marked action is noise too, regardless of entity.
    if (/\.read_marked$/.test(action)) return false;
    // Pageview spam — mirror the filter used on the dashboard's recent activity.
    const type = String((e as { type?: string }).type ?? "").toLowerCase();
    const name = String((e as { name?: string }).name ?? "").toLowerCase();
    if (type === "view" || action === "view") return false;
    if (/^(view\.|pageview)/.test(action)) return false;
    if (/^viewed/.test(name)) return false;
    return true;
  });
  const filtered =
    cleaned && filter !== "all"
      ? cleaned.filter((e) => e.entityType === filter)
      : cleaned;

  const entityTypes = data
    ? [...new Set(data.map((e) => e.entityType))].sort()
    : [];

  // Group events by day label
  function getDayLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (eventDay.getTime() === today.getTime()) return "Today";
    if (eventDay.getTime() === yesterday.getTime()) return "Yesterday";
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  }

  const grouped: { label: string; events: typeof filtered }[] = [];
  if (filtered) {
    for (const event of filtered) {
      const label = getDayLabel(typeof event.createdAt === "string" ? event.createdAt : new Date(event.createdAt as unknown as string).toISOString());
      const last = grouped[grouped.length - 1];
      if (last && last.label === label) {
        last.events!.push(event);
      } else {
        grouped.push({ label, events: [event] });
      }
    }
  }

  const runningCount = liveRuns?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Live Activity"
        badge={
          runningCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              {runningCount} running
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Currently Running */}
        {runningAgents.length > 0 && (
          <div>
            <div className="px-1 py-2 text-[10px] font-semibold text-primary/50 uppercase tracking-[0.15em]">
              Currently Running
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden divide-y divide-primary/10">
              {runningAgents.map((run) => (
                <div key={run.id} className="flex items-center gap-3 px-4 py-3">
                  <Identity name={run.agentName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{run.agentName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {run.invocationSource}
                      {run.startedAt && (
                        <> &middot; started {formatClockTime(run.startedAt)}</>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter + Recent Activity */}
        <div className="flex items-center justify-between">
          <div className="px-1 text-[10px] font-semibold text-primary/50 uppercase tracking-[0.15em]">
            Recent Activity
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Filter</label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                {entityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {filtered && filtered.length === 0 && (
          <EmptyState icon={History} message="No activity yet. This log fills up as your agents start working." />
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            <div className="px-1 py-2 text-[10px] font-semibold text-primary/50 uppercase tracking-[0.15em]">
              {group.label}
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 divide-y divide-border/50">
              {group.events!.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  agentMap={agentMap}
                  entityNameMap={entityNameMap}
                  entityTitleMap={entityTitleMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
