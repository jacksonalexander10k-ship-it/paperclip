import { useMemo } from "react";
import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { AGENT_ROLE_LABELS, type AgentRole } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";

const AGENT_COLORS = [
  { bg: "#ecfdf5", accent: "#059669", dot: "#10b981" },
  { bg: "#eef2ff", accent: "#4f46e5", dot: "#818cf8" },
  { bg: "#f0f9ff", accent: "#0284c7", dot: "#38bdf8" },
  { bg: "#fffbeb", accent: "#d97706", dot: "#f59e0b" },
  { bg: "#faf5ff", accent: "#9333ea", dot: "#a855f7" },
  { bg: "#fef2f2", accent: "#dc2626", dot: "#f87171" },
  { bg: "#ecfeff", accent: "#0891b2", dot: "#06b6d4" },
  { bg: "#f0fdf4", accent: "#16a34a", dot: "#22c55e" },
] as const;

type AgentActivityStatus = "idle" | "working" | "waiting" | "thinking" | "paused" | "error";

interface AgentStatusCardProps {
  agent: Agent;
  index: number;
  isRunning: boolean;
  pendingApprovals: number;
  currentAction?: string | null;
  lastAction?: string | null;
  lastActionAt?: string | null;
  tasksDoneToday?: number;
}

function deriveStatus(
  agent: Agent,
  isRunning: boolean,
  pendingApprovals: number,
): AgentActivityStatus {
  if (agent.status === "paused") return "paused";
  if (agent.status === "error") return "error";
  if (isRunning) return "working";
  if (pendingApprovals > 0) return "waiting";
  return "idle";
}

export function AgentStatusCard({
  agent,
  index,
  isRunning,
  pendingApprovals,
  currentAction,
}: AgentStatusCardProps) {
  const status = deriveStatus(agent, isRunning, pendingApprovals);
  const colors = AGENT_COLORS[index % AGENT_COLORS.length];
  const initials = agent.name.slice(0, 2).toUpperCase();
  const roleLabel = AGENT_ROLE_LABELS[(agent.role ?? "general") as AgentRole] ?? "Agent";
  const isActive = status === "working" || status === "waiting";

  const subtitle = useMemo(() => {
    if (status === "working" && currentAction) return currentAction;
    if (status === "waiting") return `${pendingApprovals} pending approval${pendingApprovals !== 1 ? "s" : ""}`;
    if (status === "paused") return "Paused";
    if (status === "error") return "Needs attention";
    return "Standing by";
  }, [status, currentAction, pendingApprovals]);

  return (
    <Link
      to={agentUrl(agent)}
      className="group relative flex items-center gap-3 rounded-xl border bg-card p-3.5 no-underline text-inherit cursor-pointer transition-all duration-200 hover:shadow-sm"
      style={{
        borderColor: isActive ? `${colors.accent}30` : "var(--border)",
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[12px] font-bold shrink-0"
        style={{
          backgroundColor: colors.bg,
          color: colors.accent,
        }}
      >
        {initials}
      </div>

      {/* Name + role + subtitle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground leading-tight">{agent.name}</span>
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">{roleLabel}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
          {subtitle}
        </div>
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isActive && (
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
              style={{ backgroundColor: colors.dot }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.dot }}
            />
          </span>
        )}
        {!isActive && status !== "error" && status !== "paused" && (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
        )}
        {status === "paused" && (
          <span className="h-2 w-2 rounded-full bg-amber-400" />
        )}
        {status === "error" && (
          <span className="h-2 w-2 rounded-full bg-red-400" />
        )}
      </div>
    </Link>
  );
}
