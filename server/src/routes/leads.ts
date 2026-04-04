/**
 * Leads Routes — Full CRUD for aygent_leads + CSV import
 */

import { Router } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import { leadService } from "../services/leads.js";
import { assertCompanyAccess } from "./authz.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/** Minimal CSV parser — handles quoted fields, commas inside quotes, newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field.trim());
        field = "";
        if (current.some((c) => c !== "")) lines.push(current);
        current = [];
        if (ch === "\r") i++;
      } else {
        field += ch;
      }
    }
  }
  // last field
  current.push(field.trim());
  if (current.some((c) => c !== "")) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = lines[i][j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

export function leadRoutes(db: Db) {
  const router = Router();
  const leads = leadService(db);

  // CSV import — must be registered before the :leadId param route
  router.post(
    "/companies/:companyId/leads/import-csv",
    upload.single("file"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const text = file.buffer.toString("utf-8");
      const rows = parseCsv(text);

      if (rows.length === 0) {
        res.status(400).json({ error: "CSV is empty or has no data rows" });
        return;
      }

      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.name || row.full_name || row.lead_name;
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }

        try {
          await leads.create(companyId, {
            name,
            phone: row.phone || row.mobile || row.telephone || undefined,
            email: row.email || row.email_address || undefined,
            source: row.source || "csv_import",
            nationality: row.nationality || undefined,
            propertyType: row.property_type || undefined,
            timeline: row.timeline || undefined,
            notes: row.notes || undefined,
            score: row.score ? Math.min(10, Math.max(0, Number(row.score) || 0)) : 0,
            language: row.language || undefined,
          });
          imported++;
        } catch (err) {
          errors.push(`Row ${i + 2}: ${(err as Error).message}`);
        }
      }

      res.json({ imported, errors });
    },
  );

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
