import fs from "node:fs/promises";

const DEFAULT_AGENT_BUNDLE_FILES = {
  default: ["AGENTS.md"],
  ceo: ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"],
  sales: ["AGENTS.md", "HEARTBEAT.md"],
  content: ["AGENTS.md", "HEARTBEAT.md"],
  marketing: ["AGENTS.md", "HEARTBEAT.md"],
  finance: ["AGENTS.md", "HEARTBEAT.md"],
} as const;

type DefaultAgentBundleRole = keyof typeof DEFAULT_AGENT_BUNDLE_FILES;

function resolveDefaultAgentBundleUrl(role: DefaultAgentBundleRole, fileName: string) {
  return new URL(`../onboarding-assets/${role}/${fileName}`, import.meta.url);
}

export async function loadDefaultAgentInstructionsBundle(role: DefaultAgentBundleRole): Promise<Record<string, string>> {
  const fileNames = DEFAULT_AGENT_BUNDLE_FILES[role];
  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const content = await fs.readFile(resolveDefaultAgentBundleUrl(role, fileName), "utf8");
      return [fileName, content] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Maps an agent's role string to the onboarding-assets bundle directory.
 * Roles from the wizard or hire_team command are normalised here.
 */
const ROLE_TO_BUNDLE: Record<string, DefaultAgentBundleRole> = {
  ceo: "ceo",
  sales: "sales",
  "lead-agent": "sales",
  lead: "sales",
  content: "content",
  "content-agent": "content",
  marketing: "marketing",
  "market-agent": "marketing",
  research: "marketing",
  finance: "finance",
  "portfolio-agent": "finance",
  portfolio: "finance",
};

export function resolveDefaultAgentInstructionsBundleRole(role: string): DefaultAgentBundleRole {
  return ROLE_TO_BUNDLE[role.toLowerCase()] ?? "default";
}

/**
 * Default runtime configuration per role.
 * Used when creating agents via the onboarding wizard or hire_team command.
 */
export type RoleDefaults = {
  heartbeatIntervalSec: number;
  wakeOnDemand: boolean;
  icon: string;
  gradient: string;
  capabilities: string;
  budgetMonthlyCents: number;
};

const ROLE_DEFAULTS: Record<string, RoleDefaults> = {
  ceo: {
    heartbeatIntervalSec: 14400, // 4 hours
    wakeOnDemand: true,
    icon: "👔",
    gradient: "from-indigo-500 to-purple-600",
    capabilities: "Strategy, delegation, morning briefs, escalation handling, agency-wide reporting",
    budgetMonthlyCents: 8000,
  },
  sales: {
    heartbeatIntervalSec: 0, // event-driven only
    wakeOnDemand: true,
    icon: "💬",
    gradient: "from-emerald-500 to-teal-600",
    capabilities: "Lead capture, scoring, enrichment, WhatsApp follow-ups, pipeline management, lead-to-broker handoff",
    budgetMonthlyCents: 6000,
  },
  content: {
    heartbeatIntervalSec: 0,
    wakeOnDemand: true,
    icon: "🎨",
    gradient: "from-pink-500 to-rose-600",
    capabilities: "Instagram content, pitch decks, landing pages, drip campaigns, social media scheduling",
    budgetMonthlyCents: 5000,
  },
  marketing: {
    heartbeatIntervalSec: 7200, // 2 hours — monitors DLD/listings
    wakeOnDemand: true,
    icon: "📊",
    gradient: "from-amber-500 to-orange-600",
    capabilities: "DLD transaction monitoring, listing surveillance, news aggregation, investment analysis, competitor tracking",
    budgetMonthlyCents: 4000,
  },
  finance: {
    heartbeatIntervalSec: 0,
    wakeOnDemand: true,
    icon: "💰",
    gradient: "from-cyan-500 to-blue-600",
    capabilities: "Agency cost analysis, landlord management, tenancy renewals, rent tracking, RERA calculations, budget monitoring",
    budgetMonthlyCents: 2000,
  },
};

export function getRoleDefaults(role: string): RoleDefaults | null {
  const normalised = ROLE_TO_BUNDLE[role.toLowerCase()];
  if (!normalised) return null;
  return ROLE_DEFAULTS[normalised] ?? null;
}
