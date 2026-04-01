import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";

/**
 * Gmail Pub/Sub webhook receiver.
 * Mounted BEFORE auth middleware — Google Cloud Pub/Sub needs unauthenticated POST access.
 *
 * Google sends a push notification to this endpoint whenever new mail arrives
 * at a connected agent Gmail address. The payload contains a base64-encoded
 * JSON message with emailAddress and historyId.
 *
 * We decode it, look up which agent owns that address, and log the notification.
 * Task 2 will fetch and parse the actual emails using the Gmail History API.
 */
export function gmailWebhookRoutes(db: Db) {
  const router = Router();
  const credentials = agentCredentialService(db);

  router.post("/webhook/gmail", async (req, res) => {
    try {
      const message = req.body?.message;
      if (!message?.data) {
        res.status(200).send("OK");
        return;
      }

      const decoded = JSON.parse(
        Buffer.from(message.data, "base64").toString("utf8"),
      );
      const { emailAddress, historyId } = decoded;

      if (!emailAddress) {
        res.status(200).send("OK");
        return;
      }

      const credential = await credentials.findByGmailAddress(emailAddress);
      if (!credential) {
        console.log(`[gmail-webhook] No agent found for ${emailAddress}`);
        res.status(200).send("OK");
        return;
      }

      console.log(
        `[gmail-webhook] Notification for ${emailAddress} (agent: ${credential.agentId}), historyId: ${historyId}`,
      );

      // TODO: Fetch and parse emails (Task 2 will complete this)

      res.status(200).send("OK");
    } catch (err) {
      console.error("[gmail-webhook] Error:", err);
      res.status(200).send("OK"); // Always ack to prevent retries
    }
  });

  return router;
}
