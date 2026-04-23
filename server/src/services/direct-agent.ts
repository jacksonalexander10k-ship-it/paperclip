/**
 * Direct Agent — the "fast clock" for event-driven work.
 *
 * When an event happens (lead replies, CEO delegates, user clicks Start outreach),
 * call this service directly. It:
 *   1. Loads the agent's role personality + skills
 *   2. Calls Claude via the routed model (cheap → medium → premium)
 *   3. Creates an approval (which honors the agent's autoApprove toggle)
 *   4. Returns the draft to the caller immediately
 *
 * No heartbeat. No task queue. No waiting. Sub-5-second response.
 *
 * The heartbeat system still runs for *autonomous* background work (stale-lead
 * scans, morning content briefs, DLD monitoring) — this just handles the
 * "somebody poked the agent" case.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  companies,
  aygentLeads,
  aygentWhatsappTemplates,
  aygentWhatsappMessages,
} from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { withIdentity } from "./agent-identity.js";
import { profileTemplatesService } from "./profile-templates.js";
import { approvalService } from "./approvals.js";
import { getRole, AGENT_ROLES, type AgentRoleId } from "./agent-roles.js";
import { getSkillsForAgent } from "./agent-skills.js";
import { logActivity } from "./activity-log.js";
import { logger } from "../middleware/logger.js";

/** Event types that trigger the fast clock */
export type DirectTrigger =
  | { kind: "inbound_whatsapp"; leadId?: string; incomingText: string; chatJid: string; senderPhone: string; contactName: string | null }
  | { kind: "outreach_first_touch"; leadId: string; templateId?: string; customMessage?: string }
  | {
      kind: "ceo_delegation";
      instruction: string;
      /** Either a leadId OR a phone is required. If only phone is given, we auto-create the lead. */
      leadId?: string;
      phone?: string;
      contactName?: string;
      templateId?: string;
    };

export interface DirectAgentResult {
  success: boolean;
  draft?: string;
  approvalId?: string;
  reason?: string;
}

interface AgentContext {
  id: string;
  name: string;
  role: string;
  companyId: string;
  metadata: Record<string, unknown>;
}

/**
 * Load a skill file's content (first 2000 chars to keep the prompt tight).
 * Returns null if the skill doesn't exist or is a directory-based skill (no inline content).
 */
function loadSkillContent(skillEntrySource: string): string | null {
  try {
    // If it's a directory, look for SKILL.md inside
    const skillMdPath = skillEntrySource.endsWith(".md")
      ? skillEntrySource
      : resolve(skillEntrySource, "SKILL.md");
    const content = readFileSync(skillMdPath, "utf-8");
    return content.slice(0, 2000);
  } catch {
    return null;
  }
}

/**
 * Build a system prompt tailored to this agent's role and skills.
 */
