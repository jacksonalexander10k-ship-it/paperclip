import {
  UserPlus, Lightbulb, ShieldAlert, ShieldCheck,
  MessageCircle, Mail, Instagram, FileText, Send,
  Megaphone, Calendar, Users, Eye,
} from "lucide-react";
import { formatCents } from "../lib/utils";

export const typeLabel: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "CEO Strategy",
  budget_override_required: "Budget Override",
  hire_team: "Hire Team",
  send_whatsapp: "Send WhatsApp",
  send_email: "Send Email",
  post_instagram: "Post to Instagram",
  skill_amendment: "Skill Amendment",
  approve_plan: "Approve Plan",
  bulk_whatsapp: "Bulk WhatsApp",
  confirm_viewing: "Confirm Viewing",
  send_pitch_deck: "Send Pitch Deck",
  launch_fb_campaign: "Launch Campaign",
  ceo_proposal: "CEO Proposal",
};

/** Approval types that involve sending outbound communication */
export const OUTBOUND_TYPES = new Set([
  "send_whatsapp", "send_email", "post_instagram",
  "bulk_whatsapp", "confirm_viewing", "send_pitch_deck",
]);

/** Build a contextual label for an approval, e.g. "Hire Agent: Designer" */
export function approvalLabel(type: string, payload?: Record<string, unknown> | null): string {
  const base = typeLabel[type] ?? type;
  if (type === "hire_agent" && payload?.name) {
    return `${base}: ${String(payload.name)}`;
  }
  return base;
}

export const typeIcon: Record<string, typeof UserPlus> = {
  hire_agent: UserPlus,
  hire_team: Users,
  approve_ceo_strategy: Lightbulb,
  budget_override_required: ShieldAlert,
  send_whatsapp: MessageCircle,
  send_email: Mail,
  post_instagram: Instagram,
  skill_amendment: FileText,
  approve_plan: Eye,
  bulk_whatsapp: Send,
  confirm_viewing: Calendar,
  send_pitch_deck: FileText,
  launch_fb_campaign: Megaphone,
  ceo_proposal: Lightbulb,
};

export const defaultTypeIcon = ShieldCheck;

function PayloadField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

function SkillList({ values }: { values: unknown }) {
  if (!Array.isArray(values)) return null;
  const items = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Skills</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HireAgentPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Name</span>
        <span className="font-medium">{String(payload.name ?? "—")}</span>
      </div>
      <PayloadField label="Role" value={payload.role} />
      <PayloadField label="Title" value={payload.title} />
      <PayloadField label="Icon" value={payload.icon} />
      {!!payload.capabilities && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Capabilities</span>
          <span className="text-muted-foreground">{String(payload.capabilities)}</span>
        </div>
      )}
      {!!payload.adapterType && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Adapter</span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.adapterType)}
          </span>
        </div>
      )}
      <SkillList values={payload.desiredSkills} />
    </div>
  );
}

export function CeoStrategyPayload({ payload }: { payload: Record<string, unknown> }) {
  const plan = payload.plan ?? payload.description ?? payload.strategy ?? payload.text;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Title" value={payload.title} />
      {!!plan && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
          {String(plan)}
        </div>
      )}
      {!plan && <GenericPayload payload={payload} />}
    </div>
  );
}

function HireTeamPayload({ payload }: { payload: Record<string, unknown> }) {
  const agents = Array.isArray(payload.agents) ? payload.agents : [];
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      {agents.length > 0 && (
        <div className="space-y-1">
          {agents.map((agent: Record<string, unknown>, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5">
              <span className="font-medium text-xs">{String(agent.name ?? agent.defaultName ?? agent.title ?? "Agent")}</span>
              <span className="text-[11px] text-muted-foreground uppercase">{String(agent.role ?? agent.department ?? "")}</span>
            </div>
          ))}
        </div>
      )}
      {agents.length === 0 && <GenericPayload payload={payload} />}
    </div>
  );
}

function CampaignPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Campaign" value={payload.campaign_name ?? payload.campaignName ?? payload.name} />
      <PayloadField label="Objective" value={payload.objective} />
      <PayloadField label="Budget" value={payload.budget} />
      <PayloadField label="Audience" value={payload.audience} />
      <PayloadField label="Placements" value={payload.placements} />
      <PayloadField label="Headline" value={payload.headline} />
      <PayloadField label="CTA" value={payload.cta} />
      {!!payload.primary_text && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground italic max-h-24 overflow-y-auto">
          {String(payload.primary_text)}
        </div>
      )}
      {!!payload.context && (
        <div className="mt-1.5 text-xs text-muted-foreground italic">{String(payload.context)}</div>
      )}
    </div>
  );
}

function SkillAmendmentPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Skill File" value={payload.skillFile} />
      {!!payload.evidence && (
        <div className="mt-1.5 text-xs text-muted-foreground italic">{String(payload.evidence)}</div>
      )}
      {!!payload.proposedText && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
          {String(payload.proposedText).slice(0, 500)}
        </div>
      )}
    </div>
  );
}

/** Generic payload renderer — shows key/value pairs, never raw JSON */
function GenericPayload({ payload }: { payload: Record<string, unknown> }) {
  // Skip internal fields
  const skipKeys = new Set(["type", "action", "approval_required", "_delayMinutes", "_saveAsDraft"]);
  const entries = Object.entries(payload).filter(
    ([key, val]) => !skipKeys.has(key) && val !== null && val !== undefined && val !== "",
  );

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5 text-sm">
      {entries.map(([key, val]) => {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase())
          .trim();

        // Arrays: render as tag list
        if (Array.isArray(val)) {
          if (val.length === 0) return null;
          // Array of objects — show count
          if (typeof val[0] === "object") {
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
                <span className="text-xs text-muted-foreground">{val.length} items</span>
              </div>
            );
          }
          // Array of strings — show as tags
          return (
            <div key={key} className="flex items-start gap-2">
              <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">{label}</span>
              <div className="flex flex-wrap gap-1">
                {val.slice(0, 10).map((item, i) => (
                  <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {String(item)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // Objects: show as summary
        if (typeof val === "object" && val !== null) {
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
              <span className="text-xs text-muted-foreground">{Object.keys(val as Record<string, unknown>).length} fields</span>
            </div>
          );
        }

        // Long strings: show as block
        const strVal = String(val);
        if (strVal.length > 120) {
          return (
            <div key={key}>
              <span className="text-muted-foreground text-xs block mb-1">{label}</span>
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground italic max-h-24 overflow-y-auto">
                {strVal}
              </div>
            </div>
          );
        }

        return <PayloadField key={key} label={label} value={val} />;
      })}
    </div>
  );
}

export function BudgetOverridePayload({ payload }: { payload: Record<string, unknown> }) {
  const budgetAmount = typeof payload.budgetAmount === "number" ? payload.budgetAmount : null;
  const observedAmount = typeof payload.observedAmount === "number" ? payload.observedAmount : null;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Scope" value={payload.scopeName ?? payload.scopeType} />
      <PayloadField label="Window" value={payload.windowKind} />
      <PayloadField label="Metric" value={payload.metric} />
      {(budgetAmount !== null || observedAmount !== null) ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Limit {budgetAmount !== null ? formatCents(budgetAmount) : "—"} · Observed {observedAmount !== null ? formatCents(observedAmount) : "—"}
        </div>
      ) : null}
      {!!payload.guidance && (
        <p className="text-muted-foreground">{String(payload.guidance)}</p>
      )}
    </div>
  );
}

export function OutboundPayload({ payload }: { payload: Record<string, unknown> }) {
  const to = payload.to ?? payload.recipient ?? payload.phone;
  const subject = payload.subject;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      {!!to && <PayloadField label="To" value={to} />}
      {!!subject && <PayloadField label="Subject" value={subject} />}
      {payload.leadScore !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Lead Score</span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.leadScore)}/10
          </span>
        </div>
      )}
      {!!payload.context && (
        <div className="mt-1.5 text-xs text-muted-foreground italic">{String(payload.context)}</div>
      )}
    </div>
  );
}

export function ApprovalPayloadRenderer({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "hire_agent") return <HireAgentPayload payload={payload} />;
  if (type === "hire_team") return <HireTeamPayload payload={payload} />;
  if (type === "budget_override_required") return <BudgetOverridePayload payload={payload} />;
  if (type === "launch_fb_campaign") return <CampaignPayload payload={payload} />;
  if (type === "skill_amendment") return <SkillAmendmentPayload payload={payload} />;
  if (type === "approve_ceo_strategy" || type === "ceo_proposal") return <CeoStrategyPayload payload={payload} />;
  if (OUTBOUND_TYPES.has(type)) return <OutboundPayload payload={payload} />;
  // Fallback: always show structured key/value pairs, never raw JSON
  return <GenericPayload payload={payload} />;
}
