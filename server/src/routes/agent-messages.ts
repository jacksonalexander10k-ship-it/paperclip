import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentMessageService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function agentMessageRoutes(db: Db) {
  const router = Router();
  const svc = agentMessageService(db);

  // List recent inter-agent messages for the Activity Feed
  router.get("/companies/:companyId/agent-messages", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const result = await svc.listRecent(companyId, limit);
    res.json(result);
  });

  // List messages between two agents
  router.get("/companies/:companyId/agent-messages/between", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const agentA = req.query.agentA as string;
    const agentB = req.query.agentB as string;
    if (!agentA || !agentB) {
      res.status(400).json({ error: "agentA and agentB query params required" });
      return;
    }
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const result = await svc.listBetween(companyId, agentA, agentB, limit);
    res.json(result);
  });

  // Get network stats for the Agent Network Graph
  router.get("/companies/:companyId/agent-messages/network", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days ?? 7), 30);
    const result = await svc.networkStats(companyId, days);
    res.json(result);
  });

  // Purge expired messages (can be called from a cron or manually)
  router.post("/agent-messages/purge", async (_req, res) => {
    const purged = await svc.purgeExpired();
    res.json({ purged });
  });

  return router;
}
