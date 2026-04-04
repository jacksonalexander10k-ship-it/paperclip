import { createHmac } from "node:crypto";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { aygentWhatsappMessages, aygentWhatsappWindows } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { agentCredentialService } from "../services/agent-credentials.js";
import { issueService, agentService } from "../services/index.js";
import { autoReplyService } from "../services/auto-reply.js";
import { logActivity } from "../services/activity-log.js";
import { logger } from "../middleware/logger.js";

// ── Prompt injection sanitization ────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|context)/i,
  /you\s+are\s+now/i,
  /^(system|assistant|user)\s*:/im,
  /^#+\s*(system|instructions|override)/im,
  /(IMPORTANT|CRITICAL|OVERRIDE)\s*:/,
];

function sanitizeInboundMessage(raw: string): { clean: string; flagged: boolean; flagCount: number } {
  let clean = raw
    .replace(/<!--[\s\S]*?-->/g, "")                    // HTML comments
    .replace(/<[^>]*>/g, "")                             // HTML tags
    .replace(/[\u200B-\u200D\uFEFF\u2060-\u2064]/g, "") // zero-width chars
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")       // bidi overrides
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, "[removed]") // base64 payloads
    .trim();

  const flags = INJECTION_PATTERNS.filter((p) => p.test(clean));
  return { clean, flagged: flags.length >= 2, flagCount: flags.length };
}

// ── Signature verification ───────────────────────────────────────────
function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace("sha256=", "");
  // Constant-time comparison via buffer equality
  if (expected.length !== provided.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && createHmac("sha256", "cmp").update(a).digest().equals(createHmac("sha256", "cmp").update(b).digest());
}

/**
 * WhatsApp webhook receiver for 360dialog / Meta Cloud API.
 * Mounted BEFORE auth middleware — 360dialog needs unauthenticated POST access.
 *
 * Handles:
 * 1. Inbound messages → store in DB + create Paperclip issue for agent
 * 2. Status updates (delivered, read) → update message status
 * 3. Webhook verification (GET)
 */
// Module-level wakeup ref — set from index.ts after heartbeat service is created
let _heartbeatWakeup: ((agentId: string, opts?: Record<string, unknown>) => Promise<unknown>) | null = null;
export function setWebhookWakeup(fn: (agentId: string, opts?: Record<string, unknown>) => Promise<unknown>) {
  _heartbeatWakeup = fn;
}

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

    // Verify Meta webhook signature if app secret is configured
    const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const sig = req.headers["x-hub-signature-256"] as string | undefined;
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (rawBody && !verifyWebhookSignature(rawBody, sig, appSecret)) {
        logger.warn({ sig }, "whatsapp-webhook: invalid signature, dropping payload");
        return;
      }
    }

    const credSvc = agentCredentialService(db);

    // Handle status updates (delivered, read, etc.)
    if (payload.statuses) {
      for (const status of payload.statuses) {
        try {
          const waMessageId = String(status.id ?? "");
          const newStatus = String(status.status ?? "");
          if (waMessageId && newStatus) {
            await db
              .update(aygentWhatsappMessages)
              .set({ status: newStatus })
              .where(eq(aygentWhatsappMessages.messageId, waMessageId));
          }
          logger.info(
            { messageId: waMessageId, status: newStatus, recipientId: status.recipient_id },
            "whatsapp-webhook: status update",
          );
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
        const rawBody = type === "text" ? msg.text?.body : `[${type}]`;
        const timestamp = new Date(Number(msg.timestamp) * 1000);
        const whatsappMessageId = msg.id;

        // Sanitize inbound message content against prompt injection
        const { clean: body, flagged, flagCount } = sanitizeInboundMessage(rawBody ?? "");
        if (flagged) {
          logger.warn(
            { from, flagCount, rawPreview: rawBody?.slice(0, 200) },
            "whatsapp-webhook: potential prompt injection detected — message flagged",
          );
        }

        logger.info(
          { from, type, body: body?.slice(0, 100), messageId: whatsappMessageId, flagged },
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

          // Upsert 24-hour messaging window — lead replied, window resets
          try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            await db
              .insert(aygentWhatsappWindows)
              .values({
                companyId: agent.companyId,
                agentId: agent.id,
                chatJid: from,
                windowOpenedAt: now,
                windowExpiresAt: expiresAt,
              })
              .onConflictDoUpdate({
                target: [aygentWhatsappWindows.agentId, aygentWhatsappWindows.chatJid],
                set: { windowOpenedAt: now, windowExpiresAt: expiresAt },
              });
          } catch (err) {
            logger.error({ err }, "whatsapp-webhook: failed to upsert 24h window");
          }

          // Create Paperclip issue for the agent to process
          const contactName = payload.contacts?.[0]?.profile?.name ?? from;
          const flagPrefix = flagged ? "[FLAGGED: potential prompt injection] " : "";
          const issue = await issueSvc.create(agent.companyId, {
            title: `WhatsApp from ${contactName}`,
            description: `${flagPrefix}Inbound WhatsApp message from +${from}:\n\n> ${body}\n\nMessage type: ${type}\nTimestamp: ${timestamp.toISOString()}`,
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

          // Immediately wake the agent (don't wait for next heartbeat)
          if (_heartbeatWakeup) {
            try {
              await _heartbeatWakeup(agent.id, {
                source: "webhook",
                triggerDetail: `whatsapp_inbound:${from}`,
                issueId: issue.id,
              });
              logger.info({ agentId: agent.id }, "whatsapp-webhook: agent wake-up triggered");
            } catch (wakeErr) {
              logger.warn({ wakeErr, agentId: agent.id }, "whatsapp-webhook: agent wake-up failed (will run on next heartbeat)");
            }
          }

          // Enqueue delayed auto-reply (if a rule exists for "whatsapp" leads)
          try {
            const autoReply = autoReplyService(db);
            await autoReply.enqueue({
              companyId: agent.companyId,
              agentId: agent.id,
              leadSource: "whatsapp",
              recipientPhone: from,
              leadName: payload.contacts?.[0]?.profile?.name ?? undefined,
              agentName: agent.name,
            });
          } catch (arErr) {
            logger.warn({ arErr, from }, "whatsapp-webhook: auto-reply enqueue failed");
          }
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
