import { useMemo } from "react";
import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { cn, relativeTime, agentUrl } from "../lib/utils";

/** Professional colour palette for agent avatars — muted, not rainbow. */
const AVATAR_COLORS = [
  "bg-slate-600",
  "bg-blue-600",
  "bg-cyan-700",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-700",
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

const STATUS_DOT: Record<AgentActivityStatus, string> = {
  idle: "bg-neutral-400 dark:bg-neutral-500",
  working: "bg-green-500",
  waiting: "bg-blue-500",
  thinking: "bg-amber-500",
  paused: "bg-red-500",
  error: "bg-red-500",
};

const STATUS_PULSE: Record<AgentActivityStatus, string> = {
  idle: "animate-[pulse-slow_3s_ease-in-out_infinite] bg-neutral-400/50 dark:bg-neutral-500/50",
  working: "animate-[pulse-fast_1s_ease-in-out_infinite] bg-green-400/60",
  waiting: "animate-[pulse-medium_2s_ease-in-out_infinite] bg-blue-400/60",
  thinking: "animate-[pulse-medium_1.5s_ease-in-out_infinite] bg-amber-400/60",
  paused: "",
  error: "",
};

const STATUS_LABEL: Record<AgentActivityStatus, string> = {
  idle: "Idle",
  working: "Working",
  waiting: "Waiting for approval",
  thinking: "Starting...",
  paused: "Paused",
  error: "Error",
};

export function AgentStatusCard({
  agent,
  index,
  isRunning,
  pendingApprovals,
  currentAction,
  lastAction,
  lastActionAt,
  tasksDoneToday = 0,
}: AgentStatusCardProps) {
  const status = deriveStatus(agent, isRunning, pendingApprovals);
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = agent.name.charAt(0).toUpperCase();

  const subtitle = useMemo(() => {
    if (status === "working" && currentAction) return currentAction;
    if (status === "waiting") return `${pendingApprovals} pending approval${pendingApprovals !== 1 ? "s" : ""}`;
    return STATUS_LABEL[status];
  }, [status, currentAction, pendingApprovals]);

  return (
    <Link
      to={agentUrl(agent)}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 no-underline text-inherit transition-colors hover:bg-accent/30 min-w-[180px] max-w-[200px] shrink-0"
    >
      {/* Header: Avatar + Name + Status dot */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0",
            avatarColor,
          )}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{agent.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {agent.title || agent.role}
          </div>
        </div>
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {STATUS_PULSE[status] && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full",
                STATUS_PULSE[status],
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2.5 w-2.5",
              STATUS_DOT[status],
            )}
          />
        </span>
      </div>

      {/* Current action / status text */}
      <div className="text-[11px] text-muted-foreground truncate leading-tight min-h-[14px]">
        {subtitle}
      </div>

      {/* Footer: stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {tasksDoneToday > 0
            ? `${tasksDoneToday} task${tasksDoneToday !== 1 ? "s" : ""} today`
            : "No tasks today"}
        </span>
        {lastActionAt && (
          <span className="text-[10px]">{relativeTime(lastActionAt)}</span>
        )}
      </div>
    </Link>
  );
}
