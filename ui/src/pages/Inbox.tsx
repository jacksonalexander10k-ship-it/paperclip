import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { accessApi } from "../api/access";
import { ApiError } from "../api/client";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { createIssueDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { IssueRow } from "../components/IssueRow";
import { SwipeToArchive } from "../components/SwipeToArchive";
import { PageHeader } from "../components/PageHeader";

import { StatusIcon } from "../components/StatusIcon";
import { cn } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { approvalLabel, defaultTypeIcon, typeIcon } from "../components/ApprovalPayload";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Inbox as InboxIcon,
  AlertTriangle,
  XCircle,
  X,
  RotateCcw,
  UserPlus,
  CheckCheck,
} from "lucide-react";
import { PageTabBar } from "../components/PageTabBar";
import type { Approval, HeartbeatRun, Issue, JoinRequest } from "@paperclipai/shared";
import {
  ACTIONABLE_APPROVAL_STATUSES,
  getApprovalsForTab,
  getInboxWorkItems,
  getLatestFailedRunsByAgent,
  getRecentTouchedIssues,
  InboxApprovalFilter,
  saveLastInboxTab,
  shouldShowInboxSection,
  type InboxTab,
} from "../lib/inbox";
import { useDismissedInboxItems, useReadInboxItems } from "../hooks/useInboxBadge";

type InboxCategoryFilter =
  | "everything"
  | "issues_i_touched"
  | "join_requests"
  | "approvals"
  | "failed_runs"
  | "alerts";
type SectionKey =
  | "work_items"
  | "alerts";

const INBOX_ISSUE_STATUSES = "backlog,todo,in_progress,in_review,blocked,done";

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.split("\n").map((chunk) => chunk.trim()).find(Boolean);
  return line ?? null;
}

function runFailureMessage(run: HeartbeatRun): string {
  const raw = firstNonEmptyLine(run.error) ?? firstNonEmptyLine(run.stderrExcerpt) ?? "";
  return sanitizeErrorMessage(raw);
}

