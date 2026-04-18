import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, CheckCircle, XCircle, MessageCircle, Pencil, Plus, Users, AlertTriangle, Instagram, FileText, Calendar, Mail, ExternalLink, MapPin, Clock, User } from "lucide-react";
import { ChatBubbleV2 } from "../components/chat-v2/ChatBubble";
import { ChatInputV2, type AttachedFile } from "../components/chat-v2/ChatInput";
import { ThinkingDots } from "../components/chat-v2/ThinkingDots";
import { StreamingCursor } from "../components/chat-v2/StreamingCursor";
import { ThinkingBlock, type ToolUsage } from "../components/chat-v2/ThinkingBlock";
import { ScrollToBottomPill } from "../components/chat-v2/ScrollToBottomPill";
import { SuggestionChips } from "../components/chat-v2/SuggestionChips";
import { GLASS } from "../components/chat-v2/glass";
import { formatClockTime } from "../lib/format-time";
import { issuesApi } from "../api/issues";
import { SpotlightTour } from "../components/SpotlightTour";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { assetsApi } from "../api/assets";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { WhatsAppConnect } from "../components/WhatsAppConnect";
import { WhatsAppConversationDrawer } from "../components/WhatsAppConversationDrawer";
import { AgentInsightBanner } from "../components/AgentInsightBanner";
import { agentMessagesApi, type AgentMessage } from "../api/agent-messages";
import { cn } from "@/lib/utils";
import type { IssueComment, Issue } from "@paperclipai/shared";

const CEO_CHAT_PREFIX = "CEO Chat";

/** Shared prose classes for markdown rendering in chat bubbles */
const PROSE_CLASSES = cn(
  "prose prose-sm max-w-none",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[12px]",
  "[&_strong]:text-foreground",
);

// ── First-run trigger — calls /ceo-chat/first-run to seed welcome messages ────

// Module-level guard prevents React Strict Mode double-fire — tracks per company
const firstRunFiredFor = new Set<string>();

