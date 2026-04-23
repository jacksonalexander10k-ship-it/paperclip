import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";

interface ProfileTemplate {
  id: string;
  name: string;
  tagline: string;
  appliesToRole: string;
  config: { goal: string; tone?: string; cadence?: string; handoffRules?: string; dontDo?: string };
  isStock: boolean;
}

interface AgentProfileSectionProps {
  agentId: string;
  companyId: string;
}

export function AgentProfileSection({ agentId, companyId }: AgentProfileSectionProps) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);

  const { data: current } = useQuery<{ profile: ProfileTemplate | null }>({
    queryKey: ["agent-profile", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/profile`, {
        credentials: "include",
      });
      if (!res.ok) return { profile: null };
      return res.json();
    },
  });

  const { data: templates } = useQuery<ProfileTemplate[]>({
    queryKey: ["profile-templates", companyId, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/profile-templates?role=sales`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

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
    <div>
      {profile ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{profile.name}</div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">{profile.tagline}</div>
              <div className="mt-3 text-[11.5px] space-y-1.5">
                <div><span className="font-medium">Goal: </span>{profile.config.goal}</div>
                {profile.config.tone && <div><span className="font-medium">Tone: </span>{profile.config.tone}</div>}
                {profile.config.cadence && <div><span className="font-medium">Cadence: </span>{profile.config.cadence}</div>}
                {profile.config.handoffRules && <div><span className="font-medium">Escalates: </span>{profile.config.handoffRules}</div>}
                {profile.config.dontDo && <div><span className="font-medium">Never: </span>{profile.config.dontDo}</div>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className="shrink-0 text-[11.5px] font-medium px-2.5 py-1 rounded-md border border-border hover:bg-accent/50"
            >
              {picking ? "Cancel" : "Switch"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="text-[12px] text-muted-foreground">
            No profile set. Pick one below, or ask the CEO in chat to build a custom one.
          </div>
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="shrink-0 text-[11.5px] font-medium px-2.5 py-1 rounded-md border border-border hover:bg-accent/50"
          >
            Pick one
          </button>
        </div>
      )}

      {picking && templates && templates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/40 space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Available profiles</div>
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
                <div className="text-[12.5px] font-medium">{t.name}</div>
                {t.isStock && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">stock</span>}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">{t.tagline}</div>
            </button>
          ))}
          <div className="text-[11px] text-muted-foreground mt-3 px-1">
            Want a custom profile? Ask the CEO in chat — they'll walk you through it.
          </div>
        </div>
      )}
    </div>
  );
}
