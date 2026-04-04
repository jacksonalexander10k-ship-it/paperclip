import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";

interface AygencyOnboardingWizardProps {
  onComplete: () => void;
}

// ── Data shape ─────────────────────────────────────────────────────
interface OnboardingData {
  agencyName: string;
  focus: string[];
  areas: string[];
  teamSize: string;
  leadSources: string[];
  needs: string[];
  freeText: string;
  selectedPack: string;
  ceoName: string;
}

const INITIAL: OnboardingData = {
  agencyName: "",
  focus: [],
  areas: [],
  teamSize: "",
  leadSources: [],
  needs: [],
  freeText: "",
  selectedPack: "",
  ceoName: "",
};

// ── Options ────────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  { id: "offplan", label: "Off-Plan Sales", desc: "New developments, payment plans" },
  { id: "secondary", label: "Secondary / Resale", desc: "Existing properties" },
  { id: "rentals", label: "Rentals & Leasing", desc: "Tenant placement, lease management" },
  { id: "property_mgmt", label: "Property Management", desc: "Landlord services, maintenance, renewals" },
];

const AREA_OPTIONS = [
  "JVC", "Downtown", "Dubai Marina", "Business Bay", "Palm Jumeirah",
  "JBR", "Dubai Hills", "MBR City", "Creek Harbour", "Sports City",
  "Dubailand", "DAMAC Hills", "Dubai South", "Al Furjan", "Arjan",
  "Silicon Oasis", "Motor City", "Town Square", "Other",
];

const TEAM_OPTIONS = [
  { id: "solo", label: "Just me", desc: "Solo operator" },
  { id: "small", label: "2–5 people", desc: "Small team" },
  { id: "medium", label: "6–15 people", desc: "Growing agency" },
  { id: "large", label: "15+ people", desc: "Established agency" },
];

