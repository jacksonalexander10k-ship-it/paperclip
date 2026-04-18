/**
 * Canonical Agent Roles
 *
 * Single source of truth for what types of staff exist on an agency, what
 * each one can do, and which capabilities are exclusive to one role.
 *
 * Used by:
 *   - CEO chat prompt (so CEO knows authoritatively who to delegate what to)
 *   - start_outreach command handler (only sales agents can do outreach)
 *   - Hiring flow (UI surfaces these as the choices)
 *   - mcp-tool-server ROLE_TOOLS (mirrors capabilities → tools)
 *
 * NOTE: "*_manager" is NOT in AgentRoleId — roles like sales_manager /
 * operations_manager / marketing_manager are cosmetic org-chart heads seeded
 * by services/org-departments.ts with role="general" and
 * metadata.isDepartmentManager=true. See that file for the ghost-manager
 * contract the UI uses to hide them from user-facing team lists (bug 12).
 */

export type AgentRoleId =
  | "ceo"
  | "sales"
  | "content"
  | "marketing"
  | "intelligence"
  | "operations"
  | "finance";

export interface AgentRoleDef {
  id: AgentRoleId;
  /** Human-friendly job title (used in UI + CEO chat) */
  title: string;
  /** Short description shown when picking who to hire */
  description: string;
  /** Plain-English summary of what this role does (used in CEO prompt) */
  responsibilities: string[];
  /** Capabilities ONLY this role can perform — enforced at the command layer */
  exclusiveCapabilities: Capability[];
  /** Default heartbeat frequency in minutes when this role is hired */
  defaultHeartbeatMinutes: number;
  /** Skills automatically attached when this role is hired */
  defaultSkills: string[];
}

/** Things an agent can be authorised to do. Exclusive ones gate CEO routing. */
export type Capability =
  | "outreach" // first-touch + follow-up WhatsApp/email to leads
  | "lead_qualification"
  | "lead_scoring"
  | "social_media_posting"
  | "content_creation"
  | "paid_advertising"
  | "market_research"
  | "viewing_scheduling"
  | "calendar_management"
  | "rent_collection"
  | "invoicing"
  | "agent_management"
  | "delegation";

