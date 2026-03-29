import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import type { IssueComment, Issue } from "@paperclipai/shared";

const CEO_CHAT_TITLE = "CEO Chat";

// ── Inline approval card ───────────────────────────────────────────────────────

interface ApprovalPayload {
  type: "approval_required";
  action: string;
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

function InlineApprovalCard({ payload }: { payload: ApprovalPayload }) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      setStatus("approved");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setStatus("rejected");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const actionLabels: Record<string, string> = {
    send_whatsapp: "Send WhatsApp",
    send_email: "Send Email",
    post_to_instagram: "Post to Instagram",
    generate_pitch_deck: "Send Pitch Deck",
    schedule_viewing: "Confirm Viewing",
  };

  return (
    <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-medium text-white">
          {actionLabels[payload.action] ?? payload.action}
        </span>
        {payload.lead_score != null && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
            Score {payload.lead_score}/10
          </span>
        )}
      </div>

      {payload.to && (
        <p className="text-zinc-400 mb-1">
          <span className="text-zinc-300">To:</span> {payload.to}
          {payload.phone ? ` · ${payload.phone}` : ""}
        </p>
      )}

      {payload.message && (
        <p className="text-zinc-300 bg-zinc-900 rounded-md px-3 py-2 mt-2 text-xs leading-relaxed whitespace-pre-wrap">
          {payload.message}
        </p>
      )}

      {payload.context && (
        <p className="mt-2 text-xs text-zinc-500 italic">{payload.context}</p>
      )}

      {status === "pending" && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => approveMutation.mutate(payload.lead_id ?? "")}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            onClick={() => rejectMutation.mutate(payload.lead_id ?? "")}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
        </div>
      )}

      {status === "approved" && (
        <p className="mt-3 text-xs font-medium text-green-400">Approved</p>
      )}
      {status === "rejected" && (
        <p className="mt-3 text-xs font-medium text-red-400">Rejected</p>
      )}
    </div>
  );
}

// ── Chat message bubble ────────────────────────────────────────────────────────

