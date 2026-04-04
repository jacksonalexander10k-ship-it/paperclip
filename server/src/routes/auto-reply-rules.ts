/**
 * Auto-Reply Rules Routes
 *
 * CRUD for aygent_auto_reply_rules — per-company mapping of lead source → auto-reply template.
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAutoReplyRules } from "@paperclipai/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { logger } from "../middleware/logger.js";

export function autoReplyRulesRoutes(db: Db) {
  const router = Router();

  // List all rules for a company
  router.get("/companies/:companyId/auto-reply-rules", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const rules = await db
      .select()
      .from(aygentAutoReplyRules)
      .where(eq(aygentAutoReplyRules.companyId, companyId));

    res.json(rules);
  });

  // Create a new rule
  router.post("/companies/:companyId/auto-reply-rules", async (req, res) => {
    const { companyId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const { leadSource, replyChannel, templateId, fixedMessage, emailSubject, delaySecs, enabled } = req.body;

    if (!leadSource || typeof leadSource !== "string") {
      res.status(400).json({ error: "leadSource is required" });
      return;
    }

    try {
      const [rule] = await db
        .insert(aygentAutoReplyRules)
        .values({
          companyId,
          leadSource,
          replyChannel: replyChannel ?? "whatsapp",
          templateId: templateId ?? null,
          fixedMessage: fixedMessage ?? null,
          emailSubject: emailSubject ?? null,
          delaySecs: delaySecs ?? 60,
          enabled: enabled ?? "true",
        })
        .returning();

      res.status(201).json(rule);
    } catch (err) {
      logger.error({ err }, "auto-reply-rules: failed to create rule");
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  // Update a rule
  router.put("/companies/:companyId/auto-reply-rules/:ruleId", async (req, res) => {
    const { companyId, ruleId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const { leadSource, replyChannel, templateId, fixedMessage, emailSubject, delaySecs, enabled } = req.body;

    try {
      const [updated] = await db
        .update(aygentAutoReplyRules)
        .set({
          ...(leadSource !== undefined && { leadSource }),
          ...(replyChannel !== undefined && { replyChannel }),
          ...(templateId !== undefined && { templateId }),
          ...(fixedMessage !== undefined && { fixedMessage }),
          ...(emailSubject !== undefined && { emailSubject }),
          ...(delaySecs !== undefined && { delaySecs }),
          ...(enabled !== undefined && { enabled }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aygentAutoReplyRules.id, ruleId),
            eq(aygentAutoReplyRules.companyId, companyId),
          ),
        )
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      res.json(updated);
    } catch (err) {
      logger.error({ err }, "auto-reply-rules: failed to update rule");
      res.status(500).json({ error: "Failed to update rule" });
    }
  });

  // Delete a rule
  router.delete("/companies/:companyId/auto-reply-rules/:ruleId", async (req, res) => {
    const { companyId, ruleId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    try {
      const [deleted] = await db
        .delete(aygentAutoReplyRules)
        .where(
          and(
            eq(aygentAutoReplyRules.id, ruleId),
            eq(aygentAutoReplyRules.companyId, companyId),
          ),
        )
        .returning();

      if (!deleted) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      res.json(deleted);
    } catch (err) {
      logger.error({ err }, "auto-reply-rules: failed to delete rule");
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  return router;
}
