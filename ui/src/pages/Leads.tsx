import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, type Lead, type LeadFilters } from "../api/leads";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import {
  Users,
  Plus,
  Upload,
  Search,
  X,
  ChevronDown,
  Phone,
  Mail,
  Star,
  MessageCircle,
  UserPlus,
  UserMinus,
  Trash2,
  Send,
  Layers,
} from "lucide-react";
import { WhatsAppConversationDrawer } from "../components/WhatsAppConversationDrawer";
import { StartOutreachDialog } from "../components/StartOutreachDialog";
import { ManageTemplatesDialog } from "../components/ManageTemplatesDialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEAD_STAGES = [
  "lead",
  "contacted",
  "qualified",
  "viewing",
  "negotiation",
  "closed_won",
  "closed_lost",
  "archived",
] as const;

const STAGE_LABELS: Record<string, string> = {
  lead: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  viewing: "Viewing",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  archived: "Archived",
};

const LEAD_SOURCES = [
  "whatsapp",
  "property_finder",
  "bayut",
  "dubizzle",
  "instagram",
  "facebook_ad",
  "landing_page",
  "referral",
  "manual",
  "csv_import",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  property_finder: "Property Finder",
  bayut: "Bayut",
  dubizzle: "Dubizzle",
  instagram: "Instagram",
  facebook_ad: "Facebook Ad",
  landing_page: "Landing Page",
  referral: "Referral",
  manual: "Manual",
  csv_import: "CSV Import",
};

function stagePillClasses(stage: string): string {
  switch (stage) {
    case "lead":
      return "bg-blue-500/10 text-blue-700 dark:bg-blue-400/12 dark:text-blue-400";
    case "contacted":
      return "bg-violet-500/10 text-violet-700 dark:bg-violet-400/12 dark:text-violet-400";
    case "qualified":
      return "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-400";
    case "viewing":
      return "bg-amber-500/10 text-amber-700 dark:bg-amber-400/12 dark:text-amber-400";
    case "negotiation":
      return "bg-orange-500/10 text-orange-700 dark:bg-orange-400/12 dark:text-orange-400";
    case "closed_won":
      return "bg-green-500/10 text-green-700 dark:bg-green-400/12 dark:text-green-400";
    case "closed_lost":
      return "bg-red-500/10 text-red-700 dark:bg-red-400/12 dark:text-red-400";
    case "archived":
      return "bg-muted-foreground/10 text-muted-foreground";
    default:
      return "bg-muted-foreground/10 text-muted-foreground";
  }
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  if (score >= 3) return "text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

/** Validate email strings to avoid rendering junk values like "JOHN". */
function isValidEmail(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  // Simple RFC-5322-ish check — good enough to reject non-emails like "JOHN".
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Add Lead Dialog (inline)
// ---------------------------------------------------------------------------

function AddLeadDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("manual");

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setEmail("");
      setSource("manual");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold">Add Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Ahmed Al Hashimi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground block mb-1">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground block mb-1">
                Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="ahmed@email.com"
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" className="text-[12px] h-8" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] h-8"
            disabled={!name.trim() || submitting}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                source,
              })
            }
          >
            {submitting ? "Adding..." : "Add Lead"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Dropdown (inline edit)
// ---------------------------------------------------------------------------

function StageDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (newStage: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the portaled menu below the button and close on outside click / scroll.
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() { setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const menu = open && pos
    ? createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 100 }}
          className="bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
        >
          {LEAD_STAGES.filter((s) => s !== "archived").map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent transition-colors",
                s === value && "font-medium text-foreground",
                s !== value && "text-muted-foreground",
              )}
            >
              {STAGE_LABELS[s] ?? s}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
          stagePillClasses(value),
        )}
      >
        {STAGE_LABELS[value] ?? value}
        <ChevronDown className="w-3 h-3" />
      </button>
      {menu}
    </>
  );
}

// ---------------------------------------------------------------------------
// Score Stars
// ---------------------------------------------------------------------------

