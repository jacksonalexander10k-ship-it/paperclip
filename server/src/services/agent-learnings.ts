import { and, desc, eq, lt, sql, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentLearnings, approvals, agents, heartbeatRuns } from "@paperclipai/db";
import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

const MAX_ACTIVE_LEARNINGS_PER_AGENT = 50;
const MAX_INJECT_PER_RUN = 10;
const COMPACTION_THRESHOLD = 20;
const STALE_DAYS = 90;

/** Minimum rejections on the same actionType before FIX mode triggers */
const FIX_REJECTION_THRESHOLD = 5;
/** Minimum run count difference before DERIVED mode considers an agent "better" */
const DERIVED_MIN_RUNS = 10;

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

    // Trigger skill self-improvement in the background
    proposeSkillAmendments(companyId, agentId, patterns, learningTexts).catch((err) => {
      logger.warn({ err, companyId, agentId }, "agent-learnings: skill amendment proposal failed");
    });

    return { compacted: activeLearnings.length, insights: patterns.length };
  }

  // -----------------------------------------------------------------------
  // Skill self-improvement — propose skill file amendments from compacted patterns
  // -----------------------------------------------------------------------

  /**
   * After learning compaction, check if recurring patterns should be baked into
   * the agent's skill files permanently. Creates a `skill_amendment` approval
   * for the owner to review.
   *
   * Inspired by Hermes Agent's skill self-improvement loop.
   */
  async function proposeSkillAmendments(
    companyId: string,
    agentId: string,
    compactedPatterns: string[],
    rawLearnings: string[],
  ) {
    // Need at least 3 compacted patterns to consider skill amendments
    if (compactedPatterns.length < 3) return;

    // Look up the agent's role to determine which skill files are relevant
    const agent = await db
      .select({ role: agents.role, name: agents.name })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);

    if (!agent) return;

    // Map roles to their primary skill files
    const roleSkillMap: Record<string, string[]> = {
      sales: ["lead-response.md", "lead-qualification.md", "lead-handoff.md"],
      content: ["content-instagram.md", "content-pitch-deck.md"],
      marketing: ["market-dld-monitoring.md"],
      viewing: ["viewing-scheduling.md"],
      finance: ["portfolio-tenancy.md"],
      portfolio: ["portfolio-tenancy.md"],
      ceo: [],
    };

    const normalizedRole = agent.role.toLowerCase().replace(/-agent$/, "").replace(/^lead/, "sales");
    const skillFiles = roleSkillMap[normalizedRole] ?? [];
    if (skillFiles.length === 0) return;

    // Ask the LLM which skill file (if any) should be amended
    try {
      const result = await routedGenerate({
        taskType: "learning_compaction",
        systemPrompt: `You analyze patterns from agent corrections and determine if any skill files should be updated.

Given a list of compacted learning patterns and the agent's available skill files, determine:
1. Does any pattern represent a PERMANENT agency preference that should be written into a skill file? (not a one-off correction)
2. If yes, which skill file should be amended and what section/rule should be added?

Only propose amendments for STRONG, RECURRING patterns — not one-time corrections.

Respond with JSON: {"amend": false} if no amendment needed, or:
{"amend": true, "skillFile": "filename.md", "section": "section name", "rule": "the new rule to add", "evidence": "why this is a permanent pattern"}`,
        userMessage: `Agent role: ${agent.role} (${agent.name})
Available skill files: ${skillFiles.join(", ")}

Compacted patterns (${compactedPatterns.length}):
${compactedPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Raw corrections these came from (${rawLearnings.length}):
${rawLearnings.slice(0, 10).join("\n")}

Should any skill file be permanently updated?`,
        maxTokens: 256,
      });

      const parsed = JSON.parse(result.text.trim());
      if (!parsed.amend || !parsed.skillFile || !parsed.rule) return;

      // Validate the skill file is in our allowed list
      if (!skillFiles.includes(parsed.skillFile)) {
        logger.info(
          { skillFile: parsed.skillFile, allowed: skillFiles },
          "agent-learnings: LLM proposed amendment to non-allowed skill file, skipping",
        );
        return;
      }

      // Read current skill content
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const skillPath = resolve(process.cwd(), "skills", parsed.skillFile);
      let currentContent = "";
      try {
        currentContent = await readFile(skillPath, "utf-8");
      } catch {
        // File doesn't exist — can't amend what doesn't exist
        return;
      }

      // Generate the proposed updated skill
      const amendResult = await routedGenerate({
        taskType: "learning_compaction",
        systemPrompt: `You are editing a skill file (markdown) for an AI real estate agent. Add the new rule in the appropriate section. Keep all existing content. Only ADD — never remove or rephrase existing rules. Mark the new addition with a comment like "<!-- learned from owner corrections -->".`,
        userMessage: `Current skill file (${parsed.skillFile}):\n\n${currentContent}\n\nNew rule to add in section "${parsed.section}":\n${parsed.rule}\n\nReturn the complete updated file content.`,
        maxTokens: 2048,
      });

      if (!amendResult.text || amendResult.text.length < currentContent.length * 0.5) {
        logger.warn(
          { skillFile: parsed.skillFile },
          "agent-learnings: proposed skill amendment seems too short, skipping",
        );
        return;
      }

      // Create a skill_amendment approval for the owner to review
      await db.insert(approvals).values({
        companyId,
        type: "skill_amendment",
        requestedByAgentId: agentId,
        status: "pending",
        payload: {
          action: "skill_amendment",
          skillFile: parsed.skillFile,
          currentText: currentContent,
          proposedText: amendResult.text,
          section: parsed.section,
          rule: parsed.rule,
          evidence: parsed.evidence,
          agentName: agent.name,
          sourcePatternCount: compactedPatterns.length,
          sourceLearningCount: rawLearnings.length,
        },
      });

      logger.info(
        {
          companyId,
          agentId,
          skillFile: parsed.skillFile,
          rule: parsed.rule,
        },
        "agent-learnings: skill amendment proposed",
      );
    } catch (err) {
      logger.warn({ err, companyId, agentId }, "agent-learnings: skill amendment analysis failed");
    }
  }

  // -----------------------------------------------------------------------
  // FIX mode — detect when a skill rule causes repeated rejections and propose a repair
  // -----------------------------------------------------------------------

  /**
   * Scans recent rejections/corrections for an agent. If the same actionType
   * has FIX_REJECTION_THRESHOLD+ rejections, the skill file likely has a rule
   * that doesn't match the owner's expectations. Propose a targeted fix.
   *
   * OpenSpace taxonomy: FIX — repair broken skills in-place.
   */
  async function detectAndFixBrokenSkills(companyId: string, agentId: string) {
    const agent = await db
      .select({ role: agents.role, name: agents.name })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);

    if (!agent) return null;

    // Count rejections by actionType in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rejectionCounts = await db
      .select({
        actionType: aygentAgentLearnings.actionType,
        count: sql<number>`count(*)::int`,
      })
      .from(aygentAgentLearnings)
      .where(
        and(
          eq(aygentAgentLearnings.companyId, companyId),
          eq(aygentAgentLearnings.agentId, agentId),
          sql`${aygentAgentLearnings.type} IN ('correction', 'rejection')`,
          sql`${aygentAgentLearnings.createdAt} >= ${thirtyDaysAgo}`,
        ),
      )
      .groupBy(aygentAgentLearnings.actionType);

    const brokenActionTypes = rejectionCounts.filter((r) => r.count >= FIX_REJECTION_THRESHOLD);
    if (brokenActionTypes.length === 0) return null;

    const roleSkillMap: Record<string, string[]> = {
      sales: ["lead-response.md", "lead-qualification.md", "lead-handoff.md"],
      content: ["content-instagram.md", "content-pitch-deck.md"],
      marketing: ["market-dld-monitoring.md"],
      viewing: ["viewing-scheduling.md"],
      finance: ["portfolio-tenancy.md"],
      portfolio: ["portfolio-tenancy.md"],
      ceo: [],
    };

    const normalizedRole = agent.role.toLowerCase().replace(/-agent$/, "").replace(/^lead/, "sales");
    const skillFiles = roleSkillMap[normalizedRole] ?? [];
    if (skillFiles.length === 0) return null;

    const fixes: string[] = [];

    for (const broken of brokenActionTypes) {
      // Gather the actual corrections for this actionType
      const corrections = await db
        .select({
          original: aygentAgentLearnings.original,
          corrected: aygentAgentLearnings.corrected,
          reason: aygentAgentLearnings.reason,
          type: aygentAgentLearnings.type,
        })
        .from(aygentAgentLearnings)
        .where(
          and(
            eq(aygentAgentLearnings.companyId, companyId),
            eq(aygentAgentLearnings.agentId, agentId),
            sql`${aygentAgentLearnings.actionType} = ${broken.actionType}`,
            sql`${aygentAgentLearnings.type} IN ('correction', 'rejection')`,
            sql`${aygentAgentLearnings.createdAt} >= ${thirtyDaysAgo}`,
          ),
        )
        .orderBy(desc(aygentAgentLearnings.createdAt))
        .limit(10);

      try {
        // Ask LLM to identify which skill rule is broken
        const result = await routedGenerate({
          taskType: "learning_compaction",
          systemPrompt: `You are diagnosing a broken rule in an AI agent's skill file. The agent keeps getting corrected/rejected for the same type of action. Analyze the corrections and identify which EXISTING rule in the skill file is causing the problem.

Respond with JSON:
{"broken": true, "skillFile": "filename.md", "brokenRule": "the rule that's causing issues", "fixedRule": "the corrected version of the rule", "evidence": "why this fix is needed"}
or {"broken": false} if the corrections don't point to a specific broken rule.`,
          userMessage: `Agent: ${agent.name} (${agent.role})
Action type with ${broken.count} corrections: ${broken.actionType}
Available skill files: ${skillFiles.join(", ")}

Recent corrections:
${corrections.map((c) => {
  if (c.type === "correction") {
    return `- Agent wrote: "${truncate(c.original ?? "", 100)}" → Owner changed to: "${truncate(c.corrected ?? "", 100)}"${c.reason ? ` (${c.reason})` : ""}`;
  }
  return `- REJECTED: "${truncate(c.original ?? "", 100)}"${c.reason ? ` (${c.reason})` : ""}`;
}).join("\n")}

Which rule is broken?`,
          maxTokens: 256,
        });

        const parsed = JSON.parse(result.text.trim());
        if (!parsed.broken || !parsed.skillFile || !parsed.fixedRule) continue;
        if (!skillFiles.includes(parsed.skillFile)) continue;

        // Read the skill file and propose the fix
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");
        const skillPath = resolve(process.cwd(), "skills", parsed.skillFile);
        let currentContent = "";
        try {
          currentContent = await readFile(skillPath, "utf-8");
        } catch {
          continue;
        }

        // Generate the fixed version
        const fixResult = await routedGenerate({
          taskType: "learning_compaction",
          systemPrompt: `You are fixing a broken rule in an AI agent's skill file. Replace the broken rule with the fixed version. Keep everything else exactly the same. Mark the fix with "<!-- FIX: repaired from ${broken.count} owner corrections -->".`,
          userMessage: `Skill file (${parsed.skillFile}):\n\n${currentContent}\n\nBroken rule: ${parsed.brokenRule}\nFixed rule: ${parsed.fixedRule}\n\nReturn the complete fixed file.`,
          maxTokens: 2048,
        });

        if (!fixResult.text || fixResult.text.length < currentContent.length * 0.5) continue;

        // Create skill_amendment approval
        await db.insert(approvals).values({
          companyId,
          type: "skill_amendment",
          requestedByAgentId: agentId,
          status: "pending",
          payload: {
            action: "skill_amendment",
            evolutionMode: "fix",
            skillFile: parsed.skillFile,
            currentText: currentContent,
            proposedText: fixResult.text,
            brokenRule: parsed.brokenRule,
            fixedRule: parsed.fixedRule,
            evidence: `${broken.count} corrections on ${broken.actionType} in last 30 days. ${parsed.evidence}`,
            agentName: agent.name,
          },
        });

        fixes.push(`${parsed.skillFile}: fixed "${truncate(parsed.brokenRule, 60)}" (${broken.count} corrections)`);

        logger.info(
          { companyId, agentId, skillFile: parsed.skillFile, actionType: broken.actionType, corrections: broken.count },
          "agent-learnings: FIX mode — broken skill rule detected, amendment proposed",
        );
      } catch (err) {
        logger.warn({ err, actionType: broken.actionType }, "agent-learnings: FIX mode analysis failed");
      }
    }

    return fixes.length > 0 ? { fixes } : null;
  }

  // -----------------------------------------------------------------------
  // DERIVED mode — clone winning agent's skill improvements to underperformers
  // -----------------------------------------------------------------------

  /**
   * Compares agents with the same role within a company. If one agent has a
   * significantly better approval rate (fewer corrections/rejections), propose
   * deriving an improved skill version from the winner's learnings.
   *
   * OpenSpace taxonomy: DERIVED — create enhanced skill versions from successful agents.
   */
  async function deriveFromTopPerformers(companyId: string) {
    // Get all agents with their roles
    const allAgents = await db
      .select({ id: agents.id, name: agents.name, role: agents.role })
      .from(agents)
      .where(eq(agents.companyId, companyId));

    // Group agents by role
    const byRole = new Map<string, typeof allAgents>();
    for (const agent of allAgents) {
      const role = agent.role.toLowerCase().replace(/-agent$/, "").replace(/^lead/, "sales");
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role)!.push(agent);
    }

    const derivations: string[] = [];

    for (const [role, roleAgents] of byRole) {
      // Need at least 2 agents in the same role to compare
      if (roleAgents.length < 2) continue;

      // Get performance stats for each agent in this role
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const agentStats: Array<{
        agent: typeof roleAgents[0];
        totalRuns: number;
        successRate: number;
        correctionRate: number;
      }> = [];

      for (const agent of roleAgents) {
        // Count successful runs
        const [runStats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')::int`,
          })
          .from(heartbeatRuns)
          .where(
            and(
              eq(heartbeatRuns.companyId, companyId),
              eq(heartbeatRuns.agentId, agent.id),
              sql`${heartbeatRuns.startedAt} >= ${thirtyDaysAgo}`,
            ),
          );

        // Count corrections
        const [learningStats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            corrections: sql<number>`count(*) filter (where ${aygentAgentLearnings.type} IN ('correction', 'rejection'))::int`,
          })
          .from(aygentAgentLearnings)
          .where(
            and(
              eq(aygentAgentLearnings.companyId, companyId),
              eq(aygentAgentLearnings.agentId, agent.id),
              sql`${aygentAgentLearnings.createdAt} >= ${thirtyDaysAgo}`,
            ),
          );

        const totalRuns = runStats?.total ?? 0;
        const succeeded = runStats?.succeeded ?? 0;
        const corrections = learningStats?.corrections ?? 0;
        const totalApprovals = learningStats?.total ?? 0;

        if (totalRuns < DERIVED_MIN_RUNS) continue; // Not enough data

        agentStats.push({
          agent,
          totalRuns,
          successRate: totalRuns > 0 ? succeeded / totalRuns : 0,
          correctionRate: totalApprovals > 0 ? corrections / totalApprovals : 0,
        });
      }

      if (agentStats.length < 2) continue;

      // Sort by correction rate (lower = better)
      agentStats.sort((a, b) => a.correctionRate - b.correctionRate);

      const best = agentStats[0]!;
      const worst = agentStats[agentStats.length - 1]!;

      // Only derive if there's a meaningful gap (>15 percentage points)
      const gap = worst.correctionRate - best.correctionRate;
      if (gap < 0.15) continue;

      // Get the best agent's compacted learnings (their learned patterns)
      const bestLearnings = await db
        .select({
          corrected: aygentAgentLearnings.corrected,
          actionType: aygentAgentLearnings.actionType,
          context: aygentAgentLearnings.context,
        })
        .from(aygentAgentLearnings)
        .where(
          and(
            eq(aygentAgentLearnings.companyId, companyId),
            eq(aygentAgentLearnings.agentId, best.agent.id),
            eq(aygentAgentLearnings.active, true),
            eq(aygentAgentLearnings.type, "compacted"),
          ),
        )
        .orderBy(desc(aygentAgentLearnings.createdAt))
        .limit(10);

      if (bestLearnings.length === 0) continue;

      const roleSkillMap: Record<string, string[]> = {
        sales: ["lead-response.md", "lead-qualification.md", "lead-handoff.md"],
        content: ["content-instagram.md", "content-pitch-deck.md"],
        marketing: ["market-dld-monitoring.md"],
        viewing: ["viewing-scheduling.md"],
        finance: ["portfolio-tenancy.md"],
        portfolio: ["portfolio-tenancy.md"],
        ceo: [],
      };

      const skillFiles = roleSkillMap[role] ?? [];
      if (skillFiles.length === 0) continue;

      try {
        // Ask LLM to create an enhanced skill from the best agent's patterns
        const result = await routedGenerate({
          taskType: "learning_compaction",
          systemPrompt: `You compare two AI agents with the same role. One agent (the "winner") has a much lower correction rate than the other (the "learner"). You extract what the winner does differently and propose skill improvements for the learner.

Respond with JSON:
{"derive": true, "skillFile": "filename.md", "improvements": ["improvement 1", "improvement 2"], "evidence": "why these improvements matter"}
or {"derive": false} if the winner's patterns aren't transferable.`,
          userMessage: `Role: ${role}
Winner: ${best.agent.name} — ${Math.round(best.correctionRate * 100)}% correction rate, ${best.totalRuns} runs
Learner: ${worst.agent.name} — ${Math.round(worst.correctionRate * 100)}% correction rate, ${worst.totalRuns} runs

Winner's learned patterns:
${bestLearnings.map((l) => `- [${l.actionType}] ${l.corrected ?? l.context ?? ""}`).join("\n")}

Available skill files: ${skillFiles.join(", ")}

What should the learner's skill file include from the winner's patterns?`,
          maxTokens: 256,
        });

        const parsed = JSON.parse(result.text.trim());
        if (!parsed.derive || !parsed.skillFile || !parsed.improvements?.length) continue;
        if (!skillFiles.includes(parsed.skillFile)) continue;

        // Read the skill file
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");
        const skillPath = resolve(process.cwd(), "skills", parsed.skillFile);
        let currentContent = "";
        try {
          currentContent = await readFile(skillPath, "utf-8");
        } catch {
          continue;
        }

        // Generate the derived version
        const deriveResult = await routedGenerate({
          taskType: "learning_compaction",
          systemPrompt: `You are enhancing a skill file with patterns learned from a top-performing agent. Add the improvements as new rules in appropriate sections. Keep all existing content. Mark additions with "<!-- DERIVED: learned from ${best.agent.name}'s success patterns -->".`,
          userMessage: `Skill file (${parsed.skillFile}):\n\n${currentContent}\n\nImprovements to add:\n${parsed.improvements.map((i: string, idx: number) => `${idx + 1}. ${i}`).join("\n")}\n\nReturn the complete enhanced file.`,
          maxTokens: 2048,
        });

        if (!deriveResult.text || deriveResult.text.length < currentContent.length * 0.5) continue;

        // Create skill_amendment approval targeted at the underperforming agent
        await db.insert(approvals).values({
          companyId,
          type: "skill_amendment",
          requestedByAgentId: worst.agent.id,
          status: "pending",
          payload: {
            action: "skill_amendment",
            evolutionMode: "derived",
            skillFile: parsed.skillFile,
            currentText: currentContent,
            proposedText: deriveResult.text,
            improvements: parsed.improvements,
            evidence: parsed.evidence,
            agentName: worst.agent.name,
            derivedFrom: best.agent.name,
            winnerCorrectionRate: `${Math.round(best.correctionRate * 100)}%`,
            learnerCorrectionRate: `${Math.round(worst.correctionRate * 100)}%`,
            performanceGap: `${Math.round(gap * 100)}%`,
          },
        });

        derivations.push(
          `${parsed.skillFile}: derived ${parsed.improvements.length} improvements from ${best.agent.name} → ${worst.agent.name}`,
        );

        logger.info(
          {
            companyId,
            role,
            winner: best.agent.name,
            learner: worst.agent.name,
            gap: `${Math.round(gap * 100)}%`,
            skillFile: parsed.skillFile,
          },
          "agent-learnings: DERIVED mode — skill improvement proposed from top performer",
        );
      } catch (err) {
        logger.warn({ err, role }, "agent-learnings: DERIVED mode analysis failed");
      }
    }

    return derivations.length > 0 ? { derivations } : null;
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
    /** FIX mode: detect broken skill rules from repeated rejections and propose repairs */
    detectAndFixBrokenSkills,
    /** DERIVED mode: clone winning agent's patterns to underperforming agents with same role */
    deriveFromTopPerformers,
  };
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...";
}
