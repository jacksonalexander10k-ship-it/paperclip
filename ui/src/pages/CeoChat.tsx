import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/router";
import { Send, Loader2, CheckCircle, XCircle, ArrowUp, MessageCircle, Pencil, Plus } from "lucide-react";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { WhatsAppConnect } from "../components/WhatsAppConnect";
import { WhatsAppConversationDrawer } from "../components/WhatsAppConversationDrawer";
import { AgentInsightBanner } from "../components/AgentInsightBanner";
import { cn } from "@/lib/utils";
import type { IssueComment, Issue } from "@paperclipai/shared";

const CEO_CHAT_PREFIX = "CEO Chat";

// ── Inline approval card ───────────────────────────────────────────────────────

interface ApprovalPayload {
  type: "approval_required";
  action: string;
  approval_id?: string;
  to?: string;
  phone?: string;
  message?: string;
  lead_id?: string;
  lead_score?: number;
  context?: string;
  [key: string]: unknown;
}

function parseApprovalBlock(body: string): { pre: string; payload: ApprovalPayload } | null {
  try {
    const jsonMatch = body.match(/```json\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1] : body;
    const parsed = JSON.parse(raw ?? body);
    if (parsed?.type === "approval_required") {
      const pre = jsonMatch ? body.slice(0, jsonMatch.index ?? 0).trim() : "";
      return { pre, payload: parsed as ApprovalPayload };
    }
  } catch {
    // not JSON
  }
  return null;
}

function InlineApprovalCard({
  payload,
  onViewConversation,
}: {
  payload: ApprovalPayload;
  onViewConversation?: (chatJid: string, contactName?: string) => void;
}) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "blocked">("pending");
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(payload.message ?? "");

  const approveMutation = useMutation({
    mutationFn: ({ id, edited }: { id: string; edited?: string }) =>
      approvalsApi.approve(
        id,
        undefined,
        edited !== undefined ? { message: edited } : undefined,
      ),
    onSuccess: () => {
      setStatus("approved");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: () => {
      setStatus("blocked");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setStatus("rejected");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const approvalId = payload.approval_id;
  const hasMessage = payload.message != null && payload.message !== "";

  const actionLabels: Record<string, string> = {
    send_whatsapp: "Send WhatsApp",
    send_email: "Send Email",
    post_to_instagram: "Post to Instagram",
    post_instagram: "Post to Instagram",
    generate_pitch_deck: "Send Pitch Deck",
    send_pitch_deck: "Send Pitch Deck",
    schedule_viewing: "Confirm Viewing",
    confirm_viewing: "Confirm Viewing",
    hire_agent: "Hire Agent",
  };

  return (
    <div className="chat-msg-enter mt-2 rounded-[10px] border border-border overflow-hidden bg-card">
      {/* Green header strip */}
      <div className="h-[3px] bg-primary" />
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[12px] font-semibold text-foreground">
            {actionLabels[payload.action] ?? payload.action}
          </span>
          {payload.lead_score != null && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Score {payload.lead_score}/10
            </span>
          )}
        </div>

        {payload.to && (
          <p className="text-[11px] text-muted-foreground mb-1">
            <span className="text-foreground/70">To:</span> {payload.to}
            {payload.phone ? ` \u00B7 ${payload.phone}` : ""}
          </p>
        )}

        {/* Message — static or editable textarea */}
        {hasMessage && (
          isEditing ? (
            <div className="mt-2">
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={4}
                className="w-full rounded-[8px] border border-primary/50 bg-background px-3 py-2 text-[11.5px] leading-[1.55] text-foreground/90 outline-none resize-none focus:border-primary transition-colors"
              />
            </div>
          ) : (
            <div className="mt-2 rounded-[8px] border border-border/60 bg-background px-3 py-2">
              <p className="text-[11.5px] leading-[1.55] text-foreground/80 whitespace-pre-wrap">
                {editedMessage || payload.message}
              </p>
            </div>
          )
        )}

        {payload.context && (
          <p className="mt-2 text-[10.5px] text-muted-foreground italic leading-[1.45]">{payload.context}</p>
        )}

        {/* View conversation link — only for WhatsApp actions with a phone number */}
        {(payload.action === "send_whatsapp") && payload.phone && onViewConversation && (
          <button
            className="flex items-center gap-1 mt-2 text-[10.5px] text-primary hover:underline transition-opacity"
            onClick={() => onViewConversation(payload.phone!, payload.to ?? undefined)}
          >
            <MessageCircle className="h-3 w-3" />
            View conversation
          </button>
        )}

        {/* Action buttons */}
        {status === "pending" && approvalId && (
          isEditing ? (
            <div className="flex gap-2 mt-3">
              <button
                className="flex items-center gap-1.5 rounded-[7px] bg-primary px-3 py-[6px] text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                onClick={() => approveMutation.mutate({ id: approvalId, edited: editedMessage })}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-3 w-3" />
                Approve Edited
              </button>
              <button
                className="flex items-center gap-1.5 rounded-[7px] border border-border px-3 py-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                onClick={() => { setIsEditing(false); setEditedMessage(payload.message ?? ""); }}
                disabled={approveMutation.isPending}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                className="flex items-center gap-1.5 rounded-[7px] bg-primary px-3 py-[6px] text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                onClick={() => approveMutation.mutate({ id: approvalId })}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <CheckCircle className="h-3 w-3" />
                Approve & Send
              </button>
              {hasMessage && (
                <button
                  className="flex items-center gap-1.5 rounded-[7px] border border-border px-3 py-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                  onClick={() => setIsEditing(true)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              <button
                className="flex items-center gap-1.5 rounded-[7px] border border-border px-3 py-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                onClick={() => rejectMutation.mutate(approvalId)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <XCircle className="h-3 w-3" />
                Decline
              </button>
            </div>
          )
        )}

        {status === "pending" && !approvalId && (
          <p className="mt-3 text-[10.5px] text-muted-foreground italic">Approval record pending...</p>
        )}

        {status === "approved" && (
          <p className="mt-3 text-[11px] font-medium text-primary flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Approved
          </p>
        )}
        {status === "rejected" && (
          <p className="mt-3 text-[11px] font-medium text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </p>
        )}
        {status === "blocked" && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-amber-500 font-medium">
              Connect WhatsApp to send this message
            </p>
            <WhatsAppConnect agentId="" agentName="Agent" />
            <button
              className="text-[11px] text-primary hover:underline"
              onClick={() => setStatus("pending")}
            >
              Retry after connecting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat message bubble ────────────────────────────────────────────────────────

function ChatBubble({
  comment,
  onViewConversation,
}: {
  comment: IssueComment;
  onViewConversation?: (chatJid: string, contactName?: string) => void;
}) {
  const isOwner = comment.authorUserId !== null && comment.authorAgentId === null;
  const parsed = !isOwner ? parseApprovalBlock(comment.body) : null;

  return (
    <div className={`chat-msg-enter flex ${isOwner ? "flex-row-reverse" : "flex-row"} items-end gap-2 mb-3`}>
      {/* Avatar — AI only */}
      {!isOwner && (
        <div className="w-[27px] h-[27px] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shrink-0 mb-[18px]">
          <span className="text-[10px] font-bold text-primary-foreground leading-none">
            CEO
          </span>
        </div>
      )}

      <div className={`max-w-[88%] md:max-w-[75%] flex flex-col ${isOwner ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`px-3.5 py-2.5 text-[12.5px] leading-[1.55] whitespace-pre-wrap ${
            isOwner
              ? "bg-primary text-primary-foreground rounded-[13px] rounded-br-[4px]"
              : "bg-card border border-border text-foreground rounded-[13px] rounded-bl-[4px]"
          }`}
        >
          {parsed ? parsed.pre || null : comment.body}
        </div>

        {/* Inline approval card */}
        {parsed && (
          <InlineApprovalCard
            payload={parsed.payload}
            onViewConversation={onViewConversation}
          />
        )}

        {/* Timestamp */}
        <span className="mt-[3px] text-[11px] text-muted-foreground/60 px-1 select-none">
          {new Date(comment.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Streaming bubble with inline generative UI cards ──────────────────────────

function StreamingBubble({ text }: { text: string }) {
  // Split streaming text into segments: regular text vs approval card JSON
  const segments: Array<{ type: "text" | "card"; content: string; payload?: Record<string, unknown> }> = [];
  const jsonPattern = /```json\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let match = jsonPattern.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    try {
      const parsed = JSON.parse(match[1]!);
      if (parsed?.type === "approval_required") {
        segments.push({ type: "card", content: "", payload: parsed });
      }
    } catch {
      // Not valid JSON — render as text
      segments.push({ type: "text", content: match[0] });
    }
    lastIndex = match.index + match[0].length;
    match = jsonPattern.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  // If no segments parsed, show raw text
  if (segments.length === 0) {
    segments.push({ type: "text", content: text });
  }

  return (
    <div className="chat-msg-enter flex flex-row items-end gap-2 mb-3">
      <div className="w-[27px] h-[27px] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shrink-0 mb-[18px]">
        <span className="text-[10px] font-bold text-primary-foreground leading-none">CEO</span>
      </div>
      <div className="max-w-[88%] md:max-w-[75%] flex flex-col items-start gap-2">
        {segments.map((seg, i) =>
          seg.type === "card" && seg.payload ? (
            <div key={i} className="w-full rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-primary">
                  {seg.payload.action === "send_whatsapp" ? "Send WhatsApp" : seg.payload.action === "post_instagram" ? "Post Instagram" : String(seg.payload.action)}
                </span>
                {seg.payload.lead_score != null && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Score {String(seg.payload.lead_score)}/10
                  </span>
                )}
              </div>
              {seg.payload.to != null && (
                <p className="text-[11px] text-muted-foreground mb-1">
                  To: {String(seg.payload.to)} {seg.payload.phone != null ? `· ${String(seg.payload.phone)}` : ""}
                </p>
              )}
              <p className="text-[12px] text-foreground leading-relaxed">
                {String(seg.payload.message ?? seg.payload.caption ?? "").slice(0, 200)}
                {(String(seg.payload.message ?? seg.payload.caption ?? "")).length > 200 ? "..." : ""}
              </p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground italic">Pending approval...</span>
              </div>
            </div>
          ) : (
            <div key={i} className="bg-card border border-border text-foreground rounded-[13px] rounded-bl-[4px] px-3.5 py-2.5 text-[12.5px] leading-[1.55] whitespace-pre-wrap">
              {seg.content}
              {i === segments.length - 1 && (
                <span className="inline-block w-[2px] h-[14px] bg-primary/70 ml-0.5 animate-blink align-middle rounded-full" />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// ── Thinking indicator (Claude-style) ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="chat-msg-enter flex flex-row items-end gap-2 mb-3">
      <div className="w-[27px] h-[27px] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shrink-0 mb-[18px]">
        <span className="text-[10px] font-bold text-primary-foreground leading-none">CEO</span>
      </div>
      <div className="bg-card border border-border rounded-[13px] rounded-bl-[4px] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-[5px] items-center">
            <span className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-pulse" />
            <span className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-pulse [animation-delay:200ms]" />
            <span className="w-[5px] h-[5px] rounded-full bg-primary/60 animate-pulse [animation-delay:400ms]" />
          </div>
          <span className="text-[11px] text-muted-foreground animate-pulse">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

// ── Quick actions ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Brief me", message: "Give me a morning brief" },
  { label: "What\u2019s pending?", message: "What approvals are pending?" },
  { label: "Pause all agents", message: "Pause all agents immediately" },
  { label: "Show budget", message: "Show me the current budget and spend" },
  { label: "Find leads", message: "Find me the hottest leads in the pipeline right now" },
];

// ── CEO Chat page ──────────────────────────────────────────────────────────────

export function CeoChat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Conversation drawer state
  const [conversationDrawer, setConversationDrawer] = useState<{
    open: boolean;
    chatJid: string;
    agentId?: string;
    contactName?: string;
  } | null>(null);

  const handleViewConversation = useCallback((chatJid: string, contactName?: string) => {
    setConversationDrawer({ open: true, chatJid, contactName });
  }, []);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  // Track when stream finishes so we can clear after comment loads
  const streamingDoneRef = useRef(false);
  const prevCommentCountRef = useRef(0);

  useEffect(() => {
    setBreadcrumbs([{ label: "CEO Chat" }]);
  }, [setBreadcrumbs]);

  // ── Conversation management ─────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvoId = searchParams.get("convo");

  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // All CEO Chat conversations (issues with the prefix)
  const ceoChatConversations = (allIssues ?? [])
    .filter((i: Issue) => i.title.startsWith(CEO_CHAT_PREFIX))
    .sort((a: Issue, b: Issue) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Active conversation: URL param > most recent
  const ceoChatIssue = activeConvoId
    ? ceoChatConversations.find((i: Issue) => i.id === activeConvoId) ?? ceoChatConversations[0] ?? null
    : ceoChatConversations[0] ?? null;

  const createIssueMutation = useMutation({
    mutationFn: () =>
      issuesApi.create(selectedCompanyId!, {
        title: `${CEO_CHAT_PREFIX} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      }),
    onSuccess: (newIssue) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      if (newIssue?.id) {
        setSearchParams({ convo: newIssue.id });
      }
    },
  });

  const createIssueMutate = createIssueMutation.mutate;
  const createIssuePending = createIssueMutation.isPending;
  const createIssueSuccess = createIssueMutation.isSuccess;
  useEffect(() => {
    if (!selectedCompanyId || allIssues === undefined) return;
    if (ceoChatConversations.length === 0 && !createIssuePending && !createIssueSuccess) {
      createIssueMutate();
    }
  }, [selectedCompanyId, allIssues, ceoChatConversations.length, createIssuePending, createIssueSuccess, createIssueMutate]);

  const issueId = ceoChatIssue?.id ?? null;

  const handleNewChat = useCallback(() => {
    createIssueMutate();
  }, [createIssueMutate]);

  const handleSwitchConvo = useCallback((id: string) => {
    setSearchParams({ convo: id });
  }, [setSearchParams]);

  // ── Load comments in chronological order — poll only when NOT streaming ──────
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: issueId ? queryKeys.issues.comments(issueId) : [],
    queryFn: () => issuesApi.listCommentsAsc(issueId!),
    enabled: !!issueId,
    refetchInterval: isStreaming ? false : 5_000,
  });

  // ── Mark CEO Chat issue as read whenever comments are visible ───────────────
  useEffect(() => {
    if (!issueId) return;
    issuesApi.markRead(issueId).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    }).catch(() => {
      // Non-critical — silently ignore
    });
  }, [issueId, comments.length, selectedCompanyId, queryClient]);

  // ── CEO agent status ─────────────────────────────────────────────────────────
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });
  const ceoAgent = agents?.find((a) => a.role === "ceo") ?? null;

  // ── Clear streaming bubble + optimistic message once persisted comments load ──
  useEffect(() => {
    if (streamingDoneRef.current && comments.length > prevCommentCountRef.current) {
      const last = comments[comments.length - 1];
      if (last && last.authorAgentId !== null) {
        setStreamingText("");
        setIsStreaming(false);
        setOptimisticUserMessage(null);
        streamingDoneRef.current = false;
      }
    }
    // Clear optimistic message once the real one appears in the comment list
    if (optimisticUserMessage && comments.some((c: IssueComment) => c.authorUserId !== null && c.body === optimisticUserMessage)) {
      setOptimisticUserMessage(null);
    }
    prevCommentCountRef.current = comments.length;
  }, [comments, optimisticUserMessage]);

  // ── Send message via streaming SSE ──────────────────────────────────────────
  const handleSend = useCallback(
    async (message?: string) => {
      const body = (message ?? input).trim();
      if (!body || !issueId || !selectedCompanyId || isStreaming) return;

      setInput("");
      setIsStreaming(true);
      setStreamingText("");
      streamingDoneRef.current = false;
      setOptimisticUserMessage(body);

      try {
        const res = await fetch(`/api/companies/${selectedCompanyId}/ceo-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: body, issueId }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (event.type === "text") {
              setStreamingText((prev) => prev + (event.text as string));
            }

            if (event.type === "done") {
              streamingDoneRef.current = true;
              queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
            }

            if (event.type === "error") {
              console.error("CEO chat stream error:", event.message);
            }
          }
        }
      } catch (err) {
        console.error("CEO chat fetch error:", err);
        // On error, clear immediately
        setIsStreaming(false);
        setStreamingText("");
        streamingDoneRef.current = false;
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
      }
    },
    [input, issueId, selectedCompanyId, isStreaming, queryClient],
  );

  // ── Auto-scroll to bottom ────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Scroll on streaming changes
  useEffect(scrollToBottom, [streamingText, isStreaming, scrollToBottom]);

  // Scroll when comments change (refetch after streaming ends) + initial load
  useEffect(() => {
    scrollToBottom();
    const t1 = setTimeout(scrollToBottom, 100);
    const t2 = setTimeout(scrollToBottom, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [comments.length, scrollToBottom]);

  const _statusColor = isStreaming
    ? "bg-blue-400 animate-pulse"
    : ceoAgent?.status === "active"
      ? "bg-primary"
      : ceoAgent?.status === "paused"
        ? "bg-yellow-500"
        : "bg-muted-foreground/40";

  const _statusLabel = isStreaming
    ? "Responding..."
    : ceoAgent?.status === "active"
      ? "Live"
      : ceoAgent?.status === "paused"
        ? "Paused"
        : "Idle";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Page header bar (50px) ─────────────────────────────────────── */}
      <PageHeader
        title="CEO Chat"
        badge={
          <div className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-[3px]">
            <span className="relative flex h-[6px] w-[6px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium text-primary">Live</span>
          </div>
        }
      />

      {/* ── Conversation bar ──────────────────────────────────────────── */}
      <div className="border-b border-border/40 px-4 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={handleNewChat}
          disabled={createIssuePending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </button>
        <div className="h-4 w-px bg-border/60 shrink-0" />
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ceoChatConversations.slice(0, 8).map((convo: Issue, idx: number) => {
            const isActive = convo.id === ceoChatIssue?.id;
            const dateLabel = new Date(convo.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            const timeLabel = new Date(convo.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const label = convo.title === "CEO Chat" ? `Chat ${dateLabel}` : convo.title.replace(CEO_CHAT_PREFIX, "").replace(/^[\s—-]+/, "") || `Chat ${idx + 1}`;
            return (
              <button
                key={convo.id}
                onClick={() => handleSwitchConvo(convo.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 truncate max-w-[120px]",
                  isActive
                    ? "bg-foreground/10 text-foreground ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                title={`${label} · ${timeLabel}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat messages area ─────────────────────────────────────────── */}
      <div key={issueId ?? "empty"} ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4 mb-14 md:mb-0">
        <div>
          {commentsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 text-muted-foreground/40 animate-spin" />
            </div>
          )}

          {!commentsLoading && comments.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                <span className="text-[16px] font-bold text-primary-foreground leading-none">CEO</span>
              </div>
              <p className="text-[12.5px] text-muted-foreground max-w-[260px] leading-[1.5]">
                Send a message to start talking with your CEO agent.
              </p>
            </div>
          )}

          {comments.map((comment: IssueComment) => (
            <ChatBubble
              key={comment.id}
              comment={comment}
              onViewConversation={handleViewConversation}
            />
          ))}

          {/* Optimistic user message — shows immediately before server confirms */}
          {optimisticUserMessage && (
            <div className="chat-msg-enter flex flex-row-reverse items-end gap-2 mb-3">
              <div className="max-w-[88%] md:max-w-[75%] flex flex-col items-end">
                <div className="bg-primary text-primary-foreground rounded-[13px] rounded-br-[4px] px-3.5 py-2.5 text-[12.5px] leading-[1.55] whitespace-pre-wrap">
                  {optimisticUserMessage}
                </div>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isStreaming && streamingText === "" && <TypingIndicator />}

          {/* Streaming bubble with inline generative UI cards */}
          {streamingText !== "" && <StreamingBubble text={streamingText} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Quick action pills ─────────────────────────────────────────── */}
      <div className="border-t border-border/40 px-5 py-[7px] flex gap-[5px] overflow-x-auto shrink-0 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => { void handleSend(action.message); }}
            disabled={!issueId || isStreaming}
            className="whitespace-nowrap rounded-full border border-border/60 px-3 py-[4px] text-[11.5px] text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 mt-[3px] shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-background h-[48px] px-3 focus-within:border-primary/50 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={issueId ? "Type a message to CEO..." : "Setting up CEO Chat..."}
            disabled={!issueId || isStreaming}
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder-muted-foreground/50 outline-none disabled:opacity-40"
          />
          <button
            aria-label="Send message"
            onClick={() => { void handleSend(); }}
            disabled={!input.trim() || !issueId || isStreaming}
            className="w-[30px] h-[30px] rounded-lg bg-primary flex items-center justify-center shrink-0 text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* ── WhatsApp Conversation Drawer ───────────────────────────────── */}
      {conversationDrawer && (
        <WhatsAppConversationDrawer
          open={conversationDrawer.open}
          onClose={() => setConversationDrawer(null)}
          chatJid={conversationDrawer.chatJid}
          agentId={conversationDrawer.agentId}
          contactName={conversationDrawer.contactName}
        />
      )}
    </div>
  );
}
