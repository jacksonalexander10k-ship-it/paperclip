import { and, desc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentMessages } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { pushNotificationService } from "./push-notifications.js";

const MAX_OUTBOUND_PER_RUN = 5;
const MESSAGE_TTL_HOURS = 48;
const MAX_TRIGGERED_WAKES_PER_DAY = 3;
const LOOP_DETECTION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface SendMessage {
  fromAgentId: string;
  toAgentId?: string; // null = broadcast
  priority: "info" | "action" | "urgent";
  messageType: string;
  summary?: string;
  data?: Record<string, unknown>;
}

export interface WakeupFn {
  (agentId: string, opts: {
    source?: "timer" | "assignment" | "on_demand" | "automation";
    triggerDetail?: "manual" | "ping" | "callback" | "system";
    reason?: string | null;
    payload?: Record<string, unknown> | null;
    requestedByActorType?: "user" | "agent" | "system";
    requestedByActorId?: string | null;
    contextSnapshot?: Record<string, unknown>;
  }): Promise<{ id: string } | null>;
}

export function agentMessageService(db: Db, wakeupFn?: WakeupFn) {
  // -----------------------------------------------------------------------
  // Send messages between agents (with optional event-driven wake)
  // -----------------------------------------------------------------------

  async function send(companyId: string, message: SendMessage) {
    const expiresAt = new Date(Date.now() + MESSAGE_TTL_HOURS * 60 * 60 * 1000);

    const [row] = await db
      .insert(aygentAgentMessages)
      .values({
        companyId,
        fromAgentId: message.fromAgentId,
        toAgentId: message.toAgentId ?? null,
        priority: message.priority,
        messageType: message.messageType,
        summary: message.summary ?? null,
        data: message.data ?? null,
        readByAgents: [],
        expiresAt,
      })
      .returning();

    logger.info(
      {
        companyId,
        fromAgentId: message.fromAgentId,
        toAgentId: message.toAgentId ?? "broadcast",
        messageType: message.messageType,
        priority: message.priority,
      },
      "agent-messages: message sent",
    );

    // Event-driven wake: action/urgent messages trigger immediate run for target agent
    if (wakeupFn && message.toAgentId && (message.priority === "action" || message.priority === "urgent")) {
      try {
        const shouldWake = await canTriggerWake(companyId, message.fromAgentId, message.toAgentId);
        if (shouldWake) {
          await wakeupFn(message.toAgentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "inter_agent_message",
            payload: {
              messageId: row!.id,
              fromAgentId: message.fromAgentId,
              messageType: message.messageType,
              priority: message.priority,
            },
            requestedByActorType: "agent",
            requestedByActorId: message.fromAgentId,
            contextSnapshot: {
              source: "agent_message",
              messageId: row!.id,
              fromAgentId: message.fromAgentId,
              messageType: message.messageType,
              wakeReason: "inter_agent_message",
            },
          });

          logger.info(
            { companyId, fromAgentId: message.fromAgentId, toAgentId: message.toAgentId, priority: message.priority },
            "agent-messages: triggered immediate wake for target agent",
          );
        } else {
          logger.warn(
            { companyId, fromAgentId: message.fromAgentId, toAgentId: message.toAgentId },
            "agent-messages: wake blocked by rate limit or loop detection",
          );
        }
      } catch (err) {
        logger.warn({ err, companyId, toAgentId: message.toAgentId }, "agent-messages: failed to trigger wake");
      }
    }

    // Urgent messages also push-notify the owner
    if (message.priority === "urgent") {
      pushNotificationService(db).sendToCompany(companyId, {
        title: "Agent Alert",
        body: message.summary ?? `Urgent message: ${message.messageType}`,
        url: "/inbox",
        tag: "agent-message-urgent",
      }).catch(() => {});
    }

    return row!;
  }

  /**
   * Loop detection + daily rate limit.
   * Prevents: A triggers B triggers A triggers B (within 10 min window)
   * Prevents: more than MAX_TRIGGERED_WAKES_PER_DAY per target agent
   */
  async function canTriggerWake(companyId: string, fromAgentId: string, toAgentId: string): Promise<boolean> {
    // Check for loop: did toAgent send an action/urgent message to fromAgent in the last 10 minutes?
    const loopWindow = new Date(Date.now() - LOOP_DETECTION_WINDOW_MS);
    const [loopRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          eq(aygentAgentMessages.fromAgentId, toAgentId),
          eq(aygentAgentMessages.toAgentId, fromAgentId),
          gte(aygentAgentMessages.createdAt, loopWindow),
          sql`${aygentAgentMessages.priority} IN ('action', 'urgent')`,
        ),
      );

    if ((loopRow?.count ?? 0) > 0) {
      logger.warn(
        { companyId, fromAgentId, toAgentId },
        "agent-messages: loop detected — blocking wake",
      );
      return false;
    }

    // Check daily rate limit for triggered wakes TO this agent
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [rateRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          eq(aygentAgentMessages.toAgentId, toAgentId),
          gte(aygentAgentMessages.createdAt, dayStart),
          sql`${aygentAgentMessages.priority} IN ('action', 'urgent')`,
        ),
      );

    if ((rateRow?.count ?? 0) >= MAX_TRIGGERED_WAKES_PER_DAY) {
      logger.warn(
        { companyId, toAgentId, count: rateRow?.count },
        "agent-messages: daily wake limit reached for target agent",
      );
      return false;
    }

    return true;
  }

  /**
   * Send multiple messages from one agent in a single run.
   * Enforces the per-run outbound cap.
   */
  async function sendBatch(companyId: string, messages: SendMessage[]) {
    const capped = messages.slice(0, MAX_OUTBOUND_PER_RUN);
    if (messages.length > MAX_OUTBOUND_PER_RUN) {
      logger.warn(
        { companyId, fromAgentId: messages[0]?.fromAgentId, attempted: messages.length, sent: capped.length },
        "agent-messages: outbound cap exceeded, truncated",
      );
    }

    const results = [];
    for (const msg of capped) {
      results.push(await send(companyId, msg));
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Read messages for an agent (called at start of each run)
  // -----------------------------------------------------------------------

  /**
   * Get all unread, unexpired messages addressed to this agent (or broadcast).
   * Marks them as read after retrieval.
   */
  async function getUnreadForAgent(companyId: string, agentId: string) {
    const now = new Date();

    const messages = await db
      .select()
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          gt(aygentAgentMessages.expiresAt, now),
          or(
            eq(aygentAgentMessages.toAgentId, agentId),
            isNull(aygentAgentMessages.toAgentId),
          ),
          // Not already read by this agent
          sql`NOT (${aygentAgentMessages.readByAgents} @> ${JSON.stringify([agentId])}::jsonb)`,
        ),
      )
      .orderBy(desc(aygentAgentMessages.createdAt));

    // Mark as read
    if (messages.length > 0) {
      for (const msg of messages) {
        const currentReaders = (msg.readByAgents as string[]) ?? [];
        if (!currentReaders.includes(agentId)) {
          await db
            .update(aygentAgentMessages)
            .set({
              readByAgents: [...currentReaders, agentId],
            })
            .where(eq(aygentAgentMessages.id, msg.id))
            .catch(() => {});
        }
      }
    }

    return messages;
  }

  /**
   * Format unread messages as a prompt section for injection into agent runs.
   */
  async function formatForPrompt(companyId: string, agentId: string): Promise<string> {
    const messages = await getUnreadForAgent(companyId, agentId);

    if (messages.length === 0) return "";

    const lines = messages.map((m) => {
      const from = m.fromAgentId === agentId ? "You" : `Agent ${m.fromAgentId.slice(0, 8)}`;
      const priority = m.priority === "urgent" ? " [URGENT]" : m.priority === "action" ? " [ACTION NEEDED]" : "";
      return `- ${from} (${m.messageType})${priority}: ${m.summary ?? JSON.stringify(m.data)}`;
    });

    return `\n### Messages from Other Agents (${messages.length})\nThese agents have communicated with you since your last run. Consider this information in your current task:\n${lines.join("\n")}\n`;
  }

  // -----------------------------------------------------------------------
  // Query & management
  // -----------------------------------------------------------------------

  /** List all messages for a company (for the Activity Feed UI) */
  async function listRecent(companyId: string, limit = 50) {
    return db
      .select()
      .from(aygentAgentMessages)
      .where(eq(aygentAgentMessages.companyId, companyId))
      .orderBy(desc(aygentAgentMessages.createdAt))
      .limit(limit);
  }

  /** List messages between two specific agents */
  async function listBetween(companyId: string, agentA: string, agentB: string, limit = 20) {
    return db
      .select()
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          or(
            and(eq(aygentAgentMessages.fromAgentId, agentA), eq(aygentAgentMessages.toAgentId, agentB)),
            and(eq(aygentAgentMessages.fromAgentId, agentB), eq(aygentAgentMessages.toAgentId, agentA)),
          ),
        ),
      )
      .orderBy(desc(aygentAgentMessages.createdAt))
      .limit(limit);
  }

  /** Clean up expired messages */
  async function purgeExpired() {
    const result = await db
      .delete(aygentAgentMessages)
      .where(lt(aygentAgentMessages.expiresAt, new Date()))
      .returning({ id: aygentAgentMessages.id });

    if (result.length > 0) {
      logger.info({ purged: result.length }, "agent-messages: expired messages purged");
    }

    return result.length;
  }

  /** Get message volume stats for the agent network graph */
  async function networkStats(companyId: string, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        fromAgentId: aygentAgentMessages.fromAgentId,
        toAgentId: aygentAgentMessages.toAgentId,
        count: sql<number>`count(*)::int`,
      })
      .from(aygentAgentMessages)
      .where(
        and(
          eq(aygentAgentMessages.companyId, companyId),
          gt(aygentAgentMessages.createdAt, since),
        ),
      )
      .groupBy(aygentAgentMessages.fromAgentId, aygentAgentMessages.toAgentId);

    return rows;
  }

  return {
    send,
    sendBatch,
    getUnreadForAgent,
    formatForPrompt,
    listRecent,
    listBetween,
    purgeExpired,
    networkStats,
  };
}
