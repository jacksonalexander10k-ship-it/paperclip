/**
 * Smart Auto-Approval — LLM-powered review of pending approvals.
 *
 * Inspired by Hermes Agent's smart auto-approval via auxiliary LLM.
 * Uses Gemini Flash (cheap tier) to evaluate whether a routine approval
 * can be auto-approved without human intervention.
 *
 * Rules:
 * - NEVER auto-approve: hire_agent, hire_team, budget_override_required, launch_fb_campaign
 * - ALWAYS require human: first-ever message to a lead, score >= 8 leads, bulk operations
 * - CAN auto-approve: routine follow-ups to low-score leads, viewing confirmations,
 *   content that matches established patterns, skill amendments with high evidence
 */

import { and, eq, sql, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvals, aygentAgentLearnings, aygentLeads } from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

// Types that MUST always go to the owner — too consequential to auto-approve
const NEVER_AUTO_APPROVE: Set<string> = new Set([
  "hire_agent",
  "hire_team",
  "budget_override_required",
  "launch_fb_campaign",
  "pause_fb_campaign",
  "approve_ceo_strategy",
]);

// Types that are candidates for auto-approval
const AUTO_APPROVE_CANDIDATES: Set<string> = new Set([
  "send_whatsapp",
  "send_email",
  "post_instagram",
  "confirm_viewing",
  "create_event",
  "use_whatsapp_template",
  "approve_plan",
  "skill_amendment",
  "update_lead_stage",
]);

export interface AutoApproveResult {
  autoApprove: boolean;
  reason: string;
  confidence: number; // 0.0 - 1.0
}

