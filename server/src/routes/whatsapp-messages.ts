/**
 * WhatsApp Messages Routes (authenticated)
 *
 * Provides read access to stored WhatsApp message history for the UI.
 * Mounted under the authenticated API router.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { aygentWhatsappMessages, aygentWhatsappWindows } from "@paperclipai/db";
import { and, eq, asc } from "drizzle-orm";
import { assertCompanyAccess } from "./authz.js";

export function whatsappMessageRoutes(db: Db) {
  const router = Router();

  /**
   * List WhatsApp messages for a specific chat conversation.
   *
   * GET /companies/:companyId/whatsapp/messages?chatJid=phone&agentId=uuid
   */
  router.get("/companies/:companyId/whatsapp/messages", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { chatJid, agentId } = req.query;

    if (!chatJid || typeof chatJid !== "string") {
      res.status(400).json({ error: "chatJid query param is required" });
      return;
    }

    const conditions = [
      eq(aygentWhatsappMessages.companyId, companyId),
      eq(aygentWhatsappMessages.chatJid, chatJid),
    ];

    if (agentId && typeof agentId === "string") {
      conditions.push(eq(aygentWhatsappMessages.agentId, agentId));
    }

    const messages = await db
      .select()
      .from(aygentWhatsappMessages)
      .where(and(...conditions))
      .orderBy(asc(aygentWhatsappMessages.timestamp));

    res.json(messages);
  });

  /**
   * Get WhatsApp 24-hour window status for a chat.
   * Stub — returns open:true until window tracking is implemented in Task 5.
   *
   * GET /companies/:companyId/whatsapp/window-status?chatJid=phone&agentId=uuid
   */
  router.get("/companies/:companyId/whatsapp/window-status", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { chatJid, agentId } = req.query;

    if (!chatJid || typeof chatJid !== "string") {
      res.status(400).json({ error: "chatJid query param is required" });
      return;
    }

    const conditions: ReturnType<typeof eq>[] = [
      eq(aygentWhatsappWindows.companyId, companyId),
      eq(aygentWhatsappWindows.chatJid, chatJid),
    ];

    if (agentId && typeof agentId === "string") {
      conditions.push(eq(aygentWhatsappWindows.agentId, agentId));
    }

    const windowRows = await db
      .select()
      .from(aygentWhatsappWindows)
      .where(and(...conditions))
      .limit(1);

    const window = windowRows[0];
    const open = window ? new Date(window.windowExpiresAt) > new Date() : false;

    res.json({
      open,
      expiresAt: window?.windowExpiresAt ?? null,
      openedAt: window?.windowOpenedAt ?? null,
    });
  });

  return router;
}
