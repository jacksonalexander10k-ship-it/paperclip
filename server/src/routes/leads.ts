/**
 * Leads Routes — Full CRUD for aygent_leads + CSV import
 */

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import { leadService, type LeadFilters } from "../services/leads.js";
import { startOutreachForAssignedLead, findTemplateByName } from "../services/outreach.js";
import { getRole } from "../services/agent-roles.js";
import { logger } from "../middleware/logger.js";
import { assertCompanyAccess } from "./authz.js";

/**
 * Zod schema for creating/updating a lead.
 * Email must be a valid email OR null/undefined — bare strings like "JOHN" are rejected.
 */
const leadEmailSchema = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null ? undefined : v));

const leadCreateSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    email: leadEmailSchema,
  })
  .passthrough();

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
          const rawEmail = row.email || row.email_address || undefined;
          const parsed = leadCreateSchema.safeParse({ name, email: rawEmail });
          if (!parsed.success) {
            const msg = parsed.error.issues.map((iss) => iss.message).join("; ");
            errors.push(`Row ${i + 2}: ${msg}`);
            continue;
          }
          await leads.create(companyId, {
            name,
            phone: row.phone || row.mobile || row.telephone || undefined,
            email: parsed.data.email,
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

    const { source, stage, scoreMin, scoreMax, search, assigned } = req.query;

    const items = await leads.list(companyId, {
      source: source as string | undefined,
      stage: stage as string | undefined,
      scoreMin: scoreMin !== undefined ? Number(scoreMin) : undefined,
      scoreMax: scoreMax !== undefined ? Number(scoreMax) : undefined,
      search: search as string | undefined,
      assigned: assigned as LeadFilters["assigned"],
    });

    res.json(items);
  });

  // Bulk actions on leads
  // body: { leadIds: string[], action: "assign" | "unassign" | "archive" | "set_stage" | "start_outreach", params?: {...} }
  router.post("/companies/:companyId/leads/bulk", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { leadIds, action, params } = req.body ?? {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: "leadIds must be a non-empty array" });
      return;
    }
    if (!action || typeof action !== "string") {
      res.status(400).json({ error: "action is required" });
      return;
    }

    try {
      if (action === "assign") {
        const agentId = params?.agentId;
        if (!agentId || typeof agentId !== "string") {
          res.status(400).json({ error: "params.agentId is required for assign" });
          return;
        }
        const [agentRow] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
        if (!agentRow) {
          res.status(404).json({ error: "Agent not found in this company" });
          return;
        }
        const count = await leads.bulkAssign(companyId, leadIds, agentId);
        res.json({ action, updated: count, agentId });
        return;
      }

      if (action === "unassign") {
        const count = await leads.bulkAssign(companyId, leadIds, null);
        res.json({ action, updated: count });
        return;
      }

      if (action === "archive") {
        const count = await leads.bulkArchive(companyId, leadIds);
        res.json({ action: "archive", updated: count });
        return;
      }

      if (action === "delete") {
        const count = await leads.bulkHardDelete(companyId, leadIds);
        res.json({ action: "delete", deleted: count });
        return;
      }

      if (action === "set_stage") {
        const stage = params?.stage;
        if (!stage || typeof stage !== "string") {
          res.status(400).json({ error: "params.stage is required for set_stage" });
          return;
        }
        const count = await leads.bulkSetStage(companyId, leadIds, stage);
        res.json({ action, updated: count, stage });
        return;
      }

      if (action === "start_outreach") {
        let templateId = typeof params?.templateId === "string" ? params.templateId : undefined;
        const templateName = typeof params?.templateName === "string" ? params.templateName : undefined;
        const customMessage = typeof params?.customMessage === "string" ? params.customMessage : undefined;
        const delaySecs = typeof params?.delaySecs === "number" ? params.delaySecs : undefined;

        // Resolve templateName → templateId if given
        if (!templateId && templateName) {
          const found = await findTemplateByName(db, companyId, templateName);
          if (!found) {
            res.status(400).json({ error: `Template "${templateName}" not found` });
            return;
          }
          templateId = found.id;
        }

        // Pre-fetch assigned agents to enforce sales-only outreach
        const rows = await leads.getMany(companyId, leadIds);
        const assignedAgentIds = Array.from(new Set(rows.map((l) => l.agentId).filter((x): x is string => Boolean(x))));
        const assignedAgents = assignedAgentIds.length
          ? await db.select().from(agents).where(and(eq(agents.companyId, companyId), inArray(agents.id, assignedAgentIds)))
          : [];
        const agentRoleById = new Map(assignedAgents.map((a) => [a.id, a.role]));
        const nonSalesAgents = assignedAgents.filter((a) => a.role !== "sales");
        if (nonSalesAgents.length > 0) {
          const list = nonSalesAgents.map((a) => `${a.name} (${getRole(a.role)?.title ?? a.role})`).join(", ");
          res.status(400).json({
            error: `Only Sales Agents can do outreach. Reassign these leads to a Sales Agent first: ${list}`,
            nonSalesAgents: nonSalesAgents.map((a) => ({ id: a.id, name: a.name, role: a.role })),
          });
          return;
        }

        const results: Array<{ leadId: string; enqueued: boolean; reason?: string }> = [];
        for (const lead of rows) {
          if (!lead.agentId) {
            results.push({ leadId: lead.id, enqueued: false, reason: "unassigned" });
            continue;
          }
          if (agentRoleById.get(lead.agentId) !== "sales") {
            results.push({ leadId: lead.id, enqueued: false, reason: "agent_not_sales" });
            continue;
          }
          if (!lead.phone) {
            results.push({ leadId: lead.id, enqueued: false, reason: "no_phone" });
            continue;
          }
          const ft = await startOutreachForAssignedLead(
            db,
            companyId,
            {
              id: lead.id,
              name: lead.name,
              phone: lead.phone,
              email: lead.email ?? null,
              source: lead.source ?? "manual",
              agentId: lead.agentId,
            },
            { templateId, customMessage, delaySecs },
          );
          results.push({ leadId: lead.id, enqueued: ft.enqueued, reason: ft.reason });
        }
        res.json({ action, results });
        return;
      }

      res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err) {
      logger.error({ err, action }, "leads-bulk: failed");
      res.status(500).json({ error: "Bulk action failed" });
    }
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

    const parsed = leadCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first?.path?.join(".") ?? "body";
      res.status(400).json({
        error: `Invalid ${field}: ${first?.message ?? "validation failed"}`,
        issues: parsed.error.issues,
      });
      return;
    }

    const { name, email, ...rest } = parsed.data as Record<string, unknown> & {
      name: string;
      email?: string;
    };
    const lead = await leads.create(companyId, { name, email, ...rest });
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
