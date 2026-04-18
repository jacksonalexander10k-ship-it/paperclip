import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/lib/router";
import { cn, relativeTime } from "../lib/utils";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { activityApi } from "../api/activity";
import { agentMessagesApi, type AgentMessage } from "../api/agent-messages";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { approvalLabel, typeIcon, defaultTypeIcon } from "./ApprovalPayload";
import { Button } from "@/components/ui/button";
import { Shield, Activity, MessageSquare, ArrowRight, Zap, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { agentInitials } from "../lib/team-grouping";
import type { Agent, ActivityEvent } from "@paperclipai/shared";

interface LiveActivityPanelProps {
  className?: string;
  /** If set, only show events where actor or subject matches this agent id. */
  agentId?: string;
}

/* ------------------------------------------------------------------ */
/*  Activity event formatter (shared)                                 */
/*                                                                    */
/*  Turns raw event rows like { action: "issue.read_marked" } into    */
/*  user-friendly copy. When actor === target, avoid duplicating      */
/*  the name (bug 19: "Claire tool call Claire" → "Claire used …").   */
/* ------------------------------------------------------------------ */

function titleCaseRaw(raw: string): string {
  const cleaned = raw.replace(/[._]/g, " ").trim();
  if (!cleaned) return "Activity";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export interface FormattedActivity {
  label: string;
  icon: string;
  thinking?: string;
}

/** Event-type → user-friendly string. */
export function formatActivityEvent(
  event: Pick<ActivityEvent, "action" | "details" | "actorId" | "entityType" | "entityId"> & {
    actorName?: string;
    targetName?: string;
    type?: string;
  },
): FormattedActivity {
  const type = event.type ?? event.action ?? "";
  const details = (event.details ?? {}) as Record<string, unknown>;
  const actor = event.actorName
    ?? (typeof details.agent === "string" ? (details.agent as string) : undefined)
    ?? (typeof details.fromAgent === "string" ? (details.fromAgent as string) : undefined)
    ?? "Agent";
  const target = event.targetName
    ?? (typeof details.toAgent === "string" ? (details.toAgent as string) : undefined)
    ?? (typeof details.targetName === "string" ? (details.targetName as string) : undefined);

  const title = (typeof details.title === "string" ? (details.title as string) : undefined)
    ?? (typeof details.summary === "string" ? (details.summary as string) : undefined);

  const toolName =
    (typeof details.tool_name === "string" ? (details.tool_name as string) : undefined)
    ?? (typeof details.toolName === "string" ? (details.toolName as string) : undefined)
    ?? (typeof details.tool === "string" ? (details.tool as string) : undefined);

  const contactName =
    (typeof details.contactName === "string" ? (details.contactName as string) : undefined)
    ?? (typeof details.contact_name === "string" ? (details.contact_name as string) : undefined)
    ?? (typeof details.name === "string" ? (details.name as string) : undefined);
  const phone =
    (typeof details.phone === "string" ? (details.phone as string) : undefined)
    ?? (typeof details.phoneNumber === "string" ? (details.phoneNumber as string) : undefined)
    ?? (typeof details.from === "string" ? (details.from as string) : undefined);

  // Detect "same actor and target" so we don't render "Claire … Claire"
  const sameActorTarget = Boolean(target) && target === actor;

  switch (type) {
    case "issue.read":
    case "issue.read_marked":
      return { label: "Marked task read", icon: "📄" };

    case "issue.created":
      return {
        label: title ? `New task: ${title}` : "New task created",
        icon: "📌",
      };

    case "agent.direct_response":
      return {
        label: `${actor} replied to a message`,
        icon: "💬",
        thinking: title,
      };

    case "whatsapp.received":
      return {
        label: `WhatsApp from ${contactName ?? phone ?? "contact"}`,
        icon: "📱",
      };

    case "whatsapp.sent":
      return {
        label: `WhatsApp sent to ${contactName ?? phone ?? "contact"}`,
        icon: "📤",
      };

    case "tool_call":
    case "tool.call":
    case "agent.tool_call": {
      const tool = toolName ?? "a tool";
      if (!target || sameActorTarget) {
        return { label: `${actor} used ${tool}`, icon: "🛠" };
      }
      return { label: `${actor} → ${target}: ${tool}`, icon: "🛠" };
    }

    case "comment.created":
      return { label: `${actor} posted a comment`, icon: "💭" };

    default:
      // Fall back to a humanised version of the raw type
      return {
        label: title ? `${titleCaseRaw(type)} — ${title}` : titleCaseRaw(type),
        icon: "📌",
      };
  }
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

function ActivityTab({ companyId, agentId }: { companyId: string; agentId?: string }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Ask the server to scope when possible; fall back to client filter below.
  const { data: activity } = useQuery({
    queryKey: agentId
      ? [...queryKeys.activity(companyId), "agent", agentId]
      : queryKeys.activity(companyId),
    queryFn: () => activityApi.list(companyId, agentId ? { agentId } : undefined),
    refetchInterval: 3_000,
  });

  const { data: agentsList } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const agentMap = new Map<string, Agent>();
  for (const a of agentsList ?? []) agentMap.set(a.id, a);

  // Client-side safety net — filter events where the actor or the subject is
  // the scoped agent (bug 17: some events only record the agent in details).
  const scoped = agentId
    ? (activity ?? []).filter((e) => {
        if (e.actorId === agentId) return true;
        if (e.agentId === agentId) return true;
        if (e.entityType === "agent" && e.entityId === agentId) return true;
        const details = (e.details ?? {}) as Record<string, unknown>;
        if (details.agentId === agentId) return true;
        if (details.targetAgentId === agentId) return true;
        return false;
      })
    : (activity ?? []);

  // Pageview spam — mirror the dashboard recent-activity filter. Hide these
  // before display so the right-rail stays focused on real agent work.
  const deNoised = scoped.filter((e) => {
    const action = String((e as { action?: string }).action ?? "").toLowerCase();
    const type = String((e as { type?: string }).type ?? "").toLowerCase();
    const name = String((e as { name?: string }).name ?? "").toLowerCase();
    if (type === "view" || action === "view") return false;
    if (/^(view\.|pageview)/.test(action)) return false;
    // Read-marker events render as "viewed X" — same UX noise.
    if (/\.read_marked$/.test(action)) return false;
    if (/^viewed/.test(name)) return false;
    return true;
  });

  const entries = deNoised.slice(0, 30);

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

  // Map raw events → user-friendly strings via the shared formatter.
  function describeEvent(event: typeof entries[0]) {
    const details = (event as { details?: Record<string, unknown> }).details ?? {};
    const action = (event as { action?: string }).action ?? "";
    const actorId = (event as { actorId?: string }).actorId;
    const actorName = actorId ? agentMap.get(actorId)?.name : undefined;

    const targetAgentId =
      typeof details.targetAgentId === "string" ? (details.targetAgentId as string) : undefined;
    const targetName = targetAgentId
      ? agentMap.get(targetAgentId)?.name
      : typeof details.toAgent === "string"
        ? (details.toAgent as string)
        : undefined;

    const formatted = formatActivityEvent({
      type: action,
      action,
      details,
      actorId: actorId ?? "",
      entityType: (event as { entityType?: string }).entityType ?? "",
      entityId: (event as { entityId?: string }).entityId ?? "",
      actorName,
      targetName,
    });

    const thinking =
      formatted.thinking
      ?? (typeof details.summary === "string" ? (details.summary as string) : undefined)
      ?? (typeof details.title === "string" ? (details.title as string) : undefined)
      ?? "";

    return { label: formatted.label, icon: formatted.icon, thinking };
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      {entries.map((event) => {
        const agentId = (event as { actorId?: string }).actorId;
        const agent = agentId ? agentMap.get(agentId) : null;
        const actorName = agent?.name ?? "System";
        const desc = describeEvent(event);
        const isExpanded = expandedIds.has(event.id);

        return (
          <div
            key={event.id}
            className="px-3 py-2.5 border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => desc.thinking && toggleExpand(event.id)}
          >
            <div className="flex items-start gap-2">
              <span className="text-[12px] mt-0.5 shrink-0">{desc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground">{actorName}</span>
                  <span className="text-[10px] text-muted-foreground/50">{relativeTime(String(event.createdAt))}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc.label}</p>

                {/* Expandable thinking block — like Claude's reasoning */}
                {desc.thinking && (
                  <div className={cn(
                    "mt-1.5 overflow-hidden transition-all duration-200",
                    isExpanded ? "max-h-[200px]" : "max-h-0",
                  )}>
                    <div className="rounded-md bg-muted/50 border border-border/30 px-2.5 py-2 text-[10.5px] text-muted-foreground leading-relaxed">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-1">Thinking</span>
                      {desc.thinking}
                    </div>
                  </div>
                )}
                {desc.thinking && !isExpanded && (
                  <button className="text-[9.5px] text-primary/70 hover:text-primary mt-0.5 flex items-center gap-0.5">
                    <ChevronDown className="h-2.5 w-2.5" />
                    Show reasoning
                  </button>
                )}
                {desc.thinking && isExpanded && (
                  <button className="text-[9.5px] text-primary/70 hover:text-primary mt-0.5 flex items-center gap-0.5">
                    <ChevronUp className="h-2.5 w-2.5" />
                    Hide
                  </button>
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
    const agent = (agentsList as Agent[] | undefined)?.find((a: Agent) => a.id === id);
    const name = agent?.name ?? agentName(id);
    // Collision keys — every other agent's initials so Claire vs Clive differ.
    const collisionKeys = new Set<string>();
    for (const other of (agentsList as Agent[] | undefined) ?? []) {
      if (other.id === id) continue;
      collisionKeys.add(agentInitials(other.name));
    }
    return agentInitials(name, agent?.role, collisionKeys);
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
        Agents will chat here when the CEO delegates a task. Ask the CEO to do something to try it out.
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
      {/* Clear all button — always visible when there are messages */}
      <div className="px-3 py-2 border-b border-border/40 flex justify-between items-center sticky top-0 bg-sidebar z-10">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Agent Comms {sorted.length > 0 && `(${sorted.length})`}
        </span>
        {sorted.length > 0 && (
          <button
            className="text-[11px] font-medium text-destructive/70 hover:text-destructive transition-colors px-2 py-0.5 rounded hover:bg-destructive/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            {clearMutation.isPending ? "Clearing..." : "Clear all"}
          </button>
        )}
      </div>
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

export function LiveActivityPanel({ className, agentId }: LiveActivityPanelProps) {
  const { selectedCompanyId } = useCompany();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"pending" | "activity" | "comms">("pending");

  // If no agentId was passed, derive it from the URL when on /agents/:id.
  // Keeps the right rail scoped to the current agent page (bug 17).
  const routeAgentMatch = /\/agents\/([^/]+)/.exec(location.pathname ?? "");
  const scopedAgentId = agentId ?? routeAgentMatch?.[1];

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
        "flex flex-col bg-sidebar w-[300px] shrink-0",
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
          <ActivityTab companyId={selectedCompanyId} agentId={scopedAgentId} />
        )}
      </div>
    </div>
  );
}