function ScoreDisplay({
  score,
  scoredAt,
}: {
  score: number | null | undefined;
  scoredAt?: string | null | undefined;
}) {
  // "Unscored" if we've never scored it: either no scoredAt timestamp, or score is null/0.
  const unscored =
    score === null ||
    score === undefined ||
    (score === 0 && (scoredAt === null || scoredAt === undefined));

  if (unscored) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums text-muted-foreground/40">
        —
      </span>
    );
  }

  const s = score as number;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums", scoreColor(s))}>
      <Star className="w-3 h-3 fill-current" />
      {s}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  filters,
  onFiltersChange,
}: {
  filters: LeadFilters;
  onFiltersChange: (f: LeadFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input
          type="text"
          value={filters.search ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
          placeholder="Search by name, phone, email..."
          className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-background text-[12.5px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Stage filter */}
      <select
        value={filters.stage ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value || undefined })}
        className="h-8 px-2 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All stages</option>
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s] ?? s}
          </option>
        ))}
      </select>

      {/* Source filter */}
      <select
        value={filters.source ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, source: e.target.value || undefined })}
        className="h-8 px-2 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All sources</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s] ?? s}
          </option>
        ))}
      </select>

      {/* Score filter */}
      <select
        value={
          filters.scoreMin !== undefined
            ? `${filters.scoreMin}-${filters.scoreMax ?? 10}`
            : ""
        }
        onChange={(e) => {
          if (!e.target.value) {
            onFiltersChange({ ...filters, scoreMin: undefined, scoreMax: undefined });
          } else {
            const [min, max] = e.target.value.split("-").map(Number);
            onFiltersChange({ ...filters, scoreMin: min, scoreMax: max });
          }
        }}
        className="h-8 px-2 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All scores</option>
        <option value="8-10">Hot (8-10)</option>
        <option value="5-7">Warm (5-7)</option>
        <option value="1-4">Cold (1-4)</option>
        <option value="0-0">Unscored (0)</option>
      </select>

      {/* Clear filters */}
      {(filters.stage || filters.source || filters.search || filters.scoreMin !== undefined) && (
        <Button
          variant="ghost"
          size="sm"
          className="text-[11px] h-7 text-muted-foreground"
          onClick={() => onFiltersChange({})}
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead Row
// ---------------------------------------------------------------------------

function LeadRow({
  lead,
  agentName,
  selected,
  onToggleSelect,
  onStageChange,
  onWhatsAppClick,
}: {
  lead: Lead;
  agentName: string | null;
  selected: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onStageChange: (newStage: string) => void;
  onWhatsAppClick?: (phone: string, name: string) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[36px_1fr_120px_120px_60px_120px_100px_100px] items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-accent/30 transition-colors text-[12.5px]",
        selected && "bg-accent/40",
      )}
    >
      {/* Select checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelect(lead.id, (e.nativeEvent as MouseEvent).shiftKey)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${lead.name}`}
          className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
        />
      </div>

      {/* Name + contact */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/leads/${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-foreground truncate hover:underline focus-visible:underline focus:outline-none"
          >
            {lead.name}
          </Link>
          {lead.phone && onWhatsAppClick && (
            <button
              data-testid="lead-whatsapp-btn"
              onClick={(e) => {
                e.stopPropagation();
                onWhatsAppClick(lead.phone!, lead.name);
              }}
              className="w-[22px] h-[22px] rounded-md flex items-center justify-center hover:bg-accent transition-colors shrink-0"
              title="View WhatsApp conversation"
            >
              <MessageCircle className="w-3.5 h-3.5" style={{ color: "oklch(0.48 0.17 162)" }} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/70 text-[11px] mt-0.5">
          {lead.phone && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Phone className="w-2.5 h-2.5 shrink-0" />
              {lead.phone}
            </span>
          )}
          {isValidEmail(lead.email) ? (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Mail className="w-2.5 h-2.5 shrink-0" />
              {lead.email}
            </span>
          ) : lead.email ? (
            <span className="inline-flex items-center gap-0.5 truncate text-muted-foreground/40">
              <Mail className="w-2.5 h-2.5 shrink-0" />
              —
            </span>
          ) : null}
        </div>
      </div>

      {/* Source */}
      <div className="text-muted-foreground text-[11.5px] truncate">
        {SOURCE_LABELS[lead.source ?? ""] ?? lead.source ?? "-"}
      </div>

      {/* Stage */}
      <div>
        <StageDropdown value={lead.stage} onChange={onStageChange} />
      </div>

      {/* Score */}
      <div>
        <ScoreDisplay score={lead.score} scoredAt={lead.scoredAt} />
      </div>

      {/* Assigned agent */}
      <div className="text-muted-foreground text-[11.5px] truncate">
        {agentName ?? "-"}
      </div>

      {/* Last contact */}
      <div className="text-muted-foreground/60 text-[11px]">
        {relativeTime(lead.lastContactAt)}
      </div>

      {/* Created */}
      <div className="text-muted-foreground/60 text-[11px]">
        {relativeTime(lead.createdAt)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function Leads() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<LeadFilters>({});
  const [addOpen, setAddOpen] = useState(false);
  const [waDrawer, setWaDrawer] = useState<{ open: boolean; chatJid: string; contactName: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [templatesManagerOpen, setTemplatesManagerOpen] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Leads" }]);
  }, [setBreadcrumbs]);

  const {
    data: leads,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.leads.list(selectedCompanyId!, filters as Record<string, unknown>),
    queryFn: () => leadsApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) {
      map.set(a.id, a.name);
    }
    return map;
  }, [agents]);

  const invalidateLeads = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["leads", selectedCompanyId!] });
  }, [queryClient, selectedCompanyId]);

  const createLead = useMutation({
    mutationFn: (data: Record<string, unknown>) => leadsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      invalidateLeads();
      setAddOpen(false);
    },
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      leadsApi.update(selectedCompanyId!, id, data),
    onSuccess: invalidateLeads,
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => leadsApi.importCsv(selectedCompanyId!, file),
    onSuccess: (result) => {
      invalidateLeads();
      if (result.errors.length > 0) {
        alert(`Imported ${result.imported} leads. ${result.errors.length} rows had errors.`);
      }
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (body: Parameters<typeof leadsApi.bulk>[1]) =>
      leadsApi.bulk(selectedCompanyId!, body),
    onSuccess: (res, variables) => {
      invalidateLeads();
      if (variables.action === "start_outreach" && res.results) {
        const enqueued = res.results.filter((r) => r.enqueued).length;
        const skipped = res.results.length - enqueued;
        if (skipped > 0) {
          const reasons = res.results
            .filter((r) => !r.enqueued)
            .map((r) => r.reason)
            .filter(Boolean);
          alert(`Outreach started for ${enqueued}. Skipped ${skipped} (${reasons.join(", ")}).`);
        }
      }
      setSelected(new Set());
      setAssignOpen(false);
      setStageMenuOpen(false);
    },
    onError: (err) => {
      alert(`Bulk action failed: ${(err as Error).message}`);
    },
  });

  function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      importCsv.mutate(file);
      e.target.value = "";
    }
  }

  // Summary counts
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads ?? []) {
      counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  // Selection helpers
  const visibleLeadIds = useMemo(() => (leads ?? []).map((l) => l.id), [leads]);

  // Drop selections no longer visible (e.g. after applying a filter)
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleLeadIds);
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [visibleLeadIds]);

  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedId && lastSelectedId !== id) {
          const ids = visibleLeadIds;
          const a = ids.indexOf(lastSelectedId);
          const b = ids.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(ids[i]);
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastSelectedId(id);
    },
    [lastSelectedId, visibleLeadIds],
  );

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === visibleLeadIds.length && visibleLeadIds.length > 0) return new Set();
      return new Set(visibleLeadIds);
    });
  }, [visibleLeadIds]);

  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && selectedCount === visibleLeadIds.length;
  const someSelected = selectedCount > 0 && selectedCount < visibleLeadIds.length;

  const selectedLeadIds = useMemo(() => Array.from(selected), [selected]);
  const selectedLeads = useMemo(
    () => (leads ?? []).filter((l) => selected.has(l.id)),
    [leads, selected],
  );
  const allSelectedHaveAgent = selectedLeads.length > 0 && selectedLeads.every((l) => l.agentId);

  if (!selectedCompanyId) {
    return <EmptyState icon={Users} message="Select a company to view leads." />;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Leads"
        badge={
          leads ? (
            <span className="text-[11.5px] text-muted-foreground/60 font-medium tabular-nums">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
          ) : undefined
        }
        actions={
          <>
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvChange}
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-[11.5px] h-7 gap-1.5"
              onClick={() => setTemplatesManagerOpen(true)}
              title="Manage outreach message templates"
            >
              <MessageCircle className="h-3 w-3" />
              Templates
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11.5px] h-7 gap-1.5"
              onClick={() => csvRef.current?.click()}
              disabled={importCsv.isPending}
            >
              <Upload className="h-3 w-3" />
              {importCsv.isPending ? "Importing..." : "Import CSV"}
            </Button>
            <Button
              size="sm"
              className="text-[11.5px] h-7 gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Add Lead
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Stage summary pills — render ALL stages so users see the full pipeline,
            not just the one(s) that happen to have leads. Populated stages are
            highlighted; empty stages render in a muted style. */}
        {leads && leads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {LEAD_STAGES.filter((s) => s !== "archived").map((s) => {
              const count = summary[s] ?? 0;
              const isActive = filters.stage === s;
              const isPopulated = count > 0;
              return (
                <button
                  key={s}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      stage: f.stage === s ? undefined : s,
                    }))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                    isActive
                      ? stagePillClasses(s)
                      : isPopulated
                        ? "bg-muted/60 text-foreground hover:bg-muted"
                        : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
                  )}
                >
                  {STAGE_LABELS[s] ?? s}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Assignment filter tabs */}
        <div className="flex items-center gap-1 border-b border-border pb-0">
          {(
            [
              { id: undefined, label: "All" },
              { id: "unassigned", label: "Unassigned" },
              { id: "assigned", label: "Assigned" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.label}
              onClick={() => setFilters((f) => ({ ...f, assigned: tab.id }))}
              className={cn(
                "px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors -mb-[1px]",
                filters.assigned === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onFiltersChange={setFilters} />

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
            <span className="text-[12.5px] font-medium text-foreground">
              {selectedCount} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <div className="h-4 w-px bg-border mx-1" />

            {/* Assign dropdown */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px] gap-1.5"
                onClick={() => setAssignOpen((o) => !o)}
                disabled={bulkMutation.isPending}
              >
                <UserPlus className="w-3 h-3" />
                Assign
                <ChevronDown className="w-3 h-3" />
              </Button>
              {assignOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[280px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-20">
                  {(agents ?? []).map((a) => (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent transition-colors"
                      onClick={() =>
                        bulkMutation.mutate({
                          action: "assign",
                          leadIds: selectedLeadIds,
                          params: { agentId: a.id },
                        })
                      }
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground ml-1.5">· {a.role}</span>
                    </button>
                  ))}
                  {(agents ?? []).length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-muted-foreground">No agents</div>
                  )}
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11.5px] gap-1.5"
              onClick={() =>
                bulkMutation.mutate({ action: "unassign", leadIds: selectedLeadIds })
              }
              disabled={bulkMutation.isPending}
            >
              <UserMinus className="w-3 h-3" />
              Unassign
            </Button>

            {/* Start outreach */}
            <Button
              size="sm"
              className="h-7 text-[11.5px] gap-1.5"
              onClick={() => setOutreachOpen(true)}
              disabled={bulkMutation.isPending || !allSelectedHaveAgent}
              title={
                allSelectedHaveAgent
                  ? "Pick a template or write a custom message"
                  : "Assign an agent before starting outreach"
              }
            >
              <Send className="w-3 h-3" />
              Start outreach
            </Button>

            {/* Change stage */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px] gap-1.5"
                onClick={() => setStageMenuOpen((o) => !o)}
                disabled={bulkMutation.isPending}
              >
                <Layers className="w-3 h-3" />
                Stage
                <ChevronDown className="w-3 h-3" />
              </Button>
              {stageMenuOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-popover border border-border rounded-md shadow-lg z-20">
                  {LEAD_STAGES.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent transition-colors"
                      onClick={() =>
                        bulkMutation.mutate({
                          action: "set_stage",
                          leadIds: selectedLeadIds,
                          params: { stage: s },
                        })
                      }
                    >
                      {STAGE_LABELS[s] ?? s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete — hard-deletes from DB */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11.5px] gap-1.5 text-destructive hover:text-destructive border-destructive/30"
              onClick={() => {
                if (confirm(`Delete ${selectedCount} lead${selectedCount > 1 ? "s" : ""} permanently? This cannot be undone.`)) {
                  bulkMutation.mutate({ action: "delete", leadIds: selectedLeadIds });
                }
              }}
              disabled={bulkMutation.isPending}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <PageSkeleton variant="list" />
        ) : error ? (
          <div className="text-sm text-red-500">
            Failed to load leads: {(error as Error).message}
          </div>
        ) : leads && leads.length === 0 ? (
          <EmptyState
            icon={Users}
            message={
              Object.keys(filters).length > 0
                ? "No leads match your filters."
                : "No leads yet. Add your first lead or import from CSV."
            }
            action={Object.keys(filters).length > 0 ? undefined : "Add Lead"}
            onAction={Object.keys(filters).length > 0 ? undefined : () => setAddOpen(true)}
          />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[36px_1fr_120px_120px_60px_120px_100px_100px] items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  aria-label={allSelected ? "Deselect all" : "Select all"}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                />
              </div>
              <div>Name</div>
              <div>Source</div>
              <div>Stage</div>
              <div>Score</div>
              <div>Agent</div>
              <div>Last Contact</div>
              <div>Created</div>
            </div>

            {/* Rows */}
            {(leads ?? []).map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                agentName={lead.agentId ? agentMap.get(lead.agentId) ?? null : null}
                selected={selected.has(lead.id)}
                onToggleSelect={toggleSelect}
                onStageChange={(stage) =>
                  updateLead.mutate({ id: lead.id, data: { stage } })
                }
                onWhatsAppClick={(phone, name) => {
                  const stripped = phone.replace(/^\+/, "").replace(/\s/g, "");
                  setWaDrawer({ open: true, chatJid: `${stripped}@s.whatsapp.net`, contactName: name });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Lead dialog */}
      <AddLeadDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(data) => createLead.mutate(data)}
        submitting={createLead.isPending}
      />

      {/* WhatsApp conversation drawer */}
      {waDrawer && (
        <WhatsAppConversationDrawer
          open={waDrawer.open}
          onClose={() => setWaDrawer(null)}
          chatJid={waDrawer.chatJid}
          contactName={waDrawer.contactName}
        />
      )}

      {/* Start outreach dialog */}
      {outreachOpen && selectedCompanyId && (
        <StartOutreachDialog
          open={outreachOpen}
          onClose={() => setOutreachOpen(false)}
          companyId={selectedCompanyId}
          agentName={
            selectedLeads[0]?.agentId
              ? agentMap.get(selectedLeads[0].agentId) ?? "Agent"
              : "Agent"
          }
          companyName={selectedCompany?.name ?? ""}
          selectedLeads={selectedLeads.map((l) => ({ id: l.id, name: l.name, phone: l.phone }))}
          onConfirm={(p) =>
            bulkMutation.mutate(
              { action: "start_outreach", leadIds: selectedLeadIds, params: p },
              { onSuccess: () => setOutreachOpen(false) },
            )
          }
          onManageTemplates={() => setTemplatesManagerOpen(true)}
          submitting={bulkMutation.isPending}
        />
      )}

      {/* Templates manager modal */}
      {templatesManagerOpen && selectedCompanyId && (
        <ManageTemplatesDialog
          open={templatesManagerOpen}
          onClose={() => setTemplatesManagerOpen(false)}
          companyId={selectedCompanyId}
        />
      )}
    </div>
  );
}
