/**
 * Properties Routes — CRUD for properties, lead linking, and pipeline filters
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { propertyService } from "../services/properties.js";
import { assertCompanyAccess } from "./authz.js";

export function propertyRoutes(db: Db) {
  const router = Router();
  const svc = propertyService(db);

  // List properties with optional filters
  router.get("/companies/:companyId/properties", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { listingType, pipelineStatus, area, bedrooms, propertyType, priceMin, priceMax } =
      req.query as Record<string, string | undefined>;

    const filters = {
      listingType,
      pipelineStatus,
      area,
      bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
      propertyType,
      priceMin: priceMin !== undefined ? Number(priceMin) : undefined,
      priceMax: priceMax !== undefined ? Number(priceMax) : undefined,
    };

    const result = await svc.list(companyId, filters);
    res.json(result);
  });

  // Get single property by ID
  router.get("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.getById(companyId, propertyId);
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json(property);
  });

  // Create a property
  router.post("/companies/:companyId/properties", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.create(companyId, req.body);
    res.status(201).json(property);
  });

  // Update a property
  router.patch("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.update(companyId, propertyId, req.body);
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json(property);
  });

  // Soft delete a property
  router.delete("/companies/:companyId/properties/:propertyId", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const property = await svc.remove(companyId, propertyId);
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    res.json(property);
  });

  // List leads linked to a property
  router.get("/companies/:companyId/properties/:propertyId/leads", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const leads = await svc.listPropertyLeads(companyId, propertyId);
    res.json(leads);
  });

  // Link a lead to a property
  router.post("/companies/:companyId/properties/:propertyId/leads", async (req, res) => {
    const { companyId, propertyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { leadId, interestLevel } = req.body;
    if (!leadId || typeof leadId !== "string") {
      res.status(400).json({ error: "leadId is required" });
      return;
    }

    const link = await svc.linkLead(companyId, propertyId, leadId, interestLevel);
    res.status(201).json(link);
  });

  // Unlink a lead from a property
  router.delete(
    "/companies/:companyId/properties/:propertyId/leads/:leadId",
    async (req, res) => {
      const { companyId, propertyId, leadId } = req.params;
      assertCompanyAccess(req, companyId);

      const result = await svc.unlinkLead(companyId, propertyId, leadId);
      res.json(result);
    },
  );

  return router;
}
