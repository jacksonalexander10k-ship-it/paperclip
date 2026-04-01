/**
 * Facebook Ads Connection Routes
 *
 * Allows an agent to connect/disconnect a Facebook Ads account.
 * Credentials are stored as service "facebook" in agent_credentials.
 *
 * POST   /agents/:agentId/connect/facebook  — connect (apiKey + adAccountId)
 * GET    /agents/:agentId/connect/facebook  — get connection status
 * DELETE /agents/:agentId/connect/facebook  — disconnect
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { agentService } from "../services/index.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";

export function facebookConnectRoutes(db: Db) {
  const router = Router();
  const credSvc = agentCredentialService(db);
  const agentsSvc = agentService(db);

  /**
   * Connect a Facebook Ads account to an agent.
   * Body: { apiKey: string, adAccountId: string }
   * apiKey stored as accessToken, adAccountId stored as providerAccountId.
   */
  router.post("/agents/:agentId/connect/facebook", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const { apiKey, adAccountId } = req.body;

    if (!apiKey || !adAccountId) {
      res.status(400).json({ error: "apiKey and adAccountId are required" });
      return;
    }

    await credSvc.connect(agent.companyId, agentId, "facebook", {
      accessToken: apiKey,
      providerAccountId: adAccountId,
      scopes: "ads_management,ads_read,leads_retrieval",
    });

    logger.info(
      { agentId, adAccountId, agentName: agent.name },
      "facebook-connect: agent connected to Facebook Ads",
    );

    res.json({
      connected: true,
      service: "facebook",
      adAccountId,
    });
  });

  /**
   * Get Facebook Ads connection status for an agent.
   */
  router.get("/agents/:agentId/connect/facebook", async (req, res) => {
    const { agentId } = req.params;

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "facebook");

    res.json({
      connected: cred !== null,
      adAccountId: cred?.providerAccountId ?? null,
      connectedAt: cred?.connectedAt ?? null,
    });
  });

  /**
   * Disconnect Facebook Ads from an agent.
   */
  router.delete("/agents/:agentId/connect/facebook", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "facebook");
    if (!cred) {
      res.status(404).json({ error: "No Facebook Ads connection found" });
      return;
    }

    await credSvc.disconnect(cred.id);
    logger.info({ agentId, agentName: agent.name }, "facebook-connect: disconnected");

    res.json({ disconnected: true });
  });

  return router;
}
