import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime, cn, agentUrl } from "../lib/utils";
import { Tabs } from "@/components/ui/tabs";
import { PageTabBar } from "../components/PageTabBar";
import { Button } from "@/components/ui/button";
import { Bot, Plus, GitBranch, SlidersHorizontal } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";
import { formatDepartment, agentAvatarGradient, agentInitials, isGhostDepartmentManager } from "../lib/team-grouping";

const adapterLabels: Record<string, string> = {
  claude_local: "AI Agent",
  codex_local: "AI Agent",
  gemini_local: "AI Agent",
  opencode_local: "AI Agent",
  cursor: "AI Agent",
  hermes_local: "AI Agent",
  openclaw_gateway: "AI Agent",
  process: "AI Agent",
  http: "AI Agent",
};

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

type FilterTab = "all" | "active" | "paused" | "error";

function matchesFilter(status: string, tab: FilterTab, showTerminated: boolean): boolean {
  if (status === "terminated") return showTerminated;
  if (tab === "all") return true;
  if (tab === "active") return status === "active" || status === "running" || status === "idle";
  if (tab === "paused") return status === "paused";
  if (tab === "error") return status === "error";
  return true;
}

function filterAgents(agents: Agent[], tab: FilterTab, showTerminated: boolean): Agent[] {
  return agents
    .filter((a) => !isGhostDepartmentManager(a))
    .filter((a) => matchesFilter(a.status, tab, showTerminated))
    .sort((a, b) => a.name.localeCompare(b.name));
}


function AgentStatusPill({ status }: { status: string }) {
  const isWorking = status === "running" || status === "active";
  const isPaused = status === "paused" || status === "error";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap shrink-0",
        isWorking
          ? "text-green-600 dark:text-green-400"
          : isPaused
            ? "text-red-500 dark:text-red-400"
            : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isWorking
            ? "bg-green-500"
            : isPaused
              ? "bg-red-500"
              : "bg-muted-foreground/50"
        )}
      />
      {isWorking ? "Working" : isPaused ? (status === "error" ? "Error" : "Paused") : "Idle"}
    </span>
  );
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useSidebar();
  const pathSegment = location.pathname.split("/").pop() ?? "all";
  const tab: FilterTab = (pathSegment === "all" || pathSegment === "active" || pathSegment === "paused" || pathSegment === "error") ? pathSegment : "all";
  const [showTerminated, setShowTerminated] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  // Map agentId -> first live run + live run count
  const liveRunByAgent = useMemo(() => {
    const map = new Map<string, { runId: string; liveCount: number }>();
    for (const r of runs ?? []) {
      if (r.status !== "running" && r.status !== "queued") continue;
      const existing = map.get(r.agentId);
      if (existing) {
        existing.liveCount += 1;
        continue;
      }
      map.set(r.agentId, { runId: r.id, liveCount: 1 });
    }
    return map;
  }, [runs]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Team" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const filtered = filterAgents(agents ?? [], tab, showTerminated);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Team"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/org")}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              Org chart
            </Button>
            <Button size="sm" onClick={openNewAgent}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Hire Agent
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-4">
          {/* Filter tabs + controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={(v) => navigate(`/agents/${v}`)}>
              <PageTabBar
                items={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                  { value: "error", label: "Error" },
                ]}
                value={tab}
                onValueChange={(v) => navigate(`/agents/${v}`)}
              />
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors border border-border/50 rounded-lg",
                    filtersOpen || showTerminated ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Filters
                  {showTerminated && <span className="ml-0.5 px-1 bg-foreground/10 rounded text-[10px]">1</span>}
                </button>
                {filtersOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 border border-border/50 rounded-lg bg-popover shadow-md p-1">
                    <button
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
                      onClick={() => setShowTerminated(!showTerminated)}
                    >
                      <span className={cn(
                        "flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm",
                        showTerminated && "bg-foreground"
                      )}>
                        {showTerminated && <span className="text-background text-[10px] leading-none">&#10003;</span>}
                      </span>
                      Show terminated
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error.message}</p>}

          {agents && agents.length === 0 && (
            <EmptyState
              icon={Bot}
              message="No agents hired yet. Go to CEO Chat and ask the CEO to hire your first team."
              action="Hire Agent"
              onAction={openNewAgent}
            />
          )}

          {/* Agent cards */}
          {filtered.length > 0 && (() => {
            // Build collision set: which naive initials (first two letters of name)
            // are claimed by multiple agents. Each agent on that list needs the
            // differentiated variant.
            const naive = new Map<string, number>();
            for (const a of filtered) {
              const key = agentInitials(a.name).toUpperCase();
              naive.set(key, (naive.get(key) ?? 0) + 1);
            }
            const collisions = new Set<string>();
            for (const [k, v] of naive) {
              if (v > 1) collisions.add(k);
            }
            return (
            <div className="space-y-2">
              {filtered.map((agent) => {
                const gradient = agentAvatarGradient(agent.id || agent.name);
                const initials = agentInitials(agent.name, agent.role, collisions);
                const isWorking = liveRunByAgent.has(agent.id);
                const effectiveStatus = isWorking ? "running" : agent.status;
                const liveInfo = liveRunByAgent.get(agent.id);

                return (
                  <Link
                    key={agent.id}
                    to={agentUrl(agent)}
                    className="block rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-accent/30 transition-colors no-underline text-inherit"
                  >
                    <div className="flex items-start gap-3">
                      {/* Gradient avatar */}
                      <div
                        className="shrink-0 flex items-center justify-center rounded-[9px] text-white text-[11px] font-bold"
                        style={{
                          width: 34,
                          height: 34,
                          background: gradient,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: name, role, model, status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold truncate">{agent.name}</span>
                          <span className="text-[10.5px] text-muted-foreground">
                            {formatDepartment(roleLabels[agent.role] ?? agent.role)}
                          </span>
                          <span className="hidden sm:inline text-[10.5px] text-muted-foreground">
                            {adapterLabels[agent.adapterType] ?? agent.adapterType}
                          </span>
                          <span className="ml-auto">
                            <AgentStatusPill status={effectiveStatus} />
                          </span>
                        </div>

                        {/* Current action */}
                        {isWorking && liveInfo && (
                          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                            Working...
                            {liveInfo.liveCount > 1 ? ` (${liveInfo.liveCount} tasks)` : ""}
                          </p>
                        )}

                        {/* Stats line */}
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {agent.lastHeartbeatAt
                            ? `Last active ${relativeTime(agent.lastHeartbeatAt)}`
                            : "No runs yet"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            );
          })()}

          {agents && agents.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No agents match the selected filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

