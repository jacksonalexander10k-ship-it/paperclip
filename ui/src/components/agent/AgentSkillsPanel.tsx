import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

interface SkillRecord {
  key: string;
  name: string;
  description: string;
  when: string;
  category: "communication" | "sales" | "domain" | "compliance";
  isCustom: boolean;
  enabled: boolean;
}

interface AgentSkillsPanelProps {
  agentId: string;
  companyId: string;
  agentRole: string;
}

const CATEGORY_META: Record<SkillRecord["category"], { label: string; order: number }> = {
  communication: { label: "Communication", order: 1 },
  sales: { label: "Sales craft", order: 2 },
  domain: { label: "Domain knowledge", order: 3 },
  compliance: { label: "Compliance", order: 4 },
};

/**
 * Claude-Code-style skills panel. Groups, filters, toggles, previews.
 * Stock skills are immutable; custom skills are editable. Always-on search.
 */
export function AgentSkillsPanel({ agentId, companyId, agentRole }: AgentSkillsPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled" | "custom">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: skills, isLoading } = useQuery<SkillRecord[]>({
    queryKey: ["agent-skills", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/skills`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/skills/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-skills", agentId] });
      pushToast({ title: variables.enabled ? "Skill enabled" : "Skill disabled" });
    },
    onError: (err) => {
      pushToast({
        title: "Couldn't update skill",
        body: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    },
  });

  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (filter === "enabled" && !s.enabled) return false;
      if (filter === "disabled" && s.enabled) return false;
      if (filter === "custom" && !s.isCustom) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [skills, search, filter]);

  const grouped = useMemo(() => {
    const map = new Map<SkillRecord["category"], SkillRecord[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return [...map.entries()].sort((a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order);
  }, [filtered]);

  if (isLoading) {
    return <div className="text-[12px] text-muted-foreground">Loading skills...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-transparent border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-2 py-1.5 text-[12px] bg-transparent border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All skills</option>
          <option value="enabled">Enabled only</option>
          <option value="disabled">Disabled only</option>
          <option value="custom">Custom only</option>
        </select>
        <button
          type="button"
          disabled
          title="Custom skills coming soon"
          className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium border border-border rounded-md opacity-50 cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
          Add custom
        </button>
      </div>

      {/* Grouped skill list */}
      {grouped.length === 0 && (
        <div className="text-[12px] text-muted-foreground py-8 text-center">
          No skills match your search.
        </div>
      )}

      {grouped.map(([category, items]) => {
        const onCount = items.filter((s) => s.enabled).length;
        return (
          <SkillsCategory
            key={category}
            title={CATEGORY_META[category].label}
            onCount={onCount}
            totalCount={items.length}
          >
            {items.map((skill) => (
              <SkillRow
                key={skill.key}
                skill={skill}
                expanded={expanded === skill.key}
                onToggleExpand={() => setExpanded((e) => (e === skill.key ? null : skill.key))}
                onToggleEnabled={() => toggleMutation.mutate({ key: skill.key, enabled: !skill.enabled })}
                pending={toggleMutation.isPending}
              />
            ))}
          </SkillsCategory>
        );
      })}
    </div>
  );
}

// ── Category accordion ─────────────────────────────────────────────────────

function SkillsCategory({
  title,
  onCount,
  totalCount,
  children,
}: {
  title: string;
  onCount: number;
  totalCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border/40 rounded-lg bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/20 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-[12px] font-semibold flex-1">{title}</span>
        <span className="text-[11px] text-muted-foreground">
          {onCount} on / {totalCount}
        </span>
      </button>
      {open && <div className="border-t border-border/30 divide-y divide-border/30">{children}</div>}
    </div>
  );
}

// ── Single skill row ──────────────────────────────────────────────────────

function SkillRow({
  skill,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  pending,
}: {
  skill: SkillRecord;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  pending: boolean;
}) {
  return (
    <div className="group">
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={skill.enabled}
          disabled={pending}
          onClick={onToggleEnabled}
          className={cn(
            "relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors shrink-0 mt-0.5",
            skill.enabled ? "bg-primary" : "bg-muted",
            pending && "opacity-60",
          )}
        >
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full bg-white transition-transform",
              skill.enabled ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </button>

        {/* Name + desc */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium">{skill.name}</span>
            {skill.isCustom && (
              <span className="text-[9.5px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                custom
              </span>
            )}
            {!skill.enabled && (
              <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                off
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
            {skill.description}
          </div>
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pl-14 text-[11.5px] text-muted-foreground space-y-1.5">
          <div>
            <span className="font-medium text-foreground">When to use:</span> {skill.when}
          </div>
          <div>
            <span className="font-medium text-foreground">Key:</span>{" "}
            <code className="text-[10.5px] bg-muted px-1.5 py-0.5 rounded">{skill.key}</code>
          </div>
        </div>
      )}
    </div>
  );
}