async function buildSystemPrompt(
  db: Db,
  agent: AgentContext,
  trigger: DirectTrigger,
): Promise<string> {
  const role = getRole(agent.role);
  const [company] = await db.select().from(companies).where(eq(companies.id, agent.companyId)).limit(1);
  const skills = await getSkillsForAgent(db, agent);
  // Profiles removed — agents are shaped by their system prompt + custom instructions + skills.
  const profileBlock = "";

  // Owner-authored custom instructions — discrete toggleable rules from Training tab.
  // Only enabled rules are injected.
  const meta = agent.metadata ?? {};
  type InstructionRule = { id: string; text: string; enabled: boolean; createdAt: string };
  const rawRules = (meta as Record<string, unknown>).instructionRules;
  const instructionRules: InstructionRule[] = Array.isArray(rawRules) ? rawRules as InstructionRule[] : [];
  const legacyExt = typeof (meta as Record<string, unknown>).systemPromptExtension === "string"
    ? (meta as Record<string, unknown>).systemPromptExtension as string
    : null;
  const enabledRuleLines = instructionRules.filter((r) => r.enabled).map((r) => `- ${r.text}`);
  const instructionsBlock = enabledRuleLines.length > 0
    ? `\n\n---\n\n## Custom instructions from your owner\n${enabledRuleLines.join("\n")}`
    : legacyExt && legacyExt.trim().length > 0
      ? `\n\n---\n\n## Custom instructions from your owner\n${legacyExt.trim()}`
      : "";

  // Inline the most relevant 2-3 skills. The rest are discoverable via frontmatter.
  const relevantSkillPatterns: Record<string, string[]> = {
    inbound_whatsapp: ["lead-followup", "whatsapp-outbound", "lead-response", "dubai-buyers", "multilingual", "cold-email"],
    outreach_first_touch: ["lead-response", "whatsapp-outbound", "dubai-buyers", "multilingual", "cold-email", "copywriting"],
    ceo_delegation: ["lead-followup", "whatsapp-outbound", "cold-email", "copywriting"],
  };
  const patterns = relevantSkillPatterns[trigger.kind] ?? [];
  const loadedSkills: string[] = [];
  for (const pattern of patterns) {
    const match = skills.find((s) => s.source.toLowerCase().includes(pattern));
    if (match) {
      const content = loadSkillContent(match.source);
      if (content) loadedSkills.push(`### Skill: ${match.key}\n${content}`);
    }
    if (loadedSkills.length >= 3) break;
  }

  const companyBrand = "";

  return withIdentity(`You are ${agent.name}, a ${role?.title ?? agent.role} at ${company?.name ?? "the agency"}.${companyBrand}

Your job right now: draft ONE WhatsApp reply. You're having a real conversation with a real person. Match their energy, their message length, their topic.

## How to think before you write

1. Read the lead's most recent message carefully. What did they ACTUALLY say?
2. Respond TO THAT. Don't lecture, don't pitch, don't pivot to a different topic.
3. If they answered a yes/no question, your next move is to ask ONE qualifying question — not propose units.
4. If they asked a specific question, answer it plainly in one sentence.
5. If they're silent or vague, ask ONE short question to move the conversation forward.
6. Keep it short. Real humans don't send paragraphs.

## Hard rules (non-negotiable)

- **Never propose specific properties, projects, units, developers, or viewing times unless the lead has explicitly asked for them.** "Yes I'm interested" is NOT an ask — it's confirmation. Don't throw Damac / Emaar / Sobha at them. Ask what they're looking for first.
- **Never invent properties or prices.** If you don't have a specific unit to offer (and you don't — no inventory tool was called), don't mention any.
- **One question maximum per message.** Not three.
- **Match the language** of the lead's message.
- **No emoji spam.** Max one emoji if the tone calls for it.
- **No marketing fluff.** "Exciting", "amazing", "fantastic opportunity" = banned.

## Output format

- Write ONLY the message text. No "Here's a draft:", no markdown, no quotation marks around it.
- 1–3 short sentences. If the lead's last message was 3 words, yours should be short too.
- End with a soft question ONLY if it fits. If a simple acknowledgment is more natural, just acknowledge.
- Never quote a specific guaranteed price — use "starting from" or "from approximately".

${profileBlock}${instructionsBlock}${loadedSkills.length > 0 ? `\n\n---\nYour skills you can draw on:\n\n${loadedSkills.join("\n\n---\n")}` : ""}`);
}

/**
 * Build the user prompt describing the specific event + lead context.
 *
 * Exported for regression tests — see __tests__/direct-agent-empty-body.test.ts.
 * The empty-body inbound path is load-bearing for demos (Baileys @lid decrypt
 * failures produce empty bodies). If you refactor this, keep the unreadable
 * branch intact or the regression test will fail.
 */
export async function _buildUserPromptForTest(
  db: Db,
  trigger: DirectTrigger,
  templateContent: string | null = null,
  customMessage: string | null = null,
) {
  return buildUserPrompt(db, trigger, templateContent, customMessage);
}

