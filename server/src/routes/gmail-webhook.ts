import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { fetchRecentEmails } from "../services/gmail-fetcher.js";
import { parsePortalEmail } from "../services/portal-email-parser.js";
import { leadIngestionService } from "../services/lead-ingestion.js";

/**
 * Gmail Pub/Sub webhook receiver.
 * Mounted BEFORE auth middleware — Google Cloud Pub/Sub needs unauthenticated POST access.
 *
 * Google sends a push notification to this endpoint whenever new mail arrives
 * at a connected agent Gmail address. The payload contains a base64-encoded
 * JSON message with emailAddress and historyId.
 *
 * On each notification:
 *  1. Identify which agent owns the address
 *  2. Fetch recent unread emails via Gmail API
 *  3. Parse each email for portal lead notifications (PF / Bayut / Dubizzle)
 *  4. Ingest parsed leads → aygent_leads + Paperclip issue for Lead Agent
 */
export function gmailWebhookRoutes(db: Db) {
  const router = Router();
  const credentials = agentCredentialService(db);
  const ingestion = leadIngestionService(db);

  router.post("/webhook/gmail", async (req, res) => {
    // Always ack immediately — Pub/Sub retries on non-200
    res.status(200).send("OK");

    try {
      const message = req.body?.message;
      if (!message?.data) return;

      const decoded = JSON.parse(
        Buffer.from(message.data, "base64").toString("utf8"),
      );
      const { emailAddress, historyId } = decoded;

      if (!emailAddress) return;

      const credential = await credentials.findByGmailAddress(emailAddress);
      if (!credential) {
        console.log(`[gmail-webhook] No agent found for ${emailAddress}`);
        return;
      }

      if (!credential.accessToken) {
        console.warn(`[gmail-webhook] No access token for ${emailAddress} — skipping`);
        return;
      }

      console.log(
        `[gmail-webhook] Notification for ${emailAddress} (agent: ${credential.agentId}), historyId: ${historyId}`,
      );

      // Fetch recent unread emails
      const emails = await fetchRecentEmails(credential.accessToken);
      console.log(`[gmail-webhook] Fetched ${emails.length} unread emails for ${emailAddress}`);

      let ingested = 0;
      let skipped = 0;

      for (const email of emails) {
        // Attempt to parse as a portal lead notification
        const parsed = parsePortalEmail(email.from, email.subject, email.body);
        if (!parsed) {
          skipped++;
          continue;
        }

        console.log(
          `[gmail-webhook] Portal lead detected — source: ${parsed.source}, name: ${parsed.name ?? "unknown"}, phone: ${parsed.phone ?? "none"}`,
        );

        const result = await ingestion.ingestFromPortal(
          credential.companyId,
          credential.agentId,
          parsed,
        );

        if (result) {
          ingested++;
        } else {
          skipped++; // duplicate
        }
      }

      console.log(
        `[gmail-webhook] Done — ${ingested} leads ingested, ${skipped} skipped (non-portal or duplicate)`,
      );
    } catch (err) {
      console.error("[gmail-webhook] Error:", err);
    }
  });

  return router;
}
