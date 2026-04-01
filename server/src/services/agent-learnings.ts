import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentLearnings } from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

const MAX_ACTIVE_LEARNINGS_PER_AGENT = 50;
const MAX_INJECT_PER_RUN = 10;
const COMPACTION_THRESHOLD = 20;
const STALE_DAYS = 90;

export interface CaptureCorrection {
  agentId: string;
  approvalId: string;
  actionType: string;
  context?: string;
  original: string;
  corrected: string;
  reason?: string;
}

export interface CaptureRejection {
  agentId: string;
  approvalId: string;
  actionType: string;
  context?: string;
  original: string;
  reason?: string;
}

export function agentLearningService(db: Db) {
  // -----------------------------------------------------------------------
  // Capture learnings from approval actions
  // -----------------------------------------------------------------------

  async function captureCorrection(companyId: string, input: CaptureCorrection) {
    // Don't store if original and corrected are identical
    if (input.original.trim() === input.corrected.trim()) return null;

    await enforceActiveCap(companyId, input.agentId);

    const [learning] = await db
      .insert(aygentAgentLearnings)
      .values({
        companyId,
        agentId: input.agentId,
        approvalId: input.approvalId,
        type: "correction",
        actionType: input.actionType,
        context: input.context ?? null,
        original: input.original,
        corrected: input.corrected,
        reason: input.reason ?? null,
      })
      .returning();

    logger.info(
      { companyId, agentId: input.agentId, learningId: learning!.id, actionType: input.actionType },
      "agent-learnings: correction captured",
    );

    return learning!;
  }

  async function captureRejection(companyId: string, input: CaptureRejection) {
    await enforceActiveCap(companyId, input.agentId);

    const [learning] = await db
      .insert(aygentAgentLearnings)
      .values({
        companyId,
        agentId: input.agentId,
        approvalId: input.approvalId,
        type: "rejection",
        actionType: input.actionType,
        context: input.context ?? null,
        original: input.original,
        corrected: null,
        reason: input.reason ?? null,
      })
      .returning();

    logger.info(
      { companyId, agentId: input.agentId, learningId: learning!.id },
      "agent-learnings: rejection captured",
    );

    return learning!;
  }

  // -----------------------------------------------------------------------
  // Query learnings for injection into agent runs
  // -----------------------------------------------------------------------

  /**
   * Get relevant learnings for an agent run, filtered by action type.
   * Returns the most recent N active learnings, with optional filtering.
   */
  async function getForInjection(
    companyId: string,
    agentId: string,
    actionType?: string,
  ) {
    const conditions = [
      eq(aygentAgentLearnings.companyId, companyId),
      eq(aygentAgentLearnings.agentId, agentId),
      eq(aygentAgentLearnings.active, true),
    ];

    if (actionType) {
      conditions.push(eq(aygentAgentLearnings.actionType, actionType));
    }

    const learnings = await db
      .select()
      .from(aygentAgentLearnings)
      .where(and(...conditions))
      .orderBy(desc(aygentAgentLearnings.createdAt))
      .limit(MAX_INJECT_PER_RUN);

    // Increment applied count for all returned learnings
    if (learnings.length > 0) {
      const ids = learnings.map((l) => l.id);
      await db
        .update(aygentAgentLearnings)
        .set({
          appliedCount: sql`${aygentAgentLearnings.appliedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aygentAgentLearnings.companyId, companyId),
            sql`${aygentAgentLearnings.id} = ANY(${ids})`,
          ),
        )
        .catch((err) => {
          logger.warn({ err }, "agent-learnings: failed to increment applied count");
        });
    }

    return learnings;
  }

  /**
   * Format learnings as a prompt section for injection into agent system prompt.
   */
  async function formatForPrompt(
    companyId: string,
    agentId: string,
    actionType?: string,
  ): Promise<string> {
    const learnings = await getForInjection(companyId, agentId, actionType);

    if (learnings.length === 0) return "";

    const lines = learnings.map((l) => {
      if (l.type === "correction") {
        const reason = l.reason ? ` Reason: ${l.reason}` : "";
        return `- [${l.actionType ?? "general"}] You wrote: "${truncate(l.original ?? "", 120)}" → Owner changed to: "${truncate(l.corrected ?? "", 120)}"${reason}`;
      }
      if (l.type === "rejection") {
        const reason = l.reason ? ` Reason: ${l.reason}` : "";
        return `- [${l.actionType ?? "general"}] REJECTED: "${truncate(l.original ?? "", 120)}"${reason}`;
      }
      if (l.type === "compacted") {
        return `- [insight] ${l.corrected ?? l.context ?? ""}`;
      }
      return `- [${l.type}] ${l.context ?? l.original ?? ""}`;
    });

    return `\n### Previous Corrections from Your Agency Owner (${learnings.length})\nLearn from these — apply the same adjustments to similar future output:\n${lines.join("\n")}\n`;
  }

  // -----------------------------------------------------------------------
  // CRUD for dashboard
  // -----------------------------------------------------------------------

  async function list(companyId: string, agentId?: string) {
    const conditions = [eq(aygentAgentLearnings.companyId, companyId)];
    if (agentId) conditions.push(eq(aygentAgentLearnings.agentId, agentId));

    return db
      .select()
      .from(aygentAgentLearnings)
      .where(and(...conditions))
      .orderBy(desc(aygentAgentLearnings.createdAt));
  }

  async function deactivate(id: string, companyId: string) {
    const [updated] = await db
      .update(aygentAgentLearnings)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(aygentAgentLearnings.id, id), eq(aygentAgentLearnings.companyId, companyId)))
      .returning();
    return updated ?? null;
  }

  async function remove(id: string, companyId: string) {
    const [deleted] = await db
      .delete(aygentAgentLearnings)
      .where(and(eq(aygentAgentLearnings.id, id), eq(aygentAgentLearnings.companyId, companyId)))
      .returning();
    return deleted ?? null;
  }

  async function stats(companyId: string, agentId?: string) {
    const conditions = [eq(aygentAgentLearnings.companyId, companyId)];
    if (agentId) conditions.push(eq(aygentAgentLearnings.agentId, agentId));

    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${aygentAgentLearnings.active} = true)::int`,
        corrections: sql<number>`count(*) filter (where ${aygentAgentLearnings.type} = 'correction')::int`,
        rejections: sql<number>`count(*) filter (where ${aygentAgentLearnings.type} = 'rejection')::int`,
        totalApplied: sql<number>`coalesce(sum(${aygentAgentLearnings.appliedCount}), 0)::int`,
      })
      .from(aygentAgentLearnings)
      .where(and(...conditions));

    return row!;
  }

  // -----------------------------------------------------------------------
  // Weekly compaction — summarize many raw corrections into fewer durable insights
  // -----------------------------------------------------------------------

  async function compactLearnings(companyId: string, agentId: string) {
    const activeLearnings = await db
      .select()
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          eq(aygentAgentLearnings.active, true),
          sql`${aygentAgentLearnings.type} != 'compacted'`,
        ),
      )
      .orderBy(desc(aygentAgentLearnings.createdAt));

    if (activeLearnings.length < COMPACTION_THRESHOLD) return null;

    // Summarize via Gemini Flash (cheap)
    const learningTexts = activeLearnings.map((l) => {
      if (l.type === "correction") {
        return `Correction (${l.actionType}): "${l.original}" → "${l.corrected}"${l.reason ? ` (${l.reason})` : ""}`;
      }
      return `Rejection (${l.actionType}): "${l.original}"${l.reason ? ` (${l.reason})` : ""}`;
    });

    const result = await routedGenerate({
      taskType: "learning_compaction",
      systemPrompt:
        "You are an AI that summarizes agent correction patterns. Given a list of corrections an agency owner has made to their AI agent's output, identify the 5 most important recurring patterns and summarize each as a single clear instruction. Be specific and actionable.",
      userMessage: `Here are ${activeLearnings.length} corrections:\n\n${learningTexts.join("\n")}\n\nSummarize into exactly 5 key patterns as a JSON array of strings.`,
      maxTokens: 512,
    });

    let patterns: string[];
    try {
      patterns = JSON.parse(result.text);
      if (!Array.isArray(patterns)) throw new Error("Not an array");
    } catch {
      logger.warn({ text: result.text }, "agent-learnings: failed to parse compaction result");
      return null;
    }

    // Archive old learnings and insert compacted ones
    const sourceIds = activeLearnings.map((l) => l.id);

    await db
      .update(aygentAgentLearnings)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          eq(aygentAgentLearnings.active, true),
          sql`${aygentAgentLearnings.type} != 'compacted'`,
        ),
      );

    const compactedRows = patterns.slice(0, 5).map((pattern) => ({
      companyId,
      agentId,
      type: "compacted" as const,
      actionType: "general",
      context: `Compacted from ${activeLearnings.length} learnings`,
      original: null,
      corrected: pattern,
      reason: null,
      sourceIds: sourceIds as unknown as Record<string, unknown>,
    }));

    await db.insert(aygentAgentLearnings).values(compactedRows);

    logger.info(
      { companyId, agentId, sourceLearnings: activeLearnings.length, compactedTo: patterns.length },
      "agent-learnings: compaction complete",
    );

    return { compacted: activeLearnings.length, insights: patterns.length };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  async function enforceActiveCap(companyId: string, agentId: string) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          eq(aygentAgentLearnings.active, true),
        ),
      );

    if ((countRow?.count ?? 0) >= MAX_ACTIVE_LEARNINGS_PER_AGENT) {
      // Archive the oldest active learnings to make room
      const toArchive = (countRow?.count ?? 0) - MAX_ACTIVE_LEARNINGS_PER_AGENT + 1;
      const oldest = await db
        .select({ id: aygentAgentLearnings.id })
        .from(aygentAgentLearnings)
        .where(
          and(
            eq(aygentAgentLearnings.companyId, companyId),
            eq(aygentAgentLearnings.agentId, agentId),
            eq(aygentAgentLearnings.active, true),
          ),
        )
        .orderBy(aygentAgentLearnings.createdAt)
        .limit(toArchive);

      if (oldest.length > 0) {
        for (const row of oldest) {
          await db
            .update(aygentAgentLearnings)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(aygentAgentLearnings.id, row.id));
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Conflict detection
  // -----------------------------------------------------------------------

  /**
   * Detect conflicting learnings — e.g. owner approves casual tone one day,
   * edits to formal the next. Returns pairs of learnings that contradict.
   */
  async function detectConflicts(companyId: string, agentId: string) {
    const active = await db
      .select()
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          eq(aygentAgentLearnings.active, true),
          eq(aygentAgentLearnings.type, "correction"),
        ),
      )
      .orderBy(desc(aygentAgentLearnings.createdAt));

    const conflicts: Array<{ newer: typeof active[0]; older: typeof active[0] }> = [];

    // Group by actionType, then check if corrections within same actionType contradict
    const byAction = new Map<string, typeof active>();
    for (const l of active) {
      const key = l.actionType ?? "general";
      if (!byAction.has(key)) byAction.set(key, []);
      byAction.get(key)!.push(l);
    }

    for (const [, group] of byAction) {
      if (group.length < 2) continue;
      // Simple heuristic: if the corrected text of a newer learning is similar
      // to the original text of an older learning (owner reverted a previous correction),
      // flag as conflict
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const newer = group[i]!;
          const older = group[j]!;
          // If newer.corrected is closer to older.original than older.corrected,
          // it's likely a reversal
          if (newer.corrected && older.original && older.corrected) {
            const newerMatchesOlderOriginal =
              newer.corrected.toLowerCase().includes(older.original.toLowerCase().slice(0, 20));
            if (newerMatchesOlderOriginal) {
              conflicts.push({ newer, older });
            }
          }
        }
      }
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Decay flagging — learnings older than STALE_DAYS
  // -----------------------------------------------------------------------

  async function flagStale(companyId: string, agentId?: string) {
    const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const conditions = [
      eq(aygentAgentLearnings.companyId, companyId),
      eq(aygentAgentLearnings.active, true),
      lt(aygentAgentLearnings.createdAt, staleDate),
    ];
    if (agentId) conditions.push(eq(aygentAgentLearnings.agentId, agentId));

    return db
      .select()
      .from(aygentAgentLearnings)
      .where(and(...conditions))
      .orderBy(aygentAgentLearnings.createdAt);
  }

  // -----------------------------------------------------------------------
  // Export — full learning data as JSON for data portability
  // -----------------------------------------------------------------------

  async function exportAll(companyId: string) {
    const all = await db
      .select()
      .from(aygentAgentLearnings)
      .where(eq(aygentAgentLearnings.companyId, companyId))
      .orderBy(desc(aygentAgentLearnings.createdAt));

    return {
      exportedAt: new Date().toISOString(),
      companyId,
      totalLearnings: all.length,
      learnings: all.map((l) => ({
        id: l.id,
        agentId: l.agentId,
        type: l.type,
        actionType: l.actionType,
        context: l.context,
        original: l.original,
        corrected: l.corrected,
        reason: l.reason,
        appliedCount: l.appliedCount,
        active: l.active,
        createdAt: l.createdAt,
      })),
    };
  }

  return {
    captureCorrection,
    captureRejection,
    getForInjection,
    formatForPrompt,
    list,
    deactivate,
    remove,
    stats,
    compactLearnings,
    detectConflicts,
    flagStale,
    exportAll,
  };
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...";
}
