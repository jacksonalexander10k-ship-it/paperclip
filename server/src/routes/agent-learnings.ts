import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentLearningService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function agentLearningRoutes(db: Db) {
  const router = Router();
  const svc = agentLearningService(db);

  // List learnings for a company (optionally filtered by agent)
  router.get("/companies/:companyId/agent-learnings", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const agentId = req.query.agentId as string | undefined;
    const result = await svc.list(companyId, agentId);
    res.json(result);
  });

  // Get learning stats for a company or agent
  router.get("/companies/:companyId/agent-learnings/stats", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const agentId = req.query.agentId as string | undefined;
    const result = await svc.stats(companyId, agentId);
    res.json(result);
  });

  // Deactivate a learning (soft delete — owner removes a bad learning)
  router.post("/companies/:companyId/agent-learnings/:id/deactivate", async (req, res) => {
    const { companyId, id } = req.params;
    assertCompanyAccess(req, companyId);
    const result = await svc.deactivate(id, companyId);
    if (!result) {
      res.status(404).json({ error: "Learning not found" });
      return;
    }
    res.json(result);
  });

  // Hard delete a learning
  router.delete("/companies/:companyId/agent-learnings/:id", async (req, res) => {
    const { companyId, id } = req.params;
    assertCompanyAccess(req, companyId);
    const result = await svc.remove(id, companyId);
    if (!result) {
      res.status(404).json({ error: "Learning not found" });
      return;
    }
    res.json(result);
  });

  // Trigger compaction for an agent's learnings
  router.post("/companies/:companyId/agents/:agentId/learnings/compact", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const result = await svc.compactLearnings(companyId, agentId);
    if (!result) {
      res.json({ message: "Not enough learnings to compact" });
      return;
    }
    res.json(result);
  });

  // Detect conflicting learnings for an agent
  router.get("/companies/:companyId/agents/:agentId/learnings/conflicts", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const conflicts = await svc.detectConflicts(companyId, agentId);
    res.json(conflicts);
  });

  // List stale learnings (older than 90 days)
  router.get("/companies/:companyId/agent-learnings/stale", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const agentId = req.query.agentId as string | undefined;
    const stale = await svc.flagStale(companyId, agentId);
    res.json(stale);
  });

  // Export all learnings as JSON
  router.get("/companies/:companyId/agent-learnings/export", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const data = await svc.exportAll(companyId);
    res.setHeader("Content-Disposition", `attachment; filename="learnings-${companyId}.json"`);
    res.json(data);
  });

  return router;
}
