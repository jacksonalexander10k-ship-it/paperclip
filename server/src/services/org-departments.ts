/**
 * Department setup service — extracted from org-departments route
 * so it can be called from both the HTTP route and approval-executor.
 *
 * GHOST MANAGER CONTRACT (see bug 12):
 *   The agents this module creates (Sales Manager, Operations Manager,
 *   Marketing Manager, Intelligence Manager) are COSMETIC org-chart
 *   scaffolding — they exist so the hierarchy shows a department head between
 *   the CEO and the worker agents. They are NOT real hires and should not
 *   appear in user-facing team lists or the sidebar.
 *
 *   Identification contract (used by the UI filter):
 *     - metadata.isDepartmentManager === true   (authoritative)
 *     - role === "general" AND name ends in "Manager" (fallback)
 *
 *   The AygencyOnboardingWizard still references these names, so removing the
 *   seed would break onboarding. Keep the seed — the UI hides them in the
 *   /agents views and sidebar.
 */

import type { Db } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_DEPARTMENTS: Array<{
  name: string;
  title: string;
  icon: string;
  matchRoles: string[];
  matchNames: RegExp[];
}> = [
  {
    name: "Sales Manager",
    title: "Head of Sales & Lead Management",
    icon: "trending-up",
    matchRoles: [],
    matchNames: [/lead/i, /sales/i, /call/i, /viewing/i],
  },
  {
    name: "Marketing Manager",
    title: "Head of Marketing & Content",
    icon: "megaphone",
    matchRoles: ["cmo"],
    matchNames: [/content/i, /marketing/i, /social/i],
  },
  {
    name: "Operations Manager",
    title: "Head of Operations & Portfolio",
    icon: "settings",
    matchRoles: [],
    matchNames: [/portfolio/i, /operations/i, /property/i],
  },
  {
    name: "Intelligence Manager",
    title: "Head of Market Intelligence",
    icon: "bar-chart",
    matchRoles: ["researcher"],
    matchNames: [/market/i, /intel/i, /research/i],
  },
];

export interface DeptSetupResult {
  department: string;
  manager: string;
  agents: string[];
}

/**
 * Creates department managers between CEO and workers.
 * Returns the list of departments created, or empty array if no CEO found.
 */
export async function setupDepartments(
  db: Db,
  companyId: string,
  options: { activate?: boolean } = {},
): Promise<DeptSetupResult[]> {
  const agentsSvc = agentService(db);
  const allAgents = await agentsSvc.list(companyId);
  const ceo = allAgents.find((a) => a.role === "ceo");

  if (!ceo) {
    logger.warn({ companyId }, "org-departments: no CEO agent found, skipping department setup");
    return [];
  }

  // Find workers (non-CEO, non-terminated, non-manager agents)
  const workers = allAgents.filter(
    (a) =>
      a.id !== ceo.id &&
      a.status !== "terminated" &&
      !a.name.toLowerCase().includes("manager") &&
      !(a.metadata as Record<string, unknown>)?.isDepartmentManager,
  );

  // Group workers into departments
  const departmentAssignments = new Map<string, string[]>();
  const assignedAgentIds = new Set<string>();

  for (const dept of DEFAULT_DEPARTMENTS) {
    const matches = workers.filter((agent) => {
      if (assignedAgentIds.has(agent.id)) return false;
      if (dept.matchRoles.includes(agent.role)) return true;
      return dept.matchNames.some(
        (re) => re.test(agent.name) || (agent.title && re.test(agent.title)),
      );
    });

    if (matches.length > 0) {
      departmentAssignments.set(
        dept.name,
        matches.map((a) => a.id),
      );
      for (const m of matches) assignedAgentIds.add(m.id);
    }
  }

  // Unassigned workers go under Operations
  const unassigned = workers.filter((a) => !assignedAgentIds.has(a.id));
  if (unassigned.length > 0) {
    const opsKey = "Operations Manager";
    const existing = departmentAssignments.get(opsKey) ?? [];
    departmentAssignments.set(opsKey, [...existing, ...unassigned.map((a) => a.id)]);
  }

  // Create managers and reassign workers
  const results: DeptSetupResult[] = [];

  for (const dept of DEFAULT_DEPARTMENTS) {
    const agentIds = departmentAssignments.get(dept.name);
    if (!agentIds || agentIds.length === 0) continue;

    // Check if manager already exists
    const existingManager = allAgents.find(
      (a) => a.name === dept.name && a.status !== "terminated",
    );

    let managerId: string;

    if (existingManager) {
      managerId = existingManager.id;
      await agentsSvc.update(managerId, { reportsTo: ceo.id });
    } else {
      const manager = await agentsSvc.create(companyId, {
        name: dept.name,
        role: "general",
        title: dept.title,
        icon: dept.icon,
        reportsTo: ceo.id,
        adapterType: "gemini_local",
        adapterConfig: {},
        runtimeConfig: {},
        status: options.activate ? "idle" : "paused",
        pauseReason: options.activate ? null : "cosmetic",
        capabilities: null,
        budgetMonthlyCents: 500,
        metadata: {
          isDepartmentManager: true,
          departmentAgents: agentIds,
        },
        permissions: undefined,
      });
      managerId = manager.id;
    }

    // Update workers to report to this manager
    const agentNames: string[] = [];
    for (const agentId of agentIds) {
      await agentsSvc.update(agentId, { reportsTo: managerId });
      const agent = workers.find((a) => a.id === agentId);
      if (agent) agentNames.push(agent.name);
    }

    results.push({
      department: dept.name,
      manager: managerId,
      agents: agentNames,
    });
  }

  logger.info(
    { companyId, departments: results.length },
    "org-departments: department structure created",
  );

  return results;
}
