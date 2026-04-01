import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, relativeTime } from "../lib/utils";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { activityApi } from "../api/activity";
import { agentMessagesApi, type AgentMessage } from "../api/agent-messages";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { approvalLabel, typeIcon, defaultTypeIcon } from "./ApprovalPayload";
import { Button } from "@/components/ui/button";
import { Shield, Activity, MessageSquare, ArrowRight, Zap, AlertTriangle } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

interface LiveActivityPanelProps {
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Pending Tab                                                       */
/* ------------------------------------------------------------------ */

function PendingTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(companyId),
    queryFn: () => approvalsApi.list(companyId),
    refetchInterval: 3_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onMutate: (id) => {
      setFadingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) }),
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onMutate: (id) => {
      setFadingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) }),
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
    },
  });

  const pending = (approvals ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  );

  const agentMap = new Map<string, Agent>();
  for (const a of agents ?? []) agentMap.set(a.id, a);

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-6">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 mb-2.5">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <p className="text-[12px] font-semibold text-foreground">All caught up</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Nothing needs your approval right now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {pending.map((approval) => {
        const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
        const label = approvalLabel(
          approval.type,
          approval.payload as Record<string, unknown> | null,
        );
        const agent = approval.requestedByAgentId
          ? agentMap.get(approval.requestedByAgentId)
          : null;
        const payload = approval.payload as Record<string, unknown> | null;
        const preview =
          payload?.body
            ? String(payload.body).slice(0, 120)
            : payload?.description
              ? String(payload.description).slice(0, 120)
              : null;

        const isFading = fadingIds.has(approval.id);

        return (
          <div
            key={approval.id}
            className={cn(
              "px-3 py-3 border-b border-border/40 space-y-2 transition-opacity duration-300",
              isFading && "opacity-0",
            )}
          >
            {/* Header row */}
            <div className="flex items-start gap-2.5">
              <div className="flex items-center justify-center h-[25px] w-[25px] rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold leading-tight truncate">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {agent?.name ?? "Agent"}
                  {approval.createdAt && (
                    <> · {relativeTime(String(approval.createdAt))}</>
                  )}
                </p>
              </div>
            </div>

            {/* Preview text */}
            {preview && (
              <p className="text-[11.5px] text-muted-foreground italic leading-relaxed bg-muted/50 rounded-md px-2.5 py-1.5">
                "{preview}"
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-7 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                disabled={isBusy}
                onClick={() => approveMutation.mutate(approval.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-7 text-[11px] font-medium text-muted-foreground border border-border hover:bg-muted"
                disabled={isBusy}
                onClick={() => rejectMutation.mutate(approval.id)}
              >
                Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Tab                                                      */
/* ------------------------------------------------------------------ */

function ActivityTab({ companyId }: { companyId: string }) {
  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(companyId),
    queryFn: () => activityApi.list(companyId),
    refetchInterval: 3_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const agentMap = new Map<string, Agent>();
  for (const a of agents ?? []) agentMap.set(a.id, a);

  const entries = (activity ?? []).slice(0, 30);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-6">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted mb-2.5">
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-[12px] text-muted-foreground">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {entries.map((event) => {
        const agentId =
          (event as { actorId?: string; agentId?: string }).actorId ??
          (event as { actorId?: string; agentId?: string }).agentId;
        const agent = agentId ? agentMap.get(agentId) : null;
        const actorName =
          agent?.name ??
          (event as { actorName?: string }).actorName ??
          "Someone";

        return (
          <div
            key={event.id}
            className="px-3 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors"
          >
            <p className="text-[11.5px] text-foreground leading-[1.5]">
              <span className="font-semibold">{actorName}</span>{" "}
              {(event as { summary?: string; action?: string }).summary ??
                (event as { summary?: string; action?: string }).action ??
                "did something"}
            </p>
            {event.createdAt && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {relativeTime(String(event.createdAt))}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent Comms Tab                                                   */
/* ------------------------------------------------------------------ */

function AgentCommsTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const clearMutation = useMutation({
    mutationFn: () => agentMessagesApi.clearAll(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentMessages.recent(companyId) });
      setSeenIds(new Set());
      setExpandedIds(new Set());
    },
  });

  const { data: messages } = useQuery({
    queryKey: queryKeys.agentMessages.recent(companyId),
    queryFn: () => agentMessagesApi.listRecent(companyId, 30),
    refetchInterval: 3_000,
  });

  // Track which messages are "new" (not seen before) for shimmer animation
  useEffect(() => {
    if (!messages) return;
    const currentIds = new Set(messages.map((m: AgentMessage) => m.id));
    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!seenIds.has(id)) newIds.add(id);
    }
    if (newIds.size > 0) {
      // Mark them as seen after the animation duration (1.5s)
      const timer = setTimeout(() => {
        setSeenIds((prev) => new Set([...prev, ...newIds]));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const { data: agentsList } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const agentName = (id: string) =>
    (agentsList as Agent[] | undefined)?.find((a: Agent) => a.id === id)?.name ?? "Agent";

  const agentInitial = (id: string) => {
    const name = agentName(id);
    return name.charAt(0).toUpperCase();
  };

  const agentColor = (id: string) => {
    const name = agentName(id);
    const colors = ["bg-primary", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500"];
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No agent chatter yet. Send a message to the CEO to see agents coordinate.
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Most recent at top
  const sorted = [...messages];

  return (
    <div className="flex flex-col">
      {/* Clear all button */}
      {sorted.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/40 flex justify-end">
          <button
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            {clearMutation.isPending ? "Clearing..." : "Clear all"}
          </button>
        </div>
      )}
      {sorted.map((msg: AgentMessage) => {
        const isExpanded = expandedIds.has(msg.id);
        const sender = agentName(msg.fromAgentId);
        const summary = msg.summary ?? "";
        const isLong = summary.length > 80;
        const displayText = isExpanded || !isLong ? summary : summary.slice(0, 80) + "...";
        const isNew = !seenIds.has(msg.id);

        return (
          <div
            key={msg.id}
            className={cn(
              "px-3 py-2.5 hover:bg-muted/30 transition-all cursor-pointer animate-in fade-in slide-in-from-top-1 duration-300",
              isNew && "bg-primary/5 ring-1 ring-primary/20 animate-pulse [animation-duration:1.5s] [animation-iteration-count:1]",
            )}
            onClick={() => isLong && toggleExpand(msg.id)}
          >
            <div className="flex items-start gap-2">
              {/* Agent avatar */}
              <div className={cn(
                "w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white text-[9px] font-bold",
                agentColor(msg.fromAgentId),
              )}>
                {agentInitial(msg.fromAgentId)}
              </div>

              <div className="flex-1 min-w-0">
                {/* Sender + time */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground">{sender}</span>
                  <span className="text-[10px] text-muted-foreground/50">{relativeTime(msg.createdAt)}</span>
                </div>

                {/* Message body */}
                <p className="text-[11.5px] text-foreground/80 leading-relaxed mt-0.5 whitespace-pre-wrap">
                  {displayText}
                </p>

                {isLong && !isExpanded && (
                  <span className="text-[10px] text-primary cursor-pointer">Show more</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                        */
/* ------------------------------------------------------------------ */

export function LiveActivityPanel({ className }: LiveActivityPanelProps) {
  const { selectedCompanyId } = useCompany();
  const [activeTab, setActiveTab] = useState<"pending" | "activity" | "comms">("pending");

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const pendingCount = (approvals ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  if (!selectedCompanyId) return null;

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar w-[280px] shrink-0",
        className,
      )}
    >
      {/* Tab bar — 50px height */}
      <div className="flex items-stretch h-[50px] border-b border-border shrink-0">
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("pending")}
        >
          <Shield className="h-3.5 w-3.5" />
          Pending
          {pendingCount > 0 && (
            <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "activity"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("activity")}
        >
          <Activity className="h-3.5 w-3.5" />
          Activity
        </button>
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "comms"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("comms")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comms
        </button>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "pending" ? (
          <PendingTab companyId={selectedCompanyId} />
        ) : activeTab === "comms" ? (
          <AgentCommsTab companyId={selectedCompanyId} />
        ) : (
          <ActivityTab companyId={selectedCompanyId} />
        )}
      </div>
    </div>
  );
}