/** Clean up raw error messages for non-technical users */
function sanitizeErrorMessage(raw: string): string {
  if (!raw) return "Something went wrong. Try again or contact support.";
  const lower = raw.toLowerCase();
  // Credit/billing errors
  if (lower.includes("credit balance") || lower.includes("insufficient_quota") || lower.includes("rate_limit"))
    return "Credit balance is low. Please add credits to continue.";
  // Auth errors
  if (lower.includes("unauthorized") || lower.includes("authentication") || lower.includes("api key"))
    return "Authentication error. Please check your settings.";
  // Timeout
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "The agent took too long to respond. It will retry automatically.";
  // Process/adapter errors
  if (lower.includes("adapter") || lower.includes("process") || lower.includes("spawn"))
    return "Agent couldn't start. Please try again.";
  // Strip "Claude run failed:" prefix and "subtype=xxx:" codes
  let cleaned = raw
    .replace(/Claude run failed:\s*/i, "")
    .replace(/subtype=\w+:\s*/i, "")
    .replace(/\(adapter_failed\)/i, "")
    .trim();
  if (!cleaned) return "Something went wrong. Try again or contact support.";
  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function approvalStatusLabel(status: Approval["status"]): string {
  return status.replaceAll("_", " ");
}

function readIssueIdFromRun(run: HeartbeatRun): string | null {
  const context = run.contextSnapshot;
  if (!context) return null;

  const issueId = context["issueId"];
  if (typeof issueId === "string" && issueId.length > 0) return issueId;

  const taskId = context["taskId"];
  if (typeof taskId === "string" && taskId.length > 0) return taskId;

  return null;
}


type NonIssueUnreadState = "visible" | "fading" | "hidden" | null;

/* ------------------------------------------------------------------ */
/*  Notification-card row for failed runs                              */
/* ------------------------------------------------------------------ */
function FailedRunInboxRow({
  run,
  issueById,
  agentName: linkedAgentName,
  issueLinkState,
  onDismiss,
  onRetry,
  isRetrying,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  className,
}: {
  run: HeartbeatRun;
  issueById: Map<string, Issue>;
  agentName: string | null;
  issueLinkState: unknown;
  onDismiss: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  unreadState?: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  className?: string;
}) {
  const issueId = readIssueIdFromRun(run);
  const issue = issueId ? issueById.get(issueId) ?? null : null;
  const displayError = runFailureMessage(run);
  const isUnread = unreadState === "visible" || unreadState === "fading";

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 cursor-pointer transition-all",
        isUnread
          ? "border-primary/25 bg-primary/5"
          : "bg-card/80 border-border/50 hover:border-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="flex items-center pt-1 w-3 shrink-0">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRead?.(); }}
              className="block h-2 w-2 rounded-full bg-green-500 transition-opacity hover:opacity-70"
              aria-label="Mark as read"
            />
          )}
        </div>

        {/* Icon */}
        <span className="mt-0.5 shrink-0 rounded-lg bg-red-500/10 p-1.5">
          <XCircle className="h-4 w-4 text-red-500" />
        </span>

        {/* Content */}
        <Link
          to={`/agents/${run.agentId}/runs/${run.id}`}
          className="min-w-0 flex-1 no-underline text-inherit"
        >
          <span className="block text-[12.5px] font-bold text-foreground leading-tight">
            {issue ? issue.title : <>Failed run{linkedAgentName ? ` — ${linkedAgentName}` : ""}</>}
          </span>
          <span className="mt-1 block text-[12px] text-muted-foreground line-clamp-1">
            {displayError}
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={run.status} />
            {linkedAgentName && issue ? (
              <span className="text-[11px] text-muted-foreground">{linkedAgentName}</span>
            ) : null}
          </div>
        </Link>

        {/* Right side: time + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {timeAgo(run.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-primary hover:text-primary"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRetry(); }}
              disabled={isRetrying}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {isRetrying ? "Retrying..." : "View Run"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification-card row for approvals                                */
/* ------------------------------------------------------------------ */
function ApprovalInboxRow({
  approval,
  requesterName,
  onApprove,
  onReject,
  isPending,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  className,
}: {
  approval: Approval;
  requesterName: string | null;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  unreadState?: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  className?: string;
}) {
  const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
  const label = approvalLabel(approval.type, approval.payload as Record<string, unknown> | null);
  const showResolutionButtons =
    approval.type !== "budget_override_required" &&
    ACTIONABLE_APPROVAL_STATUSES.has(approval.status);
  const isUnread = unreadState === "visible" || unreadState === "fading";

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 cursor-pointer transition-all",
        isUnread
          ? "border-primary/25 bg-primary/5"
          : "bg-card/80 border-border/50 hover:border-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="flex items-center pt-1 w-3 shrink-0">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRead?.(); }}
              className="block h-2 w-2 rounded-full bg-green-500 transition-opacity hover:opacity-70"
              aria-label="Mark as read"
            />
          )}
        </div>

        {/* Icon */}
        <span className="mt-0.5 shrink-0 rounded-lg bg-muted p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>

        {/* Content */}
        <Link
          to={`/approvals/${approval.id}`}
          className="min-w-0 flex-1 no-underline text-inherit"
        >
          <span className="block text-[12.5px] font-bold text-foreground leading-tight">
            {label}
          </span>
          <span className="mt-1 block text-[12px] text-muted-foreground">
            <span className="capitalize">{approvalStatusLabel(approval.status)}</span>
            {requesterName ? <> &middot; requested by {requesterName}</> : null}
          </span>
        </Link>

        {/* Right side: time + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {timeAgo(approval.updatedAt)}
          </span>
          {showResolutionButtons && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-7 bg-green-700 px-2.5 text-[11px] text-white hover:bg-green-600"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onApprove(); }}
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReject(); }}
                disabled={isPending}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification-card row for join requests                            */
/* ------------------------------------------------------------------ */
function JoinRequestInboxRow({
  joinRequest,
  onApprove,
  onReject,
  isPending,
  unreadState = null,
  onMarkRead,
  onArchive,
  archiveDisabled,
  className,
}: {
  joinRequest: JoinRequest;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  unreadState?: NonIssueUnreadState;
  onMarkRead?: () => void;
  onArchive?: () => void;
  archiveDisabled?: boolean;
  className?: string;
}) {
  const label =
    joinRequest.requestType === "human"
      ? "Human join request"
      : `Agent join request${joinRequest.agentName ? `: ${joinRequest.agentName}` : ""}`;
  const isUnread = unreadState === "visible" || unreadState === "fading";

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 cursor-pointer transition-all",
        isUnread
          ? "border-primary/25 bg-primary/5"
          : "bg-card/80 border-border/50 hover:border-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="flex items-center pt-1 w-3 shrink-0">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRead?.(); }}
              className="block h-2 w-2 rounded-full bg-green-500 transition-opacity hover:opacity-70"
              aria-label="Mark as read"
            />
          )}
        </div>

        {/* Icon */}
        <span className="mt-0.5 shrink-0 rounded-lg bg-muted p-1.5">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-foreground leading-tight">
            {label}
          </span>
          <span className="mt-1 block text-[12px] text-muted-foreground">
            requested {timeAgo(joinRequest.createdAt)} from IP {joinRequest.requestIp}
            {joinRequest.adapterType && <> &middot; adapter: {joinRequest.adapterType}</>}
          </span>
        </div>

        {/* Right side: time + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {timeAgo(joinRequest.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 bg-green-700 px-2.5 text-[11px] text-white hover:bg-green-600"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onApprove(); }}
              disabled={isPending}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReject(); }}
              disabled={isPending}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification-card row for issues (wrapped around IssueRow)         */
/* ------------------------------------------------------------------ */
function IssueNotificationCard({
  issue,
  issueLinkState,
  liveIssueIds,
  isUnread,
  isFading,
  isArchiving,
  isMineTab,
  onMarkRead,
  onArchive,
  archiveDisabled,
}: {
  issue: Issue & { isUnreadForMe?: boolean };
  issueLinkState: unknown;
  liveIssueIds: Set<string>;
  isUnread: boolean;
  isFading: boolean;
  isArchiving: boolean;
  isMineTab: boolean;
  onMarkRead: () => void;
  onArchive?: () => void;
  archiveDisabled: boolean;
}) {
  const showDot = isUnread || isFading;

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 cursor-pointer transition-all",
        showDot
          ? "border-primary/25 bg-primary/5"
          : "bg-card/80 border-border/50 hover:border-border",
        isArchiving && "pointer-events-none -translate-x-4 scale-[0.98] opacity-0",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="flex items-center pt-1 w-3 shrink-0">
          {showDot && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
              className={cn(
                "block h-2 w-2 rounded-full bg-green-500 transition-opacity hover:opacity-70",
                isFading && "opacity-0",
              )}
              aria-label="Mark as read"
            />
          )}
        </div>

        {/* Icon */}
        <span className="mt-0.5 shrink-0">
          <StatusIcon status={issue.status} />
        </span>

        {/* Content */}
        <Link
          to={`/issues/${issue.id}`}
          state={issueLinkState}
          className="min-w-0 flex-1 no-underline text-inherit"
        >
          <span className="block text-[12.5px] font-bold text-foreground leading-tight">
            {issue.title}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="font-mono text-[11px]">
              {issue.identifier ?? issue.id.slice(0, 8)}
            </span>
            {liveIssueIds.has(issue.id) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                </span>
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  Live
                </span>
              </span>
            ) : issue.lastExternalCommentAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5">
                <CheckCheck className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                  Replied
                </span>
              </span>
            ) : issue.status !== "done" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Pending
                </span>
              </span>
            ) : null}
          </span>
        </Link>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {issue.lastExternalCommentAt
              ? timeAgo(issue.lastExternalCommentAt)
              : timeAgo(issue.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Alert notification card                                            */
/* ================================================================== */
function AlertNotificationCard({
  icon,
  iconColor,
  children,
  to,
  onDismiss,
}: {
  icon: React.ReactNode;
  iconColor?: string;
  children: React.ReactNode;
  to: string;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-3.5 cursor-pointer transition-all hover:border-border group">
      <div className="flex items-center gap-3">
        <div className="flex items-center pt-0 w-3 shrink-0" />
        {icon}
        <Link to={to} className="flex-1 no-underline text-inherit">
          <span className="text-[12.5px] font-bold text-foreground">{children}</span>
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


/* ================================================================== */
/*  Main Inbox page                                                    */
/* ================================================================== */
export function Inbox() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [allCategoryFilter, setAllCategoryFilter] = useState<InboxCategoryFilter>("everything");
  const [allApprovalFilter, setAllApprovalFilter] = useState<InboxApprovalFilter>("all");
  const { dismissed, dismiss } = useDismissedInboxItems();
  const { readItems, markRead: markItemRead } = useReadInboxItems();

  const pathSegment = location.pathname.split("/").pop() ?? "mine";
  const tab: InboxTab =
    pathSegment === "mine" || pathSegment === "recent" || pathSegment === "all" || pathSegment === "unread"
      ? pathSegment
      : "mine";
  const issueLinkState = useMemo(
    () =>
      createIssueDetailLocationState(
        "Inbox",
        `${location.pathname}${location.search}${location.hash}`,
      ),
    [location.pathname, location.search, location.hash],
  );

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    saveLastInboxTab(tab);
  }, [tab]);

  const {
    data: approvals,
    isLoading: isApprovalsLoading,
    error: approvalsError,
  } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: joinRequests = [],
    isLoading: isJoinRequestsLoading,
  } = useQuery({
    queryKey: queryKeys.access.joinRequests(selectedCompanyId!),
    queryFn: async () => {
      try {
        return await accessApi.listJoinRequests(selectedCompanyId!, "pending_approval");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!selectedCompanyId,
    retry: false,
  });

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues, isLoading: isIssuesLoading } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const {
    data: mineIssuesRaw = [],
    isLoading: isMineIssuesLoading,
  } = useQuery({
    queryKey: queryKeys.issues.listMineByMe(selectedCompanyId!),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        touchedByUserId: "me",
        inboxArchivedByUserId: "me",
        status: INBOX_ISSUE_STATUSES,
      }),
    enabled: !!selectedCompanyId,
  });
  const {
    data: touchedIssuesRaw = [],
    isLoading: isTouchedIssuesLoading,
  } = useQuery({
    queryKey: queryKeys.issues.listTouchedByMe(selectedCompanyId!),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        touchedByUserId: "me",
        status: INBOX_ISSUE_STATUSES,
      }),
    enabled: !!selectedCompanyId,
  });

  const { data: heartbeatRuns, isLoading: isRunsLoading } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const mineIssues = useMemo(() => getRecentTouchedIssues(mineIssuesRaw), [mineIssuesRaw]);
  const touchedIssues = useMemo(() => getRecentTouchedIssues(touchedIssuesRaw), [touchedIssuesRaw]);
  const unreadTouchedIssues = useMemo(
    () => touchedIssues.filter((issue) => issue.isUnreadForMe),
    [touchedIssues],
  );
  const issuesToRender = useMemo(
    () => {
      if (tab === "mine") return mineIssues;
      if (tab === "unread") return unreadTouchedIssues;
      return touchedIssues;
    },
    [tab, mineIssues, touchedIssues, unreadTouchedIssues],
  );

  const agentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);

  const failedRuns = useMemo(
    () => getLatestFailedRunsByAgent(heartbeatRuns ?? []).filter((r) => !dismissed.has(`run:${r.id}`)),
    [heartbeatRuns, dismissed],
  );
  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of heartbeatRuns ?? []) {
      if (run.status !== "running" && run.status !== "queued") continue;
      const issueId = readIssueIdFromRun(run);
      if (issueId) ids.add(issueId);
    }
    return ids;
  }, [heartbeatRuns]);

  const approvalsToRender = useMemo(() => {
    let filtered = getApprovalsForTab(approvals ?? [], tab, allApprovalFilter);
    if (tab === "mine") {
      filtered = filtered.filter((a) => !dismissed.has(`approval:${a.id}`));
    }
    return filtered;
  }, [approvals, tab, allApprovalFilter, dismissed]);
  const showJoinRequestsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "join_requests";
  const showTouchedCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "issues_i_touched";
  const showApprovalsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "approvals";
  const showFailedRunsCategory =
    allCategoryFilter === "everything" || allCategoryFilter === "failed_runs";
  const showAlertsCategory = allCategoryFilter === "everything" || allCategoryFilter === "alerts";
  const failedRunsForTab = useMemo(() => {
    if (tab === "all" && !showFailedRunsCategory) return [];
    return failedRuns;
  }, [failedRuns, tab, showFailedRunsCategory]);

  const joinRequestsForTab = useMemo(() => {
    if (tab === "all" && !showJoinRequestsCategory) return [];
    if (tab === "mine") return joinRequests.filter((jr) => !dismissed.has(`join:${jr.id}`));
    return joinRequests;
  }, [joinRequests, tab, showJoinRequestsCategory, dismissed]);

  const workItemsToRender = useMemo(
    () =>
      getInboxWorkItems({
        issues: tab === "all" && !showTouchedCategory ? [] : issuesToRender,
        approvals: tab === "all" && !showApprovalsCategory ? [] : approvalsToRender,
        failedRuns: failedRunsForTab,
        joinRequests: joinRequestsForTab,
      }),
    [approvalsToRender, issuesToRender, showApprovalsCategory, showTouchedCategory, tab, failedRunsForTab, joinRequestsForTab],
  );

  const agentName = (id: string | null) => {
    if (!id) return null;
    return agentById.get(id) ?? null;
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_approval, id) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const approveJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.approveJoinRequest(selectedCompanyId!, joinRequest.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve join request");
    },
  });

  const rejectJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.rejectJoinRequest(selectedCompanyId!, joinRequest.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.access.joinRequests(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject join request");
    },
  });

  const [retryingRunIds, setRetryingRunIds] = useState<Set<string>>(new Set());

  const retryRunMutation = useMutation({
    mutationFn: async (run: HeartbeatRun) => {
      const payload: Record<string, unknown> = {};
      const context = run.contextSnapshot as Record<string, unknown> | null;
      if (context) {
        if (typeof context.issueId === "string" && context.issueId) payload.issueId = context.issueId;
        if (typeof context.taskId === "string" && context.taskId) payload.taskId = context.taskId;
        if (typeof context.taskKey === "string" && context.taskKey) payload.taskKey = context.taskKey;
      }
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload,
      });
      if (!("id" in result)) {
        throw new Error("Retry was skipped because the agent is not currently invokable.");
      }
      return { newRun: result, originalRun: run };
    },
    onMutate: (run) => {
      setRetryingRunIds((prev) => new Set(prev).add(run.id));
    },
    onSuccess: ({ newRun, originalRun }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(originalRun.companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(originalRun.companyId, originalRun.agentId) });
      navigate(`/agents/${originalRun.agentId}/runs/${newRun.id}`);
    },
    onSettled: (_data, _error, run) => {
      if (!run) return;
      setRetryingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(run.id);
        return next;
      });
    },
  });

  const [fadingOutIssues, setFadingOutIssues] = useState<Set<string>>(new Set());
  const [archivingIssueIds, setArchivingIssueIds] = useState<Set<string>>(new Set());
  const [fadingNonIssueItems, setFadingNonIssueItems] = useState<Set<string>>(new Set());
  const [archivingNonIssueIds, setArchivingNonIssueIds] = useState<Set<string>>(new Set());

  const invalidateInboxIssueQueries = () => {
    if (!selectedCompanyId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listMineByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listTouchedByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.listUnreadTouchedByMe(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId) });
  };

  const archiveIssueMutation = useMutation({
    mutationFn: (id: string) => issuesApi.archiveFromInbox(id),
    onMutate: (id) => {
      setActionError(null);
      setArchivingIssueIds((prev) => new Set(prev).add(id));
    },
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
    onError: (err, id) => {
      setActionError(err instanceof Error ? err.message : "Failed to archive issue");
      setArchivingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onSettled: (_data, error, id) => {
      if (error) return;
      window.setTimeout(() => {
        setArchivingIssueIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 500);
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onMutate: (id) => {
      setFadingOutIssues((prev) => new Set(prev).add(id));
    },
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
    onSettled: (_data, _error, id) => {
      setTimeout(() => {
        setFadingOutIssues((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      await Promise.all(issueIds.map((issueId) => issuesApi.markRead(issueId)));
    },
    onMutate: (issueIds) => {
      setFadingOutIssues((prev) => {
        const next = new Set(prev);
        for (const issueId of issueIds) next.add(issueId);
        return next;
      });
    },
    onSuccess: () => {
      invalidateInboxIssueQueries();
    },
    onSettled: (_data, _error, issueIds) => {
      setTimeout(() => {
        setFadingOutIssues((prev) => {
          const next = new Set(prev);
          for (const issueId of issueIds) next.delete(issueId);
          return next;
        });
      }, 300);
    },
  });

  const handleMarkNonIssueRead = (key: string) => {
    setFadingNonIssueItems((prev) => new Set(prev).add(key));
    markItemRead(key);
    setTimeout(() => {
      setFadingNonIssueItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 300);
  };

  const handleArchiveNonIssue = (key: string) => {
    setArchivingNonIssueIds((prev) => new Set(prev).add(key));
    setTimeout(() => {
      dismiss(key);
      setArchivingNonIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 200);
  };

  const nonIssueUnreadState = (key: string): NonIssueUnreadState => {
    if (tab !== "mine") return null;
    const isRead = readItems.has(key);
    const isFading = fadingNonIssueItems.has(key);
    if (isFading) return "fading";
    if (!isRead) return "visible";
    return "hidden";
  };

  if (!selectedCompanyId) {
    return <EmptyState icon={InboxIcon} message="Select a company to view inbox." />;
  }

  const hasRunFailures = failedRuns.length > 0;
  const showAggregateAgentError = !!dashboard && dashboard.agents.error > 0 && !hasRunFailures && !dismissed.has("alert:agent-errors");
  const showBudgetAlert =
    !!dashboard &&
    dashboard.costs.monthBudgetCents > 0 &&
    dashboard.costs.monthUtilizationPercent >= 80 &&
    !dismissed.has("alert:budget");
  const hasAlerts = showAggregateAgentError || showBudgetAlert;
  const showWorkItemsSection = workItemsToRender.length > 0;
  const showAlertsSection = shouldShowInboxSection({
    tab,
    hasItems: hasAlerts,
    showOnMine: hasAlerts,
    showOnRecent: hasAlerts,
    showOnUnread: hasAlerts,
    showOnAll: showAlertsCategory && hasAlerts,
  });

  const visibleSections = [
    showAlertsSection ? "alerts" : null,
    showWorkItemsSection ? "work_items" : null,
  ].filter((key): key is SectionKey => key !== null);

  const allLoaded =
    !isJoinRequestsLoading &&
    !isApprovalsLoading &&
    !isDashboardLoading &&
    !isIssuesLoading &&
    !isMineIssuesLoading &&
    !isTouchedIssuesLoading &&
    !isRunsLoading;

  const markAllReadIssues = (tab === "mine" ? mineIssues : unreadTouchedIssues)
    .filter((issue) => issue.isUnreadForMe && !fadingOutIssues.has(issue.id) && !archivingIssueIds.has(issue.id));
  const unreadIssueIds = markAllReadIssues
    .map((issue) => issue.id);
  const canMarkAllRead = unreadIssueIds.length > 0;

  // Count total unread items
  const unreadCount = unreadIssueIds.length +
    approvalsToRender.filter((a) => ACTIONABLE_APPROVAL_STATUSES.has(a.status)).length +
    failedRuns.length +
    joinRequestsForTab.length;

  return (
    <div className="flex flex-col h-full">
      {/* PageHeader */}
      <PageHeader
        title="Inbox"
        badge={
          unreadCount > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white min-w-[20px]">
              {unreadCount}
            </span>
          ) : undefined
        }
        actions={
          canMarkAllRead ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1.5"
              onClick={() => markAllReadMutation.mutate(unreadIssueIds)}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markAllReadMutation.isPending ? "Marking..." : "Mark all read"}
            </Button>
          ) : undefined
        }
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {/* Tab bar + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <Tabs value={tab} onValueChange={(value) => navigate(`/inbox/${value}`)}>
            <PageTabBar
              items={[
                { value: "mine", label: "Mine" },
                { value: "recent", label: "Recent" },
                { value: "unread", label: "Unread" },
                { value: "all", label: "All" },
              ]}
            />
          </Tabs>

          {tab === "all" && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Select
                value={allCategoryFilter}
                onValueChange={(value) => setAllCategoryFilter(value as InboxCategoryFilter)}
              >
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everything">All categories</SelectItem>
                  <SelectItem value="issues_i_touched">My recent issues</SelectItem>
                  <SelectItem value="join_requests">Join requests</SelectItem>
                  <SelectItem value="approvals">Approvals</SelectItem>
                  <SelectItem value="failed_runs">Failed runs</SelectItem>
                  <SelectItem value="alerts">Alerts</SelectItem>
                </SelectContent>
              </Select>

              {showApprovalsCategory && (
                <Select
                  value={allApprovalFilter}
                  onValueChange={(value) => setAllApprovalFilter(value as InboxApprovalFilter)}
                >
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Approval status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All approval statuses</SelectItem>
                    <SelectItem value="actionable">Needs action</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {approvalsError && <p className="text-sm text-destructive">{approvalsError.message}</p>}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        {!allLoaded && visibleSections.length === 0 && (
          <PageSkeleton variant="inbox" />
        )}

        {allLoaded && visibleSections.length === 0 && (
          <EmptyState
            icon={InboxIcon}
            message={
              tab === "mine"
                ? "Inbox zero."
                : tab === "unread"
                ? "No new inbox items."
                : tab === "recent"
                  ? "No recent inbox items."
                  : "No inbox items match these filters."
            }
          />
        )}

        {/* Alerts */}
        {showAlertsSection && (
          <div className="space-y-2 mb-4">
            {showAggregateAgentError && (
              <AlertNotificationCard
                icon={<AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                to="/agents"
                onDismiss={() => dismiss("alert:agent-errors")}
              >
                <span className="font-medium">{dashboard!.agents.error}</span>{" "}
                {dashboard!.agents.error === 1 ? "agent has" : "agents have"} errors
              </AlertNotificationCard>
            )}
            {showBudgetAlert && (
              <AlertNotificationCard
                icon={<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />}
                to="/costs"
                onDismiss={() => dismiss("alert:budget")}
              >
                Budget at{" "}
                <span className="font-medium">{dashboard!.costs.monthUtilizationPercent}%</span>{" "}
                utilization this month
              </AlertNotificationCard>
            )}
          </div>
        )}

        {/* Work items */}
        {showWorkItemsSection && (
          <div className="space-y-2">
            {workItemsToRender.map((item) => {
              const isMineTab = tab === "mine";

              if (item.kind === "approval") {
                const approvalKey = `approval:${item.approval.id}`;
                const isArchiving = archivingNonIssueIds.has(approvalKey);
                const row = (
                  <ApprovalInboxRow
                    key={approvalKey}
                    approval={item.approval}
                    requesterName={agentName(item.approval.requestedByAgentId)}
                    onApprove={() => approveMutation.mutate(item.approval.id)}
                    onReject={() => rejectMutation.mutate(item.approval.id)}
                    isPending={approveMutation.isPending || rejectMutation.isPending}
                    unreadState={nonIssueUnreadState(approvalKey)}
                    onMarkRead={() => handleMarkNonIssueRead(approvalKey)}
                    onArchive={isMineTab ? () => handleArchiveNonIssue(approvalKey) : undefined}
                    archiveDisabled={isArchiving}
                    className={
                      isArchiving
                        ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                        : "transition-all duration-200 ease-out"
                    }
                  />
                );
                return isMineTab ? (
                  <SwipeToArchive
                    key={approvalKey}
                    disabled={isArchiving}
                    onArchive={() => handleArchiveNonIssue(approvalKey)}
                  >
                    {row}
                  </SwipeToArchive>
                ) : row;
              }

              if (item.kind === "failed_run") {
                const runKey = `run:${item.run.id}`;
                const isArchiving = archivingNonIssueIds.has(runKey);
                const row = (
                  <FailedRunInboxRow
                    key={runKey}
                    run={item.run}
                    issueById={issueById}
                    agentName={agentName(item.run.agentId)}
                    issueLinkState={issueLinkState}
                    onDismiss={() => dismiss(runKey)}
                    onRetry={() => retryRunMutation.mutate(item.run)}
                    isRetrying={retryingRunIds.has(item.run.id)}
                    unreadState={nonIssueUnreadState(runKey)}
                    onMarkRead={() => handleMarkNonIssueRead(runKey)}
                    onArchive={isMineTab ? () => handleArchiveNonIssue(runKey) : undefined}
                    archiveDisabled={isArchiving}
                    className={
                      isArchiving
                        ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                        : "transition-all duration-200 ease-out"
                    }
                  />
                );
                return isMineTab ? (
                  <SwipeToArchive
                    key={runKey}
                    disabled={isArchiving}
                    onArchive={() => handleArchiveNonIssue(runKey)}
                  >
                    {row}
                  </SwipeToArchive>
                ) : row;
              }

              if (item.kind === "join_request") {
                const joinKey = `join:${item.joinRequest.id}`;
                const isArchiving = archivingNonIssueIds.has(joinKey);
                const row = (
                  <JoinRequestInboxRow
                    key={joinKey}
                    joinRequest={item.joinRequest}
                    onApprove={() => approveJoinMutation.mutate(item.joinRequest)}
                    onReject={() => rejectJoinMutation.mutate(item.joinRequest)}
                    isPending={approveJoinMutation.isPending || rejectJoinMutation.isPending}
                    unreadState={nonIssueUnreadState(joinKey)}
                    onMarkRead={() => handleMarkNonIssueRead(joinKey)}
                    onArchive={isMineTab ? () => handleArchiveNonIssue(joinKey) : undefined}
                    archiveDisabled={isArchiving}
                    className={
                      isArchiving
                        ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                        : "transition-all duration-200 ease-out"
                    }
                  />
                );
                return isMineTab ? (
                  <SwipeToArchive
                    key={joinKey}
                    disabled={isArchiving}
                    onArchive={() => handleArchiveNonIssue(joinKey)}
                  >
                    {row}
                  </SwipeToArchive>
                ) : row;
              }

              // Issue item
              const issue = item.issue;
              const isUnread = !!issue.isUnreadForMe && !fadingOutIssues.has(issue.id);
              const isFading = fadingOutIssues.has(issue.id);
              const isArchiving = archivingIssueIds.has(issue.id);

              const row = (
                <IssueNotificationCard
                  key={`issue:${issue.id}`}
                  issue={issue}
                  issueLinkState={issueLinkState}
                  liveIssueIds={liveIssueIds}
                  isUnread={isUnread}
                  isFading={isFading}
                  isArchiving={isArchiving}
                  isMineTab={isMineTab}
                  onMarkRead={() => markReadMutation.mutate(issue.id)}
                  onArchive={
                    isMineTab
                      ? () => archiveIssueMutation.mutate(issue.id)
                      : undefined
                  }
                  archiveDisabled={isArchiving || archiveIssueMutation.isPending}
                />
              );

              return isMineTab ? (
                <SwipeToArchive
                  key={`issue:${issue.id}`}
                  disabled={isArchiving || archiveIssueMutation.isPending}
                  onArchive={() => archiveIssueMutation.mutate(issue.id)}
                >
                  {row}
                </SwipeToArchive>
              ) : row;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
