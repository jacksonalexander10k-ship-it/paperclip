import { useMemo } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import type { Agent } from "@paperclipai/shared";

const AGENT_GRADIENTS = [
  "linear-gradient(135deg, #064e3b, #047857)",
  "linear-gradient(135deg, #3730a3, #4f46e5)",
  "linear-gradient(135deg, #0c4a6e, #0369a1)",
  "linear-gradient(135deg, #78350f, #b45309)",
  "linear-gradient(135deg, #7f1d1d, #b91c1c)",
  "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
  "linear-gradient(135deg, #134e4a, #0f766e)",
  "linear-gradient(135deg, #500724, #9d174d)",
] as const;

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
    const filtered = (agents ?? []).filter(
      (a: Agent) => a.status !== "terminated"
    );
    return filtered;
  }, [agents]);
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { orderedAgents } = useAgentOrder({
    agents: visibleAgents,
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)(?:\/([^/]+))?/);
  const activeAgentId = agentMatch?.[1] ?? null;
  const activeTab = agentMatch?.[2] ?? null;

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

      {/* Agent list */}
      <div className="flex flex-col gap-0.5">
        {orderedAgents.map((agent: Agent, index: number) => {
          const runCount = liveCountByAgent.get(agent.id) ?? 0;
          const gradient = AGENT_GRADIENTS[index % AGENT_GRADIENTS.length];
          const initials = agent.name.slice(0, 2).toUpperCase();
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
                  : "text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground"
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
        })}
      </div>
    </>
  );
}
