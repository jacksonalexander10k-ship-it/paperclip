import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";

interface AygencyOnboardingWizardProps {
  onComplete: () => void;
}

// ── Data shape ─────────────────────────────────────────────────────
interface PickedAgent {
  role: HirableRole;
  name: string;
  // Sales-only fields (optional — agent can be created without them and wired later)
  whatsappNumber?: string;
  email?: string;
}

interface OnboardingData {
  agencyName: string;
  pickedAgents: PickedAgent[];
  ceoName: string;
}

const INITIAL: OnboardingData = {
  agencyName: "",
  pickedAgents: [],
  ceoName: "",
};

// ── Canonical roles (non-CEO — CEO is hired implicitly) ──────────────
type HirableRole = "sales" | "content" | "marketing" | "intelligence" | "operations" | "finance";

interface RoleOption {
  id: HirableRole;
  title: string;
  tagline: string;
  defaultName: string;
  needsComms: boolean; // if true, show WhatsApp + email fields when picked
}

const ROLE_OPTIONS: RoleOption[] = [
  { id: "sales",        title: "Sales Agent",          tagline: "The only agent who messages leads. Owns the pipeline.",       defaultName: "Sarah",  needsComms: true  },
  { id: "content",      title: "Social Media Manager", tagline: "Instagram/LinkedIn content, captions, reels, brand voice.",   defaultName: "Aisha",  needsComms: false },
  { id: "marketing",    title: "Marketing Manager",    tagline: "Runs paid ad campaigns — Meta, Google. CPL and ROAS.",        defaultName: "Khaled", needsComms: false },
  { id: "intelligence", title: "Data Analyst",         tagline: "Monitors DLD, listings, competitors. Surfaces opportunities.",defaultName: "Tariq",  needsComms: false },
  { id: "operations",   title: "Operations Agent",     tagline: "Schedules viewings, confirmations, reminders. Admin + inbox.",defaultName: "Layla",  needsComms: false },
  { id: "finance",      title: "Finance Officer",      tagline: "Invoices, commissions, rent cheques, RERA/DLD fees.",         defaultName: "Mariam", needsComms: false },
];

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

