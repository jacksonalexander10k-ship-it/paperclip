/**
 * WhatsApp Connection Routes (360dialog Embedded Signup)
 *
 * Flow:
 * 1. UI renders 360dialog Connect Button (client-side JS widget)
 * 2. User completes Embedded Signup in popup
 * 3. 360dialog sends webhook to /webhook/360dialog/channel
 * 4. We call 360dialog Partner API to get the API key for the number
 * 5. Store credentials in agent_credentials
 *
 * For the MVP: also supports manual API key entry (paste credentials).
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { agentService } from "../services/index.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";

// 360dialog Partner API base URL
const THREESIXTY_API_BASE = "https://hub.360dialog.com/api/v2";

export function whatsappConnectRoutes(db: Db) {
  const router = Router();
  const credSvc = agentCredentialService(db);
  const agentsSvc = agentService(db);

  /**
   * Manual WhatsApp connection (paste 360dialog API key + phone number ID).
   * Used for MVP and agencies that prefer manual setup.
   */
  router.post("/agents/:agentId/connect/whatsapp", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const { apiKey, phoneNumberId, phoneNumber } = req.body;

    if (!apiKey || !phoneNumberId) {
      res.status(400).json({ error: "apiKey and phoneNumberId are required" });
      return;
    }

    // Verify the API key works by calling 360dialog API
    try {
      const verifyRes = await fetch(`https://waba.360dialog.io/v1/configs/webhook`, {
        method: "GET",
        headers: { "D360-API-KEY": apiKey },
      });

      if (!verifyRes.ok) {
        res.status(400).json({
          error: "Invalid API key — 360dialog returned an error. Check the key and try again.",
        });
        return;
      }
    } catch {
      // If verification fails due to network, allow connection anyway (offline dev)
      logger.warn("whatsapp-connect: could not verify 360dialog API key (network error)");
    }

    // Set the webhook URL to our server
    const webhookUrl = `${process.env.PUBLIC_URL ?? "https://aygencyworld.com"}/webhook/whatsapp`;
    try {
      await fetch(`https://waba.360dialog.io/v1/configs/webhook`, {
        method: "POST",
        headers: {
          "D360-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: webhookUrl }),
      });
    } catch {
      logger.warn("whatsapp-connect: could not set webhook URL (network error)");
    }

    // Store credential
    const credential = await credSvc.connect(agent.companyId, agentId, "whatsapp", {
      accessToken: apiKey,
      whatsappPhoneNumberId: phoneNumberId,
      providerAccountId: phoneNumber ?? null,
      scopes: "messaging",
    });

    logger.info(
      { agentId, phoneNumberId, agentName: agent.name },
      "whatsapp-connect: agent connected to WhatsApp",
    );

    res.json({
      connected: true,
      service: "whatsapp",
      phoneNumberId,
      phoneNumber: phoneNumber ?? null,
    });
  });

  /**
   * Disconnect WhatsApp from an agent
   */
  router.delete("/agents/:agentId/connect/whatsapp", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "whatsapp");
    if (!cred) {
      res.status(404).json({ error: "No WhatsApp connection found" });
      return;
    }

    await credSvc.disconnect(cred.id);
    logger.info({ agentId, agentName: agent.name }, "whatsapp-connect: disconnected");

    res.json({ disconnected: true });
  });

  /**
   * Get WhatsApp connection status for an agent
   */
  router.get("/agents/:agentId/connect/whatsapp", async (req, res) => {
    const { agentId } = req.params;

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "whatsapp");

    res.json({
      connected: cred !== null,
      phoneNumberId: cred?.whatsappPhoneNumberId ?? null,
      phoneNumber: cred?.providerAccountId ?? null,
      connectedAt: cred?.connectedAt ?? null,
    });
  });

  /**
   * 360dialog Embedded Signup webhook
   * Receives channel_created event after user completes signup in popup.
   * This is called by 360dialog, not by our UI.
   */
  router.post("/webhook/360dialog/channel", async (req, res) => {
    res.sendStatus(200);

    const { event, client_id, channels } = req.body;
    logger.info({ event, client_id, channels }, "360dialog: channel webhook received");

    if (event !== "channel_created" || !channels?.length) return;

    // For each created channel, generate API key via 360dialog Partner API
    const partnerApiKey = process.env.THREESIXTY_PARTNER_KEY;
    if (!partnerApiKey) {
      logger.warn("360dialog: THREESIXTY_PARTNER_KEY not set, cannot generate API keys");
      return;
    }

    for (const channel of channels) {
      try {
        // Generate API key for this channel
        const apiKeyRes = await fetch(
          `${THREESIXTY_API_BASE}/partners/channels/${channel.id}/api_keys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${partnerApiKey}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!apiKeyRes.ok) {
          logger.error({ status: apiKeyRes.status }, "360dialog: failed to generate API key");
          continue;
        }

        const apiKeyData = await apiKeyRes.json() as { api_key?: string };
        logger.info(
          { channelId: channel.id, phoneNumber: channel.phone_number },
          "360dialog: API key generated — store manually or via agent setup",
        );

        // Note: At this point we don't know which agent this channel belongs to.
        // The UI flow should pass the agentId as state in the Embedded Signup.
        // For MVP, log the key and let the user paste it manually.
      } catch (err) {
        logger.error({ err }, "360dialog: failed to process channel_created");
      }
    }
  });

  return router;
}
