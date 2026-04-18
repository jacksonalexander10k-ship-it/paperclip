import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link, Navigate, useBeforeUnload } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentsApi,
  type AgentKey,
  type AgentStats,
  type ClaudeLoginResult,
  type AgentPermissionUpdate,
} from "../api/agents";
import { companySkillsApi } from "../api/companySkills";
import { budgetsApi } from "../api/budgets";
import { costsApi } from "../api/costs";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { ApiError } from "../api/client";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useSidebar } from "../context/SidebarContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { AgentConfigForm } from "../components/AgentConfigForm";
import { AgentTrainingTab } from "../components/agent/AgentTrainingTab";
import { AgentScheduleTab } from "../components/agent/AgentScheduleTab";
import { AgentSettingsSimplified } from "../components/agent/AgentSettingsSimplified";
import { ThoughtProcessStream } from "../components/ThoughtProcessStream";
import { ConnectedAppsGrid } from "../components/ConnectedAppsGrid";
import { AgentConnectionsPanel } from "../components/AgentConnectionsPanel";
import { AgentLearningsTab } from "../components/AgentLearningsTab";
import { adapterLabels, roleLabels, help } from "../components/agent-config-primitives";
import { agentAvatarGradient, agentInitials } from "../lib/team-grouping";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { assetsApi } from "../api/assets";
import { getUIAdapter, buildTranscript } from "../adapters";
import { StatusBadge } from "../components/StatusBadge";
import { agentStatusDot, agentStatusDotDefault } from "../lib/status-colors";
import { MarkdownBody } from "../components/MarkdownBody";
import { CopyText } from "../components/CopyText";
import { EntityRow } from "../components/EntityRow";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { PauseResumeButton } from "../components/AgentActionButtons";
import { BudgetPolicyCard } from "../components/BudgetPolicyCard";
import { PackageFileTree, buildFileTree } from "../components/PackageFileTree";
import { ScrollToBottom } from "../components/ScrollToBottom";
import { formatCents, formatDate, relativeTime, formatTokens, visibleRunCostUsd } from "../lib/utils";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Loader2,
  Slash,
  RotateCcw,
  Trash2,
  Plus,
  Key,
  Eye,
  EyeOff,
  Copy,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
// AgentIcon/AgentIconPicker available if needed
// import { AgentIcon, AgentIconPicker } from "../components/AgentIconPicker";
import { RunTranscriptView, type TranscriptMode } from "../components/transcript/RunTranscriptView";
import { WhatsAppConnect } from "../components/WhatsAppConnect";
import { WhatsAppInbox } from "../components/WhatsAppInbox";
import { GmailConnect } from "../components/GmailConnect";
import {
  isUuidLike,
  type Agent,
  type AgentSkillEntry,
  type AgentSkillSnapshot,
  type AgentDetail as AgentDetailRecord,
  type BudgetPolicySummary,
  type HeartbeatRun,
  type HeartbeatRunEvent,
  type AgentRuntimeState,
  type Issue,
  type LiveEvent,
  type WorkspaceOperation,
} from "@paperclipai/shared";
import { redactHomePathUserSegments, redactHomePathUserSegmentsInValue } from "@paperclipai/adapter-utils";
import { agentRouteRef } from "../lib/utils";
import {
  applyAgentSkillSnapshot,
  arraysEqual,
  isReadOnlyUnmanagedSkillEntry,
} from "../lib/agent-skills-state";

const runStatusIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  succeeded: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
  running: { icon: Loader2, color: "text-cyan-600 dark:text-cyan-400" },
  queued: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
  timed_out: { icon: Timer, color: "text-orange-600 dark:text-orange-400" },
  cancelled: { icon: Slash, color: "text-neutral-500 dark:text-neutral-400" },
};

// Avatar gradients are now computed per-agent from agent.id via
// agentAvatarGradient() — see ../lib/team-grouping. This preserves the
// previous "distinct palette per agent" feel but makes collisions impossible
// between two agents that happen to share initials.

const REDACTED_ENV_VALUE = "***REDACTED***";
const SECRET_ENV_KEY_RE =
  /(api[-_]?key|access[-_]?token|auth(?:_?token)?|authorization|bearer|secret|passwd|password|credential|jwt|private[-_]?key|cookie|connectionstring)/i;
const JWT_VALUE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/;

function redactPathText(value: string, censorUsernameInLogs: boolean) {
  return redactHomePathUserSegments(value, { enabled: censorUsernameInLogs });
}

function redactPathValue<T>(value: T, censorUsernameInLogs: boolean): T {
  return redactHomePathUserSegmentsInValue(value, { enabled: censorUsernameInLogs });
}

function shouldRedactSecretValue(key: string, value: unknown): boolean {
  if (SECRET_ENV_KEY_RE.test(key)) return true;
  if (typeof value !== "string") return false;
  return JWT_VALUE_RE.test(value);
}

function redactEnvValue(key: string, value: unknown, censorUsernameInLogs: boolean): string {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "secret_ref"
  ) {
    return "***SECRET_REF***";
  }
  if (shouldRedactSecretValue(key, value)) return REDACTED_ENV_VALUE;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return redactPathText(value, censorUsernameInLogs);
  try {
    return JSON.stringify(redactPathValue(value, censorUsernameInLogs));
  } catch {
    return redactPathText(String(value), censorUsernameInLogs);
  }
}

function isMarkdown(pathValue: string) {
  return pathValue.toLowerCase().endsWith(".md");
}

function formatEnvForDisplay(envValue: unknown, censorUsernameInLogs: boolean): string {
  const env = asRecord(envValue);
  if (!env) return "<unable-to-parse>";

  const keys = Object.keys(env);
  if (keys.length === 0) return "<empty>";

  return keys
    .sort()
    .map((key) => `${key}=${redactEnvValue(key, env[key], censorUsernameInLogs)}`)
    .join("\n");
}

const sourceLabels: Record<string, string> = {
  timer: "Scheduled",
  assignment: "Assigned",
  on_demand: "Manual",
  automation: "Automation",
};

const LIVE_SCROLL_BOTTOM_TOLERANCE_PX = 32;
type ScrollContainer = Window | HTMLElement;

function isWindowContainer(container: ScrollContainer): container is Window {
  return container === window;
}