function FirstRunTrigger({ companyId, onDone }: { companyId: string | null; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId || firstRunFiredFor.has(companyId)) return;
    firstRunFiredFor.add(companyId);
    setLoading(true);

    fetch(`/api/companies/${companyId}/ceo-chat/first-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then(() => {
        setTimeout(onDone, 800);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [companyId, onDone]);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      {loading ? (
        <>
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-[12.5px] text-muted-foreground">Your CEO is reviewing your setup…</p>
        </>
      ) : (
        <>
          <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
            <span className="text-[16px] font-bold text-primary-foreground leading-none">CEO</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground max-w-[260px] leading-[1.5]">
            Send a message to start talking with your CEO agent.
          </p>
        </>
      )}
    </div>
  );
}

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

// ── Team proposal card with editable agent names ──────────────────────────────

interface ProposedAgent {
  defaultName: string;
  role: string;
  title: string;
  department: string;
  reason: string;
}

function TeamProposalCard({ payload }: { payload: ApprovalPayload }) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const agents = (payload.agents ?? []) as ProposedAgent[];
  const [names, setNames] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    agents.forEach((a, i) => { init[i] = a.defaultName; });
    return init;
  });
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Hydrate approval status from DB on mount
  useEffect(() => {
    if (!payload.approval_id) return;
    approvalsApi.get(payload.approval_id).then((a) => {
      if (a.status === "approved") setStatus("approved");
      else if (a.status === "rejected") setStatus("rejected");
    }).catch(() => {});
  }, [payload.approval_id]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const approvalId = payload.approval_id;
      if (!approvalId) throw new Error("No approval ID");

      // Pass the custom names in the edited payload
      const agentNames = agents.map((a, i) => ({
        name: names[i] || a.defaultName,
        role: a.role,
        title: a.title,
        department: a.department,
      }));

      return approvalsApi.approve(approvalId, undefined, { agents: agentNames });
    },
    onSuccess: () => {
      setStatus("approved");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      // Refresh the sidebar agent list so newly hired agents appear immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => approvalsApi.reject(payload.approval_id!),
    onSuccess: () => {
      setStatus("rejected");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  // Group agents by department
  const departments = new Map<string, { agents: (ProposedAgent & { index: number })[] }>();
  agents.forEach((a, i) => {
    const existing = departments.get(a.department) ?? { agents: [] };
    existing.agents.push({ ...a, index: i });
    departments.set(a.department, existing);
  });

  if (status === "approved") {
    return (
      <div className="chat-msg-enter mt-2 rounded-[10px] border border-primary/30 overflow-hidden bg-card">
        <div className="h-[3px] bg-primary" />
        <div className="px-3.5 py-4 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-medium text-foreground">Team approved! Agents are being hired…</span>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="chat-msg-enter mt-2 rounded-[10px] border border-border overflow-hidden bg-card">
        <div className="h-[3px] bg-destructive" />
        <div className="px-3.5 py-4 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-[12px] font-medium text-muted-foreground">Team proposal declined.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-msg-enter mt-2 rounded-[10px] border border-border overflow-hidden bg-card">
      <div className="h-[3px] bg-primary" />
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-semibold text-foreground">Proposed Team</span>
        </div>

        {/* Department sections */}
        <div className="space-y-3">
          {[...departments.entries()].map(([deptName, dept]) => (
            <div key={deptName} className="rounded-[8px] border border-border/60 bg-background overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/30 border-b border-border/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{deptName}</span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {dept.agents.map((agent) => (
                  <div key={agent.index} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                    <input
                      type="text"
                      value={names[agent.index] ?? agent.defaultName}
                      onChange={(e) => setNames((prev) => ({ ...prev, [agent.index]: e.target.value }))}
                      className="w-24 bg-transparent border-b border-dashed border-primary/30 focus:border-primary px-0 py-0.5 text-[11.5px] font-medium text-foreground outline-none transition-colors"
                    />
                    <span className="text-[10.5px] text-muted-foreground">— {agent.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Reasons */}
        <div className="mt-3 space-y-1">
          {agents.map((a, i) => (
            <p key={i} className="text-[10px] text-muted-foreground leading-[1.4]">
              <span className="text-foreground/60 font-medium">{names[i] || a.defaultName}</span> — {a.reason}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            className="flex items-center gap-1.5 rounded-[7px] bg-primary px-3 py-[6px] text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            <CheckCircle className="h-3 w-3" />
            Approve & Hire Team
          </button>
          <button
            className="flex items-center gap-1.5 rounded-[7px] border border-border px-3 py-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
            onClick={() => rejectMutation.mutate()}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            <XCircle className="h-3 w-3" />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Escalation card — yellow/orange border for urgent escalations ────────────

function EscalationCard({ payload }: { payload: ApprovalPayload }) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Hydrate approval status from DB on mount
  useEffect(() => {
    if (!payload.approval_id) return;
    approvalsApi.get(payload.approval_id).then((a) => {
      if (a.status === "approved") setStatus("approved");
      else if (a.status === "rejected") setStatus("rejected");
    }).catch(() => {});
  }, [payload.approval_id]);

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!payload.approval_id) throw new Error("No approval ID");
      return approvalsApi.approve(payload.approval_id);
    },
    onSuccess: () => {
      setStatus("approved");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => approvalsApi.reject(payload.approval_id!),
    onSuccess: () => {
      setStatus("rejected");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const leadName = (payload.lead_name as string) ?? payload.to ?? "Unknown lead";
  const reason = (payload.reason as string) ?? payload.context ?? "";
  const suggestedAction = payload.suggested_action as string | undefined;

  if (status === "approved") {
    return (
      <div className="chat-msg-enter mt-2 rounded-[10px] border border-amber-500/30 overflow-hidden bg-card">
        <div className="h-[3px] bg-amber-500" />
        <div className="px-3.5 py-4 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-medium text-foreground">Escalation acknowledged</span>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="chat-msg-enter mt-2 rounded-[10px] border border-border overflow-hidden bg-card">
        <div className="h-[3px] bg-muted" />
        <div className="px-3.5 py-4 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-[12px] font-medium text-muted-foreground">Escalation dismissed</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-msg-enter mt-2 rounded-[10px] border border-amber-500/40 overflow-hidden bg-card">
      {/* Orange header strip */}
      <div className="h-[3px] bg-amber-500" />
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Escalation
          </span>
          {payload.lead_score != null && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Score {payload.lead_score}/10
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mb-1">
          <span className="text-foreground/70">Lead:</span> {leadName}
          {payload.phone ? ` \u00B7 ${payload.phone}` : ""}
        </p>

        {reason && (
          <div className="mt-2 rounded-[8px] border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-[11.5px] leading-[1.55] text-foreground/80 whitespace-pre-wrap">{reason}</p>
          </div>
        )}

        {suggestedAction && (
          <p className="mt-2 text-[10.5px] text-muted-foreground leading-[1.45]">
            <span className="text-foreground/60 font-medium">Suggested:</span> {suggestedAction}
          </p>
        )}

        {payload.approval_id && (
          <div className="flex gap-2 mt-3">
            <button
              className="flex items-center gap-1.5 rounded-[7px] bg-amber-500 px-3 py-[6px] text-[11px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              <CheckCircle className="h-3 w-3" />
              Acknowledge
            </button>
            <button
              className="flex items-center gap-1.5 rounded-[7px] border border-border px-3 py-[6px] text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
              onClick={() => rejectMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              <XCircle className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineApprovalCard({
  payload,
  onViewConversation,
}: {
  payload: ApprovalPayload;
  onViewConversation?: (chatJid: string, contactName?: string) => void;
}) {
  // All hooks MUST be called before any conditional returns (React Rules of Hooks)
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "blocked">("pending");
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(payload.message ?? "");
  const [executionNote, setExecutionNote] = useState<string | null>(null);

  // Hydrate approval status from DB on mount
  useEffect(() => {
    if (!payload.approval_id) return;
    approvalsApi.get(payload.approval_id).then((a) => {
      if (a.status === "approved") {
        if (a.decisionNote && a.decisionNote.startsWith("Blocked:")) {
          setExecutionNote(a.decisionNote);
          setStatus("blocked");
        } else {
          setStatus("approved");
        }
      } else if (a.status === "rejected") {
        setStatus("rejected");
      }
    }).catch(() => {});
  }, [payload.approval_id]);

  const approveMutation = useMutation({
    mutationFn: ({ id, edited }: { id: string; edited?: string }) =>
      approvalsApi.approve(
        id,
        undefined,
        edited !== undefined ? { message: edited } : undefined,
      ),
    onSuccess: async (_data, variables) => {
      setIsEditing(false);
      // Re-fetch the approval to check if execution was blocked
      try {
        const updated = await approvalsApi.get(variables.id);
        if (updated.decisionNote && updated.decisionNote.startsWith("Blocked:")) {
          setExecutionNote(updated.decisionNote);
          setStatus("blocked");
        } else {
          setExecutionNote(null);
          setStatus("approved");
        }
      } catch {
        setStatus("approved");
      }
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

  // Route hire_team to the special team proposal card
  if (payload.action === "hire_team") {
    return <TeamProposalCard payload={payload} />;
  }

  // Route escalation to the dedicated escalation card
  if (payload.action === "escalate" || payload.action === "lead_escalation") {
    return <EscalationCard payload={payload} />;
  }

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
    launch_fb_campaign: "Launch Facebook Campaign",
    pause_fb_campaign: "Pause Facebook Campaign",
    launch_campaign: "Launch Campaign",
  };

  // ── Type-specific flags ──────────────────────────────────────────────────────
  const isInstagram = payload.action === "post_instagram" || payload.action === "post_to_instagram";
  const isPitchDeck = payload.action === "send_pitch_deck" || payload.action === "generate_pitch_deck";
  const isViewing = payload.action === "confirm_viewing" || payload.action === "schedule_viewing";
  const isEmail = payload.action === "send_email";

  const actionIcons: Record<string, React.ReactNode> = {
    post_instagram: <Instagram className="h-3.5 w-3.5 text-primary" />,
    post_to_instagram: <Instagram className="h-3.5 w-3.5 text-primary" />,
    send_pitch_deck: <FileText className="h-3.5 w-3.5 text-primary" />,
    generate_pitch_deck: <FileText className="h-3.5 w-3.5 text-primary" />,
    confirm_viewing: <Calendar className="h-3.5 w-3.5 text-primary" />,
    schedule_viewing: <Calendar className="h-3.5 w-3.5 text-primary" />,
    send_email: <Mail className="h-3.5 w-3.5 text-primary" />,
    send_whatsapp: <MessageCircle className="h-3.5 w-3.5 text-primary" />,
  };

  return (
    <div className="chat-msg-enter mt-2 rounded-[10px] border border-border overflow-hidden bg-card">
      {/* Green header strip */}
      <div className="h-[3px] bg-primary" />
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
            {actionIcons[payload.action] ?? null}
            {actionLabels[payload.action] ?? payload.action}
          </span>
          {payload.lead_score != null && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Score {payload.lead_score}/10
            </span>
          )}
        </div>

        {/* Type-specific body */}
        {isInstagram ? (
          <>
            {(payload.image_url as string | undefined) && (
              <div className="mt-2 rounded-[8px] overflow-hidden border border-border/60">
                <img src={payload.image_url as string} alt="Instagram preview" className="w-full max-h-[200px] object-cover" />
              </div>
            )}
            <div className="mt-2 rounded-[8px] border border-border/60 bg-background px-3 py-2">
              <p className="text-[11.5px] leading-[1.55] text-foreground/80 whitespace-pre-wrap">
                {(payload.caption as string) ?? payload.message ?? ""}
              </p>
              {payload.hashtags != null && (
                <p className="mt-1.5 text-[10.5px] text-primary/70 leading-[1.4]">
                  {String(Array.isArray(payload.hashtags) ? (payload.hashtags as string[]).join(" ") : payload.hashtags)}
                </p>
              )}
            </div>
          </>
        ) : isPitchDeck ? (
          <>
            {(payload.project_name as string | undefined) && (
              <p className="text-[11px] text-muted-foreground mb-1">
                <span className="text-foreground/70">Project:</span> {payload.project_name as string}
              </p>
            )}
            {((payload.recipient as string) ?? payload.to) && (
              <p className="text-[11px] text-muted-foreground mb-1">
                <span className="text-foreground/70">Recipient:</span> {(payload.recipient as string) ?? payload.to}
              </p>
            )}
            {(payload.url as string | undefined) && (
              <a
                href={payload.url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-border/60 bg-background px-3 py-2 text-[11.5px] text-primary hover:bg-muted/30 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>View Pitch Deck</span>
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>
            )}
            {hasMessage && (
              <div className="mt-2 rounded-[8px] border border-border/60 bg-background px-3 py-2">
                <p className="text-[11.5px] leading-[1.55] text-foreground/80 whitespace-pre-wrap">{payload.message}</p>
              </div>
            )}
          </>
        ) : isViewing ? (
          <div className="mt-2 rounded-[8px] border border-border/60 bg-background px-3 py-2.5 space-y-1.5">
            {((payload.property_address as string) ?? (payload.address as string)) && (
              <p className="text-[11.5px] text-foreground/80 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                {(payload.property_address as string) ?? (payload.address as string)}
              </p>
            )}
            {((payload.date as string) || (payload.time as string)) && (
              <p className="text-[11.5px] text-foreground/80 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                {[(payload.date as string), (payload.time as string)].filter(Boolean).join(" at ")}
              </p>
            )}
            {payload.attendees != null && (
              <p className="text-[11.5px] text-foreground/80 flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                {String(Array.isArray(payload.attendees) ? (payload.attendees as string[]).join(", ") : payload.attendees)}
              </p>
            )}
            {hasMessage && (
              <p className="text-[11px] text-muted-foreground mt-1 leading-[1.45] whitespace-pre-wrap">{payload.message}</p>
            )}
          </div>
        ) : isEmail ? (
          <>
            {((payload.recipient as string) ?? payload.to) && (
              <p className="text-[11px] text-muted-foreground mb-1">
                <span className="text-foreground/70">To:</span> {(payload.recipient as string) ?? payload.to}
                {payload.phone ? ` \u00B7 ${payload.phone}` : ""}
              </p>
            )}
            {(payload.subject as string | undefined) && (
              <p className="text-[11px] text-muted-foreground mb-1">
                <span className="text-foreground/70">Subject:</span> {payload.subject as string}
              </p>
            )}
            {((payload.body as string) ?? payload.message) && (
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
                    {editedMessage || ((payload.body as string) ?? payload.message)}
                  </p>
                </div>
              )
            )}
          </>
        ) : (
          <>
            {payload.to && (
              <p className="text-[11px] text-muted-foreground mb-1">
                <span className="text-foreground/70">To:</span> {payload.to}
                {payload.phone ? ` \u00B7 ${payload.phone}` : ""}
              </p>
            )}
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
          </>
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
                {isViewing ? "Confirm" : isInstagram ? "Approve & Post" : "Approve & Send"}
              </button>
              {(hasMessage || isInstagram || isEmail) && (
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
            <CheckCircle className="h-3 w-3" /> Approved &mdash; Sent
          </p>
        )}
        {status === "rejected" && (
          <p className="mt-3 text-[11px] font-medium text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </p>
        )}
        {status === "blocked" && (
          <div className="mt-3 space-y-2">
            {(() => {
              const note = (executionNote ?? "").toLowerCase();
              const isFacebook = note.includes("facebook");
              const isInstagramBlock = note.includes("instagram");
              const isGmail = note.includes("gmail");
              const isWhatsApp = note.includes("whatsapp");
              const isCalendar = note.includes("calendar");

              const serviceLabel = isFacebook ? "Facebook Ads" : isInstagramBlock ? "Instagram" : isGmail ? "Gmail" : isCalendar ? "Google Calendar" : isWhatsApp ? "WhatsApp" : null;

              return (
                <>
                  <p className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {serviceLabel
                      ? `Connect ${serviceLabel} to execute this action`
                      : executionNote ?? "Action blocked — missing integration"}
                  </p>
                  {isWhatsApp ? (
                    <WhatsAppConnect agentId="" agentName="Agent" />
                  ) : serviceLabel ? (
                    <a
                      href="/company/settings"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Go to Settings → Connect {serviceLabel}
                    </a>
                  ) : null}
                  <button
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => { setStatus("pending"); setExecutionNote(null); }}
                  >
                    Retry
                  </button>
                </>
              );
            })()}
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
  showAvatar = true,
  showTimestamp = true,
  isGrouped = false,
}: {
  comment: IssueComment;
  onViewConversation?: (chatJid: string, contactName?: string) => void;
  /** Whether to show the avatar (first message in a group) */
  showAvatar?: boolean;
  /** Whether to show the timestamp (last message in a group) */
  showTimestamp?: boolean;
  /** Whether this message is part of a consecutive group (tighter spacing) */
  isGrouped?: boolean;
}) {
  const isOwner = comment.authorUserId !== null && comment.authorAgentId === null;
  const parsed = !isOwner ? parseApprovalBlock(comment.body) : null;
  // Strip paperclip-command blocks — those are server-side commands, not for display
  const stripped = (parsed ? parsed.pre : comment.body)
    .replace(/```paperclip-command\s*[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const textContent = stripped;

  // Persisted tool calls (replayed on reload)
  const persistedTools: ToolUsage[] = Array.isArray((comment as unknown as { toolCalls?: unknown }).toolCalls)
    ? ((comment as unknown as { toolCalls: Array<{ id: string; name: string; startedAt: number; completedAt?: number; result?: unknown }> }).toolCalls.map((t) => ({
        id: t.id,
        name: t.name,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        result: t.result,
      })))
    : [];

  // Persisted attachments
  const commentAttachments = ((comment as unknown as { attachments?: Array<{ assetId: string; contentType: string; originalFilename: string | null }> }).attachments) ?? [];

  const timestamp = showTimestamp
    ? formatClockTime(comment.createdAt)
    : undefined;

  return (
    <ChatBubbleV2
      role={isOwner ? "user" : "assistant"}
      showHeader={showAvatar}
      grouped={isGrouped}
      timestamp={timestamp}
      footer={
        parsed ? (
          <InlineApprovalCard
            payload={parsed.payload}
            onViewConversation={onViewConversation}
          />
        ) : undefined
      }
    >
      {persistedTools.length > 0 && (
        <ThinkingBlock tools={persistedTools} isStreaming={false} />
      )}
      {textContent ? (
        isOwner ? (
          <span className="whitespace-pre-wrap">{textContent}</span>
        ) : (
          <div className={PROSE_CLASSES}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
          </div>
        )
      ) : null}
      {commentAttachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {commentAttachments.map((att) => {
            const isImage = att.contentType.startsWith("image/");
            const href = `/api/assets/${att.assetId}/content`;
            return isImage ? (
              <a key={att.assetId} href={href} target="_blank" rel="noreferrer">
                <img
                  src={href}
                  alt={att.originalFilename ?? "attachment"}
                  className="max-h-40 rounded-lg border border-white/40 object-cover"
                />
              </a>
            ) : (
              <a
                key={att.assetId}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/50 px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-white/70"
              >
                <span className="truncate max-w-[180px]">
                  {att.originalFilename ?? "file"}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </ChatBubbleV2>
  );
}

// ── Streaming bubble with inline generative UI cards ──────────────────────────

function StreamingBubble({
  text, toolsUsed = [], isStreaming = true, isThinking = false,
}: {
  text: string; toolsUsed?: ToolUsage[]; isStreaming?: boolean; isThinking?: boolean;
}) {
  // Split streaming text into segments: regular text vs approval card JSON
  const segments: Array<{ type: "text" | "card"; content: string; payload?: Record<string, unknown> }> = [];
  const jsonRegex = /```json\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let regexMatch = jsonRegex.exec(text);

  while (regexMatch !== null) {
    if (regexMatch.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, regexMatch.index) });
    }
    try {
      const parsed = JSON.parse(regexMatch[1]!);
      if (parsed?.type === "approval_required") {
        segments.push({ type: "card", content: "", payload: parsed });
      }
    } catch {
      // Not valid JSON — render as text
      segments.push({ type: "text", content: regexMatch[0] });
    }
    lastIndex = regexMatch.index + regexMatch[0].length;
    regexMatch = jsonRegex.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  // If no segments parsed, show raw text
  if (segments.length === 0) {
    segments.push({ type: "text", content: text });
  }

  const hasText = text.trim().length > 0;

  return (
    <ChatBubbleV2 role="assistant" showHeader={true}>
      {/* Thinking state — inside the bubble, no layout jump */}
      {!hasText && toolsUsed.length === 0 && isThinking && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary/60" />
          </span>
          <span>Thinking...</span>
        </div>
      )}
      {!hasText && toolsUsed.length === 0 && !isThinking && <ThinkingDots />}

      {/* Thinking block (hidden until backend emits tool_start/tool_result) */}
      {toolsUsed.length > 0 && (
        <ThinkingBlock tools={toolsUsed} isStreaming={isStreaming} />
      )}

      {segments.map((seg, i) =>
        seg.type === "card" && seg.payload ? (
          <div
            key={i}
            className="mt-2 w-full rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-primary">
                {seg.payload.action === "send_whatsapp"
                  ? "Send WhatsApp"
                  : seg.payload.action === "post_instagram"
                  ? "Post Instagram"
                  : String(seg.payload.action)}
              </span>
              {seg.payload.lead_score != null && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Score {String(seg.payload.lead_score)}/10
                </span>
              )}
            </div>
            {seg.payload.to != null && (
              <p className="text-[11px] text-muted-foreground mb-1">
                To: {String(seg.payload.to)}{" "}
                {seg.payload.phone != null
                  ? `\u00B7 ${String(seg.payload.phone)}`
                  : ""}
              </p>
            )}
            <p className="text-[12px] text-foreground leading-relaxed">
              {String(seg.payload.message ?? seg.payload.caption ?? "").slice(0, 200)}
              {String(seg.payload.message ?? seg.payload.caption ?? "").length > 200
                ? "..."
                : ""}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground italic">
                Pending approval...
              </span>
            </div>
          </div>
        ) : seg.content ? (
          <div key={i} className={PROSE_CLASSES}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.content}</ReactMarkdown>
            {i === segments.length - 1 && isStreaming && <StreamingCursor />}
          </div>
        ) : null,
      )}
    </ChatBubbleV2>
  );
}

// ── Thinking indicator (Claude-style) ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <ChatBubbleV2 role="assistant">
      <ThinkingDots />
    </ChatBubbleV2>
  );
}

// ThinkingIndicator removed — thinking state is now handled inside StreamingBubble directly.
// This avoids separate DOM elements for thinking vs streaming (no layout jump).

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

  // Offline indicator
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Spotlight tour state
  const [tourActive, setTourActive] = useState(false);

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
  const [streamError, setStreamError] = useState<string | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  // Track when stream finishes so we can clear after comment loads
  const streamingDoneRef = useRef(false);
  const prevCommentCountRef = useRef(0);

  // Drip-feed streaming buffer — smooths jittery SSE chunks
  const textBufferRef = useRef("");
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDraining = useCallback(() => {
    if (drainTimerRef.current) return;
    const drain = () => {
      const bufLen = textBufferRef.current.length;
      if (bufLen === 0) {
        drainTimerRef.current = null;
        return;
      }
      // Emit 1-3 chars per frame for smooth typing effect
      const chunkSize = Math.min(bufLen, bufLen > 50 ? 3 : 1);
      const chunk = textBufferRef.current.slice(0, chunkSize);
      textBufferRef.current = textBufferRef.current.slice(chunkSize);
      setStreamingText((prev) => prev + chunk);
      drainTimerRef.current = setTimeout(drain, 16); // ~60fps
    };
    drainTimerRef.current = setTimeout(drain, 16);
  }, []);

  const flushBuffer = useCallback(() => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
    if (textBufferRef.current.length > 0) {
      const remaining = textBufferRef.current;
      textBufferRef.current = "";
      setStreamingText((prev) => prev + remaining);
    }
  }, []);

  // Abort controller for cancelling in-flight streams
  const abortRef = useRef<AbortController | null>(null);
  const lastSentMessageRef = useRef<string>("");

  // File attachments (visual only — not wired to server yet)
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  const handleAttach = useCallback((files: File[]) => {
    const newAttachments: AttachedFile[] = files.map((file) => {
      const att: AttachedFile = { file };
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.file === file ? { ...a, preview: e.target?.result as string } : a,
            ),
          );
        };
        reader.readAsDataURL(file);
      }
      return att;
    });
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    flushBuffer();
    setIsStreaming(false);
    streamingDoneRef.current = true;
  }, [flushBuffer]);

  // Scroll-to-bottom pill visibility
  const [showScrollPill, setShowScrollPill] = useState(false);

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

  // ── Inter-agent messages (surfaced as chat bubbles) ─────────────────────────
  const { data: agentMessages = [] } = useQuery({
    queryKey: queryKeys.agentMessages?.recent(selectedCompanyId!) ?? ["agent-messages", selectedCompanyId],
    queryFn: () => agentMessagesApi.listRecent(selectedCompanyId!, 50),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const agentNameMap = new Map<string, string>();
  if (agents) {
    for (const a of agents) agentNameMap.set(a.id, a.name);
  }

  // ── Progressive reveal for first-run welcome messages ──────────────────────
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const revealTriggeredRef = useRef(false);

  useEffect(() => {
    // Only trigger progressive reveal once, on first load, when we detect first-run comments
    if (revealTriggeredRef.current || comments.length === 0 || commentsLoading) return;

    const isFirstRun = localStorage.getItem("aygency_first_run") === "true";
    if (!isFirstRun) {
      // Not first run — show all comments immediately
      setRevealedCount(comments.length);
      return;
    }

    // First run — reveal comments one by one
    revealTriggeredRef.current = true;
    localStorage.removeItem("aygency_first_run");
    setIsRevealing(true);
    setRevealedCount(0);

    let i = 0;
    const reveal = () => {
      i++;
      setRevealedCount(i);
      if (i < comments.length) {
        // Stagger: 1.5s for first, 2s for middle, 1s for last
        const delay = i === 1 ? 1500 : i < comments.length - 1 ? 2000 : 1000;
        setTimeout(reveal, delay);
      } else {
        setIsRevealing(false);
      }
    };
    // Start after a short initial delay
    setTimeout(reveal, 800);
  }, [comments.length, commentsLoading]);

  // If not in reveal mode and new comments arrive, show them all
  useEffect(() => {
    if (!isRevealing && revealTriggeredRef.current && comments.length > revealedCount) {
      setRevealedCount(comments.length);
    }
  }, [comments.length, isRevealing, revealedCount]);

  // The visible comments — either all or progressively revealed
  const visibleComments = isRevealing || (revealTriggeredRef.current && revealedCount < comments.length)
    ? comments.slice(0, revealedCount)
    : comments;

  // Show typing indicator between revealed messages
  const showRevealTyping = isRevealing && revealedCount < comments.length;

  // ── Unified timeline: merge comments + inter-agent messages ────────────────
  type TimelineItem =
    | { kind: "comment"; data: IssueComment; ts: number }
    | { kind: "agent_msg"; data: AgentMessage; ts: number };

  const timeline: TimelineItem[] = [
    ...visibleComments.map((c): TimelineItem => ({
      kind: "comment",
      data: c,
      ts: new Date(c.createdAt).getTime(),
    })),
    ...agentMessages
      .filter((m) => m.fromAgentId !== ceoAgent?.id) // Don't show CEO talking to itself
      .map((m): TimelineItem => ({
        kind: "agent_msg",
        data: m,
        ts: new Date(m.createdAt).getTime(),
      })),
  ].sort((a, b) => a.ts - b.ts);

  // ── Clear streaming bubble + optimistic message once persisted comments load ──
  useEffect(() => {
    if (streamingDoneRef.current && comments.length > prevCommentCountRef.current) {
      const last = comments[comments.length - 1];
      if (last && last.authorAgentId !== null) {
        // Persisted CEO comment has loaded — clear streaming state
        setStreamingText("");
        setStreamingTools([]);
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

  // ── Upload + tool-event state ───────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [streamingTools, setStreamingTools] = useState<ToolUsage[]>([]);
  const [thinkingText, setThinkingText] = useState<string>("");
  const [isThinking, setIsThinking] = useState(false);

  // ── Send message via streaming SSE ──────────────────────────────────────────
  const handleSend = useCallback(
    async (message?: string) => {
      const body = (message ?? input).trim();
      if (!body || !issueId || !selectedCompanyId || isStreaming || isUploading) return;

      // Show the user's message immediately (before upload)
      setOptimisticUserMessage(body);
      isNearBottomRef.current = true;

      // 1. Upload any attachments first so the server can link them.
      let attachmentAssetIds: string[] = [];
      if (attachments.length > 0) {
        setIsUploading(true);
        setUploadError(null);
        try {
          const uploaded = await Promise.all(
            attachments.map((a) =>
              assetsApi.uploadImage(selectedCompanyId, a.file, "ceo-chat"),
            ),
          );
          attachmentAssetIds = uploaded.map((r) => r.assetId);
        } catch (err) {
          setUploadError((err as Error).message || "Failed to upload attachment");
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      lastSentMessageRef.current = body;
      setInput("");
      setAttachments([]);
      setIsStreaming(true);
      setStreamingText("");
      setStreamingTools([]);
      setThinkingText("");
      setStreamError(null);
      setIsThinking(true);
      textBufferRef.current = "";
      streamingDoneRef.current = false;
      // optimisticUserMessage already set above (before upload)

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const res = await fetch(`/api/companies/${selectedCompanyId}/ceo-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: body, issueId, attachmentAssetIds }),
          signal: abortController.signal,
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

            if (event.type === "thinking") {
              setThinkingText((prev) => prev + (event.text as string));
            }

            if (event.type === "thinking_done") {
              setIsThinking(false);
            }

            if (event.type === "text") {
              // First text token = thinking is over (safety net for Gemini path)
              setIsThinking(false);
              textBufferRef.current += event.text as string;
              startDraining();
            }

            if (event.type === "tool_start") {
              const id = String(event.id ?? "");
              const name = String(event.tool ?? "tool");
              setStreamingTools((prev) => [
                ...prev,
                { id, name, startedAt: Date.now() },
              ]);
            }

            if (event.type === "tool_result") {
              const id = String(event.id ?? "");
              setStreamingTools((prev) =>
                prev.map((t) =>
                  t.id === id
                    ? { ...t, completedAt: Date.now(), result: event.result }
                    : t,
                ),
              );
            }

            if (event.type === "done") {
              flushBuffer();
              streamingDoneRef.current = true;
              setIsThinking(false);
              // Don't clear isStreaming or optimisticUserMessage here — wait for
              // persisted comment to load (handled by the useEffect above) to avoid
              // flash of empty state between streaming and persisted content.
              abortRef.current = null;
              // Refetch immediately to get the saved CEO comment
              queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
            }

            if (event.type === "error") {
              console.error("CEO chat stream error:", event.message);
              setStreamError(typeof event.message === "string" ? event.message : "Something went wrong. Please try again.");
              setIsStreaming(false);
              setIsThinking(false);
              abortRef.current = null;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User stopped the stream — already handled in handleStop
          return;
        }
        console.error("CEO chat fetch error:", err);
        // On error, clear immediately and show error to user
        flushBuffer();
        setIsStreaming(false);
        setStreamingText("");
        setStreamError("Connection lost. Please try again.");
        streamingDoneRef.current = false;
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(issueId) });
      }
    },
    [input, issueId, selectedCompanyId, isStreaming, isUploading, queryClient, startDraining, flushBuffer, attachments],
  );

  // ── Smart auto-scroll — only scroll if near bottom ───────────────────────────
  const isNearBottomRef = useRef(true);

  // Track scroll position to decide whether to auto-scroll + show pill
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 300;
      setShowScrollPill(distanceFromBottom > 100);
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // RAF auto-scroll during streaming — respects user position
  useEffect(() => {
    if (!isStreaming) return;
    let rafId: number;
    let lastScrollHeight = 0;
    const loop = () => {
      const el = scrollContainerRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 300) {
          const jumped = el.scrollHeight - lastScrollHeight > 150;
          if (jumped) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          } else {
            el.scrollTop = el.scrollHeight;
          }
        }
        lastScrollHeight = el.scrollHeight;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isStreaming]);

  const handleScrollPillClick = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el && isNearBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  // Force scroll to bottom (used for initial load and user sends message)
  const forceScrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
        isNearBottomRef.current = true;
      }
    });
  }, []);

  // Scroll on streaming changes — only if near bottom
  useEffect(scrollToBottom, [streamingText, isStreaming, scrollToBottom]);

  // Scroll when comments change (refetch after streaming ends) + initial load
  useEffect(() => {
    forceScrollToBottom();
    const t1 = setTimeout(forceScrollToBottom, 100);
    const t2 = setTimeout(forceScrollToBottom, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [comments.length, forceScrollToBottom]);

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
      ? "Online"
      : ceoAgent?.status === "paused"
        ? "Paused"
        : ceoAgent?.status === "error"
          ? "Needs attention"
          : "Ready";

  return (
    <div className="flex flex-col h-full bg-background w-full max-w-full overflow-hidden">
      {/* ── Offline banner ────────────────────────────────────────────── */}
      {isOffline && (
        <div className="bg-amber-500/90 text-white text-center text-[11px] font-medium py-1.5 px-3 shrink-0">
          You are offline. Messages will not send until connection is restored.
        </div>
      )}

      {/* ── Page header bar (50px) ─────────────────────────────────────── */}
      <div data-tour="ceo-chat-header">
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
      </div>

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
        {/*
          Date pill row.
          - overflow-x-auto + scrollbar hidden prevents clip-off at the right edge (bug 39)
          - right-edge fade mask hints there's more to scroll
          - pills are grouped by calendar day with a small "Today / Yesterday / DD MMM"
            header before each group (bug 46)
          - active style keys only off convo.id === ceoChatIssue?.id — NEVER hover —
            so two pills can't appear active simultaneously (bug 21)
        */}
        <div className="relative flex-1 min-w-0">
          <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-6">
            {(() => {
              const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              const now = new Date();
              const todayKey = startOfDay(now);
              const yesterdayKey = todayKey - 24 * 60 * 60 * 1000;
              const groups = new Map<number, { label: string; convos: Array<{ convo: Issue; idx: number }> }>();
              ceoChatConversations.slice(0, 8).forEach((convo: Issue, idx: number) => {
                const d = new Date(convo.createdAt);
                const key = startOfDay(d);
                let label: string;
                if (key === todayKey) label = "Today";
                else if (key === yesterdayKey) label = "Yesterday";
                else label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                if (!groups.has(key)) groups.set(key, { label, convos: [] });
                groups.get(key)!.convos.push({ convo, idx });
              });
              const entries = Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
              return entries.map(([dayKey, group]) => (
                <div key={dayKey} className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1 shrink-0">
                    {group.label}
                  </span>
                  {group.convos.map(({ convo, idx }) => {
                    // Active only keys off the selected conversation id — never
                    // hover — so exactly one pill is ever active at a time.
                    const isActive = convo.id === ceoChatIssue?.id;
                    const timeLabel = new Date(convo.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const dateLabel = new Date(convo.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                    const label = convo.title === "CEO Chat"
                      ? `Chat ${dateLabel}`
                      : convo.title.replace(CEO_CHAT_PREFIX, "").replace(/^[\s—-]+/, "") || `Chat ${idx + 1}`;
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
                        aria-current={isActive ? "true" : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
          {/* Right-edge fade mask so clipped pills feel intentional instead of cut off */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background via-background/70 to-transparent"
          />
        </div>
      </div>

      {/* ── Chat messages area ─────────────────────────────────────────── */}
      <div key={issueId ?? "empty"} ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 mb-16 md:mb-0">
        <div
          className="w-full max-w-3xl mx-auto"
          role="log"
          aria-live="polite"
          aria-label="Conversation with CEO"
          aria-relevant="additions"
        >
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

          {timeline.map((item, idx) => {
            if (item.kind === "agent_msg") {
              // ── Inter-agent message bubble ──
              const msg = item.data;
              const senderName = agentNameMap.get(msg.fromAgentId) ?? "Agent";
              const recipientName = msg.toAgentId ? (agentNameMap.get(msg.toAgentId) ?? "Team") : "Team";
              const initials = senderName.slice(0, 2).toUpperCase();
              const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"];
              const colorHash = senderName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
              const avatarColor = colors[colorHash % colors.length];

              return (
                <div
                  key={`msg-${msg.id}`}
                  className="flex items-start gap-3 px-1 py-2"
                  role="article"
                  aria-label={`${senderName} to ${recipientName}`}
                >
                  <div className="w-7 shrink-0">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white", avatarColor)}>
                      {initials}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[12px] font-semibold text-foreground/80">{senderName}</span>
                      <span className="text-[10px] text-muted-foreground/50">to {recipientName}</span>
                    </div>
                    <div className={cn("relative rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground border border-border/50 bg-muted/30")}>
                      <p className="whitespace-pre-wrap">{msg.summary}</p>
                    </div>
                    <span className="mt-[3px] block select-none px-1 text-[11px] text-muted-foreground/60">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            }

            // ── Regular comment bubble ──
            const comment = item.data as IssueComment;
            const isTourTrigger = !comment.authorUserId && comment.authorAgentId &&
              /show you around|want me to.*show|tour|team is live|team.*ready/i.test(comment.body);

            // Grouping — only group adjacent comments (not agent messages)
            const prevItem = idx > 0 ? timeline[idx - 1] : null;
            const nextItem = idx < timeline.length - 1 ? timeline[idx + 1] : null;
            const prev = prevItem?.kind === "comment" ? (prevItem.data as IssueComment) : null;
            const next = nextItem?.kind === "comment" ? (nextItem.data as IssueComment) : null;

            const TIME_GAP_MS = 3 * 60 * 1000;
            const isCloseInTimePrev = prev &&
              (new Date(comment.createdAt).getTime() - new Date(prev.createdAt).getTime()) < TIME_GAP_MS;
            const isCloseInTimeNext = next &&
              (new Date(next.createdAt).getTime() - new Date(comment.createdAt).getTime()) < TIME_GAP_MS;

            const isSameSenderAsPrev = prev && isCloseInTimePrev &&
              ((comment.authorAgentId && prev.authorAgentId && comment.authorAgentId === prev.authorAgentId) ||
               (comment.authorUserId && prev.authorUserId && comment.authorUserId === prev.authorUserId));
            const isSameSenderAsNext = next && isCloseInTimeNext &&
              ((comment.authorAgentId && next.authorAgentId && comment.authorAgentId === next.authorAgentId) ||
               (comment.authorUserId && next.authorUserId && comment.authorUserId === next.authorUserId));

            const showAvatar = !isSameSenderAsPrev;
            const showTimestamp = !isSameSenderAsNext;
            const isGrouped = !!isSameSenderAsPrev;

            return (
              <div key={comment.id}>
                <ChatBubble
                  comment={comment}
                  onViewConversation={handleViewConversation}
                  showAvatar={showAvatar}
                  showTimestamp={showTimestamp}
                  isGrouped={isGrouped}
                />
                {isTourTrigger && (
                  <div className="flex flex-row items-end gap-2 mb-3">
                    <div className="w-[27px] shrink-0" />
                    <div className="max-w-[88%] md:max-w-[75%] flex gap-2">
                      <button
                        onClick={() => { setTourActive(true); }}
                        disabled={isStreaming}
                        className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        Show me around
                      </button>
                      <button
                        onClick={() => { void handleSend("Let's get to work"); }}
                        disabled={isStreaming}
                        className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                      >
                        Skip, let's work
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Onboarding quick prompts — shown when CEO has posted but user hasn't typed yet */}
          {comments.length > 0 &&
            !comments.some((c: IssueComment) => c.authorUserId && !c.authorAgentId) &&
            !optimisticUserMessage &&
            !isStreaming && (
            <div className="flex flex-row items-end gap-2 mb-3">
              <div className="w-[27px] shrink-0" />
              <div className="max-w-[88%] md:max-w-[75%] flex flex-wrap gap-1.5">
                {[
                  { label: "Search Dubai projects", message: "Search Dubai projects in my areas" },
                  { label: "Show me market data", message: "Show me market data for my focus areas" },
                  { label: "Draft a WhatsApp message", message: "Draft a sample WhatsApp message to a lead" },
                  { label: "Generate an Instagram post", message: "Generate an Instagram post for my areas" },
                ].map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => { void handleSend(prompt.message); }}
                    className="rounded-full border border-primary/30 bg-primary/5 px-3 py-[5px] text-[11.5px] text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optimistic user message — shows immediately before server confirms */}
          {optimisticUserMessage && (
            <ChatBubbleV2 role="user" showHeader>
              <span className="whitespace-pre-wrap">{optimisticUserMessage}</span>
            </ChatBubbleV2>
          )}

          {/* Typing indicator during progressive reveal */}
          {showRevealTyping && <TypingIndicator />}

          {/* Single unified streaming bubble — handles thinking, typing dots, text, and tools */}
          {isStreaming && (
            <StreamingBubble
              text={streamingText}
              toolsUsed={streamingTools}
              isStreaming={isStreaming}
              isThinking={isThinking}
            />
          )}

          {/* Keep showing streaming content after done until persisted comment loads */}
          {!isStreaming && (streamingText !== "" || streamingTools.length > 0) && (
            <StreamingBubble text={streamingText} toolsUsed={streamingTools} isStreaming={false} />
          )}

          {/* Stream error message */}
          {streamError && !isStreaming && (
            <div className="mx-10 mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{streamError}</span>
              <div className="ml-auto flex items-center gap-2">
                {lastSentMessageRef.current && (
                  <button
                    onClick={() => {
                      setStreamError(null);
                      handleSend(lastSentMessageRef.current);
                    }}
                    className="text-primary/80 hover:text-primary transition-colors font-medium"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setStreamError(null)}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Suggestion chips after the last assistant reply (generic, not tool-aware yet) */}
          {!isStreaming &&
            !optimisticUserMessage &&
            visibleComments.length > 0 &&
            (() => {
              const last = visibleComments[visibleComments.length - 1];
              if (!last || last.authorAgentId === null) return null;
              return (
                <div className="pl-10 pr-4">
                  <SuggestionChips onSuggestionClick={(s) => setInput(s)} />
                </div>
              );
            })()}

          <div ref={messagesEndRef} />
        </div>
        <ScrollToBottomPill show={showScrollPill} onClick={handleScrollPillClick} />
      </div>

      {/* ── Quick action pills (glass) ─────────────────────────────────── */}
      <div data-tour="quick-actions" className="px-3 sm:px-5 pt-2 pb-1 flex gap-[5px] overflow-x-auto shrink-0 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => { void handleSend(action.message); }}
            disabled={!issueId || isStreaming}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-[5px] text-[11.5px] text-foreground/70 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed",
              GLASS.interactive,
            )}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* ── Input bar (glass) ──────────────────────────────────────────── */}
      <div
        data-tour="chat-input"
        className="fixed bottom-0 left-0 right-0 z-10 pb-[env(safe-area-inset-bottom)] md:static shrink-0"
      >
        {uploadError && (
          <div className="mx-auto max-w-3xl px-3 pb-1 text-[11px] text-destructive">
            {uploadError}
          </div>
        )}
        <ChatInputV2
          value={input}
          onChange={setInput}
          onSubmit={() => { void handleSend(); }}
          onStop={handleStop}
          isStreaming={isStreaming || isUploading}
          disabled={!issueId}
          placeholder={isUploading ? "Uploading..." : issueId ? "Type a message to CEO..." : "Setting up CEO Chat..."}
          attachments={attachments}
          onAttach={handleAttach}
          onRemoveAttachment={handleRemoveAttachment}
        />
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

      {/* ── Spotlight Tour ───────────────────────────────────────────────── */}
      <SpotlightTour
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />
    </div>
  );
}
