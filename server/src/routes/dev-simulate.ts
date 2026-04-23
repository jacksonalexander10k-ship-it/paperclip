/**
 * Dev-only public endpoints for simulating and testing. Mounted outside /api
 * so no auth session is required. Only enabled in dev.
 */
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { directAgentService } from "../services/direct-agent.js";
import { approvalService } from "../services/approvals.js";
import { logger } from "../middleware/logger.js";

export function devSimulateRoutes(db: Db) {
  const router = Router();

  router.post("/dev/simulate-inbound-whatsapp", async (req, res) => {
    const { agentId, chatJid, senderPhone, incomingText, contactName } = req.body ?? {};
    if (!agentId || !chatJid || !senderPhone) {
      res.status(400).json({ error: "agentId, chatJid, senderPhone required" });
      return;
    }
    try {
      const result = await directAgentService(db).respondToEvent(String(agentId), {
        kind: "inbound_whatsapp",
        incomingText: typeof incomingText === "string" ? incomingText : "",
        chatJid: String(chatJid),
        senderPhone: String(senderPhone),
        contactName: typeof contactName === "string" ? contactName : null,
      });
      res.json({ ok: true, result });
    } catch (err) {
      logger.error({ err }, "dev/simulate-inbound-whatsapp failed");
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Approve a pending approval (bypasses auth for dev testing)
  router.post("/dev/approve/:approvalId", async (req, res) => {
    const { approvalId } = req.params;
    const { companyId } = req.body ?? {};
    if (!companyId) {
      res.status(400).json({ error: "companyId required in body" });
      return;
    }
    try {
      const svc = approvalService(db);
      const result = await svc.approve(companyId, approvalId, {});
      res.json({ ok: true, result });
    } catch (err) {
      logger.error({ err }, "dev/approve failed");
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