async function buildUserPrompt(
  db: Db,
  trigger: DirectTrigger,
  templateContent: string | null,
  customMessage: string | null,
): Promise<{ prompt: string; lead: typeof aygentLeads.$inferSelect | null }> {
  const leadIdForLookup = trigger.leadId;
  let lead: typeof aygentLeads.$inferSelect | null = null;
  if (leadIdForLookup) {
    const [row] = await db.select().from(aygentLeads).where(eq(aygentLeads.id, leadIdForLookup)).limit(1);
    lead = row ?? null;
  }

  const leadContext = lead
    ? `Lead: ${lead.name}\nPhone: ${lead.phone ?? "(unknown)"}\nLanguage: ${lead.language ?? "English"}\nSource: ${lead.source ?? "manual"}\nStage: ${lead.stage}\nScore: ${lead.score}/10${lead.propertyType ? `\nInterested in: ${lead.propertyType}` : ""}${lead.timeline ? `\nTimeline: ${lead.timeline}` : ""}${lead.notes ? `\nNotes: ${lead.notes}` : ""}`
    : trigger.kind === "inbound_whatsapp"
      ? `New contact (no lead record yet): ${trigger.contactName ?? "Unknown"} (+${trigger.senderPhone})`
      : "Lead: (not found)";

  if (trigger.kind === "inbound_whatsapp") {
    // Pull conversation history — SCOPED to the CURRENT lead.
    // Cut off at the lead's creation date so we don't leak messages from a
    // previously-deleted lead that shared the same phone number. If no lead
    // (new inbound, no lead yet), just pull last 10 by chat_jid.
    const sinceCutoff = lead?.createdAt ?? null;
    const query = db
      .select()
      .from(aygentWhatsappMessages)
      .where(
        sinceCutoff
          ? and(
              eq(aygentWhatsappMessages.chatJid, trigger.chatJid),
              gte(aygentWhatsappMessages.timestamp, sinceCutoff),
            )
          : eq(aygentWhatsappMessages.chatJid, trigger.chatJid),
      )
      .orderBy(desc(aygentWhatsappMessages.timestamp))
      .limit(10);
    const recent = await query;
    const history = recent
      .slice()
      .reverse()
      .map((m) => `${m.fromMe ? "[YOU]" : "[LEAD]"}: ${m.content ?? ""}`)
      .join("\n");
    const unreadable = !trigger.incomingText || trigger.incomingText.trim().length === 0;
    const latestLine = unreadable
      ? "[LEAD just sent something we couldn't read — likely a sticker, image, or an encrypted payload our client couldn't decrypt]"
      : `[LEAD just said]: ${trigger.incomingText}`;
    const unreadableHint = unreadable
      ? "\n\nSince you couldn't read their last message, write ONE short, warm reply that keeps the conversation alive — based on the conversation above. Acknowledge them and ask a single short question, or politely ask them to resend. Do NOT pretend you read the message."
      : "";
    return {
      lead,
      prompt: `${leadContext}\n\nRecent conversation:\n${history || "(this is the first message)"}\n\n${latestLine}${unreadableHint}\n\nDraft your reply now.`,
    };
  }

  if (trigger.kind === "outreach_first_touch") {
    const base = customMessage
      ? `Use this message (fill in vars): ${customMessage}`
      : templateContent
        ? `Use this template (fill in vars): ${templateContent}`
        : `First-touch outreach — introduce yourself and ask an opening question.`;
    return {
      lead,
      prompt: `${leadContext}\n\nTrigger: First-touch outreach (no previous conversation).\n\n${base}\n\nDraft the message.`,
    };
  }

  if (trigger.kind === "ceo_delegation") {
    const instructionText = trigger.instruction || "";
    const baseGuide = templateContent
      ? `\n\n## Template you MUST use\n\n${templateContent}\n\nStrict rules:\n- Write the message using this template as the spine. Do not change the structure, tone, or call-to-action.\n- Replace {{vars}} with the lead's actual info (e.g. {{lead_name}} → "${lead?.name ?? "their name"}").\n- You can tighten wording for flow, but the core message must match this template.\n- Do NOT add new sentences, new offers, or new calls-to-action that aren't in the template.`
      : "";
    return {
      lead,
      prompt: `${leadContext}\n\nThe CEO just told you: "${instructionText}"${baseGuide}\n\nDraft the message now.`,
    };
  }

  return { lead, prompt: leadContext };
}

