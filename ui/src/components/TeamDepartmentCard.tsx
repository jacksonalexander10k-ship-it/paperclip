import { Link } from "@/lib/router";
import type { Agent } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";
import { agentInitials } from "../lib/team-grouping";

type AgentActivityStatus = "idle" | "working" | "waiting" | "paused" | "error";

const DEPT_THEME: Record<string, { accent: string; soft: string }> = {
  leadership:   { accent: "#059669", soft: "rgba(5, 150, 105, 0.12)" },
  sales:        { accent: "#a855f7", soft: "rgba(168, 85, 247, 0.12)" },
  marketing:    { accent: "#e11d48", soft: "rgba(225, 29, 72, 0.12)" },
  operations:   { accent: "#2563eb", soft: "rgba(37, 99, 235, 0.12)" },
  intelligence: { accent: "#d97706", soft: "rgba(217, 119, 6, 0.12)" },
  finance:      { accent: "#0d9488", soft: "rgba(13, 148, 136, 0.12)" },
  compliance:   { accent: "#475569", soft: "rgba(71, 85, 105, 0.12)" },
  other:        { accent: "#64748b", soft: "rgba(100, 116, 139, 0.12)" },
};

export interface TeamMember {
  agent: Agent;
  deptKey: string;
  isLead: boolean;
  status: AgentActivityStatus;
  subtitle: string;
}

interface TeamStripProps {
  members: TeamMember[];
}

export function TeamStrip({ members }: TeamStripProps) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-4 py-2 px-1">
      {members.map((m) => {
        // Collision keys = other agents in the SAME department. Keeps Claire/Clive
        // distinct when they both land in Sales.
        const collisionKeys = new Set<string>();
        for (const other of members) {
          if (other.agent.id === m.agent.id) continue;
          if (other.deptKey !== m.deptKey) continue;
          collisionKeys.add(agentInitialsNoCollision(other.agent.name));
        }
        return <TeamAvatar key={m.agent.id} member={m} collisionKeys={collisionKeys} />;
      })}
    </div>
  );
}

// Local helper — avoid re-computing collisions when seeding the collision set
// itself. `agentInitials` with no collision keys is deterministic first+last.
function agentInitialsNoCollision(name: string): string {
  return agentInitials(name);
}

function TeamAvatar({ member, collisionKeys }: { member: TeamMember; collisionKeys: ReadonlySet<string> }) {
  const { agent, deptKey, isLead, status, subtitle } = member;
  const theme = DEPT_THEME[deptKey] ?? DEPT_THEME.other!;
  const initials = agentInitials(agent.name, agent.role, collisionKeys);
  const title = agent.title?.trim() || agent.role || "Agent";
  const isLive = status === "working" || status === "waiting";
  const dotColor =
    status === "paused" ? "#f59e0b" :
    status === "error" ? "#ef4444" :
    isLive ? theme.accent :
    "transparent";

  return (
    <Link
      to={agentUrl(agent)}
      className="group flex flex-col items-center gap-1.5 no-underline text-inherit w-[74px] shrink-0"
      title={`${agent.name} · ${title} · ${subtitle}`}
    >
      <div className="relative">
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center text-[13px] font-bold transition-transform duration-200 group-hover:scale-[1.06]"
          style={{
            backgroundColor: theme.soft,
            color: theme.accent,
            boxShadow: isLead
              ? `0 0 0 2px ${theme.accent}, 0 0 0 4px rgba(255,255,255,1)`
              : `0 0 0 1.5px ${theme.soft}`,
          }}
        >
          {initials}
        </div>
        {(isLive || status === "paused" || status === "error") && (
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card"
            style={{ backgroundColor: dotColor }}
          >
            {isLive && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: dotColor }}
              />
            )}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center min-w-0 w-full gap-0.5">
        <span className="text-[11.5px] font-semibold text-foreground leading-none truncate w-full text-center">
          {agent.name}
        </span>
        <span
          className="text-[9.5px] font-medium uppercase tracking-wider leading-none truncate w-full text-center"
          style={{ color: theme.accent }}
        >
          {title}
        </span>
      </div>
    </Link>
  );
}
