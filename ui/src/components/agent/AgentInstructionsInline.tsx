import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, Sparkles, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface InstructionRule {
  id: string;
  text: string;
  enabled: boolean;
  createdAt: string;
}

interface AgentInstructionsInlineProps {
  agentId: string;
  companyId: string;
}

/**
 * Rule-based custom instructions. Each instruction is a discrete card with a
 * toggle and delete button. Brokers can enable/disable without losing the text.
 */
export function AgentInstructionsInline({ agentId, companyId }: AgentInstructionsInlineProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ interpreted: string; original: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: rules, isLoading } = useQuery<InstructionRule[]>({
    queryKey: ["agent-rules", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const interpretMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions/interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ interpreted: string; original: string }>;
    },
    onSuccess: (res) => {
      setProposed(res);
    },
  });

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<InstructionRule>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["agent-rules", agentId] });
      setDraft("");
      setProposed(null);
      setFlash(created.id);
      setTimeout(() => setFlash(null), 1500);
      inputRef.current?.focus();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-rules", agentId] }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-rules", agentId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/instructions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-rules", agentId] }),
  });

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed || interpretMutation.isPending || addMutation.isPending) return;
    // Send to the interpreter first — broker confirms the cleaned rule before saving.
    interpretMutation.mutate(trimmed);
  }

  return (
    <div className="space-y-3">
      {/* Add new rule — broker types freeform, CEO interprets, broker confirms */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tell the agent what to do — e.g. 'always ask about budget first'"
          className="flex-1 px-3 py-2 text-[12.5px] bg-transparent border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-ring"
          maxLength={2000}
          disabled={interpretMutation.isPending || addMutation.isPending || !!proposed}
        />
        <button
          type="submit"
          disabled={!draft.trim() || interpretMutation.isPending || addMutation.isPending || !!proposed}
          className={cn(
            "text-[12px] font-medium px-3 py-2 rounded-md transition-colors",
            draft.trim() && !interpretMutation.isPending && !proposed
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {interpretMutation.isPending ? "Reading..." : addMutation.isPending ? "Saving..." : "Add"}
        </button>
      </form>

      {/* Proposed rule — confirmation card */}
      {proposed && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-primary font-medium uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            Got it — save this as a rule?
          </div>
          <div className="text-[13px] leading-snug">{proposed.interpreted}</div>
          {proposed.interpreted.trim().toLowerCase() !== proposed.original.trim().toLowerCase() && (
            <div className="text-[10.5px] text-muted-foreground italic">
              Interpreted from: "{proposed.original.slice(0, 120)}{proposed.original.length > 120 ? "…" : ""}"
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => addMutation.mutate(proposed.interpreted)}
              disabled={addMutation.isPending}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(proposed.interpreted);
                setProposed(null);
                inputRef.current?.focus();
              }}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-border hover:bg-accent/50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => { setProposed(null); setDraft(""); }}
              className="text-[12px] font-medium px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {interpretMutation.isError && (
        <div className="text-[11.5px] text-destructive">
          Couldn't read that — try rephrasing.
        </div>
      )}
      {addMutation.isError && (
        <div className="text-[11.5px] text-destructive">
          Couldn't save that — try again.
        </div>
      )}

      {/* Rule list */}
      {isLoading && <div className="text-[12px] text-muted-foreground">Loading...</div>}

      {rules && rules.length === 0 && (
        <div className="text-[11.5px] text-muted-foreground py-3 text-center">
          No custom rules yet. Add one above and it'll apply to every message this agent drafts.
        </div>
      )}

      {rules && rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              flash={flash === rule.id}
              onToggle={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
              onEdit={(text) => editMutation.mutate({ id: rule.id, text })}
              onDelete={() => {
                if (confirm(`Delete this rule?\n\n"${rule.text}"`)) {
                  deleteMutation.mutate(rule.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single rule card ──────────────────────────────────────────────────────

function RuleCard({
  rule,
  flash,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: InstructionRule;
  flash: boolean;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rule.text);

  useEffect(() => { setDraft(rule.text); }, [rule.text]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== rule.text) onEdit(trimmed);
    else setDraft(rule.text);
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors",
        flash
          ? "border-primary bg-primary/10 animate-pulse"
          : rule.enabled
            ? "border-border/50 bg-card/60"
            : "border-border/30 bg-muted/30",
      )}
    >
      {/* Toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={rule.enabled}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors shrink-0 mt-0.5",
          rule.enabled ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-white transition-transform",
            rule.enabled ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setDraft(rule.text); setEditing(false); }
            }}
            className="w-full px-2 py-0.5 text-[12.5px] bg-transparent border border-primary/60 rounded outline-none"
            maxLength={1000}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "text-left w-full text-[12.5px] leading-snug",
              rule.enabled ? "text-foreground" : "text-muted-foreground line-through",
            )}
          >
            {rule.text}
          </button>
        )}
        <div className="flex items-center gap-2 mt-1">
          {flash && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-primary font-medium">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <span className="text-[10.5px] text-muted-foreground">
            {rule.enabled ? "Active" : "Disabled"} · {formatRelativeTime(rule.createdAt)}
          </span>
        </div>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        title="Delete rule"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
