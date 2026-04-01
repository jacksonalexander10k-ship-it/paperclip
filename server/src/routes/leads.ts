/**
 * Leads Routes — Full CRUD for aygent_leads
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { leadService } from "../services/leads.js";
import { assertCompanyAccess } from "./authz.js";

export function leadRoutes(db: Db) {
  const router = Router();
  const leads = leadService(db);

  // List leads with optional filters
  router.get("/companies/:companyId/leads", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { source, stage, scoreMin, scoreMax, search } = req.query;

    const items = await leads.list(companyId, {
      source: source as string | undefined,
      stage: stage as string | undefined,
      scoreMin: scoreMin !== undefined ? Number(scoreMin) : undefined,
      scoreMax: scoreMax !== undefined ? Number(scoreMax) : undefined,
      search: search as string | undefined,
    });

    res.json(items);
  });

  // Get single lead
  router.get("/companies/:companyId/leads/:leadId", async (req, res) => {
    const { companyId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    const lead = await leads.getById(companyId, leadId);
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  });

  // Create lead
  router.post("/companies/:companyId/leads", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { name, ...rest } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const lead = await leads.create(companyId, { name, ...rest });
    res.status(201).json(lead);
  });

  // Update lead (partial)
  router.patch("/companies/:companyId/leads/:leadId", async (req, res) => {
    const { companyId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    const lead = await leads.update(companyId, leadId, req.body);
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  });

  // Soft delete lead (set stage to "archived")
  router.delete("/companies/:companyId/leads/:leadId", async (req, res) => {
    const { companyId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    const lead = await leads.remove(companyId, leadId);
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  });

  return router;
}
