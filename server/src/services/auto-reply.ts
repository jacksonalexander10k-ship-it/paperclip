/**
 * Auto-Reply Service
 *
 * Two parts:
 * 1. enqueue() — called from webhooks when a new lead arrives.
 *    Looks up the auto-reply rule for the lead source, merges template variables,
 *    and inserts into the queue with sendAt = now + delay.
 *
 * 2. processQueue() — called from a background interval (every 10 seconds).
 *    Finds queue entries where sendAt has passed, sends the message via
 *    the approval executor's WhatsApp/email infrastructure, and marks as sent.
 */

import { and, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  aygentAutoReplyQueue,
  aygentAutoReplyRules,
  aygentWhatsappTemplates,
  aygentWhatsappMessages,
} from "@paperclipai/db";
import { agentCredentialService } from "./agent-credentials.js";
import { baileysSessionManager } from "./baileys-session-manager.js";
import { logger } from "../middleware/logger.js";

const MAX_ATTEMPTS = 3;

export function autoReplyService(db: Db) {
  const credSvc = agentCredentialService(db);

  /**
   * Enqueue an auto-reply for a newly arrived lead.
   * Returns the queue entry ID if enqueued, null if no matching rule.
   */
  async function enqueue(opts: {
    companyId: string;
    agentId: string;
    leadId?: string;
    leadSource: string;
    recipientPhone?: string;
    recipientEmail?: string;
    leadName?: string;
    agentName?: string;
    companyName?: string;
    /** Extra context for template variable merging */
    context?: Record<string, string>;
  }): Promise<string | null> {
    // Look up auto-reply rule for this lead source
    const [rule] = await db
      .select()
      .from(aygentAutoReplyRules)
      .where(
        and(
          eq(aygentAutoReplyRules.companyId, opts.companyId),
          eq(aygentAutoReplyRules.leadSource, opts.leadSource),
          eq(aygentAutoReplyRules.enabled, "true"),
        ),
      )
      .limit(1);

    if (!rule) {
      logger.debug({ leadSource: opts.leadSource, companyId: opts.companyId }, "auto-reply: no rule for lead source");
      return null;
    }

    // Determine recipient and channel
    const channel = rule.replyChannel;
    let recipient: string | null = null;
    if (channel === "whatsapp") {
      recipient = opts.recipientPhone ?? null;
    } else if (channel === "email") {
      recipient = opts.recipientEmail ?? null;
    }

    if (!recipient) {
      logger.warn({ leadSource: opts.leadSource, channel }, "auto-reply: no recipient for channel");
      return null;
    }

    // Resolve message content
    let messageContent: string | null = rule.fixedMessage;
    if (!messageContent && rule.templateId) {
      // Load template and merge variables
      const [template] = await db
        .select()
        .from(aygentWhatsappTemplates)
        .where(eq(aygentWhatsappTemplates.id, rule.templateId))
        .limit(1);

      if (template?.content) {
        messageContent = template.content;
        // Merge standard variables
        const vars: Record<string, string> = {
          lead_name: opts.leadName ?? "",
          client_name: opts.leadName ?? "",
          agent_name: opts.agentName ?? "",
          company_name: opts.companyName ?? "",
          ...(opts.context ?? {}),
        };
        for (const [key, value] of Object.entries(vars)) {
          messageContent = messageContent!.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), value);
        }

        // Increment template usage count
        await db
          .update(aygentWhatsappTemplates)
          .set({ usageCount: sql`${aygentWhatsappTemplates.usageCount} + 1` })
          .where(eq(aygentWhatsappTemplates.id, rule.templateId!));
      }
    }

    if (!messageContent) {
      logger.warn({ leadSource: opts.leadSource, ruleId: rule.id }, "auto-reply: no message content resolved");
      return null;
    }

    // Enqueue with delay
    const sendAt = new Date(Date.now() + rule.delaySecs * 1000);
    const [entry] = await db
      .insert(aygentAutoReplyQueue)
      .values({
        companyId: opts.companyId,
        agentId: opts.agentId,
        leadId: opts.leadId ?? null,
        channel,
        recipient,
        templateId: rule.templateId ?? null,
        messageContent,
        emailSubject: rule.emailSubject ?? null,
        leadSource: opts.leadSource,
        sendAt,
        status: "pending",
      })
      .returning();

    logger.info(
      {
        queueId: entry.id,
        leadSource: opts.leadSource,
        channel,
        recipient,
        delaySecs: rule.delaySecs,
        sendAt: sendAt.toISOString(),
      },
      "auto-reply: enqueued",
    );

    return entry.id;
  }

  /**
   * Process the queue — send any messages where sendAt has passed.
   * Called from a background interval (every 10 seconds).
   */
  async function processQueue(): Promise<number> {
    const now = new Date();

    // Atomically claim pending entries that are due
    const pending = await db
      .select()
      .from(aygentAutoReplyQueue)
      .where(
        and(
          eq(aygentAutoReplyQueue.status, "pending"),
          lte(aygentAutoReplyQueue.sendAt, now),
        ),
      )
      .limit(20);

    if (pending.length === 0) return 0;

    let sent = 0;
    for (const entry of pending) {
      try {
        // Mark as processing to prevent double-send
        await db
          .update(aygentAutoReplyQueue)
          .set({ status: "processing", attempts: entry.attempts + 1 })
          .where(
            and(
              eq(aygentAutoReplyQueue.id, entry.id),
              eq(aygentAutoReplyQueue.status, "pending"),
            ),
          );

        if (entry.channel === "whatsapp") {
          await sendWhatsApp(entry);
        } else if (entry.channel === "email") {
          await sendEmail(entry);
        }

        await db
          .update(aygentAutoReplyQueue)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(aygentAutoReplyQueue.id, entry.id));

        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const newAttempts = entry.attempts + 1;
        const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

        await db
          .update(aygentAutoReplyQueue)
          .set({ status: newStatus, error: msg, attempts: newAttempts })
          .where(eq(aygentAutoReplyQueue.id, entry.id));

        logger.error(
          { err, queueId: entry.id, attempts: newAttempts },
          "auto-reply: send failed",
        );
      }
    }

    if (sent > 0) {
      logger.info({ sent, total: pending.length }, "auto-reply: queue processed");
    }
    return sent;
  }

  async function sendWhatsApp(entry: typeof aygentAutoReplyQueue.$inferSelect): Promise<void> {
    const phone = entry.recipient.replace(/\+/g, "");
    const message = entry.messageContent ?? "";
    if (!phone || !message) throw new Error("Missing phone or message");

    // Try Baileys first (free)
    const baileysCred = await credSvc.getByAgentAndService(entry.agentId, "whatsapp_baileys");
    if (baileysCred && baileysSessionManager.isConnected(entry.agentId)) {
      const result = await baileysSessionManager.sendMessage(entry.agentId, phone, message);
      if (!result.success) throw new Error(result.error ?? "Baileys send failed");

      await storeOutboundMessage(entry, phone, message, result.messageId);
      return;
    }

    // Fallback: 360dialog
    const cred = await credSvc.getByAgentAndService(entry.agentId, "whatsapp");
    if (!cred?.accessToken) {
      throw new Error("No WhatsApp credentials for agent");
    }

    const res = await fetch("https://waba.360dialog.io/v1/messages", {
      method: "POST",
      headers: {
        "D360-API-KEY": cred.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        type: "text",
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`360dialog error ${res.status}: ${body}`);
    }

    await storeOutboundMessage(entry, phone, message, null);
  }

  async function sendEmail(entry: typeof aygentAutoReplyQueue.$inferSelect): Promise<void> {
    const to = entry.recipient;
    const subject = entry.emailSubject ?? "Re: Your enquiry";
    const body = entry.messageContent ?? "";

    const cred = await credSvc.getByAgentAndService(entry.agentId, "gmail");
    if (!cred?.accessToken) {
      throw new Error("No Gmail credentials for agent");
    }

    const fromAddress = cred.gmailAddress ?? "me";
    const rawMessage = [
      `From: ${fromAddress}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      "",
      body,
    ].join("\r\n");

    const encoded = Buffer.from(rawMessage).toString("base64url");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error ${res.status}: ${errBody}`);
    }
  }

  async function storeOutboundMessage(
    entry: typeof aygentAutoReplyQueue.$inferSelect,
    phone: string,
    message: string,
    messageId: string | null | undefined,
  ): Promise<void> {
    try {
      await db.insert(aygentWhatsappMessages).values({
        companyId: entry.companyId,
        agentId: entry.agentId,
        leadId: entry.leadId ?? undefined,
        chatJid: phone,
        messageId: messageId ?? `auto-reply-${entry.id}-${Date.now()}`,
        fromMe: true,
        senderName: "Agent",
        content: message,
        status: "sent",
        timestamp: new Date(),
      });
    } catch (err) {
      logger.warn({ err, queueId: entry.id }, "auto-reply: failed to store outbound message");
    }
  }

  return { enqueue, processQueue };
}
