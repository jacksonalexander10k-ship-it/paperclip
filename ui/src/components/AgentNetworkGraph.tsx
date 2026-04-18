import { useQuery } from "@tanstack/react-query";
import { agentMessagesApi, type NetworkEdge } from "@/api/agent-messages";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { agentInitials } from "@/lib/team-grouping";
import type { Agent } from "@paperclipai/shared";

interface AgentNetworkGraphProps {
  companyId: string;
}

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  count: number;
}

/**
 * Visual network graph showing agents as nodes with connecting lines
 * that represent inter-agent communication volume.
 *
 * Uses pure SVG — no external graph library needed.
 */
export function AgentNetworkGraph({ companyId }: AgentNetworkGraphProps) {
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const { data: networkData } = useQuery({
    queryKey: queryKeys.agentMessages.network(companyId, 7),
    queryFn: () => agentMessagesApi.networkStats(companyId, 7),
    refetchInterval: 30_000,
  });

  const activeAgents = ((agents ?? []) as Agent[]).filter(
    (a) => a.status !== "terminated",
  );

  if (activeAgents.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No agents to display. Hire agents to see the network.
      </div>
    );
  }

  // Layout agents in a circle
  const width = 600;
  const height = 400;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const nodes: AgentNode[] = activeAgents.map((agent, i) => {
    const angle = (2 * Math.PI * i) / activeAgents.length - Math.PI / 2;
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role ?? "general",
      status: agent.status,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build edges from network data
  const edges: Edge[] = (networkData ?? [])
    .filter((e: NetworkEdge) => e.toAgentId && nodeMap.has(e.fromAgentId) && nodeMap.has(e.toAgentId))
    .map((e: NetworkEdge) => ({
      from: e.fromAgentId,
      to: e.toAgentId!,
      count: e.count,
    }));

  const maxCount = Math.max(1, ...edges.map((e) => e.count));

  const statusColor = (status: string) => {
    switch (status) {
      case "running": return "#22c55e";
      case "idle": return "hsl(var(--primary))";
      case "paused": return "#eab308";
      default: return "#a3a3a3";
    }
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[600px] mx-auto">
        {/* Edges */}
        {edges.map((edge, i) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          const strokeWidth = 1 + (edge.count / maxCount) * 3;
          const opacity = 0.2 + (edge.count / maxCount) * 0.5;

          return (
            <g key={`edge-${i}`}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
              />
              {/* Message count label at midpoint */}
              <text
                x={(fromNode.x + toNode.x) / 2}
                y={(fromNode.y + toNode.y) / 2 - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {edge.count}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            {/* Outer ring — status color */}
            <circle
              cx={node.x}
              cy={node.y}
              r={26}
              fill="hsl(var(--card))"
              stroke={statusColor(node.status)}
              strokeWidth={2.5}
            />
            {/* Agent initial */}
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-[13px] font-bold"
            >
              {agentInitials(node.name, node.role)}
            </text>
            {/* Name label below */}
            <text
              x={node.x}
              y={node.y + 40}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium"
            >
              {node.name}
            </text>
            {/* Role label */}
            <text
              x={node.x}
              y={node.y + 53}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {node.role}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      {edges.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span>Lines = messages exchanged (last 7 days)</span>
          <span>Thicker = more messages</span>
        </div>
      )}
      {edges.length === 0 && (
        <div className="text-center text-xs text-muted-foreground mt-3">
          No inter-agent communication yet. Agents will start messaging each other as they coordinate.
        </div>
      )}
    </div>
  );
}
