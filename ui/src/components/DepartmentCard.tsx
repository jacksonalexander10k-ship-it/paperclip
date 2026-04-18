import { useState } from "react";
import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { agentUrl } from "../lib/utils";
import { agentInitials } from "../lib/team-grouping";

type AgentActivityStatus = "idle" | "working" | "waiting" | "paused" | "error";

// Colors match the sidebar (SidebarAgents.tsx DEPT_ACCENT)
const DEPT_THEME: Record<string, { accent: string; soft: string; bg: string }> = {
  leadership:   { accent: "#047857", soft: "rgba(4, 120, 87, 0.12)",   bg: "#ecfdf5" }, // dark emerald — CEO
  sales:        { accent: "#16a34a", soft: "rgba(22, 163, 74, 0.12)",  bg: "#f0fdf4" }, // green
  marketing:    { accent: "#7c3aed", soft: "rgba(124, 58, 237, 0.12)", bg: "#faf5ff" }, // purple
  operations:   { accent: "#d97706", soft: "rgba(217, 119, 6, 0.12)",  bg: "#fffbeb" }, // amber
  intelligence: { accent: "#0891b2", soft: "rgba(8, 145, 178, 0.12)",  bg: "#ecfeff" }, // cyan (Research)
  finance:      { accent: "#0d9488", soft: "rgba(13, 148, 136, 0.12)", bg: "#f0fdfa" },
  compliance:   { accent: "#475569", soft: "rgba(71, 85, 105, 0.12)",  bg: "#f8fafc" },
  other:        { accent: "#64748b", soft: "rgba(100, 116, 139, 0.12)",bg: "#f9fafb" },
};

interface DepartmentCardProps {
  deptKey: string;
  label: string;
  members: Agent[];
  statusByAgent: Map<string, { status: AgentActivityStatus; subtitle: string }>;
  defaultExpanded?: boolean;
}

export function DepartmentCard({ deptKey, label, members, statusByAgent, defaultExpanded = false }: DepartmentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const theme = DEPT_THEME[deptKey] ?? DEPT_THEME.other!;
  if (members.length === 0) return null;

  // Aggregate status across the dept — any live? any paused?
  const anyLive = members.some((a) => {
    const s = statusByAgent.get(a.id)?.status;
    return s === "working" || s === "waiting";
  });
  const anyPaused = members.some((a) => statusByAgent.get(a.id)?.status === "paused");
  const statusDot = anyLive ? theme.accent : anyPaused ? "#f59e0b" : "#cbd5e1";

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden transition-all duration-200"
      style={{ borderColor: expanded ? theme.soft : "var(--border)" }}
    >
      {/* Header — clickable */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Department badge */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style={{ backgroundColor: theme.bg }}
        >
          <span className="text-[11px] font-bold uppercase" style={{ color: theme.accent }}>
            {label.slice(0, 2)}
          </span>
        </div>

        {/* Label + member count */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-bold uppercase tracking-[0.12em]"
            style={{ color: theme.accent }}
          >
            {label}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {members.length} {members.length === 1 ? "person" : "people"}
            {" · "}
            {members.map((a) => a.name).join(", ")}
          </div>
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2 w-2">
            {anyLive && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                style={{ backgroundColor: statusDot }}
              />
            )}
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: statusDot }}
            />
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded agent list */}
      {expanded && (
        <div
          className="flex flex-col divide-y divide-border/50 border-t"
          style={{ borderColor: theme.soft }}
        >
          {members.map((agent) => {
            const s = statusByAgent.get(agent.id) ?? { status: "idle" as AgentActivityStatus, subtitle: "Standing by" };
            // Collision keys = initials of every OTHER agent in this department card.
            const collisionKeys = new Set<string>();
            for (const other of members) {
              if (other.id === agent.id) continue;
              collisionKeys.add(agentInitials(other.name));
            }
            return (
              <AgentRow
                key={agent.id}
                agent={agent}
                theme={theme}
                status={s.status}
                subtitle={s.subtitle}
                collisionKeys={collisionKeys}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  theme,
  status,
  subtitle,
  collisionKeys,
}: {
  agent: Agent;
  theme: { accent: string; soft: string; bg: string };
  status: AgentActivityStatus;
  subtitle: string;
  collisionKeys: ReadonlySet<string>;
}) {
  const initials = agentInitials(agent.name, agent.role, collisionKeys);
  const title = agent.title?.trim() || agent.role || "Agent";
  const isLive = status === "working" || status === "waiting";
  const dotColor =
    status === "paused" ? "#f59e0b" :
    status === "error" ? "#ef4444" :
    isLive ? theme.accent :
    "#cbd5e1";

  return (
    <Link
      to={agentUrl(agent)}
      className="flex items-center gap-3 px-4 py-3 no-underline text-inherit hover:bg-muted/40 transition-colors"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-bold shrink-0"
        style={{ backgroundColor: theme.bg, color: theme.accent }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{agent.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{title} · {subtitle}</div>
      </div>
      <span className="relative flex h-2 w-2 shrink-0">
        {isLive && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      </span>
    </Link>
  );
}