function isElementScrollContainer(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

function findScrollContainer(anchor: HTMLElement | null): ScrollContainer {
  let parent = anchor?.parentElement ?? null;
  while (parent) {
    if (isElementScrollContainer(parent)) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function readScrollMetrics(container: ScrollContainer): { scrollHeight: number; distanceFromBottom: number } {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const viewportBottom = window.scrollY + window.innerHeight;
    return {
      scrollHeight: pageHeight,
      distanceFromBottom: Math.max(0, pageHeight - viewportBottom),
    };
  }

  const viewportBottom = container.scrollTop + container.clientHeight;
  return {
    scrollHeight: container.scrollHeight,
    distanceFromBottom: Math.max(0, container.scrollHeight - viewportBottom),
  };
}

function scrollToContainerBottom(container: ScrollContainer, behavior: ScrollBehavior = "auto") {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    window.scrollTo({ top: pageHeight, behavior });
    return;
  }

  container.scrollTo({ top: container.scrollHeight, behavior });
}

type AgentDetailView =
  | "dashboard"          // → Home tab
  | "instructions"       // legacy, still routable
  | "configuration"      // → Settings tab
  | "skills"             // legacy, still routable
  | "runs"               // legacy Activity (reachable via URL only)
  | "budget"
  | "learnings"
  | "whatsapp"           // → Messages tab
  | "training"           // new
  | "schedule";          // new

function parseAgentDetailView(value: string | null): AgentDetailView {
  if (value === "instructions" || value === "prompts") return "instructions";
  if (value === "configure" || value === "configuration" || value === "settings") return "configuration";
  if (value === "skills") return "skills";
  if (value === "budget") return "budget";
  if (value === "runs") return value;
  if (value === "learnings") return "learnings";
  if (value === "whatsapp" || value === "messages") return "whatsapp";
  if (value === "training") return "training";
  if (value === "schedule") return "schedule";
  return "dashboard";
}

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function setsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function runMetrics(run: HeartbeatRun) {
  const usage = (run.usageJson ?? null) as Record<string, unknown> | null;
  const result = (run.resultJson ?? null) as Record<string, unknown> | null;
  const input = usageNumber(usage, "inputTokens", "input_tokens");
  const output = usageNumber(usage, "outputTokens", "output_tokens");
  const cached = usageNumber(
    usage,
    "cachedInputTokens",
    "cached_input_tokens",
    "cache_read_input_tokens",
  );
  const cost =
    visibleRunCostUsd(usage, result);
  return {
    input,
    output,
    cached,
    cost,
    totalTokens: input + output,
  };
}

type RunLogChunk = { ts: string; stream: "stdout" | "stderr" | "system"; chunk: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseStoredLogContent(content: string): RunLogChunk[] {
  const parsed: RunLogChunk[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
      const stream =
        raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
      const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
      const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
      if (!chunk) continue;
      parsed.push({ ts, stream, chunk });
    } catch {
      // Ignore malformed log lines.
    }
  }
  return parsed;
}

function workspaceOperationPhaseLabel(phase: WorkspaceOperation["phase"]) {
  switch (phase) {
    case "worktree_prepare":
      return "Worktree setup";
    case "workspace_provision":
      return "Provision";
    case "workspace_teardown":
      return "Teardown";
    case "worktree_cleanup":
      return "Worktree cleanup";
    default:
      return phase;
  }
}

function workspaceOperationStatusTone(status: WorkspaceOperation["status"]) {
  switch (status) {
    case "succeeded":
      return "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300";
    case "failed":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
    case "running":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
    case "skipped":
      return "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function WorkspaceOperationStatusBadge({ status }: { status: WorkspaceOperation["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        workspaceOperationStatusTone(status),
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function WorkspaceOperationLogViewer({
  operation,
  censorUsernameInLogs,
}: {
  operation: WorkspaceOperation;
  censorUsernameInLogs: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: logData, isLoading, error } = useQuery({
    queryKey: ["workspace-operation-log", operation.id],
    queryFn: () => heartbeatsApi.workspaceOperationLog(operation.id),
    enabled: open && Boolean(operation.logRef),
    refetchInterval: open && operation.status === "running" ? 2000 : false,
  });

  const chunks = useMemo(
    () => (logData?.content ? parseStoredLogContent(logData.content) : []),
    [logData?.content],
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide full log" : "Show full log"}
      </button>
      {open && (
        <div className="rounded-md border border-border bg-background/70 p-2">
          {isLoading && <div className="text-xs text-muted-foreground">Loading log...</div>}
          {error && (
            <div className="text-xs text-destructive">
              {error instanceof Error ? error.message : "Failed to load workspace operation log"}
            </div>
          )}
          {!isLoading && !error && chunks.length === 0 && (
            <div className="text-xs text-muted-foreground">No persisted log lines.</div>
          )}
          {chunks.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-950">
              {chunks.map((chunk, index) => (
                <div key={`${chunk.ts}-${index}`} className="flex gap-2">
                  <span className="shrink-0 text-neutral-500">
                    {new Date(chunk.ts).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-4",
                      chunk.stream === "stderr"
                        ? "text-red-600 dark:text-red-300"
                        : chunk.stream === "system"
                          ? "text-blue-600 dark:text-blue-300"
                          : "text-muted-foreground",
                    )}
                  >
                    {chunk.stream === "stderr" ? "!" : ""}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{redactPathText(chunk.chunk, censorUsernameInLogs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceOperationsSection({
  operations,
  censorUsernameInLogs,
}: {
  operations: WorkspaceOperation[];
  censorUsernameInLogs: boolean;
}) {
  if (operations.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        Workspace ({operations.length})
      </div>
      <div className="space-y-3">
        {operations.map((operation) => {
          const metadata = asRecord(operation.metadata);
          return (
            <div key={operation.id} className="rounded-md border border-border/70 bg-background/70 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{workspaceOperationPhaseLabel(operation.phase)}</div>
                <WorkspaceOperationStatusBadge status={operation.status} />
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(operation.startedAt)}
                  {operation.finishedAt && ` to ${relativeTime(operation.finishedAt)}`}
                </div>
              </div>
              {operation.command && (
                <div className="text-xs break-all">
                  <span className="text-muted-foreground">Command: </span>
                  <span>{operation.command}</span>
                </div>
              )}
              {operation.cwd && (
                <div className="text-xs break-all">
                  <span className="text-muted-foreground">Working dir: </span>
                  <span>{operation.cwd}</span>
                </div>
              )}
              {(asNonEmptyString(metadata?.branchName)
                || asNonEmptyString(metadata?.baseRef)
                || asNonEmptyString(metadata?.worktreePath)
                || asNonEmptyString(metadata?.repoRoot)
                || asNonEmptyString(metadata?.cleanupAction)) && (
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {asNonEmptyString(metadata?.branchName) && (
                    <div><span className="text-muted-foreground">Branch: </span><span>{metadata?.branchName as string}</span></div>
                  )}
                  {asNonEmptyString(metadata?.baseRef) && (
                    <div><span className="text-muted-foreground">Base ref: </span><span>{metadata?.baseRef as string}</span></div>
                  )}
                  {asNonEmptyString(metadata?.worktreePath) && (
                    <div className="break-all"><span className="text-muted-foreground">Worktree: </span><span>{metadata?.worktreePath as string}</span></div>
                  )}
                  {asNonEmptyString(metadata?.repoRoot) && (
                    <div className="break-all"><span className="text-muted-foreground">Repo root: </span><span>{metadata?.repoRoot as string}</span></div>
                  )}
                  {asNonEmptyString(metadata?.cleanupAction) && (
                    <div><span className="text-muted-foreground">Cleanup: </span><span>{metadata?.cleanupAction as string}</span></div>
                  )}
                </div>
              )}
              {typeof metadata?.created === "boolean" && (
                <div className="text-xs text-muted-foreground">
                  {metadata.created ? "Created by this run" : "Reused existing workspace"}
                </div>
              )}
              {operation.stderrExcerpt && operation.stderrExcerpt.trim() && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  Agent encountered an issue during this operation.
                </div>
              )}
              {operation.logRef && (
                <WorkspaceOperationLogViewer
                  operation={operation}
                  censorUsernameInLogs={censorUsernameInLogs}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentDetail() {
  const { companyPrefix, agentId, tab: urlTab, runId: urlRunId } = useParams<{
    companyPrefix?: string;
    agentId: string;
    tab?: string;
    runId?: string;
  }>();
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { closePanel } = usePanel();
  const { openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const activeView = urlRunId ? "runs" as AgentDetailView : parseAgentDetailView(urlTab ?? null);
  const needsDashboardData = activeView === "dashboard";
  const needsRunData = activeView === "runs" || Boolean(urlRunId);
  const shouldLoadHeartbeats = needsDashboardData || needsRunData;
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const saveConfigActionRef = useRef<(() => void) | null>(null);
  const cancelConfigActionRef = useRef<(() => void) | null>(null);
  const { isMobile } = useSidebar();
  const routeAgentRef = agentId ?? "";
  const routeCompanyId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);
  const lookupCompanyId = routeCompanyId ?? selectedCompanyId ?? undefined;
  const canFetchAgent = routeAgentRef.length > 0 && (isUuidLike(routeAgentRef) || Boolean(lookupCompanyId));
  const setSaveConfigAction = useCallback((fn: (() => void) | null) => { saveConfigActionRef.current = fn; }, []);
  const setCancelConfigAction = useCallback((fn: (() => void) | null) => { cancelConfigActionRef.current = fn; }, []);

  const { data: agent, isLoading, error } = useQuery<AgentDetailRecord>({
    queryKey: [...queryKeys.agents.detail(routeAgentRef), lookupCompanyId ?? null],
    queryFn: () => agentsApi.get(routeAgentRef, lookupCompanyId),
    enabled: canFetchAgent,
  });
  const resolvedCompanyId = agent?.companyId ?? selectedCompanyId;
  const canonicalAgentRef = agent ? agentRouteRef(agent) : routeAgentRef;
  const agentLookupRef = agent?.id ?? routeAgentRef;
  const resolvedAgentId = agent?.id ?? null;

  const { data: runtimeState } = useQuery({
    queryKey: queryKeys.agents.runtimeState(resolvedAgentId ?? routeAgentRef),
    queryFn: () => agentsApi.runtimeState(resolvedAgentId!, resolvedCompanyId ?? undefined),
    enabled: Boolean(resolvedAgentId) && needsDashboardData,
  });

  const { data: heartbeats } = useQuery({
    queryKey: queryKeys.heartbeats(resolvedCompanyId!, agent?.id ?? undefined),
    queryFn: () => heartbeatsApi.list(resolvedCompanyId!, agent?.id ?? undefined),
    enabled: !!resolvedCompanyId && !!agent?.id && shouldLoadHeartbeats,
  });

  const { data: allIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(resolvedCompanyId!), "participant-agent", resolvedAgentId ?? "__none__"],
    queryFn: () => issuesApi.list(resolvedCompanyId!, { participantAgentId: resolvedAgentId! }),
    enabled: !!resolvedCompanyId && !!resolvedAgentId && needsDashboardData,
  });

  const { data: allAgents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId && needsDashboardData,
  });

  const { data: budgetOverview } = useQuery({
    queryKey: queryKeys.budgets.overview(resolvedCompanyId ?? "__none__"),
    queryFn: () => budgetsApi.overview(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const assignedIssues = (allIssues ?? [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const reportsToAgent = (allAgents ?? []).find((a) => a.id === agent?.reportsTo);
  const directReports = (allAgents ?? []).filter((a) => a.reportsTo === agent?.id && a.status !== "terminated");
  const agentBudgetSummary = useMemo(() => {
    const matched = budgetOverview?.policies.find(
      (policy) => policy.scopeType === "agent" && policy.scopeId === (agent?.id ?? routeAgentRef),
    );
    if (matched) return matched;
    const budgetMonthlyCents = agent?.budgetMonthlyCents ?? 0;
    const spentMonthlyCents = agent?.spentMonthlyCents ?? 0;
    return {
      policyId: "",
      companyId: resolvedCompanyId ?? "",
      scopeType: "agent",
      scopeId: agent?.id ?? routeAgentRef,
      scopeName: agent?.name ?? "Agent",
      metric: "billed_cents",
      windowKind: "calendar_month_utc",
      amount: budgetMonthlyCents,
      observedAmount: spentMonthlyCents,
      remainingAmount: Math.max(0, budgetMonthlyCents - spentMonthlyCents),
      utilizationPercent:
        budgetMonthlyCents > 0 ? Number(((spentMonthlyCents / budgetMonthlyCents) * 100).toFixed(2)) : 0,
      warnPercent: 80,
      hardStopEnabled: true,
      notifyEnabled: true,
      isActive: budgetMonthlyCents > 0,
      status: budgetMonthlyCents > 0 && spentMonthlyCents >= budgetMonthlyCents ? "hard_stop" : "ok",
      paused: agent?.status === "paused",
      pauseReason: agent?.pauseReason ?? null,
      windowStart: new Date(),
      windowEnd: new Date(),
    } satisfies BudgetPolicySummary;
  }, [agent, budgetOverview?.policies, resolvedCompanyId, routeAgentRef]);
  const mobileLiveRun = useMemo(
    () => (heartbeats ?? []).find((r) => r.status === "running" || r.status === "queued") ?? null,
    [heartbeats],
  );

  useEffect(() => {
    if (!agent) return;
    if (urlRunId) {
      if (routeAgentRef !== canonicalAgentRef) {
        navigate(`/agents/${canonicalAgentRef}/runs/${urlRunId}`, { replace: true });
      }
      return;
    }
    const canonicalTab: string =
      activeView === "instructions" ? "instructions"
      : activeView === "configuration" ? "configuration"
      : activeView === "skills" ? "skills"
      : activeView === "runs" ? "runs"
      : activeView === "budget" ? "budget"
      : activeView === "whatsapp" ? "whatsapp"
      : activeView === "learnings" ? "learnings"
      : activeView === "training" ? "training"
      : activeView === "schedule" ? "schedule"
      : "dashboard";
    if (routeAgentRef !== canonicalAgentRef || urlTab !== canonicalTab) {
      navigate(`/agents/${canonicalAgentRef}/${canonicalTab}`, { replace: true });
      return;
    }
  }, [agent, routeAgentRef, canonicalAgentRef, urlRunId, urlTab, activeView, navigate]);

  useEffect(() => {
    if (!agent?.companyId || agent.companyId === selectedCompanyId) return;
    setSelectedCompanyId(agent.companyId, { source: "route_sync" });
  }, [agent?.companyId, selectedCompanyId, setSelectedCompanyId]);

  const agentAction = useMutation({
    mutationFn: async (action: "invoke" | "pause" | "resume" | "terminate") => {
      if (!agentLookupRef) return Promise.reject(new Error("No agent reference"));
      switch (action) {
        case "invoke": return agentsApi.invoke(agentLookupRef, resolvedCompanyId ?? undefined);
        case "pause": return agentsApi.pause(agentLookupRef, resolvedCompanyId ?? undefined);
        case "resume": return agentsApi.resume(agentLookupRef, resolvedCompanyId ?? undefined);
        case "terminate": return agentsApi.terminate(agentLookupRef, resolvedCompanyId ?? undefined);
      }
    },
    onSuccess: (data, action) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(routeAgentRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentLookupRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(agentLookupRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(agentLookupRef) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(resolvedCompanyId) });
        if (agent?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(resolvedCompanyId, agent.id) });
        }
      }
      if (action === "invoke" && data && typeof data === "object" && "id" in data) {
        navigate(`/agents/${canonicalAgentRef}/runs/${(data as HeartbeatRun).id}`);
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Action failed");
    },
  });

  const budgetMutation = useMutation({
    mutationFn: (amount: number) =>
      budgetsApi.upsertPolicy(resolvedCompanyId!, {
        scopeType: "agent",
        scopeId: agent?.id ?? routeAgentRef,
        amount,
        windowKind: "calendar_month_utc",
      }),
    onSuccess: () => {
      if (!resolvedCompanyId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.overview(resolvedCompanyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(routeAgentRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentLookupRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(resolvedCompanyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(resolvedCompanyId) });
    },
  });

  const updateIcon = useMutation({
    mutationFn: (icon: string) => agentsApi.update(agentLookupRef, { icon }, resolvedCompanyId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(routeAgentRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentLookupRef) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(resolvedCompanyId) });
      }
    },
  });

  const resetTaskSession = useMutation({
    mutationFn: (taskKey: string | null) =>
      agentsApi.resetSession(agentLookupRef, taskKey, resolvedCompanyId ?? undefined),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(agentLookupRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(agentLookupRef) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reset session");
    },
  });

  const updatePermissions = useMutation({
    mutationFn: (permissions: AgentPermissionUpdate) =>
      agentsApi.updatePermissions(agentLookupRef, permissions, resolvedCompanyId ?? undefined),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(routeAgentRef) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentLookupRef) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(resolvedCompanyId) });
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to update permissions");
    },
  });

  useEffect(() => {
    const crumbs: { label: string; href?: string }[] = [
      { label: "Agents", href: "/agents" },
    ];
    // Prefer the resolved agent display name; only fall back to the URL slug
    // when we haven't fetched the agent yet. Always capitalize the first letter
    // so the browser tab title doesn't flash a lowercase slug like "saif".
    const rawName = agent?.name ?? routeAgentRef ?? "Agent";
    const agentName = rawName.length > 0
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
      : rawName;
    if (activeView === "dashboard" && !urlRunId) {
      crumbs.push({ label: agentName });
    } else {
      crumbs.push({ label: agentName, href: `/agents/${canonicalAgentRef}/dashboard` });
      if (urlRunId) {
        crumbs.push({ label: "History", href: `/agents/${canonicalAgentRef}/runs` });
        crumbs.push({ label: "Run Details" });
      } else if (activeView === "instructions") {
        crumbs.push({ label: "Instructions" });
      } else if (activeView === "configuration") {
        crumbs.push({ label: "Settings" });
      // } else if (activeView === "skills") { // TODO: bring back later
      //   crumbs.push({ label: "Skills" });
      } else if (activeView === "runs") {
        crumbs.push({ label: "History" });
      } else if (activeView === "budget") {
        crumbs.push({ label: "Budget" });
      } else {
        crumbs.push({ label: "Dashboard" });
      }
    }
    setBreadcrumbs(crumbs);
  }, [setBreadcrumbs, agent, routeAgentRef, canonicalAgentRef, activeView, urlRunId]);

  // Browser tab title — wait for the agent to load so we never flash the raw
  // lowercase URL slug (e.g. "saif · Agents · Aygency World"). Setting
  // document.title here runs AFTER the breadcrumb effect above, so this wins.
  useEffect(() => {
    if (!agent?.name) return;
    const name = agent.name;
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const prev = document.title;
    document.title = `${capitalized} · Agents · Aygency World`;
    return () => {
      document.title = prev;
    };
  }, [agent?.name]);

  useEffect(() => {
    closePanel();
    return () => closePanel();
  }, [closePanel]);

  useBeforeUnload(
    useCallback((event) => {
      if (!configDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }, [configDirty]),
  );

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!agent) return null;
  if (!urlRunId && !urlTab) {
    return <Navigate to={`/agents/${canonicalAgentRef}/dashboard`} replace />;
  }
  const isPendingApproval = agent.status === "pending_approval";
  const showConfigActionBar = (activeView === "configuration" || activeView === "instructions") && (configDirty || configSaving);

  // Avatar gradient + initials are derived from a stable per-agent key (agent.id)
  // so two agents with the same initials (e.g. "Claire" + "Clive" → "CL") get
  // distinct colours, and initials themselves differentiate when there's a
  // collision in the broader roster. For a single-agent detail view we can't
  // detect collisions, so we pass the role as a disambiguator always — initials
  // fall back to first-letter-of-name + first-letter-of-role only on collision.
  const agentGradient = agentAvatarGradient(agent.id || agent.name);
  const agentInitialsText = agentInitials(agent.name, agent.role);
  const isAgentWorking = agent.status === "running" || agent.status === "active" || !!mobileLiveRun;
  const isAgentPaused = agent.status === "paused" || agent.status === "error";

  return (
    <div className={cn("flex flex-col h-full", isMobile && showConfigActionBar && "pb-24")}>
      {/* PageHeader with gradient avatar */}
      <div className="h-[50px] shrink-0 flex items-center px-5 border-b border-border/40 gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-[7px] text-white text-[10px] font-bold"
          style={{
            width: 26,
            height: 26,
            background: agentGradient,
          }}
        >
          {agentInitialsText}
        </div>
        <h1 className="text-[14px] font-bold tracking-[-0.02em] text-foreground truncate">
          {agent.name}
        </h1>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap shrink-0",
            isAgentWorking
              ? "text-green-600 dark:text-green-400"
              : isAgentPaused
                ? "text-red-500 dark:text-red-400"
                : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isAgentWorking
                ? "bg-green-500"
                : isAgentPaused
                  ? "bg-red-500"
                  : "bg-muted-foreground/50"
            )}
          />
          {isAgentWorking ? "Working" : isAgentPaused ? (agent.status === "error" ? "Error" : "Paused") : "Idle"}
        </span>
        {agent.lastHeartbeatAt && (
          <span className="text-[10.5px] text-muted-foreground shrink-0">
            Last run {relativeTime(agent.lastHeartbeatAt)}
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <PauseResumeButton
            isPaused={agent.status === "paused"}
            onPause={() => agentAction.mutate("pause")}
            onResume={() => agentAction.mutate("resume")}
            disabled={agentAction.isPending || isPendingApproval}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewIssue({ assigneeAgentId: agent.id })}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">
              Assign task
            </span>
          </Button>
          {/* Overflow menu */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="end">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  agentAction.mutate("invoke");
                  setMoreOpen(false);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Wake Up
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  navigator.clipboard.writeText(agent.id);
                  setMoreOpen(false);
                }}
              >
                <Copy className="h-3 w-3" />
                Copy Agent ID
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  resetTaskSession.mutate(null);
                  setMoreOpen(false);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset Memory
              </button>
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                onClick={() => {
                  agentAction.mutate("terminate");
                  setMoreOpen(false);
                }}
              >
                <Trash2 className="h-3 w-3" />
                Terminate
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tab bar */}
      {!urlRunId && (
        <div className="flex border-b border-border/40 px-5 gap-0.5">
          {(((): readonly { value: string; label: string }[] => {
            const base: { value: string; label: string }[] = [{ value: "dashboard", label: "Home" }];
            // Show Messages tab for ALL agents so the tab set is uniform across
            // the roster. Agents without messaging capability render an empty
            // state inside the tab — see `canMessage` check below.
            base.push({ value: "whatsapp", label: "Messages" });
            base.push({ value: "training", label: "Training" });
            base.push({ value: "schedule", label: "Schedule" });
            base.push({ value: "configuration", label: "Settings" });
            return base;
          })()).map((t) => (
            <button
              key={t.value}
              data-testid={t.value === "whatsapp" ? "agent-tab-whatsapp" : undefined}
              className={cn(
                "py-2.5 px-3 text-sm font-semibold cursor-pointer border-b-2 transition-colors",
                activeView === t.value
                  ? "text-primary border-b-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
              onClick={() => navigate(`/agents/${canonicalAgentRef}/${t.value}`)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* WhatsApp tab — edge-to-edge, no padding */}
      {activeView === "whatsapp" && (() => {
        const canMessage = agent.role === "sales" || agent.role === "viewing" || agent.role === "content";
        return (
          <div className="flex-1 overflow-hidden">
            {canMessage ? (
              <WhatsAppInbox agentId={agent.id} />
            ) : (
              <div className="h-full flex items-center justify-center px-6">
                <div className="max-w-sm text-center">
                  <p className="text-[13px] font-semibold text-foreground/80">
                    This agent doesn't send messages.
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground leading-[1.5]">
                    Only sales, viewing, and content agents use the Messages inbox.
                    {" "}This {agent.role ?? "agent"} works through other channels.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Scrollable content area (all tabs except WhatsApp) */}
      {activeView !== "whatsapp" && (
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-6">
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          {isPendingApproval && (
            <p className="text-sm text-amber-500">
              This agent is waiting for your approval before it can start working.
            </p>
          )}

          {/* Floating Save/Cancel (desktop) */}
          {!isMobile && (
            <div
              className={cn(
                "sticky top-2 z-10 float-right transition-opacity duration-150",
                showConfigActionBar
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              )}
            >
              <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelConfigActionRef.current?.()}
                  disabled={configSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveConfigActionRef.current?.()}
                  disabled={configSaving}
                >
                  {configSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Mobile bottom Save/Cancel bar */}
          {isMobile && showConfigActionBar && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
              <div
                className="flex items-center justify-end gap-2 px-3 py-2"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelConfigActionRef.current?.()}
                  disabled={configSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveConfigActionRef.current?.()}
                  disabled={configSaving}
                >
                  {configSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* View content */}
          {activeView === "dashboard" && (
            <AgentOverview
              agent={agent}
              runs={heartbeats ?? []}
              assignedIssues={assignedIssues}
              runtimeState={runtimeState}
              agentId={agent.id}
              agentRouteId={canonicalAgentRef}
            />
          )}

          {activeView === "instructions" && (
            <PromptsTab
              agent={agent}
              companyId={resolvedCompanyId ?? undefined}
              onDirtyChange={setConfigDirty}
              onSaveActionChange={setSaveConfigAction}
              onCancelActionChange={setCancelConfigAction}
              onSavingChange={setConfigSaving}
            />
          )}

          {activeView === "training" && resolvedCompanyId && (
            <AgentTrainingTab
              agentId={agent.id}
              companyId={resolvedCompanyId}
              agentRole={agent.role}
            />
          )}

          {activeView === "schedule" && resolvedCompanyId && (
            <AgentScheduleTab
              agentId={agent.id}
              companyId={resolvedCompanyId}
            />
          )}

          {activeView === "configuration" && (
            <AgentSettingsSimplified
              agent={agent}
              companyId={resolvedCompanyId ?? undefined}
            />
          )}

          {activeView === "skills" && (
            <AgentSkillsTab
              agent={agent}
              companyId={resolvedCompanyId ?? undefined}
            />
          )}

          {activeView === "learnings" && resolvedCompanyId && (
            <AgentLearningsTab
              agentId={agent.id}
              companyId={resolvedCompanyId}
            />
          )}

          {activeView === "runs" && (
            <RunsTab
              runs={heartbeats ?? []}
              companyId={resolvedCompanyId!}
              agentId={agent.id}
              agentRouteId={canonicalAgentRef}
              selectedRunId={urlRunId ?? null}
              adapterType={agent.adapterType}
            />
          )}

          {activeView === "budget" && resolvedCompanyId ? (
            <div className="max-w-3xl">
              <BudgetPolicyCard
                summary={agentBudgetSummary}
                isSaving={budgetMutation.isPending}
                onSave={(amount) => budgetMutation.mutate(amount)}
                variant="plain"
              />
            </div>
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}

/* ---- Helper components ---- */

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function LatestRunCard({ runs, agentId }: { runs: HeartbeatRun[]; agentId: string }) {
  if (runs.length === 0) return null;

  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const liveRun = sorted.find((r) => r.status === "running" || r.status === "queued");
  const run = liveRun ?? sorted[0];
  const isLive = run.status === "running" || run.status === "queued";
  const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const StatusIcon = statusInfo.icon;
  const summaryRaw = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  // Extract a clean 2-3 line excerpt: first non-empty, non-header, non-list-mark lines
  const summary = useMemo(() => {
    if (!summaryRaw) return "";
    const lines = summaryRaw
      .replace(/^#{1,6}\s+/gm, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("|") && !l.startsWith("```") && !/^[-*>]/.test(l) && !/^\d+\./.test(l));
    const excerpt: string[] = [];
    let chars = 0;
    for (const line of lines) {
      if (excerpt.length >= 3 || chars + line.length > 280) break;
      excerpt.push(line);
      chars += line.length;
    }
    return excerpt.join(" ");
  }, [summaryRaw]);

  return (
    <div className="space-y-3">
      <div className="flex w-full items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
          )}
          {isLive ? "Live Run" : "Latest Run"}
        </h3>
        <Link
          to={`/agents/${agentId}/runs/${run.id}`}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          View details &rarr;
        </Link>
      </div>

      <Link
        to={`/agents/${agentId}/runs/${run.id}`}
        className={cn(
          "block border rounded-lg p-4 space-y-2 w-full no-underline transition-colors hover:bg-muted/50 cursor-pointer",
          isLive ? "border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.08)]" : "border-border"
        )}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-3.5 w-3.5", statusInfo.color, run.status === "running" && "animate-spin")} />
          <StatusBadge status={run.status} />
          <span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
              : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
              : "bg-muted text-muted-foreground"
          )}>
            {sourceLabels[run.invocationSource] ?? run.invocationSource}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{relativeTime(run.createdAt)}</span>
        </div>

        {summary && (
          <div className="overflow-hidden max-h-16">
            <MarkdownBody className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{summary}</MarkdownBody>
          </div>
        )}
      </Link>
    </div>
  );
}

/* ---- Agent Overview (main single-page view) ---- */

function AgentStatsCard({ companyId, agentId }: { companyId: string; agentId: string }) {
  const { data: stats } = useQuery<AgentStats>({
    queryKey: ["agent-stats", companyId, agentId],
    queryFn: () => agentsApi.stats(companyId, agentId),
    enabled: !!companyId && !!agentId,
  });

  if (!stats) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Task Completion</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {stats.doneTasks}/{stats.totalTasks} done
        </span>
      </div>
      <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${stats.completionRate}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Completion rate</span>
          <span className="ml-2 font-semibold tabular-nums">{stats.completionRate}%</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total runs</span>
          <span className="ml-2 font-semibold tabular-nums">{stats.totalRuns}</span>
        </div>
      </div>
      {stats.lastRunAt && (
        <div className="text-[11px] text-muted-foreground">
          Last run: {relativeTime(stats.lastRunAt)}
        </div>
      )}
    </div>
  );
}

function AutoApproveToggle({ agent }: { agent: AgentDetailRecord }) {
  const queryClient = useQueryClient();
  const meta = (agent.metadata ?? {}) as Record<string, unknown>;
  const current = meta.autoApprove === true;

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => agentsApi.setAutoApprove(agent.id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["agents", agent.companyId] });
    },
  });

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold">Auto-reply mode</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {current
              ? "Outbound messages send automatically without approval."
              : "Every outbound message waits for your approval in CEO Chat."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={current}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(!current)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
            current ? "bg-primary" : "bg-muted",
            mutation.isPending && "opacity-50 cursor-wait",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              current ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
    </div>
  );
}

interface ProfileTemplate {
  id: string;
  name: string;
  tagline: string;
  appliesToRole: string;
  config: {
    goal: string;
    tone?: string;
    cadence?: string;
    handoffRules?: string;
    dontDo?: string;
  };
  isStock: boolean;
}

function ProfileCard({ agentId, companyId }: { agentId: string; companyId: string }) {
  // Fetch current profile
  const { data: current } = useQuery<{ profile: ProfileTemplate | null }>({
    queryKey: ["agent-profile", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/profile`, { credentials: "include" });
      if (!res.ok) return { profile: null };
      return res.json();
    },
  });
  // Fetch available templates for sales
  const { data: templates } = useQuery<ProfileTemplate[]>({
    queryKey: ["profile-templates", companyId, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/profile-templates?role=sales`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-profile", agentId] });
      setPicking(false);
    },
  });

  const profile = current?.profile;
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">Profile</div>
          {profile ? (
            <div className="mt-1">
              <div className="text-[12.5px] font-medium">{profile.name}</div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">{profile.tagline}</div>
              <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                <span className="font-medium">Goal:</span> {profile.config.goal}
              </div>
            </div>
          ) : (
            <div className="text-[11.5px] text-muted-foreground mt-0.5">
              Using role defaults. Ask CEO to set up a profile, or pick one below.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border hover:bg-accent/50 shrink-0"
        >
          {picking ? "Cancel" : profile ? "Switch" : "Pick one"}
        </button>
      </div>
      {picking && templates && templates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={applyMutation.isPending}
              onClick={() => applyMutation.mutate(t.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border border-border/40 hover:border-primary/50 hover:bg-accent/30 transition-colors",
                profile?.id === t.id && "border-primary bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-medium">{t.name}</div>
                {t.isStock && <span className="text-[10px] text-muted-foreground">stock</span>}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.tagline}</div>
            </button>
          ))}
          <div className="text-[11px] text-muted-foreground mt-2 px-1">
            Want a custom profile? Ask the CEO in chat — they'll walk you through it.
          </div>
        </div>
      )}
    </div>
  );
}

function ClearQueueButton({ agentId, agentName, companyId }: { agentId: string; agentName: string; companyId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/clear-queue`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ approvalsDeclined: number; tasksCancelled: number }>;
    },
    onSuccess: () => {
      // Refresh anything that might be showing stale counts.
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey[0];
        return k === "agents" || k === "approvals" || k === "issues" || k === "sidebar-badges";
      }});
    },
  });

  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Clear everything in ${agentName}'s queue? This cancels pending tasks and declines pending approvals.`)) {
          mutation.mutate();
        }
      }}
      disabled={mutation.isPending}
      className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
    >
      {mutation.isPending ? "Clearing..." : "Clear queue"}
    </button>
  );
}

function AgentOverview({
  agent,
  runs,
  assignedIssues,
  runtimeState,
  agentId,
  agentRouteId,
}: {
  agent: AgentDetailRecord;
  runs: HeartbeatRun[];
  assignedIssues: Issue[];
  runtimeState?: AgentRuntimeState;
  agentId: string;
  agentRouteId: string;
}) {
  const [showRecentTasks, setShowRecentTasks] = useState(false);

  // ── Runs / heartbeat stats ──
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [runs],
  );
  const liveRun = sortedRuns.find((r) => r.status === "running" || r.status === "queued");
  const currentRun = liveRun ?? sortedRuns[0];
  const isLiveRun = currentRun && (currentRun.status === "running" || currentRun.status === "queued");

  const thirtyDayRuns = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return runs.filter((r) => new Date(r.createdAt).getTime() > cutoff);
  }, [runs]);

  const totalRuns30d = thirtyDayRuns.length;
  const succeededRuns30d = thirtyDayRuns.filter((r) => r.status === "succeeded").length;
  const successRate = totalRuns30d > 0 ? Math.round((succeededRuns30d / totalRuns30d) * 100) : 0;
  const totalSpend30d = useMemo(
    () => thirtyDayRuns.reduce((sum, r) => sum + runMetrics(r).cost, 0),
    [thirtyDayRuns],
  );

  // ── Task bucketing — the new core of this page ──
  // Active   = in_progress or in_review
  // Queued   = todo, backlog, or blocked
  // Recent   = done or cancelled (completed work)
  const { activeTasks, queuedTasks, recentTasks, doneThisWeek } = useMemo(() => {
    const active: Issue[] = [];
    const queued: Issue[] = [];
    const recent: Issue[] = [];
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let doneThisWeekCount = 0;

    for (const issue of assignedIssues) {
      switch (issue.status) {
        case "in_progress":
        case "in_review":
          active.push(issue);
          break;
        case "todo":
        case "backlog":
        case "blocked":
          queued.push(issue);
          break;
        case "done":
        case "cancelled":
          recent.push(issue);
          if (issue.status === "done" && issue.completedAt) {
            const completed = new Date(issue.completedAt).getTime();
            if (completed > oneWeekAgo) doneThisWeekCount += 1;
          }
          break;
      }
    }

    // Active: most recently started / updated first
    active.sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : new Date(a.updatedAt).getTime();
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
    // Queued: priority first, then newest
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    queued.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // Recent: most recently completed first
    recent.sort((a, b) => {
      const aTime = a.completedAt
        ? new Date(a.completedAt).getTime()
        : a.cancelledAt
          ? new Date(a.cancelledAt).getTime()
          : new Date(a.updatedAt).getTime();
      const bTime = b.completedAt
        ? new Date(b.completedAt).getTime()
        : b.cancelledAt
          ? new Date(b.cancelledAt).getTime()
          : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });

    return {
      activeTasks: active,
      queuedTasks: queued,
      recentTasks: recent,
      doneThisWeek: doneThisWeekCount,
    };
  }, [assignedIssues]);

  // Which task is currently "live" — correlate heartbeat run to the task it's working on
  const liveRunIssueId = useMemo(() => {
    if (!isLiveRun || !currentRun) return null;
    // HeartbeatRun may have taskId / issueId field; defensive access
    const runRecord = currentRun as unknown as { taskId?: string | null; issueId?: string | null };
    return runRecord.taskId ?? runRecord.issueId ?? null;
  }, [currentRun, isLiveRun]);

  // ── Status header line ──
  const agentFirstName = agent.name?.split(/\s+/)[0] ?? agent.name ?? "this agent";
  const spendThisMonthCents = agent.spentMonthlyCents ?? 0;

  // ── Current run excerpt (kept for the demoted current run strip) ──
  const currentRunSummary = useMemo(() => {
    if (!currentRun) return "";
    const raw = currentRun.resultJson
      ? String((currentRun.resultJson as Record<string, unknown>).summary ?? (currentRun.resultJson as Record<string, unknown>).result ?? "")
      : currentRun.error ?? "";
    if (!raw) return "";
    const lines = raw
      .replace(/^#{1,6}\s+/gm, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("|") && !l.startsWith("```") && !/^[-*>]/.test(l) && !/^\d+\./.test(l));
    const excerpt: string[] = [];
    let chars = 0;
    for (const line of lines) {
      if (excerpt.length >= 2 || chars + line.length > 200) break;
      excerpt.push(line);
      chars += line.length;
    }
    return excerpt.join(" ");
  }, [currentRun]);

  return (
    <div className="space-y-6">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. Agent Status Summary — the "what's this agent doing" line */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isLiveRun ? (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : activeTasks.length > 0 ? (
            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
          )}
          <span className="text-[13px] font-semibold">{agent.name ?? "Agent"}</span>
          <span className="text-[11px] text-muted-foreground">·</span>
          {activeTasks.length > 0 ? (
            <>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">{activeTasks.length} active</span>
              <span className="text-[11px] text-muted-foreground">·</span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground">Idle</span>
              <span className="text-[11px] text-muted-foreground">·</span>
            </>
          )}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {queuedTasks.length} queued
          </span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {doneThisWeek} done this week
          </span>
          {spendThisMonthCents > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                ${(spendThisMonthCents / 100).toFixed(2)} this month
              </span>
            </>
          )}
        </div>
      </div>

      {/* Auto-reply toggle — only visible for sales agents */}
      {agent.role === "sales" && <AutoApproveToggle agent={agent} />}

      {/* Profile card — current role configuration */}
      {agent.role === "sales" && <ProfileCard agentId={agentId} companyId={agent.companyId} />}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. Active Work — the 3 bucketed task sections                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* 2a. Active bucket */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active
              </h3>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {activeTasks.length}
              </span>
            </div>
            {activeTasks.length > 5 && (
              <Link
                to={`/issues?participantAgentId=${agentId}&filter=active`}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline"
              >
                Show all {activeTasks.length}
              </Link>
            )}
          </div>
          {activeTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 px-4 py-5 text-[12px] text-muted-foreground text-center">
              Nothing active — {agentFirstName} is idle
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {activeTasks.slice(0, 5).map((issue) => {
                const isLiveOnThisTask = liveRunIssueId === issue.id;
                // Dead-man switch (read-time): if this issue hasn't been touched
                // in 15+ minutes AND we don't have a live run on it, surface a
                // "stale" subtitle so operators know the in_progress status is
                // probably lying. A background reconciliation should eventually
                // flip it to failed — until then, at least tell the user.
                const lastTouchMs = new Date(issue.updatedAt).getTime();
                const ageMs = Date.now() - lastTouchMs;
                const isStale = !isLiveOnThisTask && ageMs > 15 * 60 * 1000;
                return (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.identifier ?? issue.id}`}
                    className="flex flex-col gap-0.5 px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors no-underline text-inherit"
                  >
                    <div className="flex items-center gap-3">
                      {isLiveOnThisTask ? (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      ) : (
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isStale ? "bg-amber-400/70" : "bg-emerald-500/60",
                        )} />
                      )}
                      <span className="text-[13px] truncate flex-1">{issue.title}</span>
                      <StatusBadge status={issue.status} />
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {relativeTime(issue.startedAt ?? issue.updatedAt)}
                      </span>
                    </div>
                    {isStale && (
                      <span className="pl-5 text-[10.5px] text-amber-600 dark:text-amber-400">
                        (stale — may not be running)
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 2b. Queued bucket */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Queued
              </h3>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {queuedTasks.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {queuedTasks.length > 0 && (
                <ClearQueueButton agentId={agentId} agentName={agent.name} companyId={agent.companyId} />
              )}
              {queuedTasks.length > 5 && (
                <Link
                  to={`/issues?participantAgentId=${agentId}&filter=queued`}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline"
                >
                  Show all {queuedTasks.length}
                </Link>
              )}
            </div>
          </div>
          {queuedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 px-4 py-5 text-[12px] text-muted-foreground text-center">
              Nothing queued
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {queuedTasks.slice(0, 5).map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.identifier ?? issue.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors no-underline text-inherit"
                >
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    issue.priority === "critical" ? "bg-red-500" :
                    issue.priority === "high" ? "bg-amber-500" :
                    "bg-muted-foreground/40",
                  )} />
                  <span className="text-[13px] truncate flex-1">{issue.title}</span>
                  {issue.priority === "critical" || issue.priority === "high" ? (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {issue.priority}
                    </span>
                  ) : null}
                  <StatusBadge status={issue.status} />
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {relativeTime(issue.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 2c. Recent bucket — collapsed by default */}
        {recentTasks.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRecentTasks((v) => !v)}
              className="flex items-center gap-2 px-1 w-full text-left hover:opacity-80 transition-opacity"
            >
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </h3>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {recentTasks.length}
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">
                {showRecentTasks ? "Hide" : "Show"}
              </span>
            </button>
            {showRecentTasks && (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                {recentTasks.slice(0, 10).map((issue) => {
                  const finishedAt = issue.completedAt ?? issue.cancelledAt ?? issue.updatedAt;
                  return (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="flex items-center gap-3 px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors no-underline text-inherit opacity-70 hover:opacity-100"
                    >
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        issue.status === "done" ? "bg-emerald-500/50" : "bg-muted-foreground/30",
                      )} />
                      <span className="text-[13px] truncate flex-1">{issue.title}</span>
                      <StatusBadge status={issue.status} />
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {relativeTime(finishedAt)}
                      </span>
                    </Link>
                  );
                })}
                {recentTasks.length > 10 && (
                  <div className="px-4 py-2 text-[11px] text-muted-foreground text-center border-t border-border/50">
                    +{recentTasks.length - 10} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. Connected Accounts — editable panel                       */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AgentConnectionsPanel
        agentId={agentId}
        agentName={agent.name ?? "this agent"}
        companyId={agent.companyId}
      />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. Current Run (demoted — only shown if live or recent)     */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentRun && (
        <Link
          to={`/agents/${agentRouteId}/runs/${currentRun.id}`}
          className={cn(
            "block rounded-xl p-4 no-underline text-inherit transition-colors",
            isLiveRun
              ? "bg-primary/5 border border-primary/20 hover:bg-primary/10"
              : "bg-card/80 border border-border/50 hover:bg-accent/30"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isLiveRun && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
              <span className="text-[13px] font-semibold">
                {isLiveRun ? "Current Run" : "Latest Run"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(currentRun.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <StatusBadge status={currentRun.status} />
          </div>
          {currentRunSummary && (
            <p className="text-[12px] text-muted-foreground mt-2 line-clamp-2">
              {currentRunSummary}
            </p>
          )}
          {isLiveRun && (
            <div className="mt-3">
              <div className="h-1 rounded-full bg-primary/10 overflow-hidden">
                <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}
        </Link>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. Recent Activity list                                      */}
      {/* ──────────────────────────────────────────────────────────── */}
      {sortedRuns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Recent Activity</h3>
            <Link
              to={`/agents/${agentRouteId}/runs`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              See all
            </Link>
          </div>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            {sortedRuns.slice(0, 8).map((run) => {
              const metrics = runMetrics(run);
              const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
              const StatusIcon = statusInfo.icon;
              return (
                <Link
                  key={run.id}
                  to={`/agents/${agentRouteId}/runs/${run.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-accent/20 transition-colors no-underline text-inherit"
                >
                  <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(run.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <StatusBadge status={run.status} />
                  <span className="flex-1" />
                  {metrics.cost > 0 && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      ${metrics.cost.toFixed(3)}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {relativeTime(run.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 6. Metric cards — demoted from top, mobile-responsive grid  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/50">Runs · last 30 days</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{totalRuns30d}</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/50">Success rate</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{successRate}%</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/50">Spend · last 30 days</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            ${totalSpend30d > 0 ? totalSpend30d.toFixed(2) : "0.00"}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 7. Cost Breakdown (unchanged)                                */}
      {/* ──────────────────────────────────────────────────────────── */}
      {runtimeState && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold">Cost Breakdown</h3>
          <CostsSection runtimeState={runtimeState} runs={runs} companyId={agent.companyId} agentId={agentId} />
        </div>
      )}
    </div>
  );
}

/* ---- Costs Section (inline) ---- */

function CostsSection({
  runtimeState,
  runs,
  companyId,
  agentId,
}: {
  runtimeState?: AgentRuntimeState;
  runs: HeartbeatRun[];
  companyId?: string;
  agentId?: string;
}) {
  const { data: modelBreakdown } = useQuery({
    queryKey: ["costs", "by-agent-model", companyId, agentId],
    queryFn: () => costsApi.byAgentModel(companyId!),
    enabled: !!companyId,
  });

  const agentModelRows = useMemo(() => {
    if (!modelBreakdown || !agentId) return [];
    return modelBreakdown.filter((row) => row.agentId === agentId);
  }, [modelBreakdown, agentId]);

  const runsWithCost = runs
    .filter((r) => {
      const metrics = runMetrics(r);
      return metrics.cost > 0 || metrics.input > 0 || metrics.output > 0 || metrics.cached > 0;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      {runtimeState && (
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <div className="grid grid-cols-2 gap-4 tabular-nums">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/50">Total cost</div>
              <div className="mt-2 text-2xl font-bold">{formatCents(runtimeState.totalCostCents)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/50">AI usage</div>
              <div className="mt-2 text-2xl font-bold">{formatTokens((runtimeState.totalInputTokens ?? 0) + (runtimeState.totalOutputTokens ?? 0))}</div>
            </div>
          </div>
        </div>
      )}
      {agentModelRows.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-accent/20 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Cost by Model</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-accent/10">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {agentModelRows
                .sort((a, b) => b.costCents - a.costCents)
                .map((row) => (
                  <tr key={row.model} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">{row.model}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.inputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.outputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.costCents)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {runsWithCost.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-accent/20">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Run</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runsWithCost.slice(0, 10).map((run) => {
                const metrics = runMetrics(run);
                return (
                  <tr key={run.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">{formatDate(run.createdAt)}</td>
                    <td className="px-3 py-2">{new Date(run.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(metrics.input)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(metrics.output)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {metrics.cost > 0
                        ? `$${metrics.cost.toFixed(4)}`
                        : "-"
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---- Agent Configure Page ---- */

function AgentConfigurePage({
  agent,
  agentId,
  companyId,
  onDirtyChange,
  onSaveActionChange,
  onCancelActionChange,
  onSavingChange,
  updatePermissions,
}: {
  agent: AgentDetailRecord;
  agentId: string;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaveActionChange: (save: (() => void) | null) => void;
  onCancelActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
  updatePermissions: { mutate: (permissions: AgentPermissionUpdate) => void; isPending: boolean };
}) {
  const queryClient = useQueryClient();
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  const { data: configRevisions } = useQuery({
    queryKey: queryKeys.agents.configRevisions(agent.id),
    queryFn: () => agentsApi.listConfigRevisions(agent.id, companyId),
  });

  const rollbackConfig = useMutation({
    mutationFn: (revisionId: string) => agentsApi.rollbackConfigRevision(agent.id, revisionId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agent.id) });
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <ConfigurationTab
        agent={agent}
        onDirtyChange={onDirtyChange}
        onSaveActionChange={onSaveActionChange}
        onCancelActionChange={onCancelActionChange}
        onSavingChange={onSavingChange}
        updatePermissions={updatePermissions}
        companyId={companyId}
        hidePromptTemplate
        hideInstructionsFile
      />
      <div>
        <h3 className="text-sm font-medium mb-3">Connection Keys</h3>
        <KeysTab agentId={agentId} companyId={companyId} />
      </div>

      {/* Change History — collapsible at the bottom */}
      <div>
        <button
          className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
          onClick={() => setRevisionsOpen((v) => !v)}
        >
          {revisionsOpen
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
          Change History
          <span className="text-xs font-normal text-muted-foreground">{configRevisions?.length ?? 0}</span>
        </button>
        {revisionsOpen && (
          <div className="mt-3">
            {(configRevisions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {(configRevisions ?? []).slice(0, 10).map((revision) => (
                  <div key={revision.id} className="border border-border/70 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <span>{formatDate(revision.createdAt)}</span>
                        <span className="mx-1">·</span>
                        <span>{revision.source}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => rollbackConfig.mutate(revision.id)}
                        disabled={rollbackConfig.isPending}
                      >
                        Restore
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Changed:{" "}
                      {revision.changedKeys.length > 0 ? revision.changedKeys.join(", ") : "no tracked changes"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Configuration Tab ---- */

function ConfigurationTab({
  agent,
  companyId,
  onDirtyChange,
  onSaveActionChange,
  onCancelActionChange,
  onSavingChange,
  updatePermissions,
  hidePromptTemplate,
  hideInstructionsFile,
}: {
  agent: AgentDetailRecord;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaveActionChange: (save: (() => void) | null) => void;
  onCancelActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
  updatePermissions: { mutate: (permissions: AgentPermissionUpdate) => void; isPending: boolean };
  hidePromptTemplate?: boolean;
  hideInstructionsFile?: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [awaitingRefreshAfterSave, setAwaitingRefreshAfterSave] = useState(false);
  const lastAgentRef = useRef(agent);

  const { data: adapterModels } = useQuery({
    queryKey:
      companyId
        ? queryKeys.agents.adapterModels(companyId, agent.adapterType)
        : ["agents", "none", "adapter-models", agent.adapterType],
    queryFn: () => agentsApi.adapterModels(companyId!, agent.adapterType),
    enabled: Boolean(companyId),
  });

  const updateAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentsApi.update(agent.id, data, companyId),
    onMutate: () => {
      setAwaitingRefreshAfterSave(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.configRevisions(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(agent.companyId) });
    },
    onError: (err) => {
      setAwaitingRefreshAfterSave(false);
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save agent";
      pushToast({ title: "Save failed", body: message, tone: "error" });
    },
  });

  useEffect(() => {
    if (awaitingRefreshAfterSave && agent !== lastAgentRef.current) {
      setAwaitingRefreshAfterSave(false);
    }
    lastAgentRef.current = agent;
  }, [agent, awaitingRefreshAfterSave]);
  const isConfigSaving = updateAgent.isPending || awaitingRefreshAfterSave;

  useEffect(() => {
    onSavingChange(isConfigSaving);
  }, [onSavingChange, isConfigSaving]);

  const canCreateAgents = Boolean(agent.permissions?.canCreateAgents);
  const canAssignTasks = Boolean(agent.access?.canAssignTasks);
  const taskAssignSource = agent.access?.taskAssignSource ?? "none";
  const taskAssignLocked = agent.role === "ceo" || canCreateAgents;
  const taskAssignHint =
    taskAssignSource === "ceo_role"
      ? "Enabled automatically for CEO agents."
      : taskAssignSource === "agent_creator"
        ? "Enabled automatically while this agent can create new agents."
        : taskAssignSource === "explicit_grant"
          ? "Enabled via explicit company permission grant."
          : "Disabled unless explicitly granted.";

  return (
    <div className="space-y-6">
      <AgentConfigForm
        mode="edit"
        agent={agent}
        onSave={(patch) => updateAgent.mutate(patch)}
        isSaving={isConfigSaving}
        adapterModels={adapterModels}
        onDirtyChange={onDirtyChange}
        onSaveActionChange={onSaveActionChange}
        onCancelActionChange={onCancelActionChange}
        hideInlineSave
        hidePromptTemplate={hidePromptTemplate}
        hideInstructionsFile={hideInstructionsFile}
        sectionLayout="cards"
      />

      <div>
        <h3 className="text-sm font-medium mb-3">WhatsApp</h3>
        <WhatsAppConnect agentId={agent.id} agentName={agent.name} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Gmail</h3>
        <GmailConnect agentId={agent.id} agentName={agent.name} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Permissions</h3>
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="space-y-1">
              <div>Can hire team members</div>
              <p className="text-xs text-muted-foreground">
                Lets this agent bring on new agents and delegate tasks to them.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              data-slot="toggle"
              aria-checked={canCreateAgents}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50",
                canCreateAgents ? "bg-green-600" : "bg-muted",
              )}
              onClick={() =>
                updatePermissions.mutate({
                  canCreateAgents: !canCreateAgents,
                  canAssignTasks: !canCreateAgents ? true : canAssignTasks,
                })
              }
              disabled={updatePermissions.isPending}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  canCreateAgents ? "translate-x-4.5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="space-y-1">
              <div>Can delegate tasks</div>
              <p className="text-xs text-muted-foreground">
                {taskAssignHint}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              data-slot="toggle"
              aria-checked={canAssignTasks}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50",
                canAssignTasks ? "bg-green-600" : "bg-muted",
              )}
              onClick={() =>
                updatePermissions.mutate({
                  canCreateAgents,
                  canAssignTasks: !canAssignTasks,
                })
              }
              disabled={updatePermissions.isPending || taskAssignLocked}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  canAssignTasks ? "translate-x-4.5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Prompts Tab ---- */

function PromptsTab({
  agent,
  companyId,
  onDirtyChange,
  onSaveActionChange,
  onCancelActionChange,
  onSavingChange,
}: {
  agent: Agent;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaveActionChange: (save: (() => void) | null) => void;
  onCancelActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { isMobile } = useSidebar();
  const [selectedFile, setSelectedFile] = useState<string>("AGENTS.md");
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [bundleDraft, setBundleDraft] = useState<{
    mode: "managed" | "external";
    rootPath: string;
    entryFile: string;
  } | null>(null);
  const [newFilePath, setNewFilePath] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [filePanelWidth, setFilePanelWidth] = useState(260);
  const containerRef = useRef<HTMLDivElement>(null);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const lastFileVersionRef = useRef<string | null>(null);
  const externalBundleRef = useRef<{
    rootPath: string;
    entryFile: string;
    selectedFile: string;
  } | null>(null);

  useEffect(() => {
    setSelectedFile("AGENTS.md");
    setShowFilePanel(false);
    setDraft(null);
    setBundleDraft(null);
    setNewFilePath("");
    setShowNewFileInput(false);
    setPendingFiles([]);
    setExpandedDirs(new Set());
    setAwaitingRefresh(false);
    lastFileVersionRef.current = null;
    externalBundleRef.current = null;
  }, [agent.id]);

  const isLocal =
    agent.adapterType === "claude_local" ||
    agent.adapterType === "codex_local" ||
    agent.adapterType === "opencode_local" ||
    agent.adapterType === "pi_local" ||
    agent.adapterType === "hermes_local" ||
    agent.adapterType === "cursor";

  const { data: bundle, isLoading: bundleLoading } = useQuery({
    queryKey: queryKeys.agents.instructionsBundle(agent.id),
    queryFn: () => agentsApi.instructionsBundle(agent.id, companyId),
    enabled: Boolean(companyId && isLocal),
  });

  const persistedMode = bundle?.mode ?? "managed";
  const persistedRootPath = persistedMode === "managed"
    ? (bundle?.managedRootPath ?? bundle?.rootPath ?? "")
    : (bundle?.rootPath ?? "");
  const currentMode = bundleDraft?.mode ?? persistedMode;
  const currentEntryFile = bundleDraft?.entryFile ?? bundle?.entryFile ?? "AGENTS.md";
  const currentRootPath = bundleDraft?.rootPath ?? persistedRootPath;
  const fileOptions = useMemo(
    () => bundle?.files.map((file) => file.path) ?? [],
    [bundle],
  );
  const bundleMatchesDraft = Boolean(
    bundle &&
    currentMode === persistedMode &&
    currentEntryFile === bundle.entryFile &&
    currentRootPath === persistedRootPath,
  );
  const visibleFilePaths = useMemo(
    () => bundleMatchesDraft
      ? [...new Set([currentEntryFile, ...fileOptions, ...pendingFiles])]
      : [currentEntryFile, ...pendingFiles],
    [bundleMatchesDraft, currentEntryFile, fileOptions, pendingFiles],
  );
  const fileTree = useMemo(
    () => buildFileTree(Object.fromEntries(visibleFilePaths.map((filePath) => [filePath, ""]))),
    [visibleFilePaths],
  );
  const selectedOrEntryFile = selectedFile || currentEntryFile;
  const selectedFileExists = bundleMatchesDraft && fileOptions.includes(selectedOrEntryFile);
  const selectedFileSummary = bundle?.files.find((file) => file.path === selectedOrEntryFile) ?? null;

  const { data: selectedFileDetail, isLoading: fileLoading } = useQuery({
    queryKey: queryKeys.agents.instructionsFile(agent.id, selectedOrEntryFile),
    queryFn: () => agentsApi.instructionsFile(agent.id, selectedOrEntryFile, companyId),
    enabled: Boolean(companyId && isLocal && selectedFileExists),
  });

  const updateBundle = useMutation({
    mutationFn: (data: {
      mode?: "managed" | "external";
      rootPath?: string | null;
      entryFile?: string;
      clearLegacyPromptTemplate?: boolean;
    }) => agentsApi.updateInstructionsBundle(agent.id, data, companyId),
    onMutate: () => setAwaitingRefresh(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.instructionsBundle(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
    },
    onError: () => setAwaitingRefresh(false),
  });

  const saveFile = useMutation({
    mutationFn: (data: { path: string; content: string; clearLegacyPromptTemplate?: boolean }) =>
      agentsApi.saveInstructionsFile(agent.id, data, companyId),
    onMutate: () => setAwaitingRefresh(true),
    onSuccess: (_, variables) => {
      setPendingFiles((prev) => prev.filter((f) => f !== variables.path));
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.instructionsBundle(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.instructionsFile(agent.id, variables.path) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
    },
    onError: () => setAwaitingRefresh(false),
  });

  const deleteFile = useMutation({
    mutationFn: (relativePath: string) => agentsApi.deleteInstructionsFile(agent.id, relativePath, companyId),
    onMutate: () => setAwaitingRefresh(true),
    onSuccess: (_, relativePath) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.instructionsBundle(agent.id) });
      queryClient.removeQueries({ queryKey: queryKeys.agents.instructionsFile(agent.id, relativePath) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) });
    },
    onError: () => setAwaitingRefresh(false),
  });

  const uploadMarkdownImage = useMutation({
    mutationFn: async ({ file, namespace }: { file: File; namespace: string }) => {
      if (!selectedCompanyId) throw new Error("Select a company to upload images");
      return assetsApi.uploadImage(selectedCompanyId, file, namespace);
    },
  });

  useEffect(() => {
    if (!bundle) return;
    if (!bundleMatchesDraft) {
      if (selectedFile !== currentEntryFile) setSelectedFile(currentEntryFile);
      return;
    }
    const availablePaths = bundle.files.map((file) => file.path);
    if (availablePaths.length === 0) {
      if (selectedFile !== bundle.entryFile) setSelectedFile(bundle.entryFile);
      return;
    }
    if (!availablePaths.includes(selectedFile) && selectedFile !== currentEntryFile && !pendingFiles.includes(selectedFile)) {
      setSelectedFile(availablePaths.includes(bundle.entryFile) ? bundle.entryFile : availablePaths[0]!);
    }
  }, [bundle, bundleMatchesDraft, currentEntryFile, pendingFiles, selectedFile]);

  useEffect(() => {
    const nextExpanded = new Set<string>();
    for (const filePath of visibleFilePaths) {
      const parts = filePath.split("/");
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]!;
        nextExpanded.add(currentPath);
      }
    }
    setExpandedDirs((current) => (setsEqual(current, nextExpanded) ? current : nextExpanded));
  }, [visibleFilePaths]);

  useEffect(() => {
    const versionKey = selectedFileExists && selectedFileDetail
      ? `${selectedFileDetail.path}:${selectedFileDetail.content}`
      : `draft:${currentMode}:${currentRootPath}:${selectedOrEntryFile}`;
    if (awaitingRefresh) {
      setAwaitingRefresh(false);
      setBundleDraft(null);
      setDraft(null);
      lastFileVersionRef.current = versionKey;
      return;
    }
    if (lastFileVersionRef.current !== versionKey) {
      setDraft(null);
      lastFileVersionRef.current = versionKey;
    }
  }, [awaitingRefresh, currentMode, currentRootPath, selectedFileDetail, selectedFileExists, selectedOrEntryFile]);

  useEffect(() => {
    if (!bundle) return;
    setBundleDraft((current) => {
      if (current) return current;
      return {
        mode: persistedMode,
        rootPath: persistedRootPath,
        entryFile: bundle.entryFile,
      };
    });
  }, [bundle, persistedMode, persistedRootPath]);

  useEffect(() => {
    if (!bundle || currentMode !== "external") return;
    externalBundleRef.current = {
      rootPath: currentRootPath,
      entryFile: currentEntryFile,
      selectedFile: selectedOrEntryFile,
    };
  }, [bundle, currentEntryFile, currentMode, currentRootPath, selectedOrEntryFile]);

  const currentContent = selectedFileExists ? (selectedFileDetail?.content ?? "") : "";
  const displayValue = draft ?? currentContent;
  const bundleDirty = Boolean(
    bundleDraft &&
      (
        bundleDraft.mode !== persistedMode ||
        bundleDraft.rootPath !== persistedRootPath ||
        bundleDraft.entryFile !== (bundle?.entryFile ?? "AGENTS.md")
      ),
  );
  const fileDirty = draft !== null && draft !== currentContent;
  const isDirty = bundleDirty || fileDirty;
  const isSaving = updateBundle.isPending || saveFile.isPending || deleteFile.isPending || awaitingRefresh;

  useEffect(() => { onSavingChange(isSaving); }, [onSavingChange, isSaving]);
  useEffect(() => { onDirtyChange(isDirty); }, [onDirtyChange, isDirty]);

  useEffect(() => {
    onSaveActionChange(isDirty ? () => {
      const save = async () => {
        const shouldClearLegacy =
          Boolean(bundle?.legacyPromptTemplateActive) || Boolean(bundle?.legacyBootstrapPromptTemplateActive);
        if (bundleDirty && bundleDraft) {
          await updateBundle.mutateAsync({
            mode: bundleDraft.mode,
            rootPath: bundleDraft.mode === "external" ? bundleDraft.rootPath : null,
            entryFile: bundleDraft.entryFile,
          });
        }
        if (fileDirty) {
          await saveFile.mutateAsync({
            path: selectedOrEntryFile,
            content: displayValue,
            clearLegacyPromptTemplate: shouldClearLegacy,
          });
        }
      };
      void save().catch(() => undefined);
    } : null);
  }, [
    bundle,
    bundleDirty,
    bundleDraft,
    displayValue,
    fileDirty,
    isDirty,
    onSaveActionChange,
    saveFile,
    selectedOrEntryFile,
    updateBundle,
  ]);

  useEffect(() => {
    onCancelActionChange(isDirty ? () => {
      setDraft(null);
      if (bundle) {
        setBundleDraft({
          mode: persistedMode,
          rootPath: persistedRootPath,
          entryFile: bundle.entryFile,
        });
      }
    } : null);
  }, [bundle, isDirty, onCancelActionChange, persistedMode, persistedRootPath]);

  const handleSeparatorDrag = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = filePanelWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.max(180, Math.min(500, startWidth + delta));
      setFilePanelWidth(next);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [filePanelWidth]);

  if (!isLocal) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Instructions bundles are only available for local adapters.
        </p>
      </div>
    );
  }

  if (bundleLoading && !bundle) {
    return <PromptsTabSkeleton />;
  }

  return (
    <div className="max-w-6xl space-y-6">
      {(bundle?.warnings ?? []).length > 0 && (
        <div className="space-y-2">
          {(bundle?.warnings ?? []).map((warning) => (
            <div key={warning} className="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              {warning}
            </div>
          ))}
        </div>
      )}

      <Collapsible defaultOpen={currentMode === "external"}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          Advanced
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 pb-6">
          <TooltipProvider>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[auto_1fr_1fr]">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Mode
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      Managed: Paperclip stores and serves the instructions bundle. External: you provide a path on disk where the instructions live.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentMode === "managed" ? "default" : "outline"}
                    onClick={() => {
                      if (currentMode === "external") {
                        externalBundleRef.current = {
                          rootPath: currentRootPath,
                          entryFile: currentEntryFile,
                          selectedFile: selectedOrEntryFile,
                        };
                      }
                      const nextEntryFile = currentEntryFile || "AGENTS.md";
                      setBundleDraft({
                        mode: "managed",
                        rootPath: bundle?.managedRootPath ?? currentRootPath,
                        entryFile: nextEntryFile,
                      });
                      setSelectedFile(nextEntryFile);
                    }}
                  >
                    Managed
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentMode === "external" ? "default" : "outline"}
                    onClick={() => {
                      const externalBundle = externalBundleRef.current;
                      const nextEntryFile = externalBundle?.entryFile ?? currentEntryFile ?? "AGENTS.md";
                      setBundleDraft({
                        mode: "external",
                        rootPath: externalBundle?.rootPath ?? (bundle?.mode === "external" ? (bundle.rootPath ?? "") : ""),
                        entryFile: nextEntryFile,
                      });
                      setSelectedFile(externalBundle?.selectedFile ?? nextEntryFile);
                    }}
                  >
                    External
                  </Button>
                </div>
              </label>
              <label className="space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Root path
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      The absolute directory on disk where the instructions bundle lives. In managed mode this is set by Paperclip automatically.
                    </TooltipContent>
                  </Tooltip>
                </span>
                {currentMode === "managed" ? (
                  <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground pt-1.5">
                    <span className="min-w-0 truncate" title={currentRootPath || undefined}>{currentRootPath || "(managed)"}</span>
                    {currentRootPath && (
                      <CopyText text={currentRootPath} className="shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </CopyText>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={currentRootPath}
                      onChange={(event) => {
                        const nextRootPath = event.target.value;
                        externalBundleRef.current = {
                          rootPath: nextRootPath,
                          entryFile: currentEntryFile,
                          selectedFile: selectedOrEntryFile,
                        };
                        setBundleDraft({
                          mode: "external",
                          rootPath: nextRootPath,
                          entryFile: currentEntryFile,
                        });
                      }}
                      className="font-mono text-sm"
                      placeholder="/absolute/path/to/agent/prompts"
                    />
                    {currentRootPath && (
                      <CopyText text={currentRootPath} className="shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </CopyText>
                    )}
                  </div>
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Entry file
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      The main file the agent reads first when loading instructions. Defaults to AGENTS.md.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <Input
                  value={currentEntryFile}
                  onChange={(event) => {
                    const nextEntryFile = event.target.value || "AGENTS.md";
                    const nextSelectedFile = selectedOrEntryFile === currentEntryFile
                      ? nextEntryFile
                      : selectedOrEntryFile;
                    if (currentMode === "external") {
                      externalBundleRef.current = {
                        rootPath: currentRootPath,
                        entryFile: nextEntryFile,
                        selectedFile: nextSelectedFile,
                      };
                    }
                    if (selectedOrEntryFile === currentEntryFile) setSelectedFile(nextEntryFile);
                    setBundleDraft({
                      mode: currentMode,
                      rootPath: currentRootPath,
                      entryFile: nextEntryFile,
                    });
                  }}
                  className="font-mono text-sm"
                />
              </label>
            </div>
          </TooltipProvider>
        </CollapsibleContent>
      </Collapsible>

      <div ref={containerRef} className={cn("flex gap-0", isMobile && "flex-col gap-3")}>
        <div className={cn(
          "border border-border rounded-lg p-3 space-y-3 shrink-0",
          isMobile && showFilePanel && "block",
          isMobile && !showFilePanel && "hidden",
        )} style={isMobile ? undefined : { width: filePanelWidth }}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Files</h4>
            <div className="flex items-center gap-1">
              {!showNewFileInput && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setShowNewFileInput(true)}
                >
                  +
                </Button>
              )}
              {isMobile && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setShowFilePanel(false)}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
          {showNewFileInput && (
            <div className="space-y-2">
              <Input
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                placeholder="TOOLS.md"
                className="font-mono text-sm"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowNewFileInput(false);
                    setNewFilePath("");
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="flex-1"
                  disabled={!newFilePath.trim() || newFilePath.includes("..")}
                  onClick={() => {
                    const candidate = newFilePath.trim();
                    if (!candidate || candidate.includes("..")) return;
                    setPendingFiles((prev) => prev.includes(candidate) ? prev : [...prev, candidate]);
                    setSelectedFile(candidate);
                    setDraft("");
                    setNewFilePath("");
                    setShowNewFileInput(false);
                  }}
                >
                  Create
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewFileInput(false);
                    setNewFilePath("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <PackageFileTree
            nodes={fileTree}
            selectedFile={selectedOrEntryFile}
            expandedDirs={expandedDirs}
            checkedFiles={new Set()}
            onToggleDir={(dirPath) => setExpandedDirs((current) => {
              const next = new Set(current);
              if (next.has(dirPath)) next.delete(dirPath);
              else next.add(dirPath);
              return next;
            })}
            onSelectFile={(filePath) => {
              setSelectedFile(filePath);
              if (!fileOptions.includes(filePath)) setDraft("");
              if (isMobile) setShowFilePanel(false);
            }}
            onToggleCheck={() => {}}
            showCheckboxes={false}
            renderFileExtra={(node) => {
              const file = bundle?.files.find((entry) => entry.path === node.path);
              if (!file) return null;
              if (file.deprecated) {
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-3 shrink-0 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide cursor-help">
                        virtual file
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      Legacy inline prompt — this deprecated virtual file preserves the old promptTemplate content
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <span className="ml-3 shrink-0 rounded border border-border text-muted-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {file.isEntryFile ? "entry" : `${file.size}b`}
                </span>
              );
            }}
          />
        </div>

        {/* Draggable separator */}
        {!isMobile && (
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-border active:bg-primary/50 rounded transition-colors mx-1"
            onMouseDown={handleSeparatorDrag}
          />
        )}

        <div className={cn("border border-border rounded-lg p-4 space-y-3 min-w-0 flex-1", isMobile && showFilePanel && "hidden")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setShowFilePanel(true)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              )}
              <div className="min-w-0">
                <h4 className="text-sm font-medium font-mono truncate">{selectedOrEntryFile}</h4>
                <p className="text-xs text-muted-foreground">
                  {selectedFileExists
                    ? selectedFileSummary?.deprecated
                      ? "Deprecated virtual file"
                      : `${selectedFileDetail?.language ?? "text"} file`
                    : "New file in this bundle"}
                </p>
              </div>
            </div>
            {selectedFileExists && !selectedFileSummary?.deprecated && selectedOrEntryFile !== currentEntryFile && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm(`Delete ${selectedOrEntryFile}?`)) {
                    deleteFile.mutate(selectedOrEntryFile, {
                      onSuccess: () => {
                        setSelectedFile(currentEntryFile);
                        setDraft(null);
                      },
                    });
                  }
                }}
                disabled={deleteFile.isPending}
              >
                Delete
              </Button>
            )}
          </div>

          {selectedFileExists && fileLoading && !selectedFileDetail ? (
            <PromptEditorSkeleton />
          ) : isMarkdown(selectedOrEntryFile) ? (
            <MarkdownEditor
              key={selectedOrEntryFile}
              value={displayValue}
              onChange={(value) => setDraft(value ?? "")}
              placeholder="# Agent instructions"
              contentClassName="min-h-[420px] text-sm font-mono"
              imageUploadHandler={async (file) => {
                const namespace = `agents/${agent.id}/instructions/${selectedOrEntryFile.replaceAll("/", "-")}`;
                const asset = await uploadMarkdownImage.mutateAsync({ file, namespace });
                return asset.contentPath;
              }}
            />
          ) : (
            <textarea
              value={displayValue}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[420px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none"
              placeholder="File contents"
            />
          )}
        </div>
      </div>

    </div>
  );
}

function PromptsTabSkeleton() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-[30rem] max-w-full" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-none" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <PromptEditorSkeleton />
        </div>
      </div>
    </div>
  );
}

function PromptEditorSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}

function AgentSkillsTab({
  agent,
  companyId,
}: {
  agent: Agent;
  companyId?: string;
}) {
  type SkillRow = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    detail: string | null;
    locationLabel: string | null;
    originLabel: string | null;
    linkTo: string | null;
    readOnly: boolean;
    adapterEntry: AgentSkillEntry | null;
  };

  const queryClient = useQueryClient();
  const [skillDraft, setSkillDraft] = useState<string[]>([]);
  const [lastSavedSkills, setLastSavedSkills] = useState<string[]>([]);
  const [unmanagedOpen, setUnmanagedOpen] = useState(false);
  const lastSavedSkillsRef = useRef<string[]>([]);
  const hasHydratedSkillSnapshotRef = useRef(false);
  const skipNextSkillAutosaveRef = useRef(true);

  const { data: skillSnapshot, isLoading } = useQuery({
    queryKey: queryKeys.agents.skills(agent.id),
    queryFn: () => agentsApi.skills(agent.id, companyId),
    enabled: Boolean(companyId),
  });

  const { data: companySkills } = useQuery({
    queryKey: queryKeys.companySkills.list(companyId ?? ""),
    queryFn: () => companySkillsApi.list(companyId!),
    enabled: Boolean(companyId),
  });

  const syncSkills = useMutation({
    mutationFn: (desiredSkills: string[]) => agentsApi.syncSkills(agent.id, desiredSkills, companyId),
    onSuccess: async (snapshot) => {
      queryClient.setQueryData(queryKeys.agents.skills(agent.id), snapshot);
      lastSavedSkillsRef.current = snapshot.desiredSkills;
      setLastSavedSkills(snapshot.desiredSkills);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.urlKey) }),
      ]);
    },
  });

  useEffect(() => {
    setSkillDraft([]);
    setLastSavedSkills([]);
    lastSavedSkillsRef.current = [];
    hasHydratedSkillSnapshotRef.current = false;
    skipNextSkillAutosaveRef.current = true;
  }, [agent.id]);

  useEffect(() => {
    if (!skillSnapshot) return;
    const nextState = applyAgentSkillSnapshot(
      {
        draft: skillDraft,
        lastSaved: lastSavedSkillsRef.current,
        hasHydratedSnapshot: hasHydratedSkillSnapshotRef.current,
      },
      skillSnapshot.desiredSkills,
    );
    skipNextSkillAutosaveRef.current = nextState.shouldSkipAutosave;
    hasHydratedSkillSnapshotRef.current = nextState.hasHydratedSnapshot;
    setSkillDraft(nextState.draft);
    lastSavedSkillsRef.current = nextState.lastSaved;
    setLastSavedSkills(nextState.lastSaved);
  }, [skillDraft, skillSnapshot]);

  useEffect(() => {
    if (!skillSnapshot) return;
    if (skipNextSkillAutosaveRef.current) {
      skipNextSkillAutosaveRef.current = false;
      return;
    }
    if (syncSkills.isPending) return;
    if (arraysEqual(skillDraft, lastSavedSkillsRef.current)) return;

    const timeout = window.setTimeout(() => {
      if (!arraysEqual(skillDraft, lastSavedSkillsRef.current)) {
        syncSkills.mutate(skillDraft);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [skillDraft, skillSnapshot, syncSkills.isPending, syncSkills.mutate]);

  const companySkillByKey = useMemo(
    () => new Map((companySkills ?? []).map((skill) => [skill.key, skill])),
    [companySkills],
  );
  const companySkillKeys = useMemo(
    () => new Set((companySkills ?? []).map((skill) => skill.key)),
    [companySkills],
  );
  const adapterEntryByKey = useMemo(
    () => new Map((skillSnapshot?.entries ?? []).map((entry) => [entry.key, entry])),
    [skillSnapshot],
  );
  const optionalSkillRows = useMemo<SkillRow[]>(
    () =>
      (companySkills ?? [])
        .filter((skill) => !adapterEntryByKey.get(skill.key)?.required)
        .map((skill) => ({
          id: skill.id,
          key: skill.key,
          name: skill.name,
          description: skill.description,
          detail: adapterEntryByKey.get(skill.key)?.detail ?? null,
          locationLabel: adapterEntryByKey.get(skill.key)?.locationLabel ?? null,
          originLabel: adapterEntryByKey.get(skill.key)?.originLabel ?? null,
          linkTo: `/skills/${skill.id}`,
          readOnly: false,
          adapterEntry: adapterEntryByKey.get(skill.key) ?? null,
        })),
    [adapterEntryByKey, companySkills],
  );
  const requiredSkillRows = useMemo<SkillRow[]>(
    () =>
      (skillSnapshot?.entries ?? [])
        .filter((entry) => entry.required)
        .map((entry) => {
          const companySkill = companySkillByKey.get(entry.key);
          return {
            id: companySkill?.id ?? `required:${entry.key}`,
            key: entry.key,
            name: companySkill?.name ?? entry.key,
            description: companySkill?.description ?? null,
            detail: entry.detail ?? null,
            locationLabel: entry.locationLabel ?? null,
            originLabel: entry.originLabel ?? null,
            linkTo: companySkill ? `/skills/${companySkill.id}` : null,
            readOnly: false,
            adapterEntry: entry,
          };
        }),
    [companySkillByKey, skillSnapshot],
  );
  const unmanagedSkillRows = useMemo<SkillRow[]>(
    () =>
      (skillSnapshot?.entries ?? [])
        .filter((entry) => isReadOnlyUnmanagedSkillEntry(entry, companySkillKeys))
        .map((entry) => ({
          id: `external:${entry.key}`,
          key: entry.key,
          name: entry.runtimeName ?? entry.key,
          description: null,
          detail: entry.detail ?? null,
          locationLabel: entry.locationLabel ?? null,
          originLabel: entry.originLabel ?? null,
          linkTo: null,
          readOnly: true,
          adapterEntry: entry,
        })),
    [companySkillKeys, skillSnapshot],
  );
  const desiredOnlyMissingSkills = useMemo(
    () => skillDraft.filter((key) => !companySkillByKey.has(key)),
    [companySkillByKey, skillDraft],
  );
  const skillApplicationLabel = useMemo(() => {
    switch (skillSnapshot?.mode) {
      case "persistent":
        return "Kept in the workspace";
      case "ephemeral":
        return "Applied when the agent runs";
      case "unsupported":
        return "Tracked only";
      default:
        return "Unknown";
    }
  }, [skillSnapshot?.mode]);
  const unsupportedSkillMessage = useMemo(() => {
    if (skillSnapshot?.mode !== "unsupported") return null;
    if (agent.adapterType === "openclaw_gateway") {
      return "Paperclip cannot manage OpenClaw skills here. Visit your OpenClaw instance to manage this agent's skills.";
    }
    return "Paperclip cannot manage skills for this adapter yet. Manage them in the adapter directly.";
  }, [agent.adapterType, skillSnapshot?.mode]);
  const hasUnsavedChanges = !arraysEqual(skillDraft, lastSavedSkills);
  const saveStatusLabel = syncSkills.isPending
    ? "Saving changes..."
    : hasUnsavedChanges
      ? "Saving soon..."
      : null;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/skills"
          className="text-sm font-medium text-foreground underline-offset-4 no-underline transition-colors hover:text-foreground/70 hover:underline"
        >
          View company skills library
        </Link>
        {saveStatusLabel ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {syncSkills.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{saveStatusLabel}</span>
          </div>
        ) : null}
      </div>

      {skillSnapshot?.warnings.length ? (
        <div className="space-y-1 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
          {skillSnapshot.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      {unsupportedSkillMessage ? (
        <div className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
          {unsupportedSkillMessage}
        </div>
      ) : null}

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <>
          {(() => {
            const renderSkillRow = (skill: SkillRow) => {
              const adapterEntry = skill.adapterEntry ?? adapterEntryByKey.get(skill.key);
              const required = Boolean(adapterEntry?.required);
              const rowClassName = cn(
                "flex items-start gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0",
                skill.readOnly ? "bg-muted/20" : "hover:bg-accent/20",
              );
              const body = (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="truncate font-medium">{skill.name}</span>
                    </div>
                    {skill.linkTo ? (
                      <Link
                        to={skill.linkTo}
                        className="shrink-0 text-xs text-muted-foreground no-underline hover:text-foreground"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                  {skill.description && (
                    <MarkdownBody className="mt-1 text-xs text-muted-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {skill.description}
                    </MarkdownBody>
                  )}
                  {skill.readOnly && skill.originLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">{skill.originLabel}</p>
                  )}
                  {skill.readOnly && skill.locationLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">Location: {skill.locationLabel}</p>
                  )}
                  {skill.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">{skill.detail}</p>
                  )}
                </div>
              );

              if (skill.readOnly) {
                return (
                  <div key={skill.id} className={rowClassName}>
                    <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/40" />
                    {body}
                  </div>
                );
              }

              const checked = required || skillDraft.includes(skill.key);
              const disabled = required || skillSnapshot?.mode === "unsupported";
              const checkbox = (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? Array.from(new Set([...skillDraft, skill.key]))
                      : skillDraft.filter((value) => value !== skill.key);
                    setSkillDraft(next);
                  }}
                  className="mt-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                />
              );

              return (
                <label key={skill.id} className={rowClassName}>
                  {required && adapterEntry?.requiredReason ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{checkbox}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{adapterEntry.requiredReason}</TooltipContent>
                    </Tooltip>
                  ) : skillSnapshot?.mode === "unsupported" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{checkbox}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {unsupportedSkillMessage ?? "Manage skills in the adapter directly."}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    checkbox
                  )}
                  {body}
                </label>
              );
            };

            if (optionalSkillRows.length === 0 && requiredSkillRows.length === 0 && unmanagedSkillRows.length === 0) {
              return (
                <section className="border-y border-border">
                  <div className="px-3 py-6 text-sm text-muted-foreground">
                    Import skills into the company library first, then attach them here.
                  </div>
                </section>
              );
            }

            return (
              <>
                {optionalSkillRows.length > 0 && (
                  <section className="border-y border-border">
                    {optionalSkillRows.map(renderSkillRow)}
                  </section>
                )}

                {requiredSkillRows.length > 0 && (
                  <section className="border-y border-border">
                    <div className="border-b border-border bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Required by Paperclip
                      </span>
                    </div>
                    {requiredSkillRows.map(renderSkillRow)}
                  </section>
                )}

                {unmanagedSkillRows.length > 0 && (
                  <section className="border-y border-border">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex cursor-pointer items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 select-none"
                      onClick={() => setUnmanagedOpen((v) => !v)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setUnmanagedOpen((v) => !v); } }}
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        ({unmanagedSkillRows.length}) User-installed skills, not managed by Paperclip
                      </span>
                      {unmanagedOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    {unmanagedOpen && unmanagedSkillRows.map(renderSkillRow)}
                  </section>
                )}
              </>
            );
          })()}

          {desiredOnlyMissingSkills.length > 0 && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="font-medium">Requested skills missing from the company library</div>
              <div className="mt-1 text-xs">
                {desiredOnlyMissingSkills.join(", ")}
              </div>
            </div>
          )}

          <section className="border-t border-border pt-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span className="text-muted-foreground">Adapter</span>
                <span className="font-medium">{adapterLabels[agent.adapterType] ?? agent.adapterType}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span className="text-muted-foreground">Skills applied</span>
                <span>{skillApplicationLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span className="text-muted-foreground">Selected skills</span>
                <span>{skillDraft.length}</span>
              </div>
            </div>

            {syncSkills.isError && (
              <p className="mt-3 text-xs text-destructive">
                {syncSkills.error instanceof Error ? syncSkills.error.message : "Failed to update skills"}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ---- Runs Tab ---- */

function RunListItem({ run, isSelected, agentId }: { run: HeartbeatRun; isSelected: boolean; agentId: string }) {
  const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const StatusIcon = statusInfo.icon;
  const metrics = runMetrics(run);
  const summary = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  return (
    <Link
      to={isSelected ? `/agents/${agentId}/runs` : `/agents/${agentId}/runs/${run.id}`}
      className={cn(
        "flex flex-col gap-1 w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 transition-colors no-underline text-inherit",
        isSelected ? "bg-accent/40" : "hover:bg-accent/20",
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
        <span className="text-xs text-muted-foreground">
          {new Date(run.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
          run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
            : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
            : "bg-muted text-muted-foreground"
        )}>
          {sourceLabels[run.invocationSource] ?? run.invocationSource}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
          {relativeTime(run.createdAt)}
        </span>
      </div>
      {summary && (
        <span className="text-xs text-muted-foreground truncate pl-5.5">
          {summary.slice(0, 60)}
        </span>
      )}
      {(metrics.totalTokens > 0 || metrics.cost > 0) && (
        <div className="flex items-center gap-2 pl-5.5 text-[11px] text-muted-foreground tabular-nums">
          {metrics.totalTokens > 0 && <span>{formatTokens(metrics.totalTokens)} tok</span>}
          {metrics.cost > 0 && <span>${metrics.cost.toFixed(3)}</span>}
        </div>
      )}
    </Link>
  );
}

function RunsTab({
  runs,
  companyId,
  agentId,
  agentRouteId,
  selectedRunId,
  adapterType,
}: {
  runs: HeartbeatRun[];
  companyId: string;
  agentId: string;
  agentRouteId: string;
  selectedRunId: string | null;
  adapterType: string;
}) {
  const { isMobile } = useSidebar();

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  }

  // Sort by created descending
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // On mobile, don't auto-select so the list shows first; on desktop, auto-select latest
  const effectiveRunId = isMobile ? selectedRunId : (selectedRunId ?? sorted[0]?.id ?? null);
  const selectedRun = sorted.find((r) => r.id === effectiveRunId) ?? null;

  // Mobile: show either run list OR run detail with back button
  if (isMobile) {
    if (selectedRun) {
      return (
        <div className="space-y-3 min-w-0 overflow-x-hidden">
          <Link
            to={`/agents/${agentRouteId}/runs`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to runs
          </Link>
          <RunDetail key={selectedRun.id} run={selectedRun} agentRouteId={agentRouteId} adapterType={adapterType} />
        </div>
      );
    }
    return (
      <div className="border border-border rounded-lg overflow-x-hidden">
        {sorted.map((run) => (
          <RunListItem key={run.id} run={run} isSelected={false} agentId={agentRouteId} />
        ))}
      </div>
    );
  }

  // Desktop: side-by-side layout
  return (
    <div className="flex gap-0">
      {/* Left: run list — border stretches full height, content sticks */}
      <div className={cn(
        "shrink-0 border border-border rounded-lg",
        selectedRun ? "w-72" : "w-full",
      )}>
        <div className="sticky top-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        {sorted.map((run) => (
          <RunListItem key={run.id} run={run} isSelected={run.id === effectiveRunId} agentId={agentRouteId} />
        ))}
        </div>
      </div>

      {/* Right: run detail — natural height, page scrolls */}
      {selectedRun && (
        <div className="flex-1 min-w-0 pl-4">
          <RunDetail key={selectedRun.id} run={selectedRun} agentRouteId={agentRouteId} adapterType={adapterType} />
        </div>
      )}
    </div>
  );
}

/* ---- Run Detail (expanded) ---- */

function RunDetail({ run: initialRun, agentRouteId, adapterType }: { run: HeartbeatRun; agentRouteId: string; adapterType: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: hydratedRun } = useQuery({
    queryKey: queryKeys.runDetail(initialRun.id),
    queryFn: () => heartbeatsApi.get(initialRun.id),
    enabled: Boolean(initialRun.id),
  });
  const run = hydratedRun ?? initialRun;
  const metrics = runMetrics(run);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [claudeLoginResult, setClaudeLoginResult] = useState<ClaudeLoginResult | null>(null);

  useEffect(() => {
    setClaudeLoginResult(null);
  }, [run.id]);

  const cancelRun = useMutation({
    mutationFn: () => heartbeatsApi.cancel(run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.companyId, run.agentId) });
    },
  });
  const canResumeLostRun = run.errorCode === "process_lost" && run.status === "failed";
  const resumePayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      resumeFromRunId: run.id,
    };
    const context = asRecord(run.contextSnapshot);
    if (!context) return payload;
    const issueId = asNonEmptyString(context.issueId);
    const taskId = asNonEmptyString(context.taskId);
    const taskKey = asNonEmptyString(context.taskKey);
    const commentId = asNonEmptyString(context.wakeCommentId) ?? asNonEmptyString(context.commentId);
    if (issueId) payload.issueId = issueId;
    if (taskId) payload.taskId = taskId;
    if (taskKey) payload.taskKey = taskKey;
    if (commentId) payload.commentId = commentId;
    return payload;
  }, [run.contextSnapshot, run.id]);
  const resumeRun = useMutation({
    mutationFn: async () => {
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "resume_process_lost_run",
        payload: resumePayload,
      }, run.companyId);
      if (!("id" in result)) {
        throw new Error("Resume request was skipped because the agent is not currently invokable.");
      }
      return result;
    },
    onSuccess: (resumedRun) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.companyId, run.agentId) });
      navigate(`/agents/${agentRouteId}/runs/${resumedRun.id}`);
    },
  });

  const canRetryRun = run.status === "failed" || run.status === "timed_out";
  const retryPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const context = asRecord(run.contextSnapshot);
    if (!context) return payload;
    const issueId = asNonEmptyString(context.issueId);
    const taskId = asNonEmptyString(context.taskId);
    const taskKey = asNonEmptyString(context.taskKey);
    if (issueId) payload.issueId = issueId;
    if (taskId) payload.taskId = taskId;
    if (taskKey) payload.taskKey = taskKey;
    return payload;
  }, [run.contextSnapshot]);
  const retryRun = useMutation({
    mutationFn: async () => {
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload: retryPayload,
      }, run.companyId);
      if (!("id" in result)) {
        throw new Error("Retry was skipped because the agent is not currently invokable.");
      }
      return result;
    },
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.companyId, run.agentId) });
      navigate(`/agents/${agentRouteId}/runs/${newRun.id}`);
    },
  });

  const { data: touchedIssues } = useQuery({
    queryKey: queryKeys.runIssues(run.id),
    queryFn: () => activityApi.issuesForRun(run.id),
  });
  const touchedIssueIds = useMemo(
    () => Array.from(new Set((touchedIssues ?? []).map((issue) => issue.issueId))),
    [touchedIssues],
  );

  const clearSessionsForTouchedIssues = useMutation({
    mutationFn: async () => {
      if (touchedIssueIds.length === 0) return 0;
      await Promise.all(touchedIssueIds.map((issueId) => agentsApi.resetSession(run.agentId, issueId, run.companyId)));
      return touchedIssueIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.runtimeState(run.agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.taskSessions(run.agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.runIssues(run.id) });
    },
  });

  const runClaudeLogin = useMutation({
    mutationFn: () => agentsApi.loginWithClaude(run.agentId, run.companyId),
    onSuccess: (data) => {
      setClaudeLoginResult(data);
    },
  });

  const isRunning = run.status === "running" && !!run.startedAt && !run.finishedAt;
  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    if (!run.startedAt) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000));
  });

  useEffect(() => {
    if (!isRunning || !run.startedAt) return;
    const startMs = new Date(run.startedAt).getTime();
    setElapsedSec(Math.max(0, Math.round((Date.now() - startMs) / 1000)));
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.round((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, run.startedAt]);

  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const startTime = run.startedAt ? new Date(run.startedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const endTime = run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const durationSec = run.startedAt && run.finishedAt
    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;
  const displayDurationSec = durationSec ?? (isRunning ? elapsedSec : null);
  const hasMetrics = metrics.input > 0 || metrics.output > 0 || metrics.cached > 0 || metrics.cost > 0;
  const hasSession = !!(run.sessionIdBefore || run.sessionIdAfter);
  const sessionChanged = run.sessionIdBefore && run.sessionIdAfter && run.sessionIdBefore !== run.sessionIdAfter;
  const sessionId = run.sessionIdAfter || run.sessionIdBefore;
  const hasNonZeroExit = run.exitCode !== null && run.exitCode !== 0;

  return (
    <div className="space-y-4 min-w-0">
      {/* Run summary card */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Left column: status + timing */}
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              {(run.status === "running" || run.status === "queued") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs h-6 px-2"
                  onClick={() => cancelRun.mutate()}
                  disabled={cancelRun.isPending}
                >
                  {cancelRun.isPending ? "Cancelling…" : "Cancel"}
                </Button>
              )}
              {canResumeLostRun && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => resumeRun.mutate()}
                  disabled={resumeRun.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  {resumeRun.isPending ? "Resuming…" : "Resume"}
                </Button>
              )}
              {canRetryRun && !canResumeLostRun && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => retryRun.mutate()}
                  disabled={retryRun.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  {retryRun.isPending ? "Retrying…" : "Retry"}
                </Button>
              )}
            </div>
            {resumeRun.isError && (
              <div className="text-xs text-destructive">
                {resumeRun.error instanceof Error ? resumeRun.error.message : "Failed to resume run"}
              </div>
            )}
            {retryRun.isError && (
              <div className="text-xs text-destructive">
                {retryRun.error instanceof Error ? retryRun.error.message : "Failed to retry run"}
              </div>
            )}
            {startTime && (
              <div className="space-y-0.5">
                <div className="text-sm">
                  {startTime}
                  {endTime && <span className="text-muted-foreground"> &rarr; </span>}
                  {endTime}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(run.startedAt!)}
                  {run.finishedAt && <> &rarr; {relativeTime(run.finishedAt)}</>}
                </div>
                {displayDurationSec !== null && (
                  <div className="text-xs text-muted-foreground">
                    Duration: {displayDurationSec >= 60 ? `${Math.floor(displayDurationSec / 60)}m ${displayDurationSec % 60}s` : `${displayDurationSec}s`}
                  </div>
                )}
              </div>
            )}
            {run.error && (
              <div className="text-xs">
                <span className="text-red-600 dark:text-red-400">{run.error}</span>
                {run.errorCode && <span className="text-muted-foreground ml-1">({run.errorCode})</span>}
              </div>
            )}
            {run.errorCode === "claude_auth_required" && adapterType === "claude_local" && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => runClaudeLogin.mutate()}
                  disabled={runClaudeLogin.isPending}
                >
                  {runClaudeLogin.isPending ? "Running claude login..." : "Login to Claude Code"}
                </Button>
                {runClaudeLogin.isError && (
                  <p className="text-xs text-destructive">
                    {runClaudeLogin.error instanceof Error
                      ? runClaudeLogin.error.message
                      : "Failed to run Claude login"}
                  </p>
                )}
                {claudeLoginResult?.loginUrl && (
                  <p className="text-xs">
                    Login URL:
                    <a
                      href={claudeLoginResult.loginUrl}
                      className="text-blue-600 underline underline-offset-2 ml-1 break-all dark:text-blue-400"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {claudeLoginResult.loginUrl}
                    </a>
                  </p>
                )}
                {claudeLoginResult && (
                  <>
                    {!!claudeLoginResult.stdout && (
                      <div className="text-xs text-muted-foreground py-1">
                        Setup completed successfully.
                      </div>
                    )}
                    {!!claudeLoginResult.stderr && (
                      <div className="text-xs text-red-600 dark:text-red-400 py-1">
                        Agent encountered an issue during setup.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {hasNonZeroExit && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {run.signal === "SIGTERM" ? "Was stopped" : run.signal === "SIGKILL" ? "Was force-stopped" : run.signal ? "Encountered an issue" : "Stopped unexpectedly"}
              </div>
            )}
          </div>

          {/* Right column: metrics */}
          {hasMetrics && (
            <div className="border-t sm:border-t-0 sm:border-l border-border p-4 grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 content-center tabular-nums">
              <div>
                <div className="text-xs text-muted-foreground">Input</div>
                <div className="text-sm font-medium tabular-nums">{formatTokens(metrics.input)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Output</div>
                <div className="text-sm font-medium tabular-nums">{formatTokens(metrics.output)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cached</div>
                <div className="text-sm font-medium tabular-nums">{formatTokens(metrics.cached)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost</div>
                <div className="text-sm font-medium tabular-nums">{metrics.cost > 0 ? `$${metrics.cost.toFixed(4)}` : "-"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible session row */}
        {hasSession && (
          <div className="border-t border-border">
            <button
              className="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSessionOpen((v) => !v)}
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", sessionOpen && "rotate-90")} />
              Session
              {sessionChanged && <span className="text-yellow-400 ml-1">(changed)</span>}
            </button>
            {sessionOpen && (
              <div className="px-4 pb-3 space-y-1 text-xs">
                {run.sessionIdBefore && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">{sessionChanged ? "Before" : "ID"}</span>
                    <CopyText text={run.sessionIdBefore} />
                  </div>
                )}
                {sessionChanged && run.sessionIdAfter && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">After</span>
                    <CopyText text={run.sessionIdAfter} />
                  </div>
                )}
                {touchedIssueIds.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
                      disabled={clearSessionsForTouchedIssues.isPending}
                      onClick={() => {
                        const issueCount = touchedIssueIds.length;
                        const confirmed = window.confirm(
                          `Clear session for ${issueCount} issue${issueCount === 1 ? "" : "s"} touched by this run?`,
                        );
                        if (!confirmed) return;
                        clearSessionsForTouchedIssues.mutate();
                      }}
                    >
                      {clearSessionsForTouchedIssues.isPending
                        ? "clearing session..."
                        : "clear session for these issues"}
                    </button>
                    {clearSessionsForTouchedIssues.isError && (
                      <p className="text-[11px] text-destructive mt-1">
                        {clearSessionsForTouchedIssues.error instanceof Error
                          ? clearSessionsForTouchedIssues.error.message
                          : "Failed to clear sessions"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Issues touched by this run */}
      {touchedIssues && touchedIssues.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Issues Touched ({touchedIssues.length})</span>
          <div className="border border-border rounded-lg divide-y divide-border">
            {touchedIssues.map((issue) => (
              <Link
                key={issue.issueId}
                to={`/issues/${issue.identifier ?? issue.issueId}`}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent/20 transition-colors text-left no-underline text-inherit"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={issue.status} />
                  <span className="truncate">{issue.title}</span>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2">{issue.identifier ?? ""}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Error message for failed runs */}
      {run.stderrExcerpt && (
        <div className="text-xs text-red-600 dark:text-red-400 py-2">
          Agent encountered an issue during this run.
        </div>
      )}

      {/* Log viewer */}
      <LogViewer run={run} adapterType={adapterType} />
      <ScrollToBottom />
    </div>
  );
}

/* ---- Log Viewer ---- */

function LogViewer({ run, adapterType }: { run: HeartbeatRun; adapterType: string }) {
  const [events, setEvents] = useState<HeartbeatRunEvent[]>([]);
  const [logLines, setLogLines] = useState<Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(!!run.logRef);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isStreamingConnected, setIsStreamingConnected] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("nice");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pendingLogLineRef = useRef("");
  const scrollContainerRef = useRef<ScrollContainer | null>(null);
  const isFollowingRef = useRef(false);
  const lastMetricsRef = useRef<{ scrollHeight: number; distanceFromBottom: number }>({
    scrollHeight: 0,
    distanceFromBottom: Number.POSITIVE_INFINITY,
  });
  const isLive = run.status === "running" || run.status === "queued";
  const { data: workspaceOperations = [] } = useQuery({
    queryKey: queryKeys.runWorkspaceOperations(run.id),
    queryFn: () => heartbeatsApi.workspaceOperations(run.id),
    refetchInterval: isLive ? 2000 : false,
  });

  function isRunLogUnavailable(err: unknown): boolean {
    return err instanceof ApiError && err.status === 404;
  }

  function appendLogContent(content: string, finalize = false) {
    if (!content && !finalize) return;
    const combined = `${pendingLogLineRef.current}${content}`;
    const split = combined.split("\n");
    pendingLogLineRef.current = split.pop() ?? "";
    if (finalize && pendingLogLineRef.current) {
      split.push(pendingLogLineRef.current);
      pendingLogLineRef.current = "";
    }

    const parsed: Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }> = [];
    for (const line of split) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
        const stream =
          raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
        const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
        const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
        if (!chunk) continue;
        parsed.push({ ts, stream, chunk });
      } catch {
        // ignore malformed lines
      }
    }

    if (parsed.length > 0) {
      setLogLines((prev) => [...prev, ...parsed]);
    }
  }

  // Fetch events
  const { data: initialEvents } = useQuery({
    queryKey: ["run-events", run.id],
    queryFn: () => heartbeatsApi.events(run.id, 0, 200),
  });

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
    }
  }, [initialEvents]);

  const getScrollContainer = useCallback((): ScrollContainer => {
    if (scrollContainerRef.current) return scrollContainerRef.current;
    const container = findScrollContainer(logEndRef.current);
    scrollContainerRef.current = container;
    return container;
  }, []);

  const updateFollowingState = useCallback(() => {
    const container = getScrollContainer();
    const metrics = readScrollMetrics(container);
    lastMetricsRef.current = metrics;
    const nearBottom = metrics.distanceFromBottom <= LIVE_SCROLL_BOTTOM_TOLERANCE_PX;
    isFollowingRef.current = nearBottom;
    setIsFollowing((prev) => (prev === nearBottom ? prev : nearBottom));
  }, [getScrollContainer]);

  useEffect(() => {
    scrollContainerRef.current = null;
    lastMetricsRef.current = {
      scrollHeight: 0,
      distanceFromBottom: Number.POSITIVE_INFINITY,
    };

    if (!isLive) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      return;
    }

    updateFollowingState();
  }, [isLive, run.id, updateFollowingState]);

  useEffect(() => {
    if (!isLive) return;
    const container = getScrollContainer();
    updateFollowingState();

    if (container === window) {
      window.addEventListener("scroll", updateFollowingState, { passive: true });
    } else {
      container.addEventListener("scroll", updateFollowingState, { passive: true });
    }
    window.addEventListener("resize", updateFollowingState);
    return () => {
      if (container === window) {
        window.removeEventListener("scroll", updateFollowingState);
      } else {
        container.removeEventListener("scroll", updateFollowingState);
      }
      window.removeEventListener("resize", updateFollowingState);
    };
  }, [isLive, run.id, getScrollContainer, updateFollowingState]);

  // Auto-scroll only for live runs when following
  useEffect(() => {
    if (!isLive || !isFollowingRef.current) return;

    const container = getScrollContainer();
    const previous = lastMetricsRef.current;
    const current = readScrollMetrics(container);
    const growth = Math.max(0, current.scrollHeight - previous.scrollHeight);
    const expectedDistance = previous.distanceFromBottom + growth;
    const movedAwayBy = current.distanceFromBottom - expectedDistance;

    // If user moved away from bottom between updates, release auto-follow immediately.
    if (movedAwayBy > LIVE_SCROLL_BOTTOM_TOLERANCE_PX) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      lastMetricsRef.current = current;
      return;
    }

    scrollToContainerBottom(container, "auto");
    const after = readScrollMetrics(container);
    lastMetricsRef.current = after;
    if (!isFollowingRef.current) {
      isFollowingRef.current = true;
    }
    setIsFollowing((prev) => (prev ? prev : true));
  }, [events.length, logLines.length, isLive, getScrollContainer]);

  // Fetch persisted shell log
  useEffect(() => {
    let cancelled = false;
    pendingLogLineRef.current = "";
    setLogLines([]);
    setLogOffset(0);
    setLogError(null);

    if (!run.logRef && !isLive) {
      setLogLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLogLoading(true);
    const firstLimit =
      typeof run.logBytes === "number" && run.logBytes > 0
        ? Math.min(Math.max(run.logBytes + 1024, 256_000), 2_000_000)
        : 256_000;

    const load = async () => {
      try {
        let offset = 0;
        let first = true;
        while (!cancelled) {
          const result = await heartbeatsApi.log(run.id, offset, first ? firstLimit : 256_000);
          if (cancelled) break;
          appendLogContent(result.content, result.nextOffset === undefined);
          const next = result.nextOffset ?? offset + result.content.length;
          setLogOffset(next);
          offset = next;
          first = false;
          if (result.nextOffset === undefined || isLive) break;
        }
      } catch (err) {
        if (!cancelled) {
          if (isLive && isRunLogUnavailable(err)) {
            setLogLoading(false);
            return;
          }
          setLogError(err instanceof Error ? err.message : "Failed to load run log");
        }
      } finally {
        if (!cancelled) setLogLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [run.id, run.logRef, run.logBytes, isLive]);

  // Poll for live updates
  useEffect(() => {
    if (!isLive || isStreamingConnected) return;
    const interval = setInterval(async () => {
      const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
      try {
        const newEvents = await heartbeatsApi.events(run.id, maxSeq, 100);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, isStreamingConnected, events]);

  // Poll shell log for running runs
  useEffect(() => {
    if (!isLive || isStreamingConnected) return;
    const interval = setInterval(async () => {
      try {
        const result = await heartbeatsApi.log(run.id, logOffset, 256_000);
        if (result.content) {
          appendLogContent(result.content, result.nextOffset === undefined);
        }
        if (result.nextOffset !== undefined) {
          setLogOffset(result.nextOffset);
        } else if (result.content.length > 0) {
          setLogOffset((prev) => prev + result.content.length);
        }
      } catch (err) {
        if (isRunLogUnavailable(err)) return;
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, isStreamingConnected, logOffset]);

  // Stream live updates from websocket (primary path for running runs).
  useEffect(() => {
    if (!isLive) return;

    let closed = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectTimer = window.setTimeout(connect, 1500);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(run.companyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        setIsStreamingConnected(true);
      };

      socket.onmessage = (message) => {
        const rawMessage = typeof message.data === "string" ? message.data : "";
        if (!rawMessage) return;

        let event: LiveEvent;
        try {
          event = JSON.parse(rawMessage) as LiveEvent;
        } catch {
          return;
        }

        if (event.companyId !== run.companyId) return;
        const payload = asRecord(event.payload);
        const eventRunId = asNonEmptyString(payload?.runId);
        if (!payload || eventRunId !== run.id) return;

        if (event.type === "heartbeat.run.log") {
          const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
          if (!chunk) return;
          const streamRaw = asNonEmptyString(payload.stream);
          const stream = streamRaw === "stderr" || streamRaw === "system" ? streamRaw : "stdout";
          const ts = asNonEmptyString((payload as Record<string, unknown>).ts) ?? event.createdAt;
          setLogLines((prev) => [...prev, { ts, stream, chunk }]);
          return;
        }

        if (event.type !== "heartbeat.run.event") return;

        const seq = typeof payload.seq === "number" ? payload.seq : null;
        if (seq === null || !Number.isFinite(seq)) return;

        const streamRaw = asNonEmptyString(payload.stream);
        const stream =
          streamRaw === "stdout" || streamRaw === "stderr" || streamRaw === "system"
            ? streamRaw
            : null;
        const levelRaw = asNonEmptyString(payload.level);
        const level =
          levelRaw === "info" || levelRaw === "warn" || levelRaw === "error"
            ? levelRaw
            : null;

        const liveEvent: HeartbeatRunEvent = {
          id: seq,
          companyId: run.companyId,
          runId: run.id,
          agentId: run.agentId,
          seq,
          eventType: asNonEmptyString(payload.eventType) ?? "event",
          stream,
          level,
          color: asNonEmptyString(payload.color),
          message: asNonEmptyString(payload.message),
          payload: asRecord(payload.payload),
          createdAt: new Date(event.createdAt),
        };

        setEvents((prev) => {
          if (prev.some((existing) => existing.seq === seq)) return prev;
          return [...prev, liveEvent];
        });
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        setIsStreamingConnected(false);
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      setIsStreamingConnected(false);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "run_detail_unmount");
      }
    };
  }, [isLive, run.companyId, run.id, run.agentId]);

  const censorUsernameInLogs = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  }).data?.censorUsernameInLogs === true;

  const adapterInvokePayload = useMemo(() => {
    const evt = events.find((e) => e.eventType === "adapter.invoke");
    return redactPathValue(asRecord(evt?.payload ?? null), censorUsernameInLogs);
  }, [censorUsernameInLogs, events]);

  const adapter = useMemo(() => getUIAdapter(adapterType), [adapterType]);
  const transcript = useMemo(
    () => buildTranscript(logLines, adapter.parseStdoutLine, { censorUsernameInLogs }),
    [adapter, censorUsernameInLogs, logLines],
  );

  useEffect(() => {
    setTranscriptMode("nice");
  }, [run.id]);

  if (loading && logLoading) {
    return <p className="text-xs text-muted-foreground">Loading run logs...</p>;
  }

  if (events.length === 0 && logLines.length === 0 && !logError) {
    return <p className="text-xs text-muted-foreground">No log events.</p>;
  }

  const levelColors: Record<string, string> = {
    info: "text-foreground",
    warn: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  };

  const streamColors: Record<string, string> = {
    stdout: "text-foreground",
    stderr: "text-red-600 dark:text-red-300",
    system: "text-blue-600 dark:text-blue-300",
  };

  return (
    <div className="space-y-3">
      <WorkspaceOperationsSection
        operations={workspaceOperations}
        censorUsernameInLogs={censorUsernameInLogs}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Transcript ({transcript.length})
        </span>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-background/70 p-0.5">
            {(["nice", "raw"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  transcriptMode === mode
                    ? "bg-accent text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTranscriptMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          {isLive && !isFollowing && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                const container = getScrollContainer();
                isFollowingRef.current = true;
                setIsFollowing(true);
                scrollToContainerBottom(container, "auto");
                lastMetricsRef.current = readScrollMetrics(container);
              }}
            >
              Jump to live
            </Button>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-cyan-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              Live
            </span>
          )}
        </div>
      </div>
      <div className="max-h-[38rem] overflow-y-auto rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-4">
        <RunTranscriptView
          entries={transcript}
          mode={transcriptMode}
          streaming={isLive}
          emptyMessage={run.logRef ? "Waiting for transcript..." : "No persisted transcript for this run."}
        />
        {logError && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {logError}
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {(run.status === "failed" || run.status === "timed_out") && (
        <div className="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
          <div className="text-xs font-medium text-red-700 dark:text-red-300">Failure details</div>
          {run.error && (
            <div className="text-xs text-red-600 dark:text-red-200">
              <span className="text-red-700 dark:text-red-300">Error: </span>
              {redactPathText(run.error, censorUsernameInLogs)}
            </div>
          )}
          {(run.stderrExcerpt?.trim() || run.resultJson) && (
            <div className="text-xs text-red-600 dark:text-red-400">
              Agent encountered an issue during this run.
            </div>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Events ({events.length})</div>
          <div className="bg-neutral-100 dark:bg-neutral-950 rounded-lg p-3 text-xs space-y-0.5">
            {events.map((evt) => {
              const color = evt.color
                ?? (evt.level ? levelColors[evt.level] : null)
                ?? (evt.stream ? streamColors[evt.stream] : null)
                ?? "text-foreground";

              return (
                <div key={evt.id} className="flex gap-2">
                  <span className="text-neutral-400 dark:text-neutral-600 shrink-0 select-none w-16">
                    {new Date(evt.createdAt).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={cn("shrink-0 w-4", evt.stream ? (streamColors[evt.stream] ?? "text-neutral-500") : "text-neutral-500")}>
                    {evt.stream === "stderr" ? "!" : ""}
                  </span>
                  <span className={cn("break-all", color)}>
                    {evt.message
                      ? redactPathText(evt.message, censorUsernameInLogs)
                      : evt.payload
                        ? "Event processed"
                        : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Keys Tab ---- */

function KeysTab({ agentId, companyId }: { agentId: string; companyId?: string }) {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: queryKeys.agents.keys(agentId),
    queryFn: () => agentsApi.listKeys(agentId, companyId),
  });

  const createKey = useMutation({
    mutationFn: () => agentsApi.createKey(agentId, newKeyName.trim() || "Default", companyId),
    onSuccess: (data) => {
      setNewToken(data.token);
      setTokenVisible(true);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.keys(agentId) });
    },
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => agentsApi.revokeKey(agentId, keyId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.keys(agentId) });
    },
  });

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = (keys ?? []).filter((k: AgentKey) => !k.revokedAt);
  const revokedKeys = (keys ?? []).filter((k: AgentKey) => k.revokedAt);

  return (
    <div className="space-y-6">
      {/* New token banner */}
      {newToken && (
        <div className="border border-yellow-300 dark:border-yellow-600/40 bg-yellow-50 dark:bg-yellow-500/5 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            API key created — copy it now, it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-neutral-100 dark:bg-neutral-950 rounded px-3 py-1.5 text-xs font-mono text-green-700 dark:text-green-300 truncate">
              {tokenVisible ? newToken : newToken.replace(/./g, "•")}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTokenVisible((v) => !v)}
              title={tokenVisible ? "Hide" : "Show"}
            >
              {tokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyToken}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {copied && <span className="text-xs text-green-400">Copied!</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs"
            onClick={() => setNewToken(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Create new key */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Key className="h-3.5 w-3.5" />
          Create API Key
        </h3>
        <p className="text-xs text-muted-foreground">
          Connection keys allow this agent to authenticate with the server.
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Key name (e.g. production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") createKey.mutate();
            }}
          />
          <Button
            size="sm"
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Active keys */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading keys...</p>}

      {!isLoading && activeKeys.length === 0 && !newToken && (
        <p className="text-sm text-muted-foreground">No active connection keys.</p>
      )}

      {activeKeys.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            Active Keys
          </h3>
          <div className="border border-border rounded-lg divide-y divide-border">
            {activeKeys.map((key: AgentKey) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium">{key.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    Created {formatDate(key.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs"
                  onClick={() => revokeKey.mutate(key.id)}
                  disabled={revokeKey.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            Revoked Keys
          </h3>
          <div className="border border-border rounded-lg divide-y divide-border opacity-50">
            {revokedKeys.map((key: AgentKey) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm line-through">{key.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">
                    Revoked {key.revokedAt ? formatDate(key.revokedAt) : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
