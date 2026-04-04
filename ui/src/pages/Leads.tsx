import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
} from "lucide-react";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
          stagePillClasses(value),
        )}
      >
        {STAGE_LABELS[value] ?? value}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
          {LEAD_STAGES.filter((s) => s !== "archived").map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent transition-colors",
                s === value && "font-medium text-foreground",
                s !== value && "text-muted-foreground",
              )}
            >
              {STAGE_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Stars
// ---------------------------------------------------------------------------

function ScoreDisplay({ score }: { score: number }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums", scoreColor(score))}>
      <Star className="w-3 h-3 fill-current" />
      {score}
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
  onStageChange,
}: {
  lead: Lead;
  agentName: string | null;
  onStageChange: (newStage: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px_60px_120px_100px_100px] items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-accent/30 transition-colors text-[12.5px]">
      {/* Name + contact */}
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{lead.name}</div>
        <div className="flex items-center gap-2 text-muted-foreground/70 text-[11px] mt-0.5">
          {lead.phone && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Phone className="w-2.5 h-2.5 shrink-0" />
              {lead.phone}
            </span>
          )}
          {lead.email && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Mail className="w-2.5 h-2.5 shrink-0" />
              {lead.email}
            </span>
          )}
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
        <ScoreDisplay score={lead.score} />
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
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<LeadFilters>({});
  const [addOpen, setAddOpen] = useState(false);
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
        {/* Stage summary pills */}
        {leads && leads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {LEAD_STAGES.filter((s) => summary[s]).map((s) => (
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
                  filters.stage === s
                    ? stagePillClasses(s)
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {STAGE_LABELS[s] ?? s}
                <span className="tabular-nums opacity-70">{summary[s]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <FilterBar filters={filters} onFiltersChange={setFilters} />

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
            <div className="grid grid-cols-[1fr_120px_120px_60px_120px_100px_100px] items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
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
                onStageChange={(stage) =>
                  updateLead.mutate({ id: lead.id, data: { stage } })
                }
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
    </div>
  );
}