export const AGENT_ROLES: Record<AgentRoleId, AgentRoleDef> = {
  ceo: {
    id: "ceo",
    title: "CEO",
    description: "Orchestrator. Never does work directly — delegates everything to the right specialist.",
    responsibilities: [
      "Talk to the owner in CEO Chat",
      "Delegate every request to the appropriate specialist agent",
      "Hire, pause, resume, or update other agents",
      "Generate weekly reports and morning briefs",
    ],
    exclusiveCapabilities: ["agent_management", "delegation"],
    defaultHeartbeatMinutes: 240,
    defaultSkills: [
      "behaviour/agent-coordination.md",
      "community/anthropic/internal-comms",
    ],
  },

  sales: {
    id: "sales",
    title: "Sales Agent",
    description: "The only agent who messages leads. Owns the pipeline.",
    responsibilities: [
      "First-touch outreach to new leads (uses approved templates)",
      "Follow-ups for unresponsive leads",
      "Qualifying questions: budget, timeline, area, financing",
      "Lead scoring and tagging",
      "Hand off hot leads (8+) to a human broker",
    ],
    exclusiveCapabilities: ["outreach", "lead_qualification", "lead_scoring"],
    defaultHeartbeatMinutes: 15,
    defaultSkills: [
      "behaviour/lead-followup.md",
      "behaviour/whatsapp-outbound.md",
      "domain/dubai-buyers.md",
      "domain/multilingual.md",
      "community/corey-haines/cold-email",
      "community/corey-haines/copywriting",
    ],
  },

  content: {
    id: "content",
    title: "Social Media Manager",
    description: "Owns all organic social, brand content, captions, PR, and thought leadership.",
    responsibilities: [
      "Plan and post Instagram/LinkedIn content",
      "Write captions and carousel copy",
      "Generate reel covers and brand visuals",
      "PR / thought leadership posts",
      "Maintain brand voice across channels",
    ],
    exclusiveCapabilities: ["social_media_posting", "content_creation"],
    defaultHeartbeatMinutes: 1440,
    defaultSkills: [
      "behaviour/content-instagram.md",
      "behaviour/content-pitch-deck.md",
      "community/corey-haines/social-content",
      "community/corey-haines/content-strategy",
      "community/corey-haines/copywriting",
      "community/corey-haines/copy-editing",
      "community/corey-haines/ai-seo",
      "community/anthropic/brand-guidelines",
      "community/anthropic/pdf",
      "community/anthropic/pptx",
    ],
  },

  marketing: {
    id: "marketing",
    title: "Marketing Manager",
    description: "Runs paid ad campaigns on Facebook/Meta and Google. Tracks performance and CPL.",
    responsibilities: [
      "Plan and launch paid campaigns",
      "Monitor CPL, ROAS, audience performance",
      "A/B test creative and copy",
      "Pause underperformers, scale winners",
    ],
    exclusiveCapabilities: ["paid_advertising"],
    defaultHeartbeatMinutes: 60,
    defaultSkills: [
      "behaviour/campaign-management.md",
      "behaviour/facebook-ads.md",
      "community/corey-haines/paid-ads",
      "community/corey-haines/ad-creative",
      "community/corey-haines/marketing-psychology",
      "community/corey-haines/email-sequence",
      "community/corey-haines/launch-strategy",
      "community/corey-haines/analytics-tracking",
    ],
  },

  intelligence: {
    id: "intelligence",
    title: "Data Analyst",
    description: "Hunts opportunities — DLD transactions, listing changes, competitor moves, news.",
    responsibilities: [
      "Monitor DLD transaction feeds",
      "Watch Bayut / Property Finder / Dubizzle for listing changes",
      "Track competitor activity",
      "Surface news and market shifts to the CEO",
      "Generate market reports on request",
    ],
    exclusiveCapabilities: ["market_research"],
    defaultHeartbeatMinutes: 60,
    defaultSkills: [
      "domain/dubai-market.md",
      "community/phuryn/market-research/competitor-analysis",
      "community/phuryn/market-research/market-segments",
      "community/phuryn/market-research/market-sizing",
      "community/phuryn/market-research/sentiment-analysis",
      "community/phuryn/data-analytics/cohort-analysis",
      "community/phuryn/data-analytics/sql-queries",
      "community/hermes/research/blogwatcher",
      "community/anthropic/xlsx",
    ],
  },

  operations: {
    id: "operations",
    title: "Operations Agent",
    description: "Schedules viewings, manages calendars, sends confirmations and reminders. Also handles inbox + admin.",
    responsibilities: [
      "Book viewings between leads and brokers",
      "Confirmations 24h before, reminders 1h before",
      "Monitor company inbox and route emails",
      "Compliance checks on outbound communications",
    ],
    exclusiveCapabilities: ["viewing_scheduling", "calendar_management"],
    defaultHeartbeatMinutes: 30,
    defaultSkills: [
      "behaviour/viewing-scheduling.md",
      "domain/dubai-compliance.md",
      "community/resend/agent-email-inbox",
      "community/resend/email-best-practices",
      "community/resend/resend",
      "community/hermes/email/himalaya",
      "community/anthropic/docx",
    ],
  },

  finance: {
    id: "finance",
    title: "Finance Officer",
    description: "Tracks money — invoices, commissions, rent cheques, RERA/DLD fees.",
    responsibilities: [
      "Generate invoices and track payment status",
      "Calculate commission splits between brokers",
      "Manage rent cheque schedules and chase late ones",
      "Calculate RERA / DLD fees",
    ],
    exclusiveCapabilities: ["rent_collection", "invoicing"],
    defaultHeartbeatMinutes: 1440,
    defaultSkills: [
      "behaviour/property-management.md",
      "community/anthropic/xlsx",
      "community/anthropic/pdf",
    ],
  },
};

/** Look up role by id (returns null if not a canonical role) */
export function getRole(roleId: string): AgentRoleDef | null {
  return AGENT_ROLES[roleId as AgentRoleId] ?? null;
}

/** All role IDs in display order */
export const ROLE_IDS: AgentRoleId[] = [
  "ceo",
  "sales",
  "content",
  "marketing",
  "intelligence",
  "operations",
  "finance",
];

/** Find which role(s) own a capability — used to guard delegation */
export function rolesWithCapability(cap: Capability): AgentRoleId[] {
  return ROLE_IDS.filter((id) => AGENT_ROLES[id].exclusiveCapabilities.includes(cap));
}

/** Throws if the given role can't perform the capability */
export function assertRoleCanDo(roleId: string, cap: Capability): void {
  const role = getRole(roleId);
  if (!role) throw new Error(`Unknown role "${roleId}"`);
  if (!role.exclusiveCapabilities.includes(cap)) {
    const owners = rolesWithCapability(cap).map((r) => AGENT_ROLES[r].title).join(", ");
    throw new Error(
      `${role.title} cannot do "${cap}". Only ${owners || "no role"} can.`,
    );
  }
}

/** Render the roster as a markdown table — used by the CEO chat prompt */
export function renderRosterTable(): string {
  const lines = [
    "| Role | What they own | Exclusive to this role |",
    "|---|---|---|",
  ];
  for (const id of ROLE_IDS) {
    const r = AGENT_ROLES[id];
    const own = r.responsibilities.slice(0, 2).join("; ");
    const excl = r.exclusiveCapabilities.length ? r.exclusiveCapabilities.join(", ") : "—";
    lines.push(`| **${r.title}** | ${own} | ${excl} |`);
  }
  return lines.join("\n");
}
