import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import type { Agent, LiveEvent } from "@paperclipai/shared";
import { AgentStatusCard } from "./AgentStatusCard";
import { ActivityFeed, type ActivityEntry } from "./ActivityFeed";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

const MAX_FEED_ENTRIES = 100;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveAgentName(agents: Agent[] | undefined, agentId: string): string {
  if (!agents) return `Agent ${agentId.slice(0, 8)}`;
  const agent = agents.find((a) => a.id === agentId);
  return agent?.name ?? `Agent ${agentId.slice(0, 8)}`;
}

function buildFeedEntry(
  agents: Agent[] | undefined,
  type: string,
  payload: Record<string, unknown>,
): ActivityEntry | null {
  const agentId = readString(payload.agentId);
  if (!agentId) return null;

  const agentName = resolveAgentName(agents, agentId);
  const now = new Date();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (type === "heartbeat.run.status") {
    const status = readString(payload.status);
    if (status === "running") {
      const trigger = readString(payload.triggerDetail);
      return {
        id,
        timestamp: now,
        agentName,
        agentId,
        action: trigger ? `started: ${trigger}` : "heartbeat started",
      };
    }
    if (status === "succeeded") {
      return { id, timestamp: now, agentName, agentId, action: "run completed", icon: "ok" };
    }
    if (status === "failed") {
      return { id, timestamp: now, agentName, agentId, action: "run failed", icon: "!!" };
    }
    if (status === "cancelled") {
      return { id, timestamp: now, agentName, agentId, action: "run cancelled" };
    }
    return null;
  }

  if (type === "heartbeat.run.queued") {
    return { id, timestamp: now, agentName, agentId, action: "run queued" };
  }

  if (type === "agent.status") {
    const status = readString(payload.status);
    if (status === "running") {
      return { id, timestamp: now, agentName, agentId, action: "started working" };
    }
    if (status === "paused") {
      return { id, timestamp: now, agentName, agentId, action: "paused" };
    }
    if (status === "error") {
      return { id, timestamp: now, agentName, agentId, action: "encountered an error", icon: "!!" };
    }
    if (status === "idle" || status === "active") {
      return { id, timestamp: now, agentName, agentId, action: "idle -- no pending tasks" };
    }
    return null;
  }

  if (type === "activity.logged") {
    const action = readString(payload.action);
    const entityType = readString(payload.entityType);
    if (action === "issue.created" && entityType === "issue") {
      return { id, timestamp: now, agentName, agentId, action: "created a task" };
    }
    if (action === "issue.comment_added") {
      return { id, timestamp: now, agentName, agentId, action: "posted an update" };
    }
    if (action === "issue.updated") {
      return { id, timestamp: now, agentName, agentId, action: "updated a task" };
    }
    return null;
  }

  return null;
}

interface LiveActivityPanelProps {
  className?: string;
  defaultExpanded?: boolean;
}

export function LiveActivityPanel({ className, defaultExpanded = true }: LiveActivityPanelProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [feedEntries, setFeedEntries] = useState<ActivityEntry[]>([]);
  const feedEntriesRef = useRef(feedEntries);
  feedEntriesRef.current = feedEntries;

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch live runs to determine which agents are currently running
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  // Set of agent IDs that are currently running
  const runningAgentIds = useMemo(() => {
    const set = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.status === "running" || run.status === "queued") {
        set.add(run.agentId);
      }
    }
    return set;
  }, [liveRuns]);

  // Whether any agent is currently active
  const anyActive = runningAgentIds.size > 0;

  // Listen to WebSocket events for feed updates
  useEffect(() => {
    if (!selectedCompanyId) return;

    let closed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectAttempt += 1;
      const delayMs = Math.min(15000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 4));
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(selectedCompanyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        reconnectAttempt = 0;
      };

      socket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw) as LiveEvent;
          if (parsed.companyId !== selectedCompanyId) return;

          const payload = parsed.payload ?? {};
          const entry = buildFeedEntry(
            queryClient.getQueryData<Agent[]>(queryKeys.agents.list(selectedCompanyId)),
            parsed.type,
            payload,
          );

          if (entry) {
            setFeedEntries((prev) => {
              const next = [...prev, entry];
              if (next.length > MAX_FEED_ENTRIES) {
                return next.slice(next.length - MAX_FEED_ENTRIES);
              }
              return next;
            });
          }
        } catch {
          // Ignore non-JSON payloads.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (closed) return;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnect();
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "panel_unmount");
      }
    };
  }, [selectedCompanyId, queryClient]);

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  // Filter to only show non-terminated agents, sorted alphabetically
  const visibleAgents = useMemo(() => {
    if (!agents) return [];
    return agents
      .filter((a) => (a.status as string) !== "terminated" && (a.status as string) !== "archived")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents]);

  if (!selectedCompanyId) return null;

  return (
    <div
      className={cn(
        "flex flex-col border-l border-border bg-background",
        expanded ? "w-[350px]" : "w-[350px]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Agency Activity</span>
          <span className="relative flex h-2 w-2">
            {anyActive && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-pulse" />
            )}
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                anyActive ? "bg-green-500" : "bg-neutral-400",
              )}
            />
          </span>
        </div>
        <button
          onClick={toggleExpanded}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? "Collapse panel" : "Expand panel"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {expanded && (
        <>
          {/* Agent status cards — horizontal scrolling row */}
          {visibleAgents.length > 0 && (
            <div className="shrink-0 border-b border-border">
              <div className="flex gap-2 overflow-x-auto scrollbar-auto-hide p-3">
                {visibleAgents.map((agent, i) => (
                  <AgentStatusCard
                    key={agent.id}
                    agent={agent}
                    index={i}
                    isRunning={runningAgentIds.has(agent.id)}
                    pendingApprovals={0}
                    lastActionAt={agent.lastHeartbeatAt ? String(agent.lastHeartbeatAt) : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Activity feed — fills remaining space */}
          <ActivityFeed entries={feedEntries} />
        </>
      )}
    </div>
  );
}
