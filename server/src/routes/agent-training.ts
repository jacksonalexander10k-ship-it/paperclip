/**
 * Agent Training Routes
 *
 * Backs the Training tab in the per-agent page:
 *   - Skills list + toggle
 *   - Knowledge base (list/upload/delete/notes) — stub for now
 *   - Instructions extension (system prompt addendum)
 *   - Schedule (working hours, heartbeat frequency)
 *
 * Minimal v0.1 implementation — enough for the UI to work end-to-end.
 * Real KB storage + embeddings will come in a follow-up (pgvector + R2).
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agents, approvals as approvalsTbl, issues } from "@paperclipai/db";
import { and, eq, inArray } from "drizzle-orm";
import { assertCompanyAccess } from "./authz.js";
import { logger } from "../middleware/logger.js";

// ── Stock skills catalogue ──────────────────────────────────────────────────
// In production these would be markdown files in /server/src/prompts/skills/
// read at boot. For v0.1 we inline them so the UI has something to show.

interface StockSkill {
  key: string;
  name: string;
  description: string;
  when: string;
  category: "communication" | "sales" | "domain" | "compliance";
  appliesToRoles: string[];
}

const STOCK_SKILLS: StockSkill[] = [
  // Communication
  { key: "arabic-formal-tone", name: "Arabic formal tone", description: "Uses respectful \"Ustaz\" framing and formal Arabic for Arabic-speaking leads.", when: "When the lead writes in Arabic or requests Arabic.", category: "communication", appliesToRoles: ["sales", "viewing", "content"] },
  { key: "russian-direct-tone", name: "Russian direct tone", description: "Short, metrics-first tone preferred by Russian buyers.", when: "When the lead writes in Russian.", category: "communication", appliesToRoles: ["sales", "viewing"] },
  { key: "chinese-relationship-tone", name: "Chinese relationship tone", description: "Formal, relationship-first, avoids hard selling.", when: "When the lead writes in Mandarin or Cantonese.", category: "communication", appliesToRoles: ["sales", "viewing"] },
  { key: "whatsapp-short-form", name: "WhatsApp short-form", description: "Keeps WhatsApp replies to 2–3 sentences with a soft question at the end.", when: "For every WhatsApp reply.", category: "communication", appliesToRoles: ["sales", "viewing"] },
  // Sales
  { key: "cold-email", name: "Cold email opener", description: "Writes opening emails that actually get replies. Short, specific, no fluff.", when: "When drafting first-touch email to a new lead.", category: "sales", appliesToRoles: ["sales"] },
  { key: "follow-up-pattern", name: "Follow-up pattern", description: "Chases silent leads without being pushy. Adds value on each touch.", when: "When a lead has gone silent for 24h+.", category: "sales", appliesToRoles: ["sales"] },
  { key: "viewing-booker", name: "Viewing booker", description: "Drives every conversation toward a confirmed viewing slot.", when: "When the lead is qualified and it's time to book.", category: "sales", appliesToRoles: ["sales", "viewing"] },
  { key: "lead-scoring", name: "Lead scoring rubric", description: "Scores leads 0–10 on budget, timeline, area specificity, financing.", when: "After every qualifying exchange.", category: "sales", appliesToRoles: ["sales"] },
  // Domain
  { key: "dubai-areas", name: "Dubai areas knowledge", description: "Knows JVC, Downtown, Marina, Creek Harbour, Business Bay — price ranges, building types, commute.", when: "When the lead mentions or asks about an area.", category: "domain", appliesToRoles: ["sales", "viewing", "content", "marketing"] },
  { key: "off-plan-vs-ready", name: "Off-plan vs ready", description: "Explains payment plans, handover timelines, title-deed timing.", when: "When the lead hasn't decided off-plan vs ready.", category: "domain", appliesToRoles: ["sales", "viewing"] },
  { key: "golden-visa", name: "Golden Visa basics", description: "Thresholds, eligibility, common pitfalls. Never guarantees approval.", when: "When the lead mentions residency or Golden Visa.", category: "domain", appliesToRoles: ["sales", "viewing"] },
  // Compliance
  { key: "rera-disclaimers", name: "RERA disclaimers", description: "Appends RERA licence number on marketing messages; avoids guaranteed yield claims.", when: "On all outbound marketing content.", category: "compliance", appliesToRoles: ["sales", "content", "marketing"] },
  { key: "opt-out-respect", name: "Opt-out respect", description: "Recognises STOP / unsubscribe in English, Arabic, Russian. Stops contact immediately.", when: "Every inbound message.", category: "compliance", appliesToRoles: ["sales", "viewing"] },
];

function skillsForRole(role: string): StockSkill[] {
  return STOCK_SKILLS.filter((s) => s.appliesToRoles.includes(role));
}

// ── Route factory ──────────────────────────────────────────────────────────

export function agentTrainingRoutes(db: Db) {
  const router = Router();

  // ── Skills ────────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/agents/:agentId/skills", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    const [agent] = await db
      .select({ role: agents.role, metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const applicable = skillsForRole(agent.role);
    const disabledSet = new Set<string>(
      (agent.metadata as { disabledSkills?: string[] } | null)?.disabledSkills ?? [],
    );

    const payload = applicable.map((s) => ({
      key: s.key,
      name: s.name,
      description: s.description,
      when: s.when,
      category: s.category,
      isCustom: false,
      enabled: !disabledSet.has(s.key),
    }));

    res.json(payload);
  });

  router.patch("/companies/:companyId/agents/:agentId/skills/:skillKey", async (req, res) => {
    const { companyId, agentId, skillKey } = req.params;
    assertCompanyAccess(req, companyId);

    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "body.enabled must be a boolean" });
      return;
    }

    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const meta = (agent.metadata ?? {}) as Record<string, unknown>;
    const disabled = new Set<string>((meta.disabledSkills as string[] | undefined) ?? []);
    if (enabled) disabled.delete(skillKey);
    else disabled.add(skillKey);

    await db
      .update(agents)
      .set({
        metadata: { ...meta, disabledSkills: Array.from(disabled) },
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    res.json({ ok: true, skillKey, enabled });
  });

  // ── Knowledge base (stub — returns empty, accepts no-op uploads) ──────────
  // Real implementation pending: pgvector column + R2 storage + embeddings.

  router.get("/companies/:companyId/agents/:agentId/knowledge", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    res.json([]);
  });

  router.post("/companies/:companyId/agents/:agentId/knowledge", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    // TODO: accept multipart/form-data, store to R2, extract text, embed, persist row.
    logger.info({ agentId: req.params.agentId }, "agent-training: knowledge upload stub called");
    res.status(501).json({ error: "Knowledge base uploads coming soon." });
  });

  router.patch("/companies/:companyId/agents/:agentId/knowledge/:fileId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    res.status(501).json({ error: "Not yet implemented" });
  });

  router.delete("/companies/:companyId/agents/:agentId/knowledge/:fileId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    res.status(501).json({ error: "Not yet implemented" });
  });

  // ── Instruction rules (discrete toggleable custom instructions) ──────────
  // Stored on agent.metadata.instructionRules as an array of
  //   { id, text, enabled, createdAt }
  // Enabled rules are joined and injected into the agent's system prompt.
  //
  // Legacy: if an agent has only the old free-text `systemPromptExtension`,
  // we auto-migrate it into a single rule on first read.

  interface InstructionRule {
    id: string;
    text: string;
    enabled: boolean;
    createdAt: string;
  }

  function readRules(metadata: Record<string, unknown> | null): InstructionRule[] {
    if (!metadata) return [];
    const existing = (metadata as Record<string, unknown>).instructionRules;
    if (Array.isArray(existing)) return existing as InstructionRule[];
    // Legacy migration — single string → single rule
    const legacy = (metadata as Record<string, unknown>).systemPromptExtension;
    if (typeof legacy === "string" && legacy.trim().length > 0) {
      return [{
        id: `legacy-${Date.now()}`,
        text: legacy.trim(),
        enabled: true,
        createdAt: new Date().toISOString(),
      }];
    }
    return [];
  }

  async function writeRules(
    companyId: string,
    agentId: string,
    nextRules: InstructionRule[],
  ): Promise<void> {
    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) throw new Error("Agent not found");
    const meta = (agent.metadata ?? {}) as Record<string, unknown>;
    // Clear the legacy field — the rules array is now the source of truth.
    const { systemPromptExtension: _legacy, ...rest } = meta;
    void _legacy;
    await db
      .update(agents)
      .set({
        metadata: { ...rest, instructionRules: nextRules },
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
  }

  // List rules
  router.get("/companies/:companyId/agents/:agentId/instructions", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json(readRules(agent.metadata as Record<string, unknown> | null));
  });

  // Add a new rule
  router.post("/companies/:companyId/agents/:agentId/instructions", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) { res.status(400).json({ error: "Rule text is required" }); return; }
    if (text.length > 1000) { res.status(400).json({ error: "Rule too long (max 1000 chars)" }); return; }

    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const rules = readRules(agent.metadata as Record<string, unknown> | null);
    if (rules.length >= 50) { res.status(400).json({ error: "Too many rules (max 50). Delete some before adding more." }); return; }

    const newRule: InstructionRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    await writeRules(companyId, agentId, [newRule, ...rules]);
    res.status(201).json(newRule);
  });

  // Update a rule (edit text or toggle enabled)
  router.patch("/companies/:companyId/agents/:agentId/instructions/:ruleId", async (req, res) => {
    const { companyId, agentId, ruleId } = req.params;
    assertCompanyAccess(req, companyId);

    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const rules = readRules(agent.metadata as Record<string, unknown> | null);
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) { res.status(404).json({ error: "Rule not found" }); return; }

    const current = rules[idx]!;
    const patch: Partial<InstructionRule> = {};
    if (typeof req.body?.text === "string") {
      const t = req.body.text.trim();
      if (!t) { res.status(400).json({ error: "Rule text cannot be empty" }); return; }
      if (t.length > 1000) { res.status(400).json({ error: "Rule too long (max 1000 chars)" }); return; }
      patch.text = t;
    }
    if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;

    const updated: InstructionRule = { ...current, ...patch };
    const next = [...rules];
    next[idx] = updated;
    await writeRules(companyId, agentId, next);
    res.json(updated);
  });

  // Delete a rule
  router.delete("/companies/:companyId/agents/:agentId/instructions/:ruleId", async (req, res) => {
    const { companyId, agentId, ruleId } = req.params;
    assertCompanyAccess(req, companyId);

    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const rules = readRules(agent.metadata as Record<string, unknown> | null);
    const next = rules.filter((r) => r.id !== ruleId);
    if (next.length === rules.length) { res.status(404).json({ error: "Rule not found" }); return; }
    await writeRules(companyId, agentId, next);
    res.json({ ok: true });
  });

  // Interpret freeform broker input → clean rule via LLM.
  // Returns `{ interpreted: string }`. UI shows it as a preview for confirmation.
  router.post("/companies/:companyId/agents/:agentId/instructions/interpret", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    const raw = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!raw) { res.status(400).json({ error: "Text is required" }); return; }
    if (raw.length > 2000) { res.status(400).json({ error: "Too long (max 2000 chars)" }); return; }

    // Get agent context for the interpretation
    const [agent] = await db
      .select({ name: agents.name, role: agents.role })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    try {
      const { routedGenerate } = await import("../services/model-router.js");
      const result = await routedGenerate({
        taskType: "internal_reasoning",
        systemPrompt: `You translate broker instructions into clean rules for an AI real estate sales agent.

Rules for your output:
- Preserve the broker's intent EXACTLY. Never add, soften, or invent.
- Write as a single short imperative rule (ideally one sentence).
- Clear and specific. No marketing fluff.
- No quotes, no markdown, no preamble. Just the rule text itself.
- If the input is already a clean rule, return it almost unchanged.
- If the input is ambiguous, keep the ambiguity — don't guess.

Examples:

Input: "i want claire to ask about budget before showing options"
Output: Always ask about the lead's budget before proposing any property.

Input: "never mention damac hills 1 we only sell damac hills 2"
Output: Never mention DAMAC Hills 1. Only reference DAMAC Hills 2.

Input: "be more casual with clients"
Output: Use a casual, friendly tone with leads — avoid formal language.

Now translate the broker's input:`,
        userMessage: raw,
        maxTokens: 200,
      });
      const interpreted = result.text.trim().replace(/^[-*•]\s*/, "").replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
      if (!interpreted) { res.status(500).json({ error: "Could not interpret — try rephrasing" }); return; }
      res.json({ interpreted, original: raw });
    } catch (err) {
      logger.warn({ err, agentId }, "instructions-interpret: failed");
      // Fallback: return the raw input unchanged so the user can still save it.
      res.json({ interpreted: raw, original: raw, fallback: true });
    }
  });

  // ── Legacy text-extension endpoints (kept for backward compat) ────────────

  router.get("/companies/:companyId/agents/:agentId/instructions-extension", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);
    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    const rules = readRules(agent.metadata as Record<string, unknown> | null);
    // Project enabled rules back to a single joined string
    const text = rules.filter((r) => r.enabled).map((r) => `- ${r.text}`).join("\n");
    res.json({ text });
  });

  // ── Schedule (working hours + heartbeat freq) ─────────────────────────────

  router.get("/companies/:companyId/agents/:agentId/schedule", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    const [agent] = await db
      .select({ metadata: agents.metadata, runtimeConfig: agents.runtimeConfig })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const meta = (agent.metadata ?? {}) as Record<string, unknown>;
    const runtime = (agent.runtimeConfig ?? {}) as Record<string, unknown>;
    res.json({
      workingHoursStart: typeof meta.workingHoursStart === "number" ? meta.workingHoursStart : 0,
      workingHoursEnd: typeof meta.workingHoursEnd === "number" ? meta.workingHoursEnd : 24,
      heartbeatFrequencySeconds: typeof runtime.heartbeatFrequencySeconds === "number"
        ? runtime.heartbeatFrequencySeconds
        : 900,
    });
  });

  router.patch("/companies/:companyId/agents/:agentId/schedule", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    const { workingHoursStart, workingHoursEnd, heartbeatFrequencySeconds } = req.body ?? {};

    const [agent] = await db
      .select({ metadata: agents.metadata, runtimeConfig: agents.runtimeConfig })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const meta = { ...((agent.metadata ?? {}) as Record<string, unknown>) };
    const runtime = { ...((agent.runtimeConfig ?? {}) as Record<string, unknown>) };

    if (typeof workingHoursStart === "number" && workingHoursStart >= 0 && workingHoursStart <= 24) {
      meta.workingHoursStart = workingHoursStart;
    }
    if (typeof workingHoursEnd === "number" && workingHoursEnd >= 0 && workingHoursEnd <= 24) {
      meta.workingHoursEnd = workingHoursEnd;
    }
    if (typeof heartbeatFrequencySeconds === "number" && heartbeatFrequencySeconds >= 0) {
      runtime.heartbeatFrequencySeconds = heartbeatFrequencySeconds;
    }

    await db
      .update(agents)
      .set({ metadata: meta, runtimeConfig: runtime, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    res.json({ ok: true });
  });

  // ── Clear the agent's queue (pending approvals + open tasks) ────────────

  router.post("/companies/:companyId/agents/:agentId/clear-queue", async (req, res) => {
    const { companyId, agentId } = req.params;
    assertCompanyAccess(req, companyId);

    // Decline all pending approvals requested by this agent
    const declinedApprovals = await db
      .update(approvalsTbl)
      .set({
        status: "rejected",
        decisionNote: "Cleared from queue by owner",
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(approvalsTbl.companyId, companyId),
        eq(approvalsTbl.requestedByAgentId, agentId),
        eq(approvalsTbl.status, "pending"),
      ))
      .returning({ id: approvalsTbl.id });

    // Close all non-done tasks assigned to this agent
    const cancelledIssues = await db
      .update(issues)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(issues.companyId, companyId),
        eq(issues.assigneeAgentId, agentId),
        inArray(issues.status, ["todo", "in_progress", "backlog", "blocked", "in_review"]),
      ))
      .returning({ id: issues.id });

    logger.info({ companyId, agentId, approvalsDeclined: declinedApprovals.length, tasksCancelled: cancelledIssues.length }, "agent-training: queue cleared");

    res.json({
      ok: true,
      approvalsDeclined: declinedApprovals.length,
      tasksCancelled: cancelledIssues.length,
    });
  });

  // ── Scheduled jobs + handoff rules (stubs — UI shows empty states) ────────

  router.get("/companies/:companyId/agents/:agentId/scheduled-jobs", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    res.json([]);
  });

  router.get("/companies/:companyId/agents/:agentId/handoff-rules", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);
    res.json([]);
  });

  return router;
}
