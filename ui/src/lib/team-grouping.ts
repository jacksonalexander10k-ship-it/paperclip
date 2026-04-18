import type { Agent, AgentRole } from "@paperclipai/shared";

export interface TeamSection {
  /** Department key — stable ordering key */
  key: string;
  /** Display label ("Leadership", "Sales", "Marketing", …) */
  label: string;
  /** Managers in this department (shown first inside the section) */
  managers: Agent[];
  /** Individual agents in this department */
  agents: Agent[];
}

/** Role → department key. Intelligence folded into Operations (research is
 * not a separate department for a real-estate agency). */
const ROLE_TO_DEPT: Record<string, string> = {
  ceo: "leadership",
  sales: "sales",
  calling: "sales",
  viewing: "sales",
  content: "marketing",
  marketing: "marketing",
  intelligence: "operations",
  operations: "operations",
  manager: "operations",
  conveyancing: "operations",
  finance: "finance",
  compliance: "compliance",
  general: "other",
};

/** Manager roles — treated as department leads */
const MANAGER_ROLES = new Set<string>([
  "ceo",
  "content", // Social Media Manager
  "marketing", // Marketing Manager
  "manager",
  "finance",
]);

/**
 * Ordered list of departments. Matches the sidebar order so the dashboard
 * and sidebar are visually consistent.
 */
const DEPT_ORDER: Array<{ key: string; label: string }> = [
  { key: "leadership", label: "Leadership" },
  { key: "marketing", label: "Marketing" },
  { key: "operations", label: "Operations" },
  { key: "sales", label: "Sales" },
  { key: "finance", label: "Finance" },
  { key: "compliance", label: "Compliance" },
  { key: "other", label: "Other" },
];

const DEPT_LABEL_BY_KEY = new Map(DEPT_ORDER.map((d) => [d.key, d.label]));

/** Label of the department this agent belongs to (e.g. "Sales", "Marketing") */
export function agentDepartmentLabel(agent: Agent): string {
  const key = ROLE_TO_DEPT[String(agent.role ?? "general")] ?? "other";
  return DEPT_LABEL_BY_KEY.get(key) ?? "Other";
}

/**
 * Heuristic: an agent is a manager if either its role is in MANAGER_ROLES,
 * its title contains "Manager", or its name equals the generic placeholder
 * like "Sales Manager" / "Operations Manager". This also catches placeholder
 * department-manager agents created during org setup.
 */
export function isManager(agent: Agent): boolean {
  if (MANAGER_ROLES.has(String(agent.role))) return true;
  const title = (agent.title ?? "").toLowerCase();
  if (title.includes("manager") || title === "ceo") return true;
  const name = (agent.name ?? "").toLowerCase();
  if (name.endsWith(" manager") || name === "ceo") return true;
  return false;
}

/**
 * setupDepartments creates placeholder "department head" records with
 * role=general + title="Head of …". Those aren't real agents the user hired —
 * they're org-chart scaffolding. Filter them out of dashboard views.
 */
function isPlaceholderManagerSlot(a: Agent): boolean {
  if (String(a.role) !== "general") return false;
  const title = (a.title ?? "").toLowerCase();
  const name = (a.name ?? "").toLowerCase();
  return title.startsWith("head of") || name.endsWith(" manager");
}

export function groupTeam(allAgents: Agent[] | undefined | null): TeamSection[] {
  if (!allAgents || allAgents.length === 0) return [];
  const buckets = new Map<string, { managers: Agent[]; agents: Agent[] }>();
  for (const a of allAgents) {
    if (a.status === "terminated") continue;
    if (isPlaceholderManagerSlot(a)) continue;
    const dept = ROLE_TO_DEPT[String(a.role ?? "general")] ?? "other";
    if (!buckets.has(dept)) buckets.set(dept, { managers: [], agents: [] });
    const bucket = buckets.get(dept)!;
    if (isManager(a)) bucket.managers.push(a);
    else bucket.agents.push(a);
  }

  return DEPT_ORDER
    .filter((d) => buckets.has(d.key))
    .map((d) => ({
      key: d.key,
      label: d.label,
      managers: buckets.get(d.key)!.managers,
      agents: buckets.get(d.key)!.agents,
    }));
}

/** Compact role label used on cards */
export function roleBadgeLabel(agent: Agent, roleLabel: string): string {
  const title = agent.title?.trim();
  if (title) return title;
  return roleLabel;
}

/**
 * Acronyms that should be uppercased regardless of casing in the input.
 * Keep this list small and well-known — anything else is title-cased.
 */
const ACRONYMS = new Set(["CEO", "CTO", "CFO", "COO", "CMO", "API", "AI", "RERA", "DLD", "UAE", "PR", "HR", "IT", "QA", "RE"]);

/**
 * Normalise a department/role chip string so casing is consistent across the UI.
 *
 * Rules:
 *   - Preserve "&" connectors ("Creative & Marketing" stays).
 *   - Uppercase known acronyms ("CEO", "API").
 *   - Title-case regular words ("operations" → "Operations").
 *   - Replace underscores/hyphens with spaces.
 *   - Trim + collapse whitespace.
 *
 * Intended for use wherever an agent.role or agent.department string is
 * rendered as a visible label.
 */
export function formatDepartment(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = String(raw).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word) => {
      if (word === "&" || word === "+" || word === "/") return word;
      // Split on "&" inside a token like "Creative&Marketing" (rare, but safe)
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Deterministic HSL colour derived from a stable key (agent.id, name, etc).
 * Used to differentiate avatars so two agents with the same initials don't
 * render as the same colour.
 */
export function agentAvatarHsl(key: string): { h: number; s: number; l: number } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  // Keep saturation/lightness in a pleasant range — readable white text on top.
  return { h, s: 62, l: 42 };
}

/** Gradient background for an avatar, derived from a stable key. */
export function agentAvatarGradient(key: string): string {
  const { h, s, l } = agentAvatarHsl(key);
  const h2 = (h + 24) % 360;
  return `linear-gradient(135deg, hsl(${h} ${s}% ${Math.max(l - 10, 20)}%), hsl(${h2} ${s}% ${l}%))`;
}

/**
 * Compute avatar initials for an agent. When a `collisionKeys` set is provided
 * (initials already claimed by other agents in the same view), we differentiate
 * by falling back to first-letter-of-name + first-letter-of-role. If a `role`
 * is provided it's used directly, otherwise the second-letter-of-name fallback
 * is used.
 *
 * Rules:
 *  - Multi-word name → first letter of first word + first letter of last word.
 *  - Single-word name with no collision → first two letters.
 *  - Single-word name WITH a collision → first letter of name + first letter
 *    of role (e.g. Claire/Lead="CL" vs Clive/CEO="CC").
 */
export function agentInitials(
  name: string | null | undefined,
  role: string | null | undefined = null,
  collisionKeys: ReadonlySet<string> = new Set(),
): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "??";
  const words = trimmed.split(/\s+/).filter(Boolean);
  let initials: string;
  if (words.length >= 2) {
    initials = (words[0]![0] ?? "") + (words[words.length - 1]![0] ?? "");
  } else {
    initials = trimmed.slice(0, 2);
  }
  initials = initials.toUpperCase();
  // If this collides with an already-used initial pair, differentiate using role.
  if (collisionKeys.has(initials) && role) {
    const roleFirst = String(role).trim().charAt(0).toUpperCase();
    if (roleFirst) {
      const differentiated = (trimmed[0] ?? "").toUpperCase() + roleFirst;
      return differentiated;
    }
  }
  return initials;
}

export type { AgentRole };
