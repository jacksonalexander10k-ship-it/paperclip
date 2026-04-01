import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentMemory } from "@paperclipai/db";
import { knowledgeBaseService } from "./knowledge-base.js";
import { logger } from "../middleware/logger.js";

/**
 * Manages the pipeline from agent observations → knowledge base.
 *
 * Agents write observations to `aygent_agent_memory` (type: "observation").
 * This service surfaces them for CEO review and promotes approved ones
 * into the knowledge base.
 */
export function kbAutoLearningService(db: Db) {
  /**
   * Record an agent observation (called from heartbeat output parsing).
   */
  async function recordObservation(
    companyId: string,
    agentId: string,
    subject: string,
    content: string,
  ) {
    // Upsert — if same agent + subject exists, update content
    const existing = await db
      .select()
      .from(aygentAgentMemory)
      .where(
        and(
          eq(aygentAgentMemory.companyId, companyId),
          eq(aygentAgentMemory.agentId, agentId),
          eq(aygentAgentMemory.subject, subject),
          eq(aygentAgentMemory.type, "observation"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(aygentAgentMemory)
        .set({ content, updatedAt: new Date() })
        .where(eq(aygentAgentMemory.id, existing[0]!.id));

      return existing[0]!;
    }

    const [row] = await db
      .insert(aygentAgentMemory)
      .values({
        companyId,
        agentId,
        type: "observation",
        subject,
        content,
      })
      .returning();

    logger.info(
      { companyId, agentId, subject },
      "kb-auto-learning: observation recorded",
    );

    return row!;
  }

  /**
   * List pending observations for CEO review.
   */
  async function listPendingObservations(companyId: string) {
    return db
      .select()
      .from(aygentAgentMemory)
      .where(
        and(
          eq(aygentAgentMemory.companyId, companyId),
          eq(aygentAgentMemory.type, "observation"),
        ),
      )
      .orderBy(desc(aygentAgentMemory.updatedAt));
  }

  /**
   * Promote an observation to the knowledge base (owner approved).
   */
  async function promoteToKnowledgeBase(
    companyId: string,
    observationId: string,
    userId: string,
  ) {
    const [obs] = await db
      .select()
      .from(aygentAgentMemory)
      .where(
        and(
          eq(aygentAgentMemory.id, observationId),
          eq(aygentAgentMemory.companyId, companyId),
        ),
      )
      .limit(1);

    if (!obs) return null;

    // Create a knowledge base file from the observation
    const kbSvc = knowledgeBaseService(db);
    const filename = `observation-${obs.subject.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md`;
    const content = `# ${obs.subject}\n\n${obs.content}\n\n---\n_Auto-learned by agent on ${new Date(obs.updatedAt).toISOString().slice(0, 10)}_\n`;

    const storageKey = `kb/${companyId}/${filename}`;

    const created = await kbSvc.create({
      companyId,
      filename,
      title: obs.subject,
      description: `Auto-learned observation: ${obs.subject}`,
      contentType: "text/markdown",
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      storageKey,
      uploadedByUserId: userId,
    });

    // Mark observation as promoted
    await db
      .update(aygentAgentMemory)
      .set({ type: "promoted", updatedAt: new Date() })
      .where(eq(aygentAgentMemory.id, observationId));

    logger.info(
      { companyId, observationId, filename },
      "kb-auto-learning: observation promoted to knowledge base",
    );

    return created;
  }

  /**
   * Dismiss an observation (owner rejects it).
   */
  async function dismissObservation(companyId: string, observationId: string) {
    const [updated] = await db
      .update(aygentAgentMemory)
      .set({ type: "dismissed", updatedAt: new Date() })
      .where(
        and(
          eq(aygentAgentMemory.id, observationId),
          eq(aygentAgentMemory.companyId, companyId),
        ),
      )
      .returning();

    return updated ?? null;
  }

  return {
    recordObservation,
    listPendingObservations,
    promoteToKnowledgeBase,
    dismissObservation,
  };
}
