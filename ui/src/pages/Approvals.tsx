import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, Clock, History, MessageCircle, Pencil, Square, CheckSquare, Timer, FileText, Send, ChevronDown } from "lucide-react";
import { approvalLabel, typeIcon, defaultTypeIcon, ApprovalPayloadRenderer, OUTBOUND_TYPES } from "../components/ApprovalPayload";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { PageSkeleton } from "../components/PageSkeleton";
import { WhatsAppConversationDrawer } from "../components/WhatsAppConversationDrawer";
import type { Approval, Agent } from "@paperclipai/shared";

type StatusFilter = "pending" | "all";

/* ------------------------------------------------------------------ */
/*  Layout-C Approval Card                                             */
/* ------------------------------------------------------------------ */
function LayoutCApprovalCard({
  approval,
  requesterAgent,
  onApprove,
  onApproveWithEdit,
  onReject,
  isPending,
  justApproved,
  justRejected,
  onViewConversation,
  isSelected,
  onToggleSelect,
}: {
  approval: Approval;
  requesterAgent: Agent | null;
  onApprove: () => void;
  onApproveWithEdit?: (editedPayload: Record<string, unknown>) => void;
  onReject: () => void;
  isPending: boolean;
  justApproved?: boolean;
  justRejected?: boolean;
  onViewConversation?: (chatJid: string, contactName?: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
  const label = approvalLabel(approval.type, approval.payload as Record<string, unknown> | null);
  const showResolutionButtons =
    approval.type !== "budget_override_required" &&
    (approval.status === "pending" || approval.status === "revision_requested") &&
    !justApproved &&
    !justRejected;

  // Extract a message preview from the payload if available
  const payload = approval.payload as Record<string, unknown> | null;
  const messagePreview: string | null =
    (typeof payload?.message === "string" ? payload.message : null) ??
    (typeof payload?.body === "string" ? payload.body : null) ??
    (typeof payload?.content === "string" ? payload.content : null) ??
    (typeof payload?.description === "string" ? payload.description : null) ??
    null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(messagePreview ?? "");

  return (
    <div data-testid="approval-card" className={cn("rounded-xl border overflow-hidden transition-all", isSelected ? "border-primary/60 ring-1 ring-primary/20" : "border-border/50 hover:border-border")}>
      {/* Header strip */}
      <div className="bg-primary/5 px-3.5 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          {onToggleSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              aria-label={isSelected ? "Deselect" : "Select"}
            >
              {isSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
            </button>
          )}
          <span className="flex items-center justify-center h-[25px] w-[25px] rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-primary leading-tight truncate">
              {label}
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {requesterAgent ? (
                <>
                  Requested by{" "}
                  <Identity name={requesterAgent.name} size="sm" className="inline-flex" />
                </>
              ) : (
                "System request"
              )}
              {" "}&middot; {timeAgo(approval.createdAt)}
            </span>
          </div>
          {/* Status indicator for resolved */}
          {approval.status === "approved" && !justApproved && (
            <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </span>
          )}
          {approval.status === "rejected" && !justRejected && (
            <span className="flex items-center gap-1 text-[11px] text-red-500 shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" />
              Rejected
            </span>
          )}
          {(approval.status === "pending" || approval.status === "revision_requested") && !justApproved && !justRejected && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5">
        {/* Payload details */}
        <ApprovalPayloadRenderer type={approval.type} payload={approval.payload} />

        {/* Message preview — static or editable */}
        {messagePreview && (
          isEditing ? (
            <div className="mt-2.5">
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-primary/50 bg-background px-3 py-2 text-[12px] leading-[1.55] text-foreground outline-none resize-none focus:border-primary transition-colors"
              />
            </div>
          ) : (
            <div className="mt-2.5 rounded-lg bg-muted p-2.5">
              <p className="text-[12px] text-muted-foreground italic line-clamp-3 m-0">
                {editedMessage || messagePreview}
              </p>
            </div>
          )
        )}

        {/* View conversation link — WhatsApp approvals with a phone number */}
        {(payload?.action as string | undefined) === "send_whatsapp" &&
          typeof payload?.phone === "string" &&
          onViewConversation && (
            <button
              className="flex items-center gap-1 mt-2 text-[11px] text-primary hover:underline transition-opacity"
              onClick={() =>
                onViewConversation(
                  payload.phone as string,
                  (payload.to as string | undefined) ?? undefined,
                )
              }
            >
              <MessageCircle className="h-3 w-3" />
              View conversation
            </button>
          )}

        {/* Decision note */}
        {approval.decisionNote && (
          <div className="mt-2.5 text-[11px] text-muted-foreground italic border-t border-border/40 pt-2">
            Note: {approval.decisionNote}
          </div>
        )}

        {/* Just approved / rejected state */}
        {justApproved && (
          <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[13px] font-medium">Approved</span>
          </div>
        )}
        {justRejected && (
          <div className="mt-3 flex items-center gap-2 text-red-500">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[13px] font-medium">Rejected</span>
          </div>
        )}

        {/* Action buttons — multi-option gates for outbound, simple for others */}
        {showResolutionButtons && (
          isEditing ? (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
              <Button
                size="sm"
                className="flex-1 h-8 bg-primary text-white hover:bg-primary/90 text-[12px] font-medium"
                onClick={() => {
                  setIsEditing(false);
                  if (onApproveWithEdit) {
                    onApproveWithEdit({ message: editedMessage });
                  } else {
                    onApprove();
                  }
                }}
                disabled={isPending}
              >
                Approve Edited
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-[12px] border border-border/50 hover:bg-muted"
                onClick={() => { setIsEditing(false); setEditedMessage(messagePreview ?? ""); }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          ) : OUTBOUND_TYPES.has(approval.type) ? (
            /* Multi-option gates for outbound communications */
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
              <div className="flex gap-2">
                {/* Primary: Send Now */}
                <Button
                  size="sm"
                  data-testid="approval-send-now"
                  className="flex-1 h-8 bg-green-700 hover:bg-green-600 text-white text-[12px] font-medium gap-1"
                  onClick={onApprove}
                  disabled={isPending}
                >
                  <Send className="h-3 w-3" />
                  Send Now
                </Button>
                {/* Send with Delay */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[12px] border border-border/50 hover:bg-muted gap-1"
                  onClick={() => {
                    if (onApproveWithEdit) {
                      onApproveWithEdit({ _delayMinutes: 30 });
                    } else {
                      onApprove();
                    }
                  }}
                  disabled={isPending}
                  title="Send after 30 min delay — cancel window"
                >
                  <Timer className="h-3 w-3" />
                  30m Delay
                </Button>
              </div>
              <div className="flex gap-2">
                {/* Edit before sending */}
                {messagePreview && onApproveWithEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 px-3 text-[12px] border border-border/50 hover:bg-muted gap-1"
                    onClick={() => setIsEditing(true)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit & Send
                  </Button>
                )}
                {/* Save as Draft */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 px-3 text-[12px] border border-border/50 hover:bg-muted gap-1"
                  onClick={() => {
                    if (onApproveWithEdit) {
                      onApproveWithEdit({ _saveAsDraft: true });
                    } else {
                      onApprove();
                    }
                  }}
                  disabled={isPending}
                  title="Save as draft — review manually later"
                >
                  <FileText className="h-3 w-3" />
                  Save Draft
                </Button>
                {/* Decline */}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="approval-decline"
                  className="h-8 px-3 text-[12px] border border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={onReject}
                  disabled={isPending}
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : (
            /* Standard approve/decline for non-outbound types */
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
              <Button
                size="sm"
                className="flex-1 h-8 bg-primary text-white hover:bg-primary/90 text-[12px] font-medium"
                onClick={onApprove}
                disabled={isPending}
              >
                Approve
              </Button>
              {messagePreview && onApproveWithEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[12px] border border-border/50 hover:bg-muted gap-1"
                  onClick={() => setIsEditing(true)}
                  disabled={isPending}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-[12px] border border-border/50 hover:bg-muted"
                onClick={onReject}
                disabled={isPending}
              >
                Decline
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}


/* ================================================================== */
/*  Main Approvals page                                                */
/* ================================================================== */
export function Approvals() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegment = location.pathname.split("/").pop() ?? "pending";
  const statusFilter: StatusFilter = pathSegment === "all" ? "all" : "pending";
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Map<string, "approved" | "rejected">>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Conversation drawer state
  const [conversationDrawer, setConversationDrawer] = useState<{
    open: boolean;
    chatJid: string;
    contactName?: string;
  } | null>(null);

  const handleViewConversation = useCallback((chatJid: string, contactName?: string) => {
    setConversationDrawer({ open: true, chatJid, contactName });
  }, []);

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, editedPayload }: { id: string; editedPayload?: Record<string, unknown> }) =>
      approvalsApi.approve(id, undefined, editedPayload),
    onSuccess: (_approval, { id }) => {
      setActionError(null);
      setResolvedIds((prev) => new Map(prev).set(id, "approved"));
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: (_data, id) => {
      setActionError(null);
      setResolvedIds((prev) => new Map(prev).set(id, "rejected"));
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: (ids: string[]) => approvalsApi.batchApprove(selectedCompanyId!, ids),
    onSuccess: (result) => {
      setActionError(null);
      const approvedIds = result.results
        .filter((r) => r.status === "approved")
        .map((r) => r.id);
      setResolvedIds((prev) => {
        const next = new Map(prev);
        for (const id of approvedIds) next.set(id, "approved");
        return next;
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to batch approve");
    },
  });

  const filtered = (data ?? [])
    .filter(
      (a) => statusFilter === "all" || a.status === "pending" || a.status === "revision_requested",
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = (data ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a company first.</p>;
  }

  if (isLoading) {
    return <PageSkeleton variant="approvals" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* PageHeader */}
      <PageHeader
        title="Inbox"
        badge={
          pendingCount > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white min-w-[20px]">
              {pendingCount} pending
            </span>
          ) : undefined
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] gap-1.5"
            onClick={() => navigate(`/approvals/${statusFilter === "all" ? "pending" : "all"}`)}
          >
            <History className="h-3.5 w-3.5" />
            {statusFilter === "all" ? "Pending" : "History"}
          </Button>
        }
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-4">
          <Tabs value={statusFilter} onValueChange={(v) => navigate(`/approvals/${v}`)}>
            <PageTabBar items={[
              { value: "pending", label: <>Pending{pendingCount > 0 && (
                <span className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  "bg-red-500/20 text-red-500"
                )}>
                  {pendingCount}
                </span>
              )}</> },
              { value: "all", label: "All" },
            ]} />
          </Tabs>
        </div>

        {/* Batch approve bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 mb-2">
            <span className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 px-3 text-[12px] bg-primary text-white hover:bg-primary/90"
                onClick={() => batchApproveMutation.mutate(Array.from(selectedIds))}
                disabled={batchApproveMutation.isPending}
              >
                {batchApproveMutation.isPending ? "Approving…" : "Approve All"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-[12px] border border-border/50 hover:bg-muted"
                onClick={() => setSelectedIds(new Set())}
                disabled={batchApproveMutation.isPending}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "pending" ? "No pending approvals." : "No approvals yet."}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((approval) => {
              const isPendingApproval =
                approval.status === "pending" || approval.status === "revision_requested";
              return (
                <LayoutCApprovalCard
                  key={approval.id}
                  approval={approval}
                  requesterAgent={
                    approval.requestedByAgentId
                      ? (agents ?? []).find((a) => a.id === approval.requestedByAgentId) ?? null
                      : null
                  }
                  onApprove={() => approveMutation.mutate({ id: approval.id })}
                  onApproveWithEdit={(editedPayload) => approveMutation.mutate({ id: approval.id, editedPayload })}
                  onReject={() => rejectMutation.mutate(approval.id)}
                  isPending={approveMutation.isPending || rejectMutation.isPending || batchApproveMutation.isPending}
                  justApproved={resolvedIds.get(approval.id) === "approved"}
                  justRejected={resolvedIds.get(approval.id) === "rejected"}
                  onViewConversation={handleViewConversation}
                  isSelected={selectedIds.has(approval.id)}
                  onToggleSelect={
                    isPendingApproval
                      ? () => setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(approval.id)) {
                            next.delete(approval.id);
                          } else {
                            next.add(approval.id);
                          }
                          return next;
                        })
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Conversation Drawer */}
      {conversationDrawer && (
        <WhatsAppConversationDrawer
          open={conversationDrawer.open}
          onClose={() => setConversationDrawer(null)}
          chatJid={conversationDrawer.chatJid}
          contactName={conversationDrawer.contactName}
        />
      )}
    </div>
  );
}