export function autoApproveService(db: Db) {
  /**
   * Evaluate whether an approval can be auto-approved.
   * Returns a decision with confidence score.
   */
  async function evaluate(
    companyId: string,
    approval: {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      requestedByAgentId: string | null;
    },
  ): Promise<AutoApproveResult> {
    // Hard rule: never auto-approve high-risk types
    if (NEVER_AUTO_APPROVE.has(approval.type)) {
      return {
        autoApprove: false,
        reason: `${approval.type} always requires human approval`,
        confidence: 1.0,
      };
    }

    // Hard rule: only consider known candidate types
    if (!AUTO_APPROVE_CANDIDATES.has(approval.type)) {
      return {
        autoApprove: false,
        reason: `Unknown approval type: ${approval.type}`,
        confidence: 1.0,
      };
    }

    // Check if this is first contact with a lead — never auto-approve first messages
    if (
      (approval.type === "send_whatsapp" || approval.type === "send_email") &&
      approval.payload.leadId
    ) {
      const isFirstContact = await checkFirstContact(companyId, String(approval.payload.leadId));
      if (isFirstContact) {
        return {
          autoApprove: false,
          reason: "First message to this lead — owner should review initial contact",
          confidence: 0.95,
        };
      }
    }

    // Check lead score — high-score leads need human eyes
    if (approval.payload.leadId || approval.payload.lead_id) {
      const leadId = String(approval.payload.leadId ?? approval.payload.lead_id);
      const lead = await db
        .select({ score: aygentLeads.score })
        .from(aygentLeads)
        .where(and(eq(aygentLeads.id, leadId), eq(aygentLeads.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (lead && lead.score >= 8) {
        return {
          autoApprove: false,
          reason: `Lead score ${lead.score}/10 — high-value lead, owner should review`,
          confidence: 0.9,
        };
      }
    }

    // Check bulk operations — never auto-approve
    if (approval.type === "bulk_whatsapp") {
      return {
        autoApprove: false,
        reason: "Bulk operations always require human approval",
        confidence: 1.0,
      };
    }

    // Check agent's track record — how many corrections/rejections recently?
    const agentId = approval.requestedByAgentId;
    let trackRecord = { corrections: 0, total: 0, rejectionRate: 0 };
    if (agentId) {
      trackRecord = await getAgentTrackRecord(companyId, agentId);

      // If agent has high rejection rate, don't auto-approve
      if (trackRecord.total >= 5 && trackRecord.rejectionRate > 0.3) {
        return {
          autoApprove: false,
          reason: `Agent has ${Math.round(trackRecord.rejectionRate * 100)}% correction rate — needs more human oversight`,
          confidence: 0.85,
        };
      }
    }

    // For remaining candidates, use LLM to make the call
    return evaluateWithLLM(companyId, approval, trackRecord);
  }

  async function checkFirstContact(companyId: string, leadId: string): Promise<boolean> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(approvals)
      .where(
        and(
          eq(approvals.companyId, companyId),
          eq(approvals.status, "approved"),
          sql`${approvals.payload}->>'leadId' = ${leadId}`,
          sql`${approvals.type} IN ('send_whatsapp', 'send_email')`,
        ),
      );
    return (row?.count ?? 0) === 0;
  }

  async function getAgentTrackRecord(
    companyId: string,
    agentId: string,
  ): Promise<{ corrections: number; total: number; rejectionRate: number }> {
    const [row] = await db
      .select({
        corrections: sql<number>`count(*) filter (where ${aygentAgentLearnings.type} IN ('correction', 'rejection'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          eq(aygentAgentLearnings.active, true),
        ),
      );

    const corrections = row?.corrections ?? 0;
    const total = row?.total ?? 0;
    const rejectionRate = total > 0 ? corrections / total : 0;
    return { corrections, total, rejectionRate };
  }

  async function evaluateWithLLM(
    companyId: string,
    approval: {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      requestedByAgentId: string | null;
    },
    trackRecord: { corrections: number; total: number; rejectionRate: number },
  ): Promise<AutoApproveResult> {
    try {
      // Get recent learnings for context
      let learningsContext = "";
      if (approval.requestedByAgentId) {
        const recentLearnings = await db
          .select({ type: aygentAgentLearnings.type, corrected: aygentAgentLearnings.corrected, actionType: aygentAgentLearnings.actionType })
          .from(aygentAgentLearnings)
          .where(
            and(
              eq(aygentAgentLearnings.companyId, companyId),
              eq(aygentAgentLearnings.agentId, approval.requestedByAgentId),
              eq(aygentAgentLearnings.active, true),
            ),
          )
          .orderBy(desc(aygentAgentLearnings.createdAt))
          .limit(5);

        if (recentLearnings.length > 0) {
          learningsContext = `\nAgent's recent corrections:\n${recentLearnings.map((l) => `- [${l.type}/${l.actionType}] ${l.corrected ?? ""}`).join("\n")}`;
        }
      }

      const result = await routedGenerate({
        taskType: "internal_reasoning",
        systemPrompt: `You are a quality gate for an AI real estate agency. You review outbound actions (WhatsApp messages, emails, Instagram posts) and decide if they can be auto-approved without the agency owner seeing them first.

Rules:
- Routine follow-up messages to low/medium-score leads: usually safe to auto-approve
- Viewing confirmations with correct details: safe to auto-approve
- Messages with the right tone and no compliance issues: safe
- Messages mentioning specific prices/yields/guarantees: REJECT (compliance risk)
- Unusual tone, aggressive sales language, or off-brand messaging: REJECT
- Anything that seems like the agent is making up information: REJECT

Respond with EXACTLY one line of JSON: {"autoApprove": true/false, "reason": "brief reason", "confidence": 0.0-1.0}`,
        userMessage: `Approval type: ${approval.type}
Payload: ${JSON.stringify(approval.payload, null, 2)}
Agent track record: ${trackRecord.total} total actions, ${trackRecord.corrections} corrections (${Math.round(trackRecord.rejectionRate * 100)}% correction rate)${learningsContext}

Should this be auto-approved?`,
        maxTokens: 128,
      });

      const parsed = JSON.parse(result.text.trim());
      return {
        autoApprove: parsed.autoApprove === true,
        reason: String(parsed.reason ?? "LLM review"),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      };
    } catch (err) {
      logger.warn({ err, approvalId: approval.id }, "auto-approve: LLM evaluation failed, defaulting to manual");
      return {
        autoApprove: false,
        reason: "LLM evaluation failed — defaulting to manual review",
        confidence: 0.5,
      };
    }
  }

  return { evaluate };
}
