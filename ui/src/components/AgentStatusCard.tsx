import { useMemo } from "react";
import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";

/* Exact gradients from C design */
const AGENT_GRADIENTS = [
  "linear-gradient(135deg, #064e3b, #047857)",
  "linear-gradient(135deg, #3730a3, #4f46e5)",
  "linear-gradient(135deg, #0c4a6e, #0369a1)",
  "linear-gradient(135deg, #78350f, #b45309)",
  "linear-gradient(135deg, #4a044e, #86198f)",
  "linear-gradient(135deg, #7f1d1d, #b91c1c)",
  "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
  "linear-gradient(135deg, #134e4a, #0f766e)",
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
  const gradient = AGENT_GRADIENTS[index % AGENT_GRADIENTS.length];
  const initials = agent.name.slice(0, 2).toUpperCase();

  const subtitle = useMemo(() => {
    if (status === "working" && currentAction) return currentAction;
    if (status === "waiting") return `${pendingApprovals} pending approval${pendingApprovals !== 1 ? "s" : ""}`;
    if (status === "paused") return "Paused";
    if (status === "error") return "Error";
    return "No active tasks today";
  }, [status, currentAction, pendingApprovals]);

  /* .pill-on / .pill-off from design */
  const statusPill =
    status === "working" || status === "waiting" ? (
      <span className="py-[3px] px-2 rounded-[20px] text-[10px] font-semibold bg-primary/[0.13] text-primary whitespace-nowrap">
        Working
      </span>
    ) : status === "paused" ? (
      <span className="py-[3px] px-2 rounded-[20px] text-[10px] font-semibold bg-red-500/[0.15] text-red-400 whitespace-nowrap">
        Paused
      </span>
    ) : status === "error" ? (
      <span className="py-[3px] px-2 rounded-[20px] text-[10px] font-semibold bg-red-500/[0.15] text-red-400 whitespace-nowrap">
        Error
      </span>
    ) : (
      /* .pill-off */
      <span className="py-[3px] px-2 rounded-[20px] text-[10px] font-semibold bg-muted text-muted-foreground whitespace-nowrap">
        Idle
      </span>
    );

  return (
    /* .atile — exact from C design CSS */
    <Link
      to={agentUrl(agent)}
      className="flex items-center gap-[10px] bg-card border border-border rounded-[10px] p-[12px_14px] no-underline text-inherit cursor-pointer transition-[border-color] duration-150 hover:border-[rgba(255,255,255,0.12)]"
    >
      {/* .av — 34px rounded-9px gradient avatar */}
      <div
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[12px] font-bold text-white shrink-0"
        style={{ background: gradient }}
      >
        {initials}
      </div>
      {/* .ai — flex:1, min-width:0 */}
      <div className="flex-1 min-w-0">
        {/* .an */}
        <div className="text-[13px] font-semibold text-foreground">{agent.name}</div>
        {/* .at */}
        <div className="text-[11.5px] text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
          {subtitle}
        </div>
      </div>
      {statusPill}
    </Link>
  );
}
