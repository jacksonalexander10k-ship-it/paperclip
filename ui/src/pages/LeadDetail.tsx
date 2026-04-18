import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, User, Pencil } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { leadsApi, type Lead } from "../api/leads";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "../lib/format-time";

// ---------------------------------------------------------------------------
// Constants (kept local to mirror Add Lead modal options)
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

const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "penthouse", "studio", "any"] as const;
const TIMELINES = ["asap", "1-3 months", "3-6 months", "6+ months", "exploring"] as const;
const LANGUAGES = ["English", "Arabic", "Russian", "Chinese", "Hindi/Urdu", "Other"] as const;

function isValidEmail(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Edit form state
// ---------------------------------------------------------------------------

interface EditForm {
  phone: string;
  email: string;
  preferredAreas: string; // comma-separated
  nationality: string;
  stage: string;
  score: string;
  source: string;
  language: string;
  propertyType: string;
  timeline: string;
  marketPreference: string;
  agentId: string;
  notes: string;
  budgetMin: string;
  budgetMax: string;
}

function leadToForm(lead: Lead): EditForm {
  const budget = (lead.budget ?? {}) as Record<string, unknown>;
  const min = typeof budget.min === "number" ? budget.min : undefined;
  const max = typeof budget.max === "number" ? budget.max : undefined;
  return {
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    preferredAreas: (lead.preferredAreas ?? []).join(", "),
    nationality: lead.nationality ?? "",
    stage: lead.stage ?? "lead",
    score: String(lead.score ?? 0),
    source: lead.source ?? "",
    language: lead.language ?? "",
    propertyType: lead.propertyType ?? "",
    timeline: lead.timeline ?? "",
    marketPreference: lead.marketPreference ?? "",
    agentId: lead.agentId ?? "",
    notes: lead.notes ?? "",
    budgetMin: min !== undefined ? String(min) : "",
    budgetMax: max !== undefined ? String(max) : "",
  };
}

function formToPayload(form: EditForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    nationality: form.nationality.trim() || null,
    stage: form.stage,
    source: form.source.trim() || null,
    language: form.language.trim() || null,
    propertyType: form.propertyType.trim() || null,
    timeline: form.timeline.trim() || null,
    marketPreference: form.marketPreference.trim() || null,
    agentId: form.agentId || null,
    notes: form.notes.trim() || null,
    preferredAreas: form.preferredAreas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const scoreNum = Number(form.score);
  if (!Number.isNaN(scoreNum)) {
    payload.score = Math.min(10, Math.max(0, Math.round(scoreNum)));
  }

  const budget: Record<string, number> = {};
  const min = form.budgetMin ? Number(form.budgetMin) : undefined;
  const max = form.budgetMax ? Number(form.budgetMax) : undefined;
  if (min !== undefined && !Number.isNaN(min)) budget.min = min;
  if (max !== undefined && !Number.isNaN(max)) budget.max = max;
  payload.budget = Object.keys(budget).length > 0 ? budget : null;

  return payload;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function LeadDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const { data: lead, isLoading, error } = useQuery({
    queryKey: ["leads", "detail", selectedCompanyId, leadId],
    queryFn: () => leadsApi.get(selectedCompanyId!, leadId!),
    enabled: !!selectedCompanyId && !!leadId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignedAgent = lead?.agentId ? agents.find((a) => a.id === lead.agentId) : null;

  const updateLead = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      leadsApi.update(selectedCompanyId!, leadId!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["leads", "detail", selectedCompanyId, leadId], updated);
      queryClient.invalidateQueries({ queryKey: ["leads", selectedCompanyId!] });
      setEditing(false);
      pushToast({ title: "Lead updated", tone: "success" });
    },
    onError: (err) => {
      pushToast({
        title: "Save failed",
        body: (err as Error).message,
        tone: "error",
      });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Leads", href: "/leads" },
      { label: lead?.name ?? (leadId ? leadId.slice(0, 8) : "Lead") },
    ]);
  }, [setBreadcrumbs, lead?.name, leadId]);

  useEffect(() => {
    if (!lead?.name) return;
    const prev = document.title;
    document.title = `${lead.name} · Leads · Aygency World`;
    return () => { document.title = prev; };
  }, [lead?.name]);

  // Seed form when entering edit mode
  useEffect(() => {
    if (editing && lead) {
      setForm(leadToForm(lead));
    }
  }, [editing, lead]);

  if (isLoading) return <PageSkeleton />;
  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <User className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">This lead no longer exists or you don't have access.</p>
        <Link to="/leads" className="text-sm text-primary hover:underline">← Back to leads</Link>
      </div>
    );
  }

  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSave() {
    if (!form) return;
    updateLead.mutate(formToPayload(form));
  }

  function handleCancel() {
    setEditing(false);
    setForm(null);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={lead.name}
        actions={
          <div className="flex items-center gap-3">
            {!editing && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px] gap-1.5"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            <Link
              to="/leads"
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to leads
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-5 space-y-4">
          {/* Contact card */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Contact
            </div>
            {!editing || !form ? (
              <div className="space-y-2.5 text-[13px]">
                <Row icon={Phone} label="Phone" value={lead.phone ?? "—"} />
                <Row
                  icon={Mail}
                  label="Email"
                  value={isValidEmail(lead.email) ? lead.email! : "—"}
                />
                <Row
                  icon={MapPin}
                  label="Preferred areas"
                  value={lead.preferredAreas?.length ? lead.preferredAreas.join(", ") : "—"}
                />
                <Row icon={User} label="Nationality" value={lead.nationality ?? "—"} />
                <Row icon={Calendar} label="Created" value={formatDateTime(lead.createdAt)} />
                <Row
                  icon={Calendar}
                  label="Last contact"
                  value={lead.lastContactAt ? formatDateTime(lead.lastContactAt) : "Never contacted"}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => update("phone", v)}
                  placeholder="+971 50 123 4567"
                />
                <InputField
                  label="Email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  placeholder="ahmed@email.com"
                />
                <InputField
                  label="Preferred areas"
                  value={form.preferredAreas}
                  onChange={(v) => update("preferredAreas", v)}
                  placeholder="JVC, Downtown (comma-separated)"
                  colSpan={2}
                />
                <InputField
                  label="Nationality"
                  value={form.nationality}
                  onChange={(v) => update("nationality", v)}
                  placeholder="Emirati, Indian, British..."
                  colSpan={2}
                />
              </div>
            )}
          </div>

          {/* Status card */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Status
            </div>
            {!editing || !form ? (
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <Field label="Stage" value={stageLabel(lead.stage)} />
                <Field
                  label="Score"
                  value={
                    lead.score > 0 || lead.scoredAt
                      ? `${lead.score} / 10`
                      : "Unscored"
                  }
                />
                <Field label="Source" value={lead.source ?? "—"} />
                <Field label="Language" value={lead.language ?? "—"} />
                <Field label="Property type" value={lead.propertyType ?? "—"} />
                <Field label="Timeline" value={lead.timeline ?? "—"} />
                <Field label="Market" value={lead.marketPreference ?? "—"} />
                <Field
                  label="Assigned agent"
                  value={
                    assignedAgent ? (
                      <button
                        onClick={() => navigate(`/agents/${assignedAgent.id}`)}
                        className="text-primary hover:underline"
                      >
                        {assignedAgent.name}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Stage"
                  value={form.stage}
                  onChange={(v) => update("stage", v)}
                  options={LEAD_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] ?? s }))}
                />
                <InputField
                  label="Score (0-10)"
                  type="number"
                  value={form.score}
                  onChange={(v) => update("score", v)}
                  placeholder="0"
                />
                <SelectField
                  label="Source"
                  value={form.source}
                  onChange={(v) => update("source", v)}
                  options={[
                    { value: "", label: "—" },
                    ...LEAD_SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
                  ]}
                />
                <SelectField
                  label="Language"
                  value={form.language}
                  onChange={(v) => update("language", v)}
                  options={[
                    { value: "", label: "—" },
                    ...LANGUAGES.map((l) => ({ value: l, label: l })),
                  ]}
                />
                <SelectField
                  label="Property type"
                  value={form.propertyType}
                  onChange={(v) => update("propertyType", v)}
                  options={[
                    { value: "", label: "—" },
                    ...PROPERTY_TYPES.map((p) => ({
                      value: p,
                      label: p.charAt(0).toUpperCase() + p.slice(1),
                    })),
                  ]}
                />
                <SelectField
                  label="Timeline"
                  value={form.timeline}
                  onChange={(v) => update("timeline", v)}
                  options={[
                    { value: "", label: "—" },
                    ...TIMELINES.map((t) => ({ value: t, label: t })),
                  ]}
                />
                <InputField
                  label="Market"
                  value={form.marketPreference}
                  onChange={(v) => update("marketPreference", v)}
                  placeholder="off-plan, secondary..."
                />
                <SelectField
                  label="Assigned agent"
                  value={form.agentId}
                  onChange={(v) => update("agentId", v)}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...agents.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          {!editing || !form ? (
            lead.notes ? (
              <div className="rounded-xl border border-border/50 bg-card/80 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Notes
                </div>
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                  {lead.notes}
                </div>
              </div>
            ) : null
          ) : (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Notes
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={4}
                className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Background, preferences, context..."
              />
            </div>
          )}

          {/* Budget */}
          {!editing || !form ? (
            lead.budget && Object.keys(lead.budget).length > 0 ? (
              <div className="rounded-xl border border-border/50 bg-card/80 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Budget
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-foreground/80">
                  {JSON.stringify(lead.budget, null, 2)}
                </pre>
              </div>
            ) : null
          ) : (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Budget (AED)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Min"
                  type="number"
                  value={form.budgetMin}
                  onChange={(v) => update("budgetMin", v)}
                  placeholder="Min"
                />
                <InputField
                  label="Max"
                  type="number"
                  value={form.budgetMax}
                  onChange={(v) => update("budgetMax", v)}
                  placeholder="Max"
                />
              </div>
            </div>
          )}

          {/* Save / Cancel */}
          {editing && (
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-[12px] h-8"
                onClick={handleCancel}
                disabled={updateLead.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-[12px] h-8"
                onClick={handleSave}
                disabled={updateLead.isPending || !form}
              >
                {updateLead.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-foreground/90 break-all">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className="text-foreground/90">{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  colSpan,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : undefined}>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  colSpan,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : undefined}>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value || "__empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LeadDetail;
