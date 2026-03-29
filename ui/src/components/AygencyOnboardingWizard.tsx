import { useState } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation } from "@tanstack/react-query";
import { Building2, Wifi, Loader2, CheckCircle, ChevronRight } from "lucide-react";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { Button } from "@/components/ui/button";

type FocusArea = "Off-Plan" | "Rentals" | "Secondary" | "All";
type AgencySize = "Solo" | "Small (2–5)" | "Medium (6–15)" | "Large (15+)";

interface WizardState {
  agencyName: string;
  focus: FocusArea;
  size: AgencySize;
  whatsappPhone: string;
  whatsappToken: string;
}

interface AygencyOnboardingWizardProps {
  onComplete: () => void;
}

export function AygencyOnboardingWizard({ onComplete }: AygencyOnboardingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WizardState>({
    agencyName: "",
    focus: "All",
    size: "Solo",
    whatsappPhone: "",
    whatsappToken: "",
  });

  const createCompanyMutation = useMutation({
    mutationFn: async () => {
      const company = await companiesApi.create({ name: state.agencyName });
      await agentsApi.create(company.id, { name: "CEO", role: "ceo" });
      return company;
    },
    onSuccess: (company) => {
      localStorage.setItem("aygency_onboarding_complete", "true");
      localStorage.setItem("aygency_agency_name", state.agencyName);
      localStorage.setItem("aygency_focus", state.focus);
      localStorage.setItem("aygency_size", state.size);
      localStorage.setItem("aygency_company_id", company.id);
      localStorage.setItem("aygency_company_prefix", company.issuePrefix);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create agency");
    },
  });

  function handleNext() {
    if (step === 1 && !state.agencyName.trim()) return;
    if (step === 2) {
      setStep(3);
      createCompanyMutation.mutate();
      return;
    }
    setStep((s) => s + 1);
  }

  function handleOpenChat() {
    const prefix = localStorage.getItem("aygency_company_prefix");
    onComplete();
    if (prefix) {
      navigate(`/${prefix}/ceo-chat`);
    } else {
      navigate("/ceo-chat");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {step === 1 && (
            <Step1
              state={state}
              setState={setState}
              onNext={handleNext}
            />
          )}
          {step === 2 && (
            <Step2
              state={state}
              setState={setState}
              onNext={handleNext}
              onSkip={handleNext}
            />
          )}
          {step === 3 && (
            <Step3
              isLoading={createCompanyMutation.isPending}
              isSuccess={createCompanyMutation.isSuccess}
              error={error}
              onOpen={handleOpenChat}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({
  state,
  setState,
  onNext,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
}) {
  const focusOptions: FocusArea[] = ["Off-Plan", "Rentals", "Secondary", "All"];
  const sizeOptions: AgencySize[] = ["Solo", "Small (2–5)", "Medium (6–15)", "Large (15+)"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Building2 className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Agency Basics</h2>
          <p className="text-sm text-zinc-400">Tell us about your agency</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">Agency Name</label>
        <input
          type="text"
          placeholder="e.g. Dubai Properties LLC"
          value={state.agencyName}
          onChange={(e) => setState((s) => ({ ...s, agencyName: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") onNext(); }}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none transition-colors"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">Focus Area</label>
        <div className="grid grid-cols-2 gap-2">
          {focusOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setState((s) => ({ ...s, focus: opt }))}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left ${
                state.focus === opt
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">Agency Size</label>
        <div className="grid grid-cols-2 gap-2">
          {sizeOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setState((s) => ({ ...s, size: opt }))}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left ${
                state.size === opt
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={onNext}
        disabled={!state.agencyName.trim()}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
      >
        Next
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function Step2({
  state,
  setState,
  onNext,
  onSkip,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Wifi className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Connect Integrations</h2>
          <p className="text-sm text-zinc-400">Optional — connect later any time</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* WhatsApp */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">WhatsApp Business</span>
            <span className="text-xs text-zinc-500">(optional — connect later)</span>
          </div>
          <input
            type="tel"
            placeholder="+971 50 000 0000"
            value={state.whatsappPhone}
            onChange={(e) => setState((s) => ({ ...s, whatsappPhone: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <input
            type="text"
            placeholder="Access Token"
            value={state.whatsappToken}
            onChange={(e) => setState((s) => ({ ...s, whatsappToken: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Gmail — coming soon */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 flex items-center justify-between opacity-50">
          <span className="text-sm font-medium text-zinc-400">Gmail</span>
          <button
            disabled
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-500 cursor-not-allowed"
          >
            Connect Gmail (coming soon)
          </button>
        </div>

        {/* Google Calendar — coming soon */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 flex items-center justify-between opacity-50">
          <span className="text-sm font-medium text-zinc-400">Google Calendar</span>
          <button
            disabled
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-500 cursor-not-allowed"
          >
            Connect Calendar (coming soon)
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Skip for now
        </button>
        <Button
          onClick={onNext}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Step3({
  isLoading,
  isSuccess,
  error,
  onOpen,
}: {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      {isLoading && (
        <>
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
          <div>
            <h2 className="text-lg font-semibold text-white">Launching your agency...</h2>
            <p className="mt-1 text-sm text-zinc-400">Hiring your CEO agent</p>
          </div>
        </>
      )}
      {isSuccess && !error && (
        <>
          <CheckCircle className="h-10 w-10 text-green-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Your agency is ready.</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Your CEO agent is standing by.
            </p>
          </div>
          <Button
            onClick={onOpen}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
          >
            Open CEO Chat
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </>
      )}
      {error && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </div>
          <p className="text-xs text-zinc-500">Please refresh the page and try again.</p>
        </div>
      )}
    </div>
  );
}
