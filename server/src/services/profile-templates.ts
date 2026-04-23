/**
 * Profile templates service — manage reusable role configs for agents.
 *
 * A profile template defines an agent's behaviour: goal, tone, cadence, hand-off
 * rules. Stock templates ship with the platform (companyId NULL, isStock true).
 * Custom templates are created via the CEO wizard and scoped per company.
 *
 * Apply a template to an agent → its config flows into the system prompt at draft time.
 */

import type { Db } from "@paperclipai/db";
import { aygentProfileTemplates, agents } from "@paperclipai/db";
import { and, eq, isNull, or } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

export interface ProfileConfig {
  goal: string;
  secondary?: string;
  tone?: string;
  cadence?: string;
  handoffRules?: string;
  dontDo?: string;
  custom?: string;
}

export interface ProfileTemplate {
  id: string;
  companyId: string | null;
  name: string;
  tagline: string;
  appliesToRole: string;
  config: ProfileConfig;
  isStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function profileTemplatesService(db: Db) {
  /** List all templates the company can see (stock + their own customs). */
  async function listForCompany(companyId: string, role?: string): Promise<ProfileTemplate[]> {
    const conditions = [
      or(isNull(aygentProfileTemplates.companyId), eq(aygentProfileTemplates.companyId, companyId)),
    ];
    if (role) conditions.push(eq(aygentProfileTemplates.appliesToRole, role));
    const rows = await db
      .select()
      .from(aygentProfileTemplates)
      .where(and(...conditions));
    return rows as ProfileTemplate[];
  }

  /** Get a template by id (must be visible to this company — stock or own). */
  async function get(companyId: string, id: string): Promise<ProfileTemplate | null> {
    const [row] = await db
      .select()
      .from(aygentProfileTemplates)
      .where(
        and(
          eq(aygentProfileTemplates.id, id),
          or(isNull(aygentProfileTemplates.companyId), eq(aygentProfileTemplates.companyId, companyId)),
        ),
      )
      .limit(1);
    return (row as ProfileTemplate) ?? null;
  }

  /** Find by name within a company's visible set. Used by the wizard's apply step. */
  async function findByName(companyId: string, name: string, role?: string): Promise<ProfileTemplate | null> {
    const all = await listForCompany(companyId, role);
    const lower = name.trim().toLowerCase();
    return all.find((t) => t.name.toLowerCase() === lower) ?? null;
  }

  /** Create a new custom template (always company-scoped, never stock). */
  async function create(input: {
    companyId: string;
    name: string;
    tagline: string;
    appliesToRole: string;
    config: ProfileConfig;
  }): Promise<ProfileTemplate> {
    const [row] = await db
      .insert(aygentProfileTemplates)
      .values({
        companyId: input.companyId,
        name: input.name.trim(),
        tagline: input.tagline.trim(),
        appliesToRole: input.appliesToRole,
        config: input.config,
        isStock: false,
      })
      .returning();
    logger.info({ templateId: row.id, companyId: input.companyId, name: input.name }, "profile-templates: created");
    return row as ProfileTemplate;
  }

  /** Update an existing custom template. Stock templates are immutable. */
  async function update(
    companyId: string,
    id: string,
    patch: { name?: string; tagline?: string; config?: ProfileConfig },
  ): Promise<ProfileTemplate | null> {
    const existing = await get(companyId, id);
    if (!existing || existing.isStock || existing.companyId !== companyId) return null;
    const [row] = await db
      .update(aygentProfileTemplates)
      .set({
        name: patch.name?.trim() ?? existing.name,
        tagline: patch.tagline?.trim() ?? existing.tagline,
        config: patch.config ?? existing.config,
        updatedAt: new Date(),
      })
      .where(eq(aygentProfileTemplates.id, id))
      .returning();
    return (row as ProfileTemplate) ?? null;
  }

  /** Apply a template to an agent. Sets agent.profileTemplateId. */
  async function applyToAgent(companyId: string, agentId: string, templateId: string | null): Promise<boolean> {
    if (templateId !== null) {
      const tmpl = await get(companyId, templateId);
      if (!tmpl) return false;
    }
    await db
      .update(agents)
      .set({ profileTemplateId: templateId, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
    logger.info({ companyId, agentId, templateId }, "profile-templates: applied to agent");
    return true;
  }

  /** Read the currently-applied template for an agent (returns null if none). */
  async function getForAgent(companyId: string, agentId: string): Promise<ProfileTemplate | null> {
    const [agent] = await db
      .select({ profileTemplateId: agents.profileTemplateId })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .limit(1);
    if (!agent?.profileTemplateId) return null;
    return get(companyId, agent.profileTemplateId);
  }

  /** Render a template's config as a markdown block to inject into a system prompt. */
  function renderForPrompt(template: ProfileTemplate): string {
    const lines: string[] = [];
    lines.push(`## Your Active Profile: "${template.name}"`);
    lines.push(`*${template.tagline}*`);
    lines.push("");
    lines.push(`**Goal:** ${template.config.goal}`);
    if (template.config.secondary) lines.push(`**Secondary goal:** ${template.config.secondary}`);
    if (template.config.tone) lines.push(`**Tone:** ${template.config.tone}`);
    if (template.config.cadence) lines.push(`**Cadence:** ${template.config.cadence}`);
    if (template.config.handoffRules) lines.push(`**When to escalate:** ${template.config.handoffRules}`);
    if (template.config.dontDo) lines.push(`**Never do:** ${template.config.dontDo}`);
    if (template.config.custom) lines.push(`**Notes:** ${template.config.custom}`);
    lines.push("");
    lines.push("Every reply must serve this goal. Stay in character for this profile.");
    return lines.join("\n");
  }

  return {
    listForCompany,
    get,
    findByName,
    create,
    update,
    applyToAgent,
    getForAgent,
    renderForPrompt,
  };
}
