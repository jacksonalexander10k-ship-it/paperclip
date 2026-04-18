import { useEffect } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, User } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { leadsApi } from "../api/leads";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDateTime } from "../lib/format-time";

function isValidEmail(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeadDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={lead.name}
        actions={
          <Link
            to="/leads"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to leads
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-5 space-y-4">
          {/* Contact card */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Contact
            </div>
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
          </div>

          {/* Status card */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Status
            </div>
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
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Notes
              </div>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                {lead.notes}
              </div>
            </div>
          )}

          {/* Budget */}
          {lead.budget && Object.keys(lead.budget).length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Budget
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-foreground/80">
                {JSON.stringify(lead.budget, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

export default LeadDetail;
