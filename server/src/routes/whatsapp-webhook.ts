import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { aygentWhatsappMessages } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { issueService, agentService } from "../services/index.js";
import { logActivity } from "../services/activity-log.js";
import { logger } from "../middleware/logger.js";

/**
 * WhatsApp webhook receiver for 360dialog / Meta Cloud API.
 * Mounted BEFORE auth middleware — 360dialog needs unauthenticated POST access.
 *
 * Handles:
 * 1. Inbound messages → store in DB + create Paperclip issue for agent
 * 2. Status updates (delivered, read) → update message status
 * 3. Webhook verification (GET)
 */
export function whatsappWebhookRoutes(db?: Db) {
  const router = Router();

  router.post("/webhook/whatsapp", async (req, res) => {
    // Always respond 200 quickly — 360dialog retries on failure
    res.sendStatus(200);

    const payload = req.body;
    if (!db) {
      logger.warn("whatsapp-webhook: no DB connection, logging only");
      logger.info({ payload }, "whatsapp-webhook: received");
      return;
    }

    const credSvc = agentCredentialService(db);

    // Handle status updates (delivered, read, etc.)
    if (payload.statuses) {
      for (const status of payload.statuses) {
        try {
          // Update message status in DB
          // status.id is the WhatsApp message ID, status.status is "delivered" | "read" | "failed"
          logger.info(
            { messageId: status.id, status: status.status, recipientId: status.recipient_id },
            "whatsapp-webhook: status update",
          );
          // TODO: UPDATE aygent_whatsapp_messages SET status = ... WHERE whatsapp_message_id = ...
        } catch (err) {
          logger.error({ err }, "whatsapp-webhook: failed to process status update");
        }
      }
      return;
    }

    // Handle inbound messages
    if (payload.messages) {
      const issueSvc = issueService(db);
      const agentsSvc = agentService(db);

      // Determine which agent owns the receiving number
      // The phone_number_id is in the metadata or contacts
      const phoneNumberId =
        payload.metadata?.phone_number_id ??
        payload.contacts?.[0]?.wa_id ??
        null;

      for (const msg of payload.messages) {
        const from = msg.from;
        const type = msg.type;
        const body = type === "text" ? msg.text?.body : `[${type}]`;
        const timestamp = new Date(Number(msg.timestamp) * 1000);
        const whatsappMessageId = msg.id;

        logger.info(
          { from, type, body: body?.slice(0, 100), messageId: whatsappMessageId },
          "whatsapp-webhook: inbound message",
        );

        try {
          // Resolve phone_number_id → agent via credentials
          let credential = null;
          if (phoneNumberId) {
            credential = await credSvc.findByWhatsappPhoneNumberId(phoneNumberId);
          }

          if (!credential) {
            logger.warn({ phoneNumberId, from }, "whatsapp-webhook: no agent found for phone number");
            continue;
          }

          const agent = await agentsSvc.getById(credential.agentId);
          if (!agent) continue;

          // Store message in DB
          try {
            await db.insert(aygentWhatsappMessages).values({
              companyId: agent.companyId,
              agentId: agent.id,
              chatJid: from,
              messageId: whatsappMessageId,
              fromMe: false,
              senderName: payload.contacts?.[0]?.profile?.name ?? null,
              senderPhone: from,
              content: body ?? "",
              mediaType: type !== "text" ? type : null,
              status: "received",
              timestamp,
            });
          } catch (err) {
            logger.error({ err }, "whatsapp-webhook: failed to store message");
          }

          // Create Paperclip issue for the agent to process
          const contactName = payload.contacts?.[0]?.profile?.name ?? from;
          const issue = await issueSvc.create(agent.companyId, {
            title: `WhatsApp from ${contactName}`,
            description: `Inbound WhatsApp message from +${from}:\n\n> ${body}\n\nMessage type: ${type}\nTimestamp: ${timestamp.toISOString()}`,
            status: "todo",
            priority: "high",
            assigneeAgentId: agent.id,
            originKind: "webhook",
            originId: whatsappMessageId,
          });

          // Log activity
          await logActivity(db, {
            companyId: agent.companyId,
            actorType: "system",
            actorId: "whatsapp-webhook",
            action: "lead.inbound_whatsapp",
            entityType: "issue",
            entityId: issue.id,
            agentId: agent.id,
            details: {
              from,
              contactName,
              messageType: type,
              bodyPreview: body?.slice(0, 100),
            },
          });

          logger.info(
            { issueId: issue.id, agentName: agent.name, from },
            "whatsapp-webhook: issue created for inbound message",
          );
        } catch (err) {
          logger.error({ err, from }, "whatsapp-webhook: failed to process inbound message");
        }
      }
    }
  });

  // GET for webhook verification
  router.get("/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info("whatsapp-webhook: verified");
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  });

  return router;
}
