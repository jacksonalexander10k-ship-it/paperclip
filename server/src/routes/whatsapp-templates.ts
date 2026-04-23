/**
 * WhatsApp Templates Routes — CRUD for aygent_whatsapp_templates
 */

import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentWhatsappTemplates } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { assertCompanyAccess } from "./authz.js";

export function whatsappTemplateRoutes(db: Db) {
  const router = Router();

  // List templates for a company (optionally filtered by category)
  router.get("/companies/:companyId/whatsapp-templates", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { category } = req.query;
    const conditions = [eq(aygentWhatsappTemplates.companyId, companyId)];
    if (category && typeof category === "string") {
      conditions.push(eq(aygentWhatsappTemplates.category, category));
    }

    const items = await db
      .select()
      .from(aygentWhatsappTemplates)
      .where(and(...conditions))
      .orderBy(desc(aygentWhatsappTemplates.isDefault), desc(aygentWhatsappTemplates.updatedAt));

    res.json(items);
  });

  // Get one
  router.get("/companies/:companyId/whatsapp-templates/:templateId", async (req, res) => {
    const { companyId, templateId } = req.params;
    assertCompanyAccess(req, companyId);

    const [tpl] = await db
      .select()
      .from(aygentWhatsappTemplates)
      .where(
        and(
          eq(aygentWhatsappTemplates.companyId, companyId),
          eq(aygentWhatsappTemplates.id, templateId),
        ),
      )
      .limit(1);

    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(tpl);
  });

  // Create
  router.post("/companies/:companyId/whatsapp-templates", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { name, category, content, isDefault } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    try {
      const [tpl] = await db
        .insert(aygentWhatsappTemplates)
        .values({
          companyId,
          name,
          category: category ?? null,
          content,
          isDefault: Boolean(isDefault),
        })
        .returning();
      res.status(201).json(tpl);
    } catch (err) {
      logger.error({ err }, "whatsapp-templates: create failed");
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Update
  router.put("/companies/:companyId/whatsapp-templates/:templateId", async (req, res) => {
    const { companyId, templateId } = req.params;
    assertCompanyAccess(req, companyId);

    const { name, category, content, isDefault } = req.body ?? {};
    try {
      const [tpl] = await db
        .update(aygentWhatsappTemplates)
        .set({
          ...(name !== undefined && { name }),
          ...(category !== undefined && { category }),
          ...(content !== undefined && { content }),
          ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aygentWhatsappTemplates.companyId, companyId),
            eq(aygentWhatsappTemplates.id, templateId),
          ),
        )
        .returning();

      if (!tpl) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      res.json(tpl);
    } catch (err) {
      logger.error({ err }, "whatsapp-templates: update failed");
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete
  router.delete("/companies/:companyId/whatsapp-templates/:templateId", async (req, res) => {
    const { companyId, templateId } = req.params;
    assertCompanyAccess(req, companyId);

    try {
      const [tpl] = await db
        .delete(aygentWhatsappTemplates)
        .where(
          and(
            eq(aygentWhatsappTemplates.companyId, companyId),
            eq(aygentWhatsappTemplates.id, templateId),
          ),
        )
        .returning();

      if (!tpl) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      res.json({ deleted: true, id: tpl.id });
    } catch (err) {
      logger.error({ err }, "whatsapp-templates: delete failed");
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  return router;
}
