import { useMemo, useState, useCallback } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { cn, agentRouteRef, agentUrl } from "../lib/utils";
import { useAgentOrder } from "../hooks/useAgentOrder";
import { BudgetSidebarMarker } from "./BudgetSidebarMarker";
import { agentInitials, isGhostDepartmentManager } from "../lib/team-grouping";
import type { Agent } from "@paperclipai/shared";

// Department colors matching org chart. Avatars in the sidebar use these
// so the visual identity is department-driven (not per-agent random).
const DEPT_ACCENT: Record<string, string> = {
  leadership: "#047857",
  sales:      "#16a34a",
  marketing:  "#7c3aed",
  operations: "#d97706",
  intelligence: "#d97706", // folded into operations
};

// Role → department key (mirrors team-grouping.ts)
const ROLE_TO_DEPT: Record<string, string> = {
  ceo: "leadership",
  sales: "sales",
  calling: "sales",
  viewing: "sales",
  content: "marketing",
  marketing: "marketing",
  intelligence: "operations",
  operations: "operations",
  manager: "operations",
  conveyancing: "operations",
};

function agentGradientFor(role: string | null | undefined): string {
  const dept = ROLE_TO_DEPT[String(role ?? "general")] ?? "other";
  const accent = DEPT_ACCENT[dept] ?? "#64748b";
  // Simple gradient — darker version of the accent for depth
  return `linear-gradient(135deg, ${accent}, ${accent}cc)`;
}

function detectDeptKeyFromManager(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sales")) return "sales";
  if (n.includes("marketing")) return "marketing";
  if (n.includes("intel")) return "intelligence";
  return "operations";
}

const COLLAPSED_STORAGE_KEY = "paperclip.sidebarDeptCollapsed";

function readCollapsedState(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function writeCollapsedState(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Ignore
  }
}

interface DeptGroup {
  key: string;
  label: string;
  accent: string;
  agents: Agent[];
}

export function SidebarAgents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const liveCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of liveRuns ?? []) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return counts;
  }, [liveRuns]);

  const visibleAgents = useMemo(() => {
    return (agents ?? []).filter(
      (a: Agent) => a.status !== "terminated" && !isGhostDepartmentManager(a),
    );
  }, [agents]);

  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { orderedAgents } = useAgentOrder({
    agents: visibleAgents,
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  // Build department groups
  const { ceo, departments, ungrouped } = useMemo(() => {
    const ceoAgent = orderedAgents.find((a) => a.role === "ceo") ?? null;

    // Find department managers
    const managers = orderedAgents.filter(
      (a) => (a.metadata as Record<string, unknown>)?.isDepartmentManager,
    );

    if (managers.length === 0) {
      // No departments — flat list (minus CEO)
      return {
        ceo: ceoAgent,
        departments: [] as DeptGroup[],
        ungrouped: orderedAgents.filter((a) => a.role !== "ceo"),
      };
    }

    // Group workers by their manager
    const managerIds = new Set(managers.map((m) => m.id));
    const groups: DeptGroup[] = [];
    const grouped = new Set<string>();

    for (const manager of managers) {
      const deptKey = detectDeptKeyFromManager(manager.name);
      const workers = orderedAgents.filter(
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
      grouped.add(manager.id); // hide the manager itself
    }

    // Any remaining agents not in a group (excluding CEO and managers)
    const remaining = orderedAgents.filter(
      (a) => a.role !== "ceo" && !grouped.has(a.id),
    );

    return { ceo: ceoAgent, departments: groups, ungrouped: remaining };
  }, [orderedAgents]);

  // Collapsed state
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsedState);

  const toggleDept = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeCollapsedState(next);
      return next;
    });
  }, []);

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)(?:\/([^/]+))?/);
  const activeAgentId = agentMatch?.[1] ?? null;
  const activeTab = agentMatch?.[2] ?? null;

  // Build the full visible set for collision-key derivation — every agent
  // rendered in the sidebar contributes so Claire vs Clive get distinct initials.
  const sidebarAgents = useMemo<Agent[]>(() => {
    const list: Agent[] = [];
    if (ceo) list.push(ceo);
    for (const dept of departments) list.push(...dept.agents);
    list.push(...ungrouped);
    return list;
  }, [ceo, departments, ungrouped]);

  // Shared agent row renderer
  const renderAgent = (agent: Agent, _index: number) => {
    const runCount = liveCountByAgent.get(agent.id) ?? 0;
    const gradient = agentGradientFor(agent.role);
    // Initials from OTHER agents in scope — the helper de-collides when possible.
    const collisionKeys = new Set<string>();
    for (const other of sidebarAgents) {
      if (other.id === agent.id) continue;
      collisionKeys.add(agentInitials(other.name));
    }
    const initials = agentInitials(agent.name, agent.role, collisionKeys);
    return (
      <NavLink
        key={agent.id}
        to={activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent)}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        className={cn(
          "flex items-center gap-2 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors ml-1",
          activeAgentId === agentRouteRef(agent)
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground",
        )}
      >
        {/* Status dot */}
        {runCount > 0 ? (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
        )}
        {/* Colored gradient badge with initials */}
        <span
          className="flex shrink-0 items-center justify-center rounded-[4px] text-white font-bold"
          style={{ background: gradient, width: 18, height: 18, fontSize: 7 }}
        >
          {initials}
        </span>
        <span className="flex-1 truncate">{agent.name}</span>
        {agent.pauseReason === "budget" && (
          <span className="ml-auto shrink-0">
            <BudgetSidebarMarker title="Paused — budget limit reached" />
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Hire button */}
      <div className="flex items-center px-2 py-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openNewAgent();
          }}
          className="ml-auto flex items-center justify-center h-4 w-4 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-colors"
          aria-label="Hire a new team member"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {/* CEO always first, outside any group */}
        {ceo && renderAgent(ceo, 0)}

        {/* Department groups */}
        {departments.map((dept) => {
          const isCollapsed = collapsed.has(dept.key);
          return (
            <div key={dept.key} className="mt-1">
              {/* Department header */}
              <button
                onClick={() => toggleDept(dept.key)}
                className="flex items-center gap-1.5 px-2 py-1 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <span
                  className="w-1 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: dept.accent }}
                />
                {isCollapsed ? (
                  <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5 shrink-0" />
                )}
                <span>{dept.label}</span>
                <span className="ml-auto text-[9px] font-normal tabular-nums">
                  {dept.agents.length}
                </span>
              </button>

              {/* Department agents */}
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5">
                  {dept.agents.map((agent, i) => renderAgent(agent, i + 1))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped agents (no departments set up, or orphans) */}
        {ungrouped.map((agent, i) => renderAgent(agent, i + departments.length + 1))}
      </div>
    </>
  );
}
