import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Trash2 } from "lucide-react";

interface AgentSchedule {
  workingHoursStart: number;
  workingHoursEnd: number;
  heartbeatFrequencySeconds: number;
}

interface ScheduledJob {
  id: string;
  name: string;
  cronExpr: string;
  active: boolean;
  nextRunAt: string | null;
}

interface HandoffRule {
  id: string;
  condition: string;
  handoffToUserName: string | null;
  handoffToAgentName: string | null;
}

interface AgentScheduleTabProps {
  agentId: string;
  companyId: string;
}

const FREQUENCY_OPTIONS = [
  { value: 900, label: "Every 15 minutes" },
  { value: 1800, label: "Every 30 minutes" },
  { value: 3600, label: "Every hour" },
  { value: 14400, label: "Every 4 hours" },
  { value: 86400, label: "Once a day" },
  { value: 0, label: "Only when woken up" },
];

export function AgentScheduleTab({ agentId, companyId }: AgentScheduleTabProps) {
  const queryClient = useQueryClient();

  const { data: schedule } = useQuery<AgentSchedule>({
    queryKey: ["agent-schedule", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/schedule`, {
        credentials: "include",
      });
      if (!res.ok) {
        return { workingHoursStart: 0, workingHoursEnd: 24, heartbeatFrequencySeconds: 900 };
      }
      return res.json();
    },
  });

  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(24);
  const [freq, setFreq] = useState(900);

  useEffect(() => {
    if (schedule) {
      setStartHour(schedule.workingHoursStart);
      setEndHour(schedule.workingHoursEnd);
      setFreq(schedule.heartbeatFrequencySeconds);
    }
  }, [schedule]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<AgentSchedule>) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-schedule", agentId] }),
  });

  const { data: jobs } = useQuery<ScheduledJob[]>({
    queryKey: ["agent-jobs", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/scheduled-jobs`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: handoffRules } = useQuery<HandoffRule[]>({
    queryKey: ["agent-handoff-rules", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/handoff-rules`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      {/* Working hours */}
      <Card title="Working hours" description="When this agent is allowed to send messages. Dubai time.">
        <div className="flex items-center gap-3">
          <HourPicker value={startHour} onChange={(v) => { setStartHour(v); saveMutation.mutate({ workingHoursStart: v }); }} />
          <span className="text-[12.5px] text-muted-foreground">to</span>
          <HourPicker value={endHour} onChange={(v) => { setEndHour(v); saveMutation.mutate({ workingHoursEnd: v }); }} />
          {startHour === 0 && (endHour === 0 || endHour === 24) && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
              Always on (24 h)
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          Outside these hours, messages queue and send when they come back online.
        </div>
      </Card>

      {/* Check-in frequency */}
      <Card title="Check in for pending work" description="How often they scan for tasks, follow-ups, and stale leads. Events (inbound messages, CEO commands) always wake them instantly.">
        <select
          value={freq}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFreq(v);
            saveMutation.mutate({ heartbeatFrequencySeconds: v });
          }}
          className="w-full px-3 py-2 text-[12.5px] bg-transparent border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-ring"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Card>

      {/* Scheduled routines */}
      <Card
        title="Recurring tasks"
        description="Automatic work this agent does on a schedule — morning posts, weekly reports, chasing stale leads."
        action={
          <button
            type="button"
            disabled
            title="Add routines via CEO chat for now"
            className="flex items-center gap-1 text-[11.5px] font-medium px-2 py-1 rounded border border-border opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        }
      >
        {!jobs || jobs.length === 0 ? (
          <EmptyRow>No recurring tasks yet. Ask the CEO: "Get Sarah to chase cold leads every Tuesday morning."</EmptyRow>
        ) : (
          <div className="space-y-1.5">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-3 py-2 rounded border border-border/40 bg-card/50">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{job.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {cronToHuman(job.cronExpr)}
                    {job.nextRunAt && ` · next: ${new Date(job.nextRunAt).toLocaleString()}`}
                  </div>
                </div>
                <button type="button" className="text-muted-foreground hover:text-destructive p-1" disabled>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hand-off rules */}
      <Card
        title="When to escalate"
        description="When this agent should pass a conversation to a person (or another agent)."
        action={
          <button
            type="button"
            disabled
            className="flex items-center gap-1 text-[11.5px] font-medium px-2 py-1 rounded border border-border opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3 w-3" /> Add rule
          </button>
        }
      >
        {!handoffRules || handoffRules.length === 0 ? (
          <EmptyRow>Using the default rules from this agent's profile.</EmptyRow>
        ) : (
          <div className="space-y-1.5">
            {handoffRules.map((r) => (
              <div key={r.id} className="text-[12px] px-3 py-2 rounded border border-border/40">
                When <span className="font-medium">{r.condition}</span>, hand off to{" "}
                <span className="font-medium">{r.handoffToUserName ?? r.handoffToAgentName ?? "..."}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1">
          <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold">{title}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{description}</div>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function HourPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="px-2 py-1.5 text-[12.5px] bg-transparent border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-ring"
    >
      {Array.from({ length: 25 }, (_, i) => (
        <option key={i} value={i}>{formatHour(i)}</option>
      ))}
    </select>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  if (h === 24) return "midnight";
  if (h < 12) return `${h} am`;
  return `${h - 12} pm`;
}

function cronToHuman(expr: string): string {
  // Minimal friendly renderer — covers common cases.
  if (expr === "0 9 * * *") return "Every day at 9 am";
  if (expr === "0 4 * * *") return "Every day at 8 am Dubai";
  if (expr === "0 4 * * 1") return "Every Monday at 8 am";
  if (expr === "*/15 * * * *") return "Every 15 minutes";
  return expr;
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] text-muted-foreground px-3 py-2 text-center">{children}</div>;
}
