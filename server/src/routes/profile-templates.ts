/**
 * Profile Templates Routes
 *
 * Lets the UI read the available profile templates (stock + custom) and
 * apply one to an agent. The CEO wizard creates new ones via ceo-commands;
 * these REST routes handle direct UI actions (list, apply, switch).
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { profileTemplatesService } from "../services/profile-templates.js";
import { assertCompanyAccess } from "./authz.js";

export function profileTemplateRoutes(db: Db) {
  const router = Router();
  const svc = profileTemplatesService(db);

  // List templates visible to a company (stock + their own customs).
  // Optional ?role=sales filter.
  router.get("/companies/:companyId/profile-templates", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const templates = await svc.listForCompany(companyId, role);
    res.json(templates);
  });

  // Get one template
  router.get("/companies/:companyId/profile-templates/:id", async (req, res) => {
    const { companyId, id } = req.params;
    assertCompanyAccess(req, companyId);
    const template = await svc.get(companyId, id);
    if (!template) {
      res.status(404).json({ error: "Profile template not found" });
      return;
    }
    res.json(template);
  });

  // Apply (or clear) a profile on an agent
  router.post("/companies/:companyId/agents/:agentId/profile", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const templateId = (req.body?.templateId as string | null | undefined) ?? null;
    const ok = await svc.applyToAgent(companyId, agentId, templateId);
    if (!ok) {
      res.status(404).json({ error: "Template not found or not applicable" });
      return;
    }
    const active = templateId ? await svc.get(companyId, templateId) : null;
    res.json({ ok: true, profile: active });
  });

  // Read the profile currently applied to an agent
  router.get("/companies/:companyId/agents/:agentId/profile", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const profile = await svc.getForAgent(companyId, agentId);
    res.json({ profile });
  });

  return router;
}