const TOTAL_STEPS = 3;

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
  const [data, setData] = useState<OnboardingData>(() => {
    let agencyName = "";
    try {
      agencyName = localStorage.getItem("aygency_pending_agency_name") ?? "";
      if (agencyName) localStorage.removeItem("aygency_pending_agency_name");
    } catch { /* non-critical */ }
    return { ...INITIAL, agencyName };
  });

  // Fallback: if localStorage was empty (e.g. user was auto-created via API,
  // or they already logged in once), use the better-auth user's name as the agency name.
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  useEffect(() => {
    if (!data.agencyName && session?.user?.name) {
      setData((d) => ({ ...d, agencyName: session.user!.name! }));
    }
  }, [session, data.agencyName]);
  const [error, setError] = useState<string | null>(null);
  // packs removed — agent picker in step 7 replaces pack selection

  // toggleArray removed — steps 2-6 (focus/areas/teamSize/leadSources/needs) were cut.

  const canContinueRef = useRef(canContinue);
  const nextRef = useRef(next);

  function canContinue(): boolean {
    switch (step) {
      case 1: return data.agencyName.trim().length > 0;
      case 2: return data.pickedAgents.length > 0 && data.pickedAgents.every((a) => a.name.trim().length > 0);
      case 3: return data.ceoName.trim().length > 0;
      default: return false;
    }
  }

  function next() {
    if (!canContinue()) return;
    if (step === 3) {
      launch();
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
  }

  // Keep refs current so the keydown handler never has a stale closure
  canContinueRef.current = canContinue;
  nextRef.current = next;

  function buildAgencyContext(): string {
    const lines: string[] = [];
    lines.push(`Agency: ${data.agencyName}`);
    if (data.pickedAgents.length > 0) {
      lines.push(`Hired agents (in addition to CEO):`);
      for (const a of data.pickedAgents) {
        const meta = a.role === "sales" ? `${a.whatsappNumber ? ` | WhatsApp: ${a.whatsappNumber}` : ""}${a.email ? ` | Email: ${a.email}` : ""}` : "";
        lines.push(`- ${a.name} (${a.role})${meta}`);
      }
    }
    return lines.join("\n");
  }

  // Create company + CEO + call AI to generate welcome + team proposal during loading screen
  const createMutation = useMutation({
    mutationFn: async () => {
      // Description is user-editable free text on the company. The roster
      // is rendered live as a read-only "Team summary" in Settings, so we
      // no longer dump the hired agents into description during onboarding.
      // This prevents the Description textarea from showing a backend-state
      // dump the moment the owner opens Settings for the first time.
      void buildAgencyContext;

      // Step 1: Create company
      const company = await companiesApi.create({
        name: data.agencyName.trim(),
        description: null,
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

      // Step 4: Create every picked agent. Uniqueness is enforced server-side when credentials attach.
      for (const picked of data.pickedAgents) {
        const roleDef = ROLE_OPTIONS.find((r) => r.id === picked.role);
        const metadata: Record<string, unknown> = {};
        if (picked.role === "sales") {
          if (picked.whatsappNumber && picked.whatsappNumber.trim()) metadata.pendingWhatsappNumber = picked.whatsappNumber.trim();
          if (picked.email && picked.email.trim()) metadata.pendingEmail = picked.email.trim();
        }
        try {
          await agentsApi.create(company.id, {
            name: picked.name.trim(),
            role: picked.role,
            title: roleDef?.title ?? picked.role,
            adapterType: "claude_local",
            // dangerouslySkipPermissions: agents run autonomously — no interactive
            // permission prompts can be answered. Role-scoped MCP is the actual gate.
            adapterConfig: { model: "claude-sonnet-4-20250514", dangerouslySkipPermissions: true },
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        } catch (err) {
          console.warn(`Failed to create ${picked.role} agent:`, err);
        }
      }

      // Step 5: AI generates welcome messages + team proposal (this is the slow part)
      // The user sees the loading screen while this runs
      try {
        await fetch(`/api/companies/${company.id}/ceo-chat/first-run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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
    setStep(4); // creating/loading state (one past TOTAL_STEPS)
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
      if (e.key === "Enter" && canContinueRef.current() && step <= TOTAL_STEPS) nextRef.current();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step]);

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

        {/* ── Step 2: Pick your agents ── */}
        {step === 2 && (
          <StepShell
            title="Hire your team"
            subtitle="Each agent is a real person with their own name, number, and email. Pick who you need."
            onNext={next}
            onBack={back}
            canContinue={canContinue()}
          >
            <div className="flex flex-col gap-3">
              {ROLE_OPTIONS.map((opt) => {
                const picked = data.pickedAgents.find((a) => a.role === opt.id);
                const togglePicked = () => {
                  setData((d) => {
                    const exists = d.pickedAgents.some((a) => a.role === opt.id);
                    if (exists) {
                      return { ...d, pickedAgents: d.pickedAgents.filter((a) => a.role !== opt.id) };
                    }
                    return { ...d, pickedAgents: [...d.pickedAgents, { role: opt.id, name: opt.defaultName }] };
                  });
                };
                const updatePicked = (patch: Partial<PickedAgent>) => {
                  setData((d) => ({
                    ...d,
                    pickedAgents: d.pickedAgents.map((a) => (a.role === opt.id ? { ...a, ...patch } : a)),
                  }));
                };
                return (
                  <div
                    key={opt.id}
                    className={`rounded-xl border transition-all ${
                      picked ? "border-[#10b981] bg-[#10b981]/5" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={togglePicked}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-white">{opt.title}</div>
                        <div className="text-[12px] text-zinc-400 mt-0.5">{opt.tagline}</div>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                          picked ? "border-[#10b981] bg-[#10b981]" : "border-zinc-700"
                        }`}
                      >
                        {picked && (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="text-white">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {picked && (
                      <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5 border-t border-[#10b981]/20">
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-zinc-500">Name</label>
                          <input
                            type="text"
                            value={picked.name}
                            onChange={(e) => updatePicked({ name: e.target.value })}
                            placeholder={opt.defaultName}
                            className="w-full bg-transparent border-b border-zinc-800 focus:border-[#10b981] px-0 py-1.5 text-[14px] text-white placeholder-zinc-700 outline-none transition-colors"
                          />
                        </div>
                        {opt.needsComms && (
                          <>
                            <div>
                              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                                WhatsApp number <span className="text-zinc-600 normal-case">(optional — connect now or later)</span>
                              </label>
                              <input
                                type="tel"
                                value={picked.whatsappNumber ?? ""}
                                onChange={(e) => updatePicked({ whatsappNumber: e.target.value })}
                                placeholder="+971 50 123 4567"
                                className="w-full bg-transparent border-b border-zinc-800 focus:border-[#10b981] px-0 py-1.5 text-[14px] text-white placeholder-zinc-700 outline-none transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                                Email <span className="text-zinc-600 normal-case">(optional — connect now or later)</span>
                              </label>
                              <input
                                type="email"
                                value={picked.email ?? ""}
                                onChange={(e) => updatePicked({ email: e.target.value })}
                                placeholder={`${picked.name.toLowerCase() || opt.defaultName.toLowerCase()}@yourdomain.ae`}
                                className="w-full bg-transparent border-b border-zinc-800 focus:border-[#10b981] px-0 py-1.5 text-[14px] text-white placeholder-zinc-700 outline-none transition-colors"
                              />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                              Each sales agent is a distinct person. Two agents can't share the same number or email — same as hiring two real staff.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </StepShell>
        )}

        {/* ── Step 3: Name CEO ── */}
        {step === 3 && (
          <StepShell
            title="Name your CEO"
            subtitle={`${data.ceoName || "Your CEO"} will run ${data.agencyName} with a team of ${data.pickedAgents.length}`}
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

        {/* ── Step 4: Creating (AI reasons during this screen) ── */}
        {step === 4 && (
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
