import { useMemo } from "react";
import { Link } from "@/lib/router";
import { AgentIcon } from "./AgentIconPicker";
import { cn, agentUrl } from "../lib/utils";
import type { Agent, Issue } from "@paperclipai/shared";

interface LiveRun {
  id: string;
  agentId: string;
  agentName: string;
  issueId?: string | null;
  status: string;
}

interface AgentStatusCardsProps {
  agents: Agent[];
  issues: Issue[];
  liveRuns: LiveRun[];
}

type AgentState = "working" | "idle" | "paused";

const DEPT_ACCENT: Record<string, string> = {
  sales: "#16a34a",
  marketing: "#7c3aed",
  operations: "#d97706",
  intelligence: "#0891b2",
};

const DEPT_ORDER = ["sales", "marketing", "operations", "intelligence"];

function detectDeptKeyFromManager(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sales")) return "sales";
  if (n.includes("marketing")) return "marketing";
  if (n.includes("intel")) return "intelligence";
  return "operations";
}

function getAgentState(agent: Agent, liveRuns: LiveRun[]): AgentState {
  if (agent.status === "paused") return "paused";
  const hasLiveRun = liveRuns.some((r) => r.agentId === agent.id && r.status === "running");
  if (hasLiveRun) return "working";
  return "idle";
}

interface DeptGroup {
  key: string;
  label: string;
  accent: string;
  agents: Agent[];
}

export function AgentStatusCards({ agents, issues, liveRuns }: AgentStatusCardsProps) {
  const queueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      if (
        issue.assigneeAgentId &&
        (issue.status === "backlog" || issue.status === "todo" || issue.status === "blocked")
      ) {
        counts[issue.assigneeAgentId] = (counts[issue.assigneeAgentId] ?? 0) + 1;
      }
    }
    return counts;
  }, [issues]);

  const activeTaskTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const issue of issues) {
      if (
        issue.assigneeAgentId &&
        (issue.status === "in_progress" || issue.status === "in_review")
      ) {
        if (!titles[issue.assigneeAgentId]) {
          titles[issue.assigneeAgentId] = issue.title;
        }
      }
    }
    return titles;
  }, [issues]);

  const { departments, ungrouped } = useMemo(() => {
    const visible = agents.filter((a) => a.status !== "terminated" && a.role !== "ceo");

    // Find department managers
    const managers = visible.filter(
      (a) => (a.metadata as Record<string, unknown> | null)?.isDepartmentManager,
    );

    if (managers.length === 0) {
      return { departments: [] as DeptGroup[], ungrouped: visible };
    }

    const managerIds = new Set(managers.map((m) => m.id));
    const groups: DeptGroup[] = [];
    const grouped = new Set<string>();

    for (const manager of managers) {
      const deptKey = detectDeptKeyFromManager(manager.name);
      const workers = visible.filter(
        (a) => a.reportsTo === manager.id && !managerIds.has(a.id),
      );
      if (workers.length > 0) {
        groups.push({
          key: deptKey,
          label: deptKey.charAt(0).toUpperCase() + deptKey.slice(1),
          accent: DEPT_ACCENT[deptKey] ?? "#94a3b8",
          agents: workers,
        });
        for (const w of workers) grouped.add(w.id);
      }
      grouped.add(manager.id);
    }

    // Sort departments by canonical order
    groups.sort((a, b) => DEPT_ORDER.indexOf(a.key) - DEPT_ORDER.indexOf(b.key));

    const remaining = visible.filter((a) => !grouped.has(a.id));
    return { departments: groups, ungrouped: remaining };
  }, [agents]);

  if (departments.length === 0 && ungrouped.length === 0) return null;

  const renderCard = (agent: Agent) => {
    const state = getAgentState(agent, liveRuns);
    const queue = queueCounts[agent.id] ?? 0;
    const activeTask = activeTaskTitles[agent.id];

    return (
      <Link
        key={agent.id}
        to={agentUrl(agent)}
        className="flex min-w-[150px] max-w-[180px] shrink-0 flex-col gap-1.5 rounded-xl border border-border/50 bg-card/80 p-3 text-sm no-underline text-inherit transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-2">
          {state === "working" ? (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                state === "paused" ? "bg-red-400" : "bg-zinc-400",
              )}
            />
          )}
          <AgentIcon icon={agent.icon} className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate font-medium text-xs">{agent.name}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {state === "working" && activeTask ? activeTask : state === "paused" ? "Paused" : "Idle"}
        </div>
        <div className="text-[11px] text-muted-foreground/60">Queue: {queue}</div>
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      {departments.map((dept) => (
        <div key={dept.key}>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: dept.accent }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {dept.label}
            </span>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {dept.agents.length}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dept.agents.map(renderCard)}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div>
          {departments.length > 0 && (
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-zinc-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Other
              </span>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ungrouped.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
