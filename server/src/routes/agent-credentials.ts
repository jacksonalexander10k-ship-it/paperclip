/**
 * Agent Credentials Routes
 *
 * Manage per-agent OAuth credentials for WhatsApp, Gmail, Instagram, etc.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { agentService } from "../services/index.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";

export function agentCredentialRoutes(db: Db) {
  const router = Router();
  const credSvc = agentCredentialService(db);
  const agentsSvc = agentService(db);

  // List all credentials for a company
  router.get("/companies/:companyId/credentials", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const credentials = await credSvc.listByCompany(companyId);
    // Redact tokens in list response
    res.json(
      credentials.map((c) => ({
        ...c,
        accessToken: c.accessToken ? "***connected***" : null,
        refreshToken: c.refreshToken ? "***connected***" : null,
      })),
    );
  });

  // List credentials for a specific agent
  router.get("/agents/:agentId/credentials", async (req, res) => {
    const { agentId } = req.params;
    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const credentials = await credSvc.listByAgent(agentId);
    res.json(
      credentials.map((c) => ({
        ...c,
        accessToken: c.accessToken ? "***connected***" : null,
        refreshToken: c.refreshToken ? "***connected***" : null,
      })),
    );
  });

  // Connect a service to an agent
  router.post("/agents/:agentId/credentials", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const { service, accessToken, refreshToken, providerAccountId, whatsappPhoneNumberId, gmailAddress, scopes, expiresAt } = req.body;

    if (!service || typeof service !== "string") {
      res.status(400).json({ error: "service is required" });
      return;
    }

    const credential = await credSvc.connect(agent.companyId, agentId, service, {
      accessToken,
      refreshToken,
      providerAccountId,
      whatsappPhoneNumberId,
      gmailAddress,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    logger.info({ agentId, service }, "agent-credentials: connected");

    res.json({
      ...credential,
      accessToken: credential.accessToken ? "***connected***" : null,
      refreshToken: credential.refreshToken ? "***connected***" : null,
    });
  });

  // Disconnect a service
  router.delete("/credentials/:credentialId", async (req, res) => {
    const { credentialId } = req.params;
    assertBoard(req);

    await credSvc.disconnect(credentialId);
    logger.info({ credentialId }, "agent-credentials: disconnected");
    res.status(204).end();
  });

  return router;
}
