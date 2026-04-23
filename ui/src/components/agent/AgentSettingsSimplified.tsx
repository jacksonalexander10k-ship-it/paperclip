import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AgentDetail } from "@paperclipai/shared";

interface AgentSettingsSimplifiedProps {
  agent: AgentDetail;
  companyId?: string;
}

/**
 * Simplified Settings tab — no adapter tinkering, no MCP permissions, no
 * budget policy advanced view. Just: name, avatar, budget cap, danger zone.
 *
 * Power-users who need the full config can reach it via /agents/:id/configuration.
 */
export function AgentSettingsSimplified({ agent, companyId }: AgentSettingsSimplifiedProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(agent.name);
  const [budgetAed, setBudgetAed] = useState(Math.round((agent.budgetMonthlyCents ?? 0) / 100 * 3.67)); // rough cents-USD-to-AED

  const saveNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agent.id] });
    },
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async (cents: number) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ budgetMonthlyCents: cents }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent", agent.id] }),
  });

  const pauseMutation = useMutation({
    mutationFn: async (pause: boolean) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agent.id}/${pause ? "pause" : "resume"}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent", agent.id] }),
  });

  const isPaused = agent.status === "paused";

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      {/* Identity — internal name (shown in your dashboard) */}
      <Card title="Name" description="How this agent appears inside your dashboard.">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== agent.name) saveNameMutation.mutate(name.trim()); }}
          className="w-full px-3 py-2 text-[13px] bg-transparent border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-ring"
        />
      </Card>

      {/* WhatsApp display name — what leads see */}
      {agent.role === "sales" && (
        <WhatsappDisplayNameCard agent={agent} />
      )}

      {/* Budget */}
      <Card
        title="Monthly budget cap"
        description={`About AED ${budgetAed.toLocaleString()} per month. Sends a notification at 80% and pauses the agent at 100%.`}
      >
        <input
          type="range"
          min={500}
          max={100000}
          step={500}
          value={budgetAed}
          onChange={(e) => setBudgetAed(Number(e.target.value))}
          onMouseUp={(e) => saveBudgetMutation.mutate(Math.round((Number((e.target as HTMLInputElement).value) / 3.67) * 100))}
          onTouchEnd={(e) => saveBudgetMutation.mutate(Math.round((Number((e.target as HTMLInputElement).value) / 3.67) * 100))}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>AED 500</span>
          <span>AED 100,000</span>
        </div>
      </Card>

      {/* Power-user link */}
      <div className="text-[11.5px] text-muted-foreground px-2">
        Advanced settings (adapter, permissions, raw config):{" "}
        <a
          href={`/agents/${encodeURIComponent(agent.urlKey ?? agent.id)}/configuration`}
          className="underline hover:text-foreground"
        >
          open advanced
        </a>
      </div>

      {/* Danger zone */}
      <Card
        title="Danger zone"
        titleClass="text-destructive"
        className="border-destructive/40"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-medium">{isPaused ? "Agent is paused" : "Agent is active"}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {isPaused
                  ? "Won't reply or start new work until resumed."
                  : "Pausing stops all replies and scheduled work."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => pauseMutation.mutate(!isPaused)}
              disabled={pauseMutation.isPending}
              className={cn(
                "shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-md border",
                isPaused
                  ? "border-primary text-primary hover:bg-primary/5"
                  : "border-border hover:bg-accent/50"
              )}
            >
              {pauseMutation.isPending ? "..." : isPaused ? "Resume" : "Pause"}
            </button>
          </div>

          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2 rounded-md border border-border opacity-50 cursor-not-allowed"
            title="Coming soon"
          >
            <Download className="h-3.5 w-3.5" /> Export all conversations
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Fire ${agent.name}? You can restore them for 30 days.`)) {
                alert("Termination flow not yet wired to backend.");
              }
            }}
            className="w-full flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/5"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Fire {agent.name}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── WhatsApp display name editor ────────────────────────────────────────────

function WhatsappDisplayNameCard({ agent }: { agent: AgentDetail }) {
  const meta = (agent.metadata ?? {}) as Record<string, unknown>;
  const initial = typeof meta.whatsappDisplayName === "string" ? meta.whatsappDisplayName : agent.name;
  const [name, setName] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (newName: string) => {
      // First push to Baileys (the live connection) so the WhatsApp profile updates
      const baileysRes = await fetch(`/api/agents/${agent.id}/baileys/profile-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName }),
      });
      if (!baileysRes.ok) {
        const body = await baileysRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update on WhatsApp");
      }
      // Also persist on the agent record for future reconnects
      const recordRes = await fetch(`/api/companies/${agent.companyId}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ metadata: { ...meta, whatsappDisplayName: newName } }),
      });
      if (!recordRes.ok) throw new Error("Saved on WhatsApp but failed to persist locally");
    },
    onMutate: () => { setStatus("saving"); setError(null); },
    onSuccess: () => {
      setStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["agent", agent.id] });
      setTimeout(() => setStatus("idle"), 1500);
    },
    onError: (err) => {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save");
    },
  });

  const changed = name.trim() !== initial && name.trim().length > 0;

  return (
    <Card
      title="Display name on WhatsApp"
      description="What leads see as the sender name in their phone. Max 25 characters."
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={25}
          className="flex-1 px-3 py-2 text-[13px] bg-transparent border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-ring"
          placeholder={agent.name}
        />
        <button
          type="button"
          disabled={!changed || saveMutation.isPending}
          onClick={() => saveMutation.mutate(name.trim())}
          className={cn(
            "text-[12px] font-medium px-3 py-2 rounded-md transition-colors",
            changed && !saveMutation.isPending
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5">
        {status === "saved" && <span className="text-primary">Saved. New messages will show this name.</span>}
        {status === "error" && <span className="text-destructive">{error}</span>}
        {status === "idle" && !changed && "Applies to every message this agent sends. Requires WhatsApp to be connected."}
      </div>
    </Card>
  );
}

function Card({
  title,
  titleClass,
  description,
  className,
  children,
}: {
  title: string;
  titleClass?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3", className)}>
      <div className={cn("text-[13px] font-semibold", titleClass)}>{title}</div>
      {description && <div className="text-[11.5px] text-muted-foreground mt-0.5 mb-3">{description}</div>}
      {!description && <div className="mb-2" />}
      {children}
    </div>
  );
}
