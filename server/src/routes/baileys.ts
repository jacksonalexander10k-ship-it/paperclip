/**
 * Baileys WhatsApp Routes
 *
 * API endpoints for managing Baileys (WhatsApp Web) connections per agent.
 * Handles: connect (QR code), disconnect, status check, and manual send.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { baileysSessionManager } from "../services/baileys-session-manager.js";
import { logger } from "../middleware/logger.js";

export function baileysRoutes(db: Db) {
  const router = Router();

  // Ensure session manager has DB reference
  baileysSessionManager.setDb(db);

  /**
   * POST /agents/:agentId/baileys/connect
   * Start a Baileys session. Returns QR code data URL for scanning.
   * Subsequent QR refreshes are pushed via WebSocket live events (baileys.qr).
   */
  router.post("/agents/:agentId/baileys/connect", async (req, res) => {
    const { agentId } = req.params;
    const companyId = req.query.companyId as string ?? req.body?.companyId;

    if (!companyId) {
      res.status(400).json({ error: "companyId is required" });
      return;
    }

    try {
      const result = await baileysSessionManager.connect(agentId, companyId);
      res.json(result);
    } catch (err) {
      logger.error({ err, agentId }, "baileys-route: connect failed");
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /agents/:agentId/baileys/status
   * Check connection status for an agent's Baileys session.
   */
  router.get("/agents/:agentId/baileys/status", async (req, res) => {
    const { agentId } = req.params;
    const status = baileysSessionManager.getStatus(agentId);
    res.json(status);
  });

  /**
   * POST /agents/:agentId/baileys/disconnect
   * Disconnect a Baileys session. Pass ?logout=true to fully log out and clear auth state.
   */
  router.post("/agents/:agentId/baileys/disconnect", async (req, res) => {
    const { agentId } = req.params;
    const logout = req.query.logout === "true" || req.body?.logout === true;

    try {
      await baileysSessionManager.disconnect(agentId, logout);
      res.json({ status: "disconnected", loggedOut: logout });
    } catch (err) {
      logger.error({ err, agentId }, "baileys-route: disconnect failed");
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /agents/:agentId/baileys/send
   * Send a message through Baileys. Used internally by the approval executor
   * and can also be called directly for testing.
   */
  router.post("/agents/:agentId/baileys/send", async (req, res) => {
    const { agentId } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
      res.status(400).json({ error: "phone and message are required" });
      return;
    }

    try {
      const result = await baileysSessionManager.sendMessage(agentId, phone, message);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err) {
      logger.error({ err, agentId }, "baileys-route: send failed");
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /baileys/sessions
   * List all active Baileys sessions (admin endpoint).
   */
  router.get("/baileys/sessions", async (_req, res) => {
    const sessions = baileysSessionManager.getActiveSessions();
    res.json({ sessions, count: sessions.length });
  });

  return router;
}