const SOURCE_OPTIONS = [
  { id: "property_finder", label: "Property Finder" },
  { id: "bayut", label: "Bayut" },
  { id: "dubizzle", label: "Dubizzle" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook_ads", label: "Facebook / Meta Ads" },
  { id: "google_ads", label: "Google Ads" },
  { id: "referrals", label: "Referrals / Word of mouth" },
  { id: "cold_calling", label: "Cold calling" },
  { id: "website", label: "Website / Landing pages" },
  { id: "none", label: "No leads yet" },
];

const NEED_OPTIONS = [
  { id: "lead_management", label: "Lead Management" },
  { id: "content_marketing", label: "Content & Marketing" },
  { id: "market_intelligence", label: "Market Intelligence" },
  { id: "viewings", label: "Viewing Management" },
  { id: "portfolio", label: "Portfolio & Landlords" },
  { id: "calling", label: "AI Calling" },
];

// ── Pack / Department structures ───────────────────────────────────

interface AgentDef { role: string; title: string; }
interface Department { manager: string; agents: AgentDef[]; }
interface Pack { id: string; name: string; tagline: string; departments: Department[]; recommended?: boolean; }

const DEPTS: Record<string, { manager: string; agents: AgentDef[] }> = {
  sales: { manager: "Sales Manager", agents: [
    { role: "sales", title: "Lead Agent" },
    { role: "viewing", title: "Viewing Agent" },
    { role: "calling", title: "Call Agent" },
  ]},
  marketing: { manager: "Marketing Manager", agents: [
    { role: "content", title: "Content Agent" },
    { role: "marketing", title: "Market Intel" },
  ]},
  operations: { manager: "Operations Manager", agents: [
    { role: "finance", title: "Portfolio Agent" },
  ]},
};

const NEED_TO_DEPT: Record<string, string> = {
  lead_management: "sales", viewings: "sales", calling: "sales",
  content_marketing: "marketing", market_intelligence: "marketing",
  portfolio: "operations",
};

function buildPacks(needs: string[]): Pack[] {
  const deptOrder = ["sales", "marketing", "operations"];
  const needed = [...new Set(needs.map((n) => NEED_TO_DEPT[n]).filter(Boolean))];
  if (needed.length === 0) needed.push("sales", "marketing");
  if (needed.length === 1) needed.push(needed[0] === "sales" ? "marketing" : "sales");

  const starterDepts: Department[] = needed.slice(0, 2).map((k) => ({
    manager: DEPTS[k].manager, agents: DEPTS[k].agents.slice(0, 1),
  }));

  const growthDepts: Department[] = needed.map((k) => ({
    manager: DEPTS[k].manager, agents: DEPTS[k].agents.slice(0, 2),
  }));
  for (const k of deptOrder) {
    if (growthDepts.length >= 3) break;
    if (!growthDepts.find((d) => d.manager === DEPTS[k].manager))
      growthDepts.push({ manager: DEPTS[k].manager, agents: DEPTS[k].agents.slice(0, 1) });
  }

  const scaleDepts: Department[] = deptOrder.map((k) => ({
    manager: DEPTS[k].manager, agents: [...DEPTS[k].agents],
  }));

  const count = (ds: Department[]) => ds.reduce((s, d) => s + d.agents.length, 0);

  return [
    { id: "starter", name: "Starter", tagline: `CEO + ${starterDepts.length} depts + ${count(starterDepts)} agents`, departments: starterDepts },
    { id: "growth", name: "Growth", tagline: `CEO + ${growthDepts.length} depts + ${count(growthDepts)} agents`, departments: growthDepts, recommended: true },
    { id: "scale", name: "Scale", tagline: `CEO + ${scaleDepts.length} depts + ${count(scaleDepts)} agents — full ops`, departments: scaleDepts },
  ];
}

// ── Org chart styles ───────────────────────────────────────────────

const ORG_STYLES = `
@keyframes org-glow-pulse { 0%,100%{filter:drop-shadow(0 0 4px rgba(16,185,129,.2))} 50%{filter:drop-shadow(0 0 10px rgba(16,185,129,.4))} }
@keyframes org-node-in { 0%{opacity:0;transform:scale(.7)} 100%{opacity:1;transform:scale(1)} }
@keyframes org-ring-pulse { 0%,100%{r:20;opacity:.15} 50%{r:24;opacity:.05} }
.org-glow{animation:org-glow-pulse 3s ease-in-out infinite}
.org-node-enter{animation:org-node-in .35s ease-out both}
.org-ring{animation:org-ring-pulse 2.5s ease-in-out infinite}
`;
let _stylesInjected = false;
function injectStyles() { if (_stylesInjected) return; const s = document.createElement("style"); s.textContent = ORG_STYLES; document.head.appendChild(s); _stylesInjected = true; }

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

// ── PackCard with 3-tier animated org chart ────────────────────────

function PackCard({ pack, selected, onClick }: { pack: Pack; selected: boolean; onClick: () => void }) {
  useEffect(() => { injectStyles(); }, []);
  const depts = pack.departments;
  const pid = `p-${pack.id}`;
  const ceoR = 16, mgrR = 12, aR = 10;
  const ceoY = 26, mgrY = 85, aY = 140;
  const deptWidths = depts.map((d) => Math.max(1, d.agents.length) * 52);
  const totalW = deptWidths.reduce((s, w) => s + w, 0) + (depts.length - 1) * 20;
  const svgW = Math.max(240, totalW + 40);
  const svgH = 175;
  const ceoX = svgW / 2;
  let ox = (svgW - totalW - (depts.length - 1) * 20) / 2;
  const mpos = depts.map((d, di) => {
    const w = deptWidths[di]; const mx = ox + w / 2;
    const sp = 52; const sx = mx - ((d.agents.length - 1) * sp) / 2;
    const axs = d.agents.map((_, ai) => sx + ai * sp);
    ox += w + 20;
    return { x: mx, dept: d, axs };
  });
  const g = (a: number) => `rgba(16,185,129,${a})`;
  const z = (a: number) => `rgba(63,63,70,${a})`;

  return (
    <button type="button" onClick={onClick}
      className={`w-full flex flex-col rounded-2xl transition-all duration-300 border relative overflow-hidden ${
        selected ? "border-[#10b981]/60 bg-gradient-to-b from-[#10b981]/6 to-transparent" : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-600"}`}>
      {selected && <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 bg-[#10b981]/8 blur-3xl rounded-full" /></div>}
      <div className="flex items-center justify-between px-5 pt-4 pb-1 relative z-10">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className={`text-[16px] font-semibold ${selected ? "text-white" : "text-zinc-300"}`}>{pack.name}</span>
            {pack.recommended && <span className="text-[10px] font-medium uppercase tracking-wider bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded-full">Recommended</span>}
          </div>
          <span className="text-[12px] text-zinc-500">{pack.tagline}</span>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "border-[#10b981] bg-[#10b981]" : "border-zinc-700"}`}>
          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
        </div>
      </div>
      <div className="px-2 pb-3 pt-1 relative z-10 flex justify-center">
        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="max-w-full" style={{ overflow: "visible" }}>
          {/* CEO→Manager beziers + traveling dots */}
          {mpos.map((mp, mi) => { const id = `${pid}-cm-${mi}`; const d = bezier(ceoX, ceoY + ceoR, mp.x, mgrY - mgrR); return (
            <g key={`cm-${mi}`}><path id={id} d={d} fill="none" stroke={selected ? g(.2) : z(.25)} strokeWidth={1.5} />
              {selected && <circle r={2.5} fill={g(.9)}><animateMotion dur={`${2.2 + mi * .3}s`} repeatCount="indefinite" begin={`${mi * .6}s`}><mpath href={`#${id}`} /></animateMotion><animate attributeName="opacity" values="0;1;1;0" dur={`${2.2 + mi * .3}s`} repeatCount="indefinite" begin={`${mi * .6}s`} /></circle>}
            </g>); })}
          {/* Manager→Agent beziers + dots */}
          {mpos.map((mp, mi) => mp.axs.map((ax, ai) => { const id = `${pid}-ma-${mi}-${ai}`; const d = bezier(mp.x, mgrY + mgrR, ax, aY - aR); return (
            <g key={`ma-${mi}-${ai}`}><path id={id} d={d} fill="none" stroke={selected ? g(.15) : z(.2)} strokeWidth={1} />
              {selected && <circle r={2} fill={g(.7)}><animateMotion dur={`${1.8 + ai * .3}s`} repeatCount="indefinite" begin={`${mi * .8 + ai * .4 + .5}s`}><mpath href={`#${id}`} /></animateMotion><animate attributeName="opacity" values="0;.8;.8;0" dur={`${1.8 + ai * .3}s`} repeatCount="indefinite" begin={`${mi * .8 + ai * .4 + .5}s`} /></circle>}
            </g>); }))}
          {/* CEO node */}
          <g className="org-node-enter">
            {selected && <circle cx={ceoX} cy={ceoY} r={20} fill="none" stroke={g(.12)} strokeWidth={1.5} className="org-ring" />}
            <circle cx={ceoX} cy={ceoY} r={ceoR} fill={selected ? g(.12) : "rgba(24,24,27,.9)"} stroke={selected ? g(.5) : z(.5)} strokeWidth={1.5} className={selected ? "org-glow" : ""} />
            <text x={ceoX} y={ceoY + 4} textAnchor="middle" fill={selected ? "#10b981" : "#a1a1aa"} fontSize="8" fontWeight="700" fontFamily="system-ui">CEO</text>
            <text x={ceoX} y={ceoY + ceoR + 12} textAnchor="middle" fill={selected ? "#e4e4e7" : "#71717a"} fontSize="8" fontWeight="600" fontFamily="system-ui">CEO</text>
          </g>
          {/* Manager nodes */}
          {mpos.map((mp, mi) => (
            <g key={`mgr-${mi}`} className="org-node-enter" style={{ animationDelay: `${.1 * (mi + 1)}s` }}>
              {selected && <circle cx={mp.x} cy={mgrY} r={15} fill="none" stroke={g(.08)} strokeWidth={1} className="org-ring" style={{ animationDelay: `${mi * .6}s` }} />}
              <circle cx={mp.x} cy={mgrY} r={mgrR} fill={selected ? g(.1) : "rgba(24,24,27,.85)"} stroke={selected ? g(.4) : z(.4)} strokeWidth={1.2} className={selected ? "org-glow" : ""} />
              <text x={mp.x} y={mgrY + 4} textAnchor="middle" fill={selected ? g(.8) : z(.6)} fontSize="6" fontWeight="600" fontFamily="system-ui">MGR</text>
              <text x={mp.x} y={mgrY + mgrR + 11} textAnchor="middle" fill={selected ? "#d4d4d8" : "#52525b"} fontSize="7" fontWeight="500" fontFamily="system-ui">{mp.dept.manager.replace(" Manager", "")}</text>
            </g>
          ))}
          {/* Agent nodes */}
          {mpos.map((mp, mi) => mp.dept.agents.map((agent, ai) => { const ax = mp.axs[ai]; return (
            <g key={`a-${mi}-${ai}`} className="org-node-enter" style={{ animationDelay: `${.15 * (mi + 1) + .08 * ai}s` }}>
              {selected && <circle cx={ax} cy={aY} r={13} fill="none" stroke={g(.06)} strokeWidth={1} className="org-ring" />}
              <circle cx={ax} cy={aY} r={aR} fill={selected ? g(.06) : "rgba(24,24,27,.75)"} stroke={selected ? g(.25) : z(.3)} strokeWidth={1} className={selected ? "org-glow" : ""} />
              <text x={ax} y={aY + aR + 11} textAnchor="middle" fill={selected ? "#a1a1aa" : "#3f3f46"} fontSize="7" fontWeight="400" fontFamily="system-ui">{agent.title.replace(" Agent", "").replace(" Intel", "")}</text>
            </g>); }))}
        </svg>
      </div>
    </button>
  );
}

