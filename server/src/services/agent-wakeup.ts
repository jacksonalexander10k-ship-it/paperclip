/**
 * Universal wake-up helper.
 *
 * The rule: any real-world event that should cause an agent to act MUST call
 * wakeAgentNow(). Never rely on the scheduled heartbeat — that's the slow clock
 * for background sweeps. Events are the fast clock.
 *
 * Sources that must call this:
 *   - CEO delegates a task → wake the assignee
 *   - Inbound WhatsApp from a lead → wake the sales agent that owns that number
 *     (usually handled by direct-agent.ts; wake-up is the secondary path if direct fails)
 *   - New lead created via webhook/form/portal → wake the assigned sales agent
 *   - Inbound email → wake the operations/sales agent
 *   - Instagram DM inbound → wake the social/sales agent
 *   - Approval edited or rejected by owner → wake the drafter to learn from it
 *   - Any other event that requires an agent response
 *
 * The helper is idempotent per (agentId, triggerDetail) pair within a short window —
 * the scheduler will dedupe queued runs for the same wakeup source.
 */

import type { Db } from "@paperclipai/db";
import { agentWakeupRequests, heartbeatRuns } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

export interface WakeAgentOptions {
  /** What triggered the wake-up. Used for logging and telemetry. */
  reason:
    | "ceo_delegation"
    | "inbound_whatsapp"
    | "inbound_email"
    | "inbound_instagram_dm"
    | "new_lead"
    | "approval_feedback"
    | "webhook_event"
    | "system";
  /**
   * Short identifier for the specific trigger (e.g. "issue:<id>", "lead:<id>",
   * "whatsapp:<jid>"). Helps dedupe and debug.
   */
  triggerDetail: string;
  /** Arbitrary data passed to the run — issueId, leadId, chatJid, etc. */
  payload?: Record<string, unknown>;
  /** Who requested this wake-up. Defaults to system. */
  requestedBy?: { actorType: "agent" | "user" | "system"; actorId: string | null };
}

export async function wakeAgentNow(
  db: Db,
  companyId: string,
  agentId: string,
  opts: WakeAgentOptions,
): Promise<{ wakeupId: string; runId: string } | null> {
  const now = new Date();
  const source = opts.reason === "ceo_delegation" ? "delegation" : "event";
  const requestedBy = opts.requestedBy ?? { actorType: "system", actorId: null };

  try {
    const result = await db.transaction(async (tx) => {
      const [wakeup] = await tx
        .insert(agentWakeupRequests)
        .values({
          companyId,
          agentId,
          source,
          triggerDetail: opts.triggerDetail.slice(0, 200),
          reason: opts.reason,
          payload: opts.payload ?? {},
          status: "queued",
          requestedByActorType: requestedBy.actorType,
          requestedByActorId: requestedBy.actorId,
          updatedAt: now,
        })
        .returning();
      const [run] = await tx
        .insert(heartbeatRuns)
        .values({
          companyId,
          agentId,
          invocationSource: source,
          triggerDetail: opts.triggerDetail.slice(0, 200),
          status: "queued",
          wakeupRequestId: wakeup.id,
          contextSnapshot: { ...opts.payload, wakeReason: opts.reason },
          updatedAt: now,
        })
        .returning();
      await tx
        .update(agentWakeupRequests)
        .set({ runId: run.id, updatedAt: now })
        .where(eq(agentWakeupRequests.id, wakeup.id));
      return { wakeupId: wakeup.id, runId: run.id };
    });
    logger.info({ companyId, agentId, reason: opts.reason, triggerDetail: opts.triggerDetail }, "wake-up: agent queued for immediate run");
    return result;
  } catch (err) {
    logger.warn({ err, companyId, agentId, reason: opts.reason, triggerDetail: opts.triggerDetail }, "wake-up: failed to queue (agent will still run on next scheduled heartbeat)");
    return null;
  }
}
