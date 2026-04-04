import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { heartbeatsApi } from "../api/heartbeats";
import type { HeartbeatRunEvent } from "@paperclipai/shared";
import {
  Search, Pencil, MessageCircle, FileText, Check,
  Loader2, ChevronDown, ChevronUp, Brain, Wrench, Shield,
  AlertCircle, Clock,
} from "lucide-react";

interface ThoughtEntry {
  id: string;
  ts: string;
  icon: typeof Search;
  label: string;
  detail?: string;
  status: "running" | "completed" | "error";
  category: "thinking" | "tool" | "communication" | "approval";
}

function mapEventToThought(event: HeartbeatRunEvent): ThoughtEntry | null {
  const eventType = event.eventType ?? "";
  const msg = event.message ?? "";
  const payload = (event.payload ?? null) as Record<string, unknown> | null;

  let mapped: Omit<ThoughtEntry, "id" | "ts"> | null = null;

  // Tool calls
  if (eventType === "tool.start" || eventType === "tool_use") {
    const toolName = String(payload?.name ?? payload?.tool ?? "tool");
    const input = payload?.input ?? payload?.args;
    const inputSummary = input ? JSON.stringify(input).slice(0, 120) : undefined;
    mapped = { icon: Wrench, label: `Calling ${toolName}`, detail: inputSummary, status: "running", category: "tool" };
  } else if (eventType === "tool.end" || eventType === "tool_result") {
    const toolName = String(payload?.name ?? payload?.tool ?? "tool");
    mapped = { icon: Check, label: `${toolName} completed`, status: "completed", category: "tool" };
  } else if (eventType === "thinking" || eventType === "assistant.thinking") {
    mapped = { icon: Brain, label: "Reasoning...", detail: msg.slice(0, 200), status: "running", category: "thinking" };
  } else if (msg.toLowerCase().includes("search") || eventType.includes("search")) {
    mapped = { icon: Search, label: msg.slice(0, 100) || "Searching...", status: "running", category: "tool" };
  } else if (msg.toLowerCase().includes("draft") || msg.toLowerCase().includes("writing")) {
    mapped = { icon: Pencil, label: msg.slice(0, 100) || "Drafting content...", status: "running", category: "communication" };
  } else if (eventType.includes("approval") || msg.toLowerCase().includes("approval")) {
    mapped = { icon: Shield, label: msg.slice(0, 100) || "Queuing for approval...", status: "completed", category: "approval" };
  } else if (msg.toLowerCase().includes("message") || msg.toLowerCase().includes("whatsapp")) {
    mapped = { icon: MessageCircle, label: msg.slice(0, 100), status: "completed", category: "communication" };
  } else if (msg) {
    mapped = { icon: FileText, label: msg.slice(0, 100), status: "completed", category: "thinking" };
  }

  if (!mapped) return null;

  return {
    id: `${event.runId}-${event.seq}`,
    ts: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
    ...mapped,
  };
}

const categoryColors: Record<string, string> = {
  thinking: "text-blue-500",
  tool: "text-amber-500",
  communication: "text-green-500",
  approval: "text-purple-500",
};

export function ThoughtProcessStream({
  agentId,
  companyId,
  className,
}: {
  agentId: string;
  companyId: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const streamRef = useRef<HTMLDivElement>(null);

  // Check for active runs
  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.liveRuns(companyId), agentId],
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    refetchInterval: 5_000,
  });

  const activeRun = (liveRuns ?? []).find((r) => r.agentId === agentId);
  const isLive = !!activeRun;

  // Poll events for the active run
  const { data: rawEvents } = useQuery({
    queryKey: ["agent-thought-events", activeRun?.id],
    queryFn: () => heartbeatsApi.events(activeRun!.id),
    enabled: !!activeRun?.id,
    refetchInterval: isLive ? 2_000 : false,
  });

  // If no active run, try to load events from the most recent completed run
  const { data: recentRuns } = useQuery({
    queryKey: queryKeys.heartbeats(companyId, agentId),
    queryFn: () => heartbeatsApi.list(companyId, agentId),
    enabled: !isLive,
  });

  const lastCompletedRun = useMemo(() => {
    if (isLive) return null;
    return (recentRuns ?? [])
      .filter((r) => r.status === "succeeded" || r.status === "failed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [recentRuns, isLive]);

  const { data: lastRunEvents } = useQuery({
    queryKey: ["agent-thought-events", lastCompletedRun?.id],
    queryFn: () => heartbeatsApi.events(lastCompletedRun!.id),
    enabled: !!lastCompletedRun?.id && !isLive,
  });

  const entries = useMemo(() => {
    const events = rawEvents ?? lastRunEvents ?? [];
    return events
      .map(mapEventToThought)
      .filter((e): e is ThoughtEntry => e !== null)
      .slice(-50);
  }, [rawEvents, lastRunEvents]);

  // Auto-scroll to bottom when live
  useEffect(() => {
    if (streamRef.current && isExpanded && isLive) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [entries, isExpanded, isLive]);

  if (!isLive && entries.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-border/60 overflow-hidden", className)}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
          ) : (
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[12px] font-semibold text-foreground">
            {isLive ? "Thought Process" : "Last Run"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {entries.length} {entries.length === 1 ? "step" : "steps"}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Stream */}
      {isExpanded && (
        <div ref={streamRef} className="max-h-[280px] overflow-y-auto">
          {entries.length === 0 && isLive && (
            <div className="flex items-center gap-2 px-3.5 py-3 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Waiting for agent activity...
            </div>
          )}
          {entries.map((entry, i) => {
            const Icon = entry.icon;
            const isLast = i === entries.length - 1;
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-start gap-2.5 px-3.5 py-2 border-b border-border/20",
                  isLast && entry.status === "running" && isLive && "bg-primary/[0.03]",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {entry.status === "running" && isLive ? (
                    <Loader2 className={cn("h-3.5 w-3.5 animate-spin", categoryColors[entry.category])} />
                  ) : entry.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Icon className={cn("h-3.5 w-3.5", categoryColors[entry.category])} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] text-foreground leading-snug truncate">{entry.label}</p>
                  {entry.detail && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{entry.detail}</p>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground/50 shrink-0 mt-0.5 tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
