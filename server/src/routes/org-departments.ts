/**
 * Org Department Manager Routes
 *
 * Creates department manager agents (cosmetic or lightweight relay)
 * that sit between CEO and department workers in the org chart.
 * Makes the org chart look like a real business hierarchy.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentService } from "../services/agents.js";
import { logger } from "../middleware/logger.js";

/**
 * Default department structure.
 * Each department has a manager title, role, and the roles of agents that belong to it.
 */
const DEFAULT_DEPARTMENTS: Array<{
  name: string;
  title: string;
  icon: string;
  /** Agent roles or name patterns that fall under this department */
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
    matchNames: [/content/i, /marketing/i, /social/i, /nour/i],
  },
  {
    name: "Operations Manager",
    title: "Head of Operations & Portfolio",
    icon: "settings",
    matchRoles: [],
    matchNames: [/portfolio/i, /operations/i, /property/i, /sara/i],
  },
  {
    name: "Intelligence Manager",
    title: "Head of Market Intelligence",
    icon: "bar-chart",
    matchRoles: ["researcher"],
    matchNames: [/market/i, /intel/i, /research/i, /omar/i],
  },
];

export function orgDepartmentRoutes(db: Db) {
  const router = Router();
  const agentsSvc = agentService(db);

  /**
   * POST /companies/:companyId/org/setup-departments
   *
   * Automatically creates department managers between CEO and workers.
   * - Finds the CEO agent
   * - Groups existing agents into departments
   * - Creates a paused manager for each department with ≥1 agent
   * - Updates workers to report to their department manager
   * - Managers report to CEO
   *
   * Query params:
   *   ?activate=true — create managers as idle (ready for Gemini relay) instead of paused
   */
  router.post("/companies/:companyId/org/setup-departments", async (req, res) => {
    const { companyId } = req.params;
    const activate = req.query.activate === "true";

    try {
      const allAgents = await agentsSvc.list(companyId);
      const ceo = allAgents.find((a) => a.role === "ceo");

      if (!ceo) {
        res.status(400).json({ error: "No CEO agent found. Create a CEO first." });
        return;
      }

      // Find workers (non-CEO, non-terminated, non-manager agents)
      const workers = allAgents.filter(
        (a) => a.id !== ceo.id && a.status !== "terminated" && !a.name.toLowerCase().includes("manager"),
      );

      // Group workers into departments
      const departmentAssignments = new Map<string, string[]>(); // deptName → agentIds
      const assignedAgentIds = new Set<string>();

      for (const dept of DEFAULT_DEPARTMENTS) {
        const matches = workers.filter((agent) => {
          if (assignedAgentIds.has(agent.id)) return false;
          // Match by role
          if (dept.matchRoles.includes(agent.role)) return true;
          // Match by name pattern
          return dept.matchNames.some((re) => re.test(agent.name) || (agent.title && re.test(agent.title)));
        });

        if (matches.length > 0) {
          departmentAssignments.set(dept.name, matches.map((a) => a.id));
          for (const m of matches) assignedAgentIds.add(m.id);
        }
      }

      // Any unassigned workers go under "Operations Manager" as fallback
      const unassigned = workers.filter((a) => !assignedAgentIds.has(a.id));
      if (unassigned.length > 0) {
        const opsKey = "Operations Manager";
        const existing = departmentAssignments.get(opsKey) ?? [];
        departmentAssignments.set(opsKey, [...existing, ...unassigned.map((a) => a.id)]);
      }

      // Create managers and reassign workers
      const results: Array<{ department: string; manager: string; agents: string[] }> = [];

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
          // Ensure it reports to CEO
          await agentsSvc.update(managerId, { reportsTo: ceo.id });
        } else {
          // Create the department manager
          const manager = await agentsSvc.create(companyId, {
            name: dept.name,
            role: "general",
            title: dept.title,
            icon: dept.icon,
            reportsTo: ceo.id,
            adapterType: "gemini_local", // cheap/free model ready if activated
            adapterConfig: {},
            runtimeConfig: {},
            status: activate ? "idle" : "paused",
            pauseReason: activate ? null : "cosmetic",
            capabilities: null,
            budgetMonthlyCents: 500, // $5/month cap (safety net)
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

      res.json({
        message: `Created ${results.length} department${results.length !== 1 ? "s" : ""} with managers`,
        departments: results,
      });
    } catch (err) {
      logger.error({ err, companyId }, "org-departments: setup failed");
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * DELETE /companies/:companyId/org/departments
   * Remove all department managers and flatten the org back to CEO → workers.
   */
  router.delete("/companies/:companyId/org/departments", async (req, res) => {
    const { companyId } = req.params;

    try {
      const allAgents = await agentsSvc.list(companyId);
      const ceo = allAgents.find((a) => a.role === "ceo");
      if (!ceo) {
        res.status(400).json({ error: "No CEO agent found." });
        return;
      }

      const managers = allAgents.filter(
        (a) => (a.metadata as any)?.isDepartmentManager && a.status !== "terminated",
      );

      for (const manager of managers) {
        // Move all reports back to CEO
        const reports = allAgents.filter((a) => a.reportsTo === manager.id);
        for (const report of reports) {
          await agentsSvc.update(report.id, { reportsTo: ceo.id });
        }
        // Terminate the manager
        await agentsSvc.update(manager.id, { status: "terminated" });
      }

      res.json({ message: `Removed ${managers.length} department manager(s)` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