export function directAgentService(db: Db) {
  /**
   * Fire the fast clock. Agent drafts a reply immediately.
   */
  async function respondToEvent(
    agentIdOrRecord: string | AgentContext,
    trigger: DirectTrigger,
  ): Promise<DirectAgentResult> {
    const started = Date.now();

    let agent: AgentContext;
    if (typeof agentIdOrRecord === "string") {
      const [row] = await db.select().from(agents).where(eq(agents.id, agentIdOrRecord)).limit(1);
      if (!row) return { success: false, reason: "agent_not_found" };
      agent = {
        id: row.id,
        name: row.name,
        role: row.role,
        companyId: row.companyId,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
      };
    } else {
      agent = agentIdOrRecord;
    }

    // Resolve template / custom message if given
    let templateContent: string | null = null;
    let templateId: string | undefined;
    let customMessage: string | null = null;
    if (trigger.kind === "outreach_first_touch" || trigger.kind === "ceo_delegation") {
      if (trigger.templateId) {
        const [tpl] = await db
          .select()
          .from(aygentWhatsappTemplates)
          .where(and(eq(aygentWhatsappTemplates.id, trigger.templateId), eq(aygentWhatsappTemplates.companyId, agent.companyId)))
          .limit(1);
        if (tpl?.content) {
          templateContent = tpl.content;
          templateId = tpl.id;
        }
      }
      if (trigger.kind === "outreach_first_touch" && trigger.customMessage) {
        customMessage = trigger.customMessage;
      }
    }

    // For ceo_delegation with phone but no leadId: auto-create the lead.
    // The CEO often says "message +971... about X" with just a phone — create the lead so we can act.
    if (trigger.kind === "ceo_delegation" && !trigger.leadId && trigger.phone) {
      const cleanPhone = trigger.phone.replace(/[^\d+]/g, "");
      const phoneWithPlus = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
      const phoneVariants = [phoneWithPlus, cleanPhone.replace(/^\+/, "")];
      const [existing] = await db
        .select()
        .from(aygentLeads)
        .where(and(
          eq(aygentLeads.companyId, agent.companyId),
          inArray(aygentLeads.phone, phoneVariants),
        ))
        .limit(1);
      if (existing) {
        trigger.leadId = existing.id;
      } else {
        try {
          const [created] = await db
            .insert(aygentLeads)
            .values({
              companyId: agent.companyId,
              name: trigger.contactName ?? `Lead ${phoneWithPlus}`,
              phone: phoneWithPlus,
              source: "ceo_delegation",
              stage: "lead",
              score: 0,
              agentId: agent.id,
            })
            .returning();
          if (created) {
            trigger.leadId = created.id;
            logger.info({ leadId: created.id, agentId: agent.id, phone: phoneWithPlus }, "direct-agent: auto-created lead from ceo_delegation");
          }
        } catch (err) {
          logger.warn({ err, phone: phoneWithPlus }, "direct-agent: lead create failed for ceo_delegation");
        }
      }
    }

    // For inbound_whatsapp: auto-create a lead if none exists for this sender.
    // A real human would reply to anyone — so should the agent.
    if (trigger.kind === "inbound_whatsapp" && !trigger.leadId) {
      const isLidSender = trigger.chatJid.endsWith("@lid");

      // Look up existing lead by phone (regular senders)
      const phoneVariants = [`+${trigger.senderPhone}`, trigger.senderPhone];
      const [existing] = await db
        .select()
        .from(aygentLeads)
        .where(and(
          eq(aygentLeads.companyId, agent.companyId),
          inArray(aygentLeads.phone, phoneVariants),
        ))
        .limit(1);

      // @lid auto-link: WhatsApp privacy mode strips the sender's real phone,
      // so an @lid inbound has no way to match an existing lead. If this agent
      // sent an outbound to a REAL phone in the last 10 minutes, it's almost
      // certainly the same person replying — link this @lid to THAT lead
      // instead of creating a new one. Prevents pipeline pollution during
      // normal conversations with privacy-mode contacts.
      if (!existing && isLidSender) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const [recentOutbound] = await db
          .select({ chatJid: aygentWhatsappMessages.chatJid })
          .from(aygentWhatsappMessages)
          .where(and(
            eq(aygentWhatsappMessages.agentId, agent.id),
            eq(aygentWhatsappMessages.fromMe, true),
            gte(aygentWhatsappMessages.timestamp, tenMinutesAgo),
          ))
          .orderBy(desc(aygentWhatsappMessages.timestamp))
          .limit(1);

        if (recentOutbound && !recentOutbound.chatJid.endsWith("@lid")) {
          const outboundPhone = recentOutbound.chatJid.replace("@s.whatsapp.net", "");
          const linkedVariants = [`+${outboundPhone}`, outboundPhone];
          const [linkedLead] = await db
            .select()
            .from(aygentLeads)
            .where(and(
              eq(aygentLeads.companyId, agent.companyId),
              inArray(aygentLeads.phone, linkedVariants),
            ))
            .limit(1);

          if (linkedLead) {
            trigger.leadId = linkedLead.id;
            // Rewrite the chatJid on this trigger so conversation history and
            // send-path queries use the REAL phone, not the @lid alias.
            trigger.chatJid = recentOutbound.chatJid;
            trigger.senderPhone = outboundPhone;
            logger.info(
              { leadId: linkedLead.id, agentId: agent.id, lidJid: isLidSender, linkedTo: recentOutbound.chatJid },
              "direct-agent: linked @lid inbound to recent outbound lead (privacy-mode recovery)",
            );
          }
        }
      }

      if (!trigger.leadId && existing) {
        trigger.leadId = existing.id;
      }
      if (!trigger.leadId && !existing) {
        // Create a new lead from the inbound — minimal info
        try {
          const [created] = await db
            .insert(aygentLeads)
            .values({
              companyId: agent.companyId,
              name: trigger.contactName ?? `Lead +${trigger.senderPhone}`,
              phone: `+${trigger.senderPhone}`,
              source: "whatsapp_inbound",
              stage: "lead",
              score: 0,
              agentId: agent.id,
            })
            .returning();
          if (created) {
            trigger.leadId = created.id;
            logger.info({ leadId: created.id, agentId: agent.id, senderPhone: trigger.senderPhone }, "direct-agent: auto-created lead from inbound");
          }
        } catch (err) {
          logger.warn({ err, senderPhone: trigger.senderPhone }, "direct-agent: lead create failed");
        }
      }
    }

    const systemPrompt = await buildSystemPrompt(db, agent, trigger);
    const { prompt, lead } = await buildUserPrompt(db, trigger, templateContent, customMessage);

    // For inbound replies, ALWAYS use the original chatJid (preserves @lid for privacy-mode senders).
    // Using lead.phone would strip the @lid suffix and route to a non-existent @s.whatsapp.net number.
    let recipientPhone: string;
    let leadDisplayName: string;
    let leadIdForApproval: string | null = null;
    if (trigger.kind === "inbound_whatsapp") {
      recipientPhone = trigger.chatJid;
      leadDisplayName = lead?.name ?? trigger.contactName ?? `+${trigger.senderPhone}`;
      leadIdForApproval = lead?.id ?? null;
    } else if (lead) {
      if (!lead.phone) return { success: false, reason: "lead_has_no_phone" };
      recipientPhone = lead.phone;
      leadDisplayName = lead.name;
      leadIdForApproval = lead.id;
    } else {
      return { success: false, reason: "lead_not_found" };
    }

    // Fire the LLM
    let draft = "";
    try {
      const res = await routedGenerate({
        // Map to a known task type so the router picks Gemini Pro deliberately (not via "default").
        taskType: "whatsapp_draft",
        systemPrompt,
        userMessage: prompt,
        // Gemini 3.1 Pro is a thinking model — it spends most of its output budget on internal
        // reasoning. Need plenty of headroom so thinking never starves the actual reply.
        maxTokens: 8000,
      });
      draft = (res.text ?? "").trim();
    } catch (err) {
      logger.error({ err, agentId: agent.id, trigger: trigger.kind }, "direct-agent: LLM call failed");
      return { success: false, reason: "llm_failed" };
    }

    if (!draft) {
      return { success: false, reason: "empty_draft" };
    }

    // Create approval — honors agent.metadata.autoApprove via the existing auto-approve service
    let approvalId: string | undefined;
    try {
      const approval = await approvalService(db).create(agent.companyId, {
        type: "send_whatsapp",
        requestedByAgentId: agent.id,
        status: "pending",
        payload: {
          type: "approval_required",
          action: "send_whatsapp",
          phone: recipientPhone,
          message: draft,
          leadId: leadIdForApproval,
          leadName: leadDisplayName,
          agentName: agent.name,
          context: `Direct response — trigger: ${trigger.kind}`,
          templateId,
        },
      });
      approvalId = approval?.id;
    } catch (err) {
      logger.error({ err, agentId: agent.id }, "direct-agent: approval create failed");
      return { success: false, draft, reason: "approval_failed" };
    }

    // Mark the lead as contacted the moment we draft. Prevents the CEO's queue
    // resolver from picking the same lead again on repeat dispatches.
    // (lastContactAt was null; now it's set. Queue filter excludes this lead next time.)
    if (leadIdForApproval) {
      try {
        await db
          .update(aygentLeads)
          .set({ lastContactAt: new Date(), stage: "contacted", updatedAt: new Date() })
          .where(eq(aygentLeads.id, leadIdForApproval));
      } catch (err) {
        logger.warn({ err, leadId: leadIdForApproval }, "direct-agent: failed to mark lead contacted");
      }
    }

    await logActivity(db, {
      companyId: agent.companyId,
      actorType: "system",
      actorId: "direct-agent",
      action: "agent.direct_response",
      entityType: "lead",
      entityId: leadIdForApproval ?? agent.id,
      agentId: agent.id,
      details: {
        trigger: trigger.kind,
        draftPreview: draft.slice(0, 100),
        approvalId,
        leadId: leadIdForApproval,
        durationMs: Date.now() - started,
      },
    }).catch((err) => logger.warn({ err }, "direct-agent: activity log failed"));

    logger.info(
      {
        agentId: agent.id,
        agentName: agent.name,
        trigger: trigger.kind,
        leadId: leadIdForApproval,
        recipientPhone,
        approvalId,
        durationMs: Date.now() - started,
      },
      "direct-agent: draft produced",
    );

    return { success: true, draft, approvalId };
  }

  return { respondToEvent };
}
