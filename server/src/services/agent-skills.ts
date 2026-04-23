/**
 * Agent Skills Resolver
 *
 * Single entry point for "what skills does this agent get?"
 * Combines:
 *   1. Role-default skills from the canonical roster (agent-roles.ts)
 *   2. Company-wide runtime skills (existing behaviour)
 *   3. Repo-bundled skills (skills/, skills/community/, skills/domain/, skills/behaviour/)
 *
 * Returned in the PaperclipSkillEntry shape that adapters expect.
 */

import { resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import type { Db } from "@paperclipai/db";
import { companySkillService } from "./company-skills.js";
import { AGENT_ROLES, getRole } from "./agent-roles.js";
import { logger } from "../middleware/logger.js";

/** Mirrors PaperclipSkillEntry from company-skills (we don't import the type to avoid a cycle) */
export interface SkillEntry {
  key: string;
  runtimeName: string;
  source: string;
  required: boolean;
  requiredReason: string | null;
}

interface AgentLike {
  id: string;
  companyId: string;
  role: string;
}

/**
 * Find the repo root — where skills/ lives.
 * Walks up from CWD until it finds a directory containing `skills/`.
 */
let cachedRepoRoot: string | null = null;
function repoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, "skills"))) {
      cachedRepoRoot = dir;
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  cachedRepoRoot = process.cwd();
  return cachedRepoRoot;
}

/**
 * Resolve a relative skill path to an absolute path under skills/.
 * Returns null if the path doesn't exist.
 */
function resolveSkillPath(relative: string): string | null {
  const abs = resolve(repoRoot(), "skills", relative);
  try {
    if (!existsSync(abs)) return null;
    statSync(abs); // throws if broken symlink
    return abs;
  } catch {
    return null;
  }
}

/** Slugify a path into a stable key */
function pathToKey(prefix: string, p: string): string {
  return `${prefix}:${p.replace(/[^a-zA-Z0-9_/.-]/g, "-")}`;
}

/** Build SkillEntry for a role-default repo-bundled skill */
function entryForRoleSkill(roleId: string, relative: string): SkillEntry | null {
  const source = resolveSkillPath(relative);
  if (!source) {
    logger.warn({ roleId, relative }, "agent-skills: role default skill not found on disk");
    return null;
  }
  return {
    key: pathToKey(`role-${roleId}`, relative),
    runtimeName: relative.replace(/[/.]/g, "-"),
    source,
    required: true,
    requiredReason: `Bundled with role "${roleId}".`,
  };
}

/**
 * Get all skills for an agent — role defaults + company runtime skills + dedupe.
 */
export async function getSkillsForAgent(db: Db, agent: AgentLike): Promise<SkillEntry[]> {
  const companySkills = companySkillService(db);

  // 1. Role defaults from the canonical roster
  const role = getRole(agent.role);
  const roleEntries: SkillEntry[] = [];
  if (role) {
    for (const rel of role.defaultSkills) {
      const entry = entryForRoleSkill(role.id, rel);
      if (entry) roleEntries.push(entry);
    }
  }

  // 2. Company runtime skills (existing behaviour — paperclip_bundled + custom imports)
  const companyEntries = (await companySkills.listRuntimeSkillEntries(agent.companyId)) as SkillEntry[];

  // 3. Merge + dedupe by source path (role defaults take precedence on conflict)
  const bySource = new Map<string, SkillEntry>();
  for (const e of [...roleEntries, ...companyEntries]) {
    if (!bySource.has(e.source)) bySource.set(e.source, e);
  }

  const merged = Array.from(bySource.values());
  merged.sort((a, b) => a.key.localeCompare(b.key));
  return merged;
}

/**
 * Diagnostic — list which role defaults are missing from disk for the given role.
 * Useful for the marketplace UI later: "Hire Sales Agent? You're missing X skills."
 */
export function checkRoleSkillsAvailable(roleId: string): {
  found: string[];
  missing: string[];
} {
  const role = getRole(roleId);
  if (!role) return { found: [], missing: [] };
  const found: string[] = [];
  const missing: string[] = [];
  for (const rel of role.defaultSkills) {
    if (resolveSkillPath(rel)) found.push(rel);
    else missing.push(rel);
  }
  return { found, missing };
}