function ChatBubble({ comment }: { comment: IssueComment }) {
  const isOwner = comment.authorUserId !== null && comment.authorAgentId === null;
  const parsed = !isOwner ? parseApprovalBlock(comment.body) : null;

  return (
    <div className={`flex ${isOwner ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] ${isOwner ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isOwner
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-tl-sm"
          }`}
        >
          {parsed ? parsed.pre || null : comment.body}
        </div>
        {parsed && <InlineApprovalCard payload={parsed.payload} />}
        <span className="mt-1 text-[10px] text-zinc-500 px-1">
          {new Date(comment.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Streaming bubble ───────────────────────────────────────────────────────────

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] items-start flex flex-col">
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 text-zinc-100 border border-zinc-700 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {text}
          <span className="inline-block w-0.5 h-3.5 bg-zinc-400 ml-0.5 animate-pulse align-middle" />
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="rounded-2xl rounded-tl-sm bg-zinc-800 border border-zinc-700 px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Quick actions bar ──────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Brief me", message: "Give me a morning brief" },
  { label: "What's pending?", message: "What approvals are pending?" },
  { label: "Pause all agents", message: "Pause all agents immediately" },
];

// ── CEO Chat page ──────────────────────────────────────────────────────────────

export function CeoChat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  // Text buffer for smooth drip-feed
  const textBufferRef = useRef("");
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "CEO Chat" }]);
  }, [setBreadcrumbs]);

  // ── Find or create the CEO Chat issue ───────────────────────────────────────
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const ceoChatIssue = issues?.find((i: Issue) => i.title === CEO_CHAT_TITLE) ?? null;

  const createIssueMutation = useMutation({
    mutationFn: () =>
      issuesApi.create(selectedCompanyId!, {
        title: CEO_CHAT_TITLE,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  const createIssueMutate = createIssueMutation.mutate;
  const createIssuePending = createIssueMutation.isPending;
  const createIssueSuccess = createIssueMutation.isSuccess;
  useEffect(() => {
    if (!selectedCompanyId || issues === undefined) return;
    if (!ceoChatIssue && !createIssuePending && !createIssueSuccess) {
      createIssueMutate();
    }
  }, [selectedCompanyId, issues, ceoChatIssue, createIssuePending, createIssueSuccess, createIssueMutate]);

  const issueId = ceoChatIssue?.id ?? null;

  // ── Load comments — background poll for other-agent updates ─────────────────
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: issueId ? queryKeys.issues.comments(issueId) : [],
    queryFn: () => issuesApi.listComments(issueId!),
    enabled: !!issueId,
    refetchInterval: 15_000,
  });

  // ── CEO agent status ─────────────────────────────────────────────────────────
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });
  const ceoAgent = agents?.find((a) => a.role === "ceo") ?? null;

  // ── Smooth drip-feed drain ───────────────────────────────────────────────────
  const startDraining = useCallback(() => {
    if (drainTimerRef.current) return;

    function drain() {
      drainTimerRef.current = null;
      const bufLen = textBufferRef.current.length;
      if (bufLen === 0) return;

      let chunkSize: number;
      if (bufLen > 100) chunkSize = 20 + Math.floor(Math.random() * 20);
      else if (bufLen > 20) chunkSize = 5 + Math.floor(Math.random() * 10);
      else chunkSize = 2 + Math.floor(Math.random() * 3);

      // Try to break at word boundary
      if (chunkSize < bufLen) {
        const nextSpace = textBufferRef.current.indexOf(" ", chunkSize);
        if (nextSpace !== -1 && nextSpace < chunkSize + 10) chunkSize = nextSpace + 1;
      }

      const chunk = textBufferRef.current.slice(0, chunkSize);
      textBufferRef.current = textBufferRef.current.slice(chunkSize);

      setStreamingText((prev) => prev + chunk);

      if (textBufferRef.current.length > 0) {
        drainTimerRef.current = setTimeout(drain, 30);
      }
    }

    drainTimerRef.current = setTimeout(drain, 30);
  }, []);

  // ── Send message via streaming SSE ──────────────────────────────────────────
  const handleSend = useCallback(
    async (message?: string) => {
      const body = (message ?? input).trim();
      if (!body || !issueId || !selectedCompanyId || isStreaming) return;

      setInput("");
      setIsStreaming(true);
      setStreamingText("");
      textBufferRef.current = "";

      // Optimistically add owner message to local view immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });

      try {
        const res = await fetch(`/api/companies/${selectedCompanyId}/ceo-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: body }),
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
              textBufferRef.current += event.text as string;
              startDraining();
            }

            if (event.type === "done") {
              // Drain any remaining buffer instantly
              if (textBufferRef.current.length > 0) {
                setStreamingText((prev) => prev + textBufferRef.current);
                textBufferRef.current = "";
              }
            }

            if (event.type === "error") {
              console.error("CEO chat stream error:", event.message);
            }
          }
        }
      } catch (err) {
        console.error("CEO chat fetch error:", err);
      } finally {
        // Clear streaming state and refresh persisted comments
        setIsStreaming(false);
        setStreamingText("");
        textBufferRef.current = "";
        if (drainTimerRef.current) {
          clearTimeout(drainTimerRef.current);
          drainTimerRef.current = null;
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
      }
    },
    [input, issueId, selectedCompanyId, isStreaming, queryClient, startDraining],
  );

  // ── Auto-scroll to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, streamingText, isStreaming]);

  const statusColor = isStreaming
    ? "bg-blue-400 animate-pulse"
    : ceoAgent?.status === "active"
      ? "bg-green-500"
      : ceoAgent?.status === "paused"
        ? "bg-yellow-500"
        : "bg-zinc-500";

  const statusLabel = isStreaming
    ? "Responding..."
    : ceoAgent?.status === "active"
      ? "Running"
      : ceoAgent?.status === "paused"
        ? "Paused"
        : "Idle";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          <h1 className="text-base font-semibold text-foreground">CEO Chat</h1>
        </div>
        {ceoAgent && (
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {commentsLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {!commentsLoading && comments.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="h-10 w-10 text-zinc-600" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Send a message to start talking with your CEO.
            </p>
          </div>
        )}

        {comments.map((comment: IssueComment) => (
          <ChatBubble key={comment.id} comment={comment} />
        ))}

        {/* Typing indicator — shown while waiting for first streaming token */}
        {isStreaming && streamingText === "" && <TypingIndicator />}

        {/* Streaming bubble — fills in character by character */}
        {streamingText !== "" && <StreamingBubble text={streamingText} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="px-5 py-2 border-t border-border flex gap-2 flex-wrap shrink-0">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => { void handleSend(action.message); }}
            disabled={!issueId || isStreaming}
            className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-5 pb-5 pt-2 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={issueId ? "Message the CEO..." : "Setting up CEO Chat..."}
            disabled={!issueId || isStreaming}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50"
          />
          <Button
            onClick={() => { void handleSend(); }}
            disabled={!input.trim() || !issueId || isStreaming}
            size="icon"
            className="h-11 w-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-white shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