const TOTAL_STEPS = 8;

// ── Reusable components ────────────────────────────────────────────

function ToggleChip({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-[14px] font-medium transition-all border ${
        selected
          ? "bg-[#10b981]/15 border-[#10b981] text-[#10b981]"
          : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function OptionCard({ selected, onClick, label, desc }: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex flex-col gap-0.5 rounded-2xl px-5 py-4 text-left transition-all border ${
        selected
          ? "bg-[#10b981]/10 border-[#10b981]"
          : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <span className={`text-[15px] font-medium ${selected ? "text-white" : "text-zinc-300"}`}>
        {label}
      </span>
      {desc && <span className="text-[12px] text-zinc-500">{desc}</span>}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function AygencyOnboardingWizard({ onComplete }: AygencyOnboardingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const packs = useMemo(() => buildPacks(data.needs), [data.needs]);

  function toggleArray(field: keyof OnboardingData, value: string) {
    setData((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  function canContinue(): boolean {
    switch (step) {
      case 1: return data.agencyName.trim().length > 0;
      case 2: return data.focus.length > 0;
      case 3: return data.areas.length > 0;
      case 4: return data.teamSize !== "";
      case 5: return data.leadSources.length > 0;
      case 6: return data.needs.length > 0;
      case 7: return data.selectedPack !== "";
      case 8: return data.ceoName.trim().length > 0;
      default: return false;
    }
  }

  function next() {
    if (!canContinue()) return;
    if (step === 8) {
      launch();
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
  }

  function buildAgencyContext(): string {
    const lines: string[] = [];
    lines.push(`Agency: ${data.agencyName}`);
    lines.push(`Focus: ${data.focus.join(", ")}`);
    lines.push(`Areas: ${data.areas.join(", ")}`);
    lines.push(`Team size: ${data.teamSize}`);
    lines.push(`Lead sources: ${data.leadSources.join(", ")}`);
    lines.push(`Needs help with: ${data.needs.join(", ")}`);
    if (data.freeText.trim()) {
      lines.push(`Owner's notes: ${data.freeText.trim()}`);
    }
    const selectedPack = packs.find((p) => p.id === data.selectedPack);
    if (selectedPack) {
      lines.push(`Selected pack: ${data.selectedPack} (${selectedPack.tagline})`);
      for (const dept of selectedPack.departments) {
        lines.push(`Department: ${dept.manager} → ${dept.agents.map((a) => a.title).join(", ")}`);
      }
    }
    return lines.join("\n");
  }

  // Create company + CEO + call AI to generate welcome + team proposal during loading screen
  const createMutation = useMutation({
    mutationFn: async () => {
      const agencyContext = buildAgencyContext();

      // Step 1: Create company
      const company = await companiesApi.create({
        name: data.agencyName.trim(),
        description: agencyContext,
      });

      // Step 2: Create only the CEO agent (no heartbeat, no wakeup)
      const ceo = await agentsApi.create(company.id, {
        name: data.ceoName.trim(),
        role: "ceo",
        title: "Chief Executive Officer",
        adapterType: "claude_local",
        adapterConfig: { model: "claude-sonnet-4-20250514" },
      });

      // Step 3: Create CEO Chat issue
      try {
        await issuesApi.create(company.id, {
          title: "CEO Chat",
          description: "Persistent chat thread between agency owner and CEO agent.",
          status: "in_progress",
          priority: "medium",
          assigneeAgentId: ceo.id,
          originKind: "system",
        });
      } catch {
        // May already exist
      }

      // Step 4: AI generates welcome messages + team proposal (this is the slow part)
      // The user sees the loading screen while this runs
      try {
        await fetch(`/api/companies/${company.id}/ceo-chat/first-run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Non-critical — CEO Chat will still work, just without pre-seeded messages
      }

      return company;
    },
    onSuccess: (company) => {
      localStorage.setItem("aygency_onboarding_complete", "true");
      localStorage.setItem("aygency_first_run", "true");
      localStorage.setItem("aygency_agency_name", data.agencyName.trim());
      localStorage.setItem("aygency_ceo_name", data.ceoName.trim());
      localStorage.setItem("aygency_company_id", company.id);
      localStorage.setItem("aygency_company_prefix", company.issuePrefix);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStep(8);
    },
  });

  function launch() {
    setStep(9); // creating/loading state
    setError(null);
    createMutation.mutate();
  }

  useEffect(() => {
    if (createMutation.isSuccess && createMutation.data) {
      const prefix = createMutation.data.issuePrefix;
      // Give the loading animation time to show "ready" state, then redirect
      const t = setTimeout(() => {
        onComplete();
        // Full page reload to pick up new company in React context
        window.location.replace(`/${prefix}/ceo-chat`);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [createMutation.isSuccess, createMutation.data]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && canContinue() && step <= 8) next();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, data]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080808] overflow-y-auto">

      {/* Fixed header bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-8 py-5 bg-[#080808]/90 backdrop-blur-md">
        <span className="text-[15px] font-bold tracking-tight text-white">
          aygency<span className="text-[#10b981]">world</span>
        </span>
        {step <= TOTAL_STEPS && (
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i + 1 <= step ? "w-5 bg-[#10b981]" : "w-5 bg-zinc-800"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center px-8 pt-8 pb-12">
      <div className="w-full max-w-lg">

        {/* ── Step 1: Agency name ── */}
        {step === 1 && (
          <StepShell title="What's your agency called?" onNext={next} canContinue={canContinue()}>
            <input
              type="text"
              placeholder="e.g. Prime Properties Dubai"
              value={data.agencyName}
              onChange={(e) => setData((d) => ({ ...d, agencyName: e.target.value }))}
              autoFocus
              className="w-full bg-transparent border-b-2 border-zinc-800 focus:border-[#10b981] px-0 py-3 text-xl text-white placeholder-zinc-700 outline-none transition-colors text-center"
            />
          </StepShell>
        )}

        {/* ── Step 2: Focus ── */}
        {step === 2 && (
          <StepShell title="What does your agency do?" subtitle="Select all that apply" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-col gap-2.5">
              {FOCUS_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  selected={data.focus.includes(opt.id)}
                  onClick={() => toggleArray("focus", opt.id)}
                  label={opt.label}
                  desc={opt.desc}
                />
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 3: Areas ── */}
        {step === 3 && (
          <StepShell title="Which areas do you cover?" subtitle="Select your main areas" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-wrap gap-2 justify-center">
              {AREA_OPTIONS.map((area) => (
                <ToggleChip key={area} selected={data.areas.includes(area)} onClick={() => toggleArray("areas", area)}>
                  {area}
                </ToggleChip>
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 4: Team size ── */}
        {step === 4 && (
          <StepShell title="How big is your current team?" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-col gap-2.5">
              {TEAM_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  selected={data.teamSize === opt.id}
                  onClick={() => setData((d) => ({ ...d, teamSize: opt.id }))}
                  label={opt.label}
                  desc={opt.desc}
                />
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 5: Lead sources ── */}
        {step === 5 && (
          <StepShell title="Where do your leads come from?" subtitle="Select all that apply" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-wrap gap-2 justify-center">
              {SOURCE_OPTIONS.map((opt) => (
                <ToggleChip key={opt.id} selected={data.leadSources.includes(opt.id)} onClick={() => toggleArray("leadSources", opt.id)}>
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 6: What they need + free text ── */}
        {step === 6 && (
          <StepShell title="What do you need help with?" subtitle="Your CEO will build a team based on this" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {NEED_OPTIONS.map((opt) => (
                  <ToggleChip
                    key={opt.id}
                    selected={data.needs.includes(opt.id)}
                    onClick={() => toggleArray("needs", opt.id)}
                  >
                    {opt.label}
                  </ToggleChip>
                ))}
              </div>

              <textarea
                placeholder="Tell your CEO anything else — e.g. We're launching a new project next month, need to generate 200 leads fast, our brokers speak Arabic and Russian…"
                value={data.freeText}
                onChange={(e) => setData((d) => ({ ...d, freeText: e.target.value }))}
                rows={3}
                className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-[#10b981] rounded-xl px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none transition-colors resize-none"
              />
            </div>
          </StepShell>
        )}

        {/* ── Step 7: Choose your setup (animated org chart packs) ── */}
        {step === 7 && (
          <StepShell title="Choose your setup" subtitle="Your CEO will manage these departments" onNext={next} onBack={back} canContinue={canContinue()}>
            <div className="flex flex-col gap-3">
              {packs.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  selected={data.selectedPack === pack.id}
                  onClick={() => setData((d) => ({ ...d, selectedPack: pack.id }))}
                />
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Step 8: Name CEO ── */}
        {step === 8 && (
          <StepShell
            title="Name your CEO"
            subtitle={`${data.ceoName || "Your CEO"} will run ${data.agencyName} with ${packs.find((p) => p.id === data.selectedPack)?.departments.length ?? 0} departments`}
            onNext={next}
            onBack={back}
            canContinue={canContinue()}
            buttonLabel="Hire CEO"
          >
            <input
              type="text"
              placeholder="e.g. Khalid, Sarah, Alex…"
              value={data.ceoName}
              onChange={(e) => setData((d) => ({ ...d, ceoName: e.target.value }))}
              autoFocus
              className="w-full bg-transparent border-b-2 border-zinc-800 focus:border-[#10b981] px-0 py-3 text-xl text-white placeholder-zinc-700 outline-none transition-colors text-center"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          </StepShell>
        )}

        {/* ── Step 9: Creating (AI reasons during this screen) ── */}
        {step === 9 && (
          <LoadingScreen
            ceoName={data.ceoName}
            agencyName={data.agencyName}
            done={createMutation.isSuccess}
          />
        )}

      </div>
      </div>
    </div>
  );
}

// ── Loading screen with animated progress ──────────────────────────

function LoadingScreen({ ceoName, agencyName, done }: { ceoName: string; agencyName: string; done: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (done) { setPhase(4); return; }
    const timers = [
      setTimeout(() => setPhase(1), 800),   // "Creating agency..."
      setTimeout(() => setPhase(2), 2000),   // "Hiring CEO..."
      setTimeout(() => setPhase(3), 4000),   // "CEO is reviewing your setup..."
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);

  const steps = [
    { label: `Creating ${agencyName}`, threshold: 1 },
    { label: `Hiring ${ceoName} as CEO`, threshold: 2 },
    { label: `${ceoName} is reviewing your setup and building a team proposal`, threshold: 3 },
    { label: `${ceoName} is ready`, threshold: 4 },
  ];

  return (
    <div className="flex flex-col items-center gap-8 text-center pt-16">
      {!done ? (
        <Loader2 className="h-9 w-9 text-[#10b981] animate-spin" />
      ) : (
        <CheckCircle2 className="h-9 w-9 text-[#10b981]" />
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              phase > s.threshold ? "opacity-50" :
              phase === s.threshold ? "opacity-100" :
              "opacity-0 translate-y-2"
            }`}
          >
            {phase > s.threshold ? (
              <CheckCircle2 className="h-4 w-4 text-[#10b981] shrink-0" />
            ) : phase === s.threshold ? (
              <Loader2 className="h-4 w-4 text-[#10b981] animate-spin shrink-0" />
            ) : (
              <div className="h-4 w-4 shrink-0" />
            )}
            <span className={`text-[13px] text-left ${
              phase === s.threshold ? "text-white" : "text-zinc-500"
            }`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {done && (
        <p className="text-sm text-zinc-500 animate-pulse">Opening CEO Chat…</p>
      )}
    </div>
  );
}

// ── Step shell ─────────────────────────────────────────────────────

function StepShell({ title, subtitle, children, onNext, onBack, canContinue, buttonLabel = "Continue" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  canContinue: boolean;
  buttonLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-7">
      <div className="text-center">
        <p className="text-[28px] font-semibold text-white leading-tight">{title}</p>
        {subtitle && <p className="mt-2 text-[14px] text-zinc-500">{subtitle}</p>}
      </div>

      {children}

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="group flex items-center justify-center gap-2 w-full rounded-2xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-20 disabled:cursor-not-allowed py-4 text-[15px] font-semibold text-white transition-all"
      >
        {buttonLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>

      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-1 text-xs text-zinc-700 hover:text-zinc-500 text-center transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      )}
    </div>
  );
}
