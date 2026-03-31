import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import type { AgentRole } from "@paperclipai/shared";

const ROLE_OPTIONS: { value: AgentRole; label: string; emoji: string; description: string }[] = [
  { value: "ceo",      label: "CEO",       emoji: "🏢", description: "Runs the agency & manages the team" },
  { value: "cmo",      label: "Marketing", emoji: "📣", description: "Leads, content & social media" },
  { value: "general",  label: "General",   emoji: "⚡", description: "Flexible — handles any task" },
  { value: "cfo",      label: "Finance",   emoji: "💰", description: "Budgets, costs & reports" },
  { value: "researcher", label: "Research", emoji: "🔍", description: "Market data & insights" },
  { value: "engineer", label: "Tech",      emoji: "🛠", description: "Tech setup & integrations" },
];

interface AygencyOnboardingWizardProps {
  onComplete: () => void;
}

export function AygencyOnboardingWizard({ onComplete }: AygencyOnboardingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agencyName, setAgencyName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState<AgentRole>("ceo");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const company = await companiesApi.create({ name: agencyName.trim() });
      const agent = await agentsApi.create(company.id, { name: agentName.trim(), role: agentRole });
      try {
        await issuesApi.create(company.id, {
          title: "CEO Chat",
          description: "Persistent chat thread between agency owner and CEO agent.",
          status: "in_progress",
          priority: "medium",
          assigneeAgentId: agent.id,
          originKind: "system",
        });
      } catch {
        // May already exist
      }
      try {
        await agentsApi.wakeup(agent.id, { source: "on_demand", triggerDetail: "system", reason: "onboarding_complete" });
      } catch {
        // Non-critical
      }
      return company;
    },
    onSuccess: (company) => {
      localStorage.setItem("aygency_onboarding_complete", "true");
      localStorage.setItem("aygency_agency_name", agencyName.trim());
      localStorage.setItem("aygency_company_id", company.id);
      localStorage.setItem("aygency_company_prefix", company.issuePrefix);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStep(2);
    },
  });

  function handleStep1() {
    if (!agencyName.trim()) return;
    setStep(2);
  }

  function handleStep2() {
    if (!agentName.trim()) return;
    setStep(3);
    setError(null);
    createMutation.mutate();
  }

  function handleEnter() {
    onComplete();
    navigate("/ceo-chat");
  }

  useEffect(() => {
    if (createMutation.isSuccess) {
      const t = setTimeout(handleEnter, 1400);
      return () => clearTimeout(t);
    }
  }, [createMutation.isSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080808]">

      {/* Wordmark */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 select-none">
        <span className="text-[15px] font-bold tracking-tight text-white">
          aygency<span className="text-[#10b981]">world</span>
        </span>
      </div>

      {/* Step indicator */}
      {step < 3 && (
        <div className="absolute top-8 right-8 flex gap-1.5">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                s <= step ? "w-6 bg-[#10b981]" : "w-6 bg-zinc-800"
              }`}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-md px-8">

        {/* ── Step 1: Agency name ── */}
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <div className="text-center">
              <p className="text-[32px] font-semibold text-white leading-tight">
                What's your agency called?
              </p>
            </div>

            <input
              type="text"
              placeholder="e.g. Prime Properties Dubai"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStep1(); }}
              autoFocus
              className="w-full bg-transparent border-b-2 border-zinc-800 focus:border-[#10b981] px-0 py-3 text-xl text-white placeholder-zinc-700 outline-none transition-colors text-center"
            />

            <button
              onClick={handleStep1}
              disabled={!agencyName.trim()}
              className="group flex items-center justify-center gap-2 w-full rounded-2xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-20 disabled:cursor-not-allowed py-4 text-[15px] font-semibold text-white transition-all"
            >
              Continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {/* ── Step 2: Agent name + role ── */}
        {step === 2 && (
          <div className="flex flex-col gap-8">
            <div className="text-center">
              <p className="text-[32px] font-semibold text-white leading-tight">
                Name your first agent
              </p>
              <p className="mt-2 text-[15px] text-zinc-500">
                They'll run {agencyName} from day one
              </p>
            </div>

            <input
              type="text"
              placeholder="Give them a name — Alex, Sarah, Max…"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStep2(); }}
              autoFocus
              className="w-full bg-transparent border-b-2 border-zinc-800 focus:border-[#10b981] px-0 py-3 text-xl text-white placeholder-zinc-700 outline-none transition-colors text-center"
            />

            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-widest text-center">
                Pick their role
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {ROLE_OPTIONS.map((opt) => {
                  const active = agentRole === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAgentRole(opt.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 transition-all ${
                        active
                          ? "bg-[#10b981]/15 ring-1 ring-[#10b981]/60"
                          : "bg-zinc-900/60 hover:bg-zinc-900"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className={`text-xs font-semibold ${active ? "text-[#10b981]" : "text-zinc-300"}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-600 text-center min-h-[1.2em]">
                {ROLE_OPTIONS.find((o) => o.value === agentRole)?.description}
              </p>
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <button
              onClick={handleStep2}
              disabled={!agentName.trim()}
              className="group flex items-center justify-center gap-2 w-full rounded-2xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-20 disabled:cursor-not-allowed py-4 text-[15px] font-semibold text-white transition-all"
            >
              Launch agency
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => setStep(1)}
              className="text-xs text-zinc-700 hover:text-zinc-500 text-center transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step 3: Creating ── */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-5 text-center">
            {!createMutation.isSuccess ? (
              <>
                <Loader2 className="h-9 w-9 text-[#10b981] animate-spin" />
                <div>
                  <p className="text-xl font-semibold text-white">Launching {agencyName}</p>
                  <p className="mt-1.5 text-sm text-zinc-500">Hiring {agentName}…</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-9 w-9 text-[#10b981]" />
                <div>
                  <p className="text-xl font-semibold text-white">You're in.</p>
                  <p className="mt-1.5 text-sm text-zinc-500">Opening CEO Chat…</p>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
