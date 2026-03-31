/**
 * Broker Routes — Limited access for human brokers
 *
 * Brokers can only see their assigned leads, log actions, and request help.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { brokerService } from "../services/broker.js";
import { assertCompanyAccess } from "./authz.js";

export function brokerRoutes(db: Db) {
  const router = Router();
  const broker = brokerService(db);

  // List broker's assigned leads
  router.get("/companies/:companyId/broker/:brokerId/leads", async (req, res) => {
    const { companyId, brokerId } = req.params;
    assertCompanyAccess(req, companyId);

    const leads = await broker.listLeads(companyId, brokerId);
    res.json(leads);
  });

  // Get single lead detail (scoped to broker)
  router.get("/companies/:companyId/broker/:brokerId/leads/:leadId", async (req, res) => {
    const { companyId, brokerId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    const lead = await broker.getLead(companyId, brokerId, leadId);
    if (!lead) {
      res.status(404).json({ error: "Lead not found or not assigned to this broker" });
      return;
    }
    res.json(lead);
  });

  // Log a broker action (called, visited, etc.)
  router.post("/companies/:companyId/broker/:brokerId/leads/:leadId/actions", async (req, res) => {
    const { companyId, brokerId, leadId } = req.params;
    assertCompanyAccess(req, companyId);

    const { action, notes } = req.body;
    if (!action || typeof action !== "string") {
      res.status(400).json({ error: "action is required" });
      return;
    }

    const result = await broker.logAction(companyId, brokerId, leadId, action, notes);
    res.json(result);
  });

  // Request help from CEO
  router.post("/companies/:companyId/broker/:brokerId/help", async (req, res) => {
    const { companyId, brokerId } = req.params;
    assertCompanyAccess(req, companyId);

    const { title, description } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const issue = await broker.requestHelp(companyId, brokerId, title, description ?? "");
    res.json(issue);
  });

  return router;
}
