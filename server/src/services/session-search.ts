/**
 * Cross-Session Search — Lets agents search past conversations, WhatsApp messages,
 * and issue comments across all previous heartbeat runs.
 *
 * Inspired by Hermes Agent's FTS5 session search. Uses PostgreSQL ILIKE + tsvector
 * for text matching across three data sources:
 * 1. WhatsApp conversation history (aygent_whatsapp_messages)
 * 2. Heartbeat run events (agent actions and tool outputs)
 * 3. Issue comments (CEO Chat and task discussions)
 */

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  aygentWhatsappMessages,
  aygentLeads,
  heartbeatRunEvents,
  issueComments,
  agents,
} from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const MAX_RESULTS_PER_SOURCE = 15;
const MAX_TOTAL_RESULTS = 30;
const SNIPPET_LENGTH = 300;

export interface SearchResult {
  source: "whatsapp" | "agent_run" | "issue_comment";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  /** Restrict to a specific agent's data */
  agentId?: string;
  /** Restrict to a specific lead's conversations */
  leadId?: string;
  /** Only search within this many days back (default: 90) */
  daysBack?: number;
  /** Which sources to search (default: all) */
  sources?: Array<"whatsapp" | "agent_run" | "issue_comment">;
  /** Max results (default: 30) */
  limit?: number;
}

function snippet(text: string | null, maxLen: number = SNIPPET_LENGTH): string {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "...";
}

export function sessionSearchService(db: Db) {
  /**
   * Search across all past conversations and agent activity for a company.
   */
  async function search(
    companyId: string,
    query: string,
    opts: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const daysBack = opts.daysBack ?? 90;
    const limit = Math.min(opts.limit ?? MAX_TOTAL_RESULTS, MAX_TOTAL_RESULTS);
    const sources = opts.sources ?? ["whatsapp", "agent_run", "issue_comment"];
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Build search pattern for ILIKE
    const pattern = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const results: SearchResult[] = [];

    // Run searches in parallel
    const searches: Promise<void>[] = [];

    if (sources.includes("whatsapp")) {
      searches.push(searchWhatsApp(companyId, pattern, cutoff, opts, results));
    }
    if (sources.includes("agent_run")) {
      searches.push(searchRunEvents(companyId, pattern, cutoff, opts, results));
    }
    if (sources.includes("issue_comment")) {
      searches.push(searchIssueComments(companyId, pattern, cutoff, opts, results));
    }

    await Promise.all(searches);

    // Sort all results by timestamp descending, limit total
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return results.slice(0, limit);
  }

  async function searchWhatsApp(
    companyId: string,
    pattern: string,
    cutoff: Date,
    opts: SearchOptions,
    results: SearchResult[],
  ): Promise<void> {
    try {
      const conditions = [
        eq(aygentWhatsappMessages.companyId, companyId),
        ilike(aygentWhatsappMessages.content, pattern),
        sql`${aygentWhatsappMessages.timestamp} >= ${cutoff}`,
      ];

      if (opts.agentId) {
        conditions.push(eq(aygentWhatsappMessages.agentId, opts.agentId));
      }
      if (opts.leadId) {
        conditions.push(eq(aygentWhatsappMessages.leadId, opts.leadId));
      }

      const rows = await db
        .select({
          content: aygentWhatsappMessages.content,
          timestamp: aygentWhatsappMessages.timestamp,
          fromMe: aygentWhatsappMessages.fromMe,
          senderName: aygentWhatsappMessages.senderName,
          chatJid: aygentWhatsappMessages.chatJid,
          agentId: aygentWhatsappMessages.agentId,
          leadId: aygentWhatsappMessages.leadId,
        })
        .from(aygentWhatsappMessages)
        .where(and(...conditions))
        .orderBy(desc(aygentWhatsappMessages.timestamp))
        .limit(MAX_RESULTS_PER_SOURCE);

      for (const row of rows) {
        results.push({
          source: "whatsapp",
          content: snippet(row.content),
          timestamp: row.timestamp?.toISOString() ?? "",
          metadata: {
            fromMe: row.fromMe,
            senderName: row.senderName,
            chatJid: row.chatJid,
            agentId: row.agentId,
            leadId: row.leadId,
          },
        });
      }
    } catch (err) {
      logger.warn({ err, companyId }, "session-search: WhatsApp search failed");
    }
  }

  async function searchRunEvents(
    companyId: string,
    pattern: string,
    cutoff: Date,
    opts: SearchOptions,
    results: SearchResult[],
  ): Promise<void> {
    try {
      const conditions = [
        eq(heartbeatRunEvents.companyId, companyId),
        ilike(heartbeatRunEvents.message, pattern),
        sql`${heartbeatRunEvents.createdAt} >= ${cutoff}`,
      ];

      if (opts.agentId) {
        conditions.push(eq(heartbeatRunEvents.agentId, opts.agentId));
      }

      const rows = await db
        .select({
          message: heartbeatRunEvents.message,
          createdAt: heartbeatRunEvents.createdAt,
          eventType: heartbeatRunEvents.eventType,
          agentId: heartbeatRunEvents.agentId,
          runId: heartbeatRunEvents.runId,
        })
        .from(heartbeatRunEvents)
        .where(and(...conditions))
        .orderBy(desc(heartbeatRunEvents.createdAt))
        .limit(MAX_RESULTS_PER_SOURCE);

      for (const row of rows) {
        results.push({
          source: "agent_run",
          content: snippet(row.message),
          timestamp: row.createdAt.toISOString(),
          metadata: {
            eventType: row.eventType,
            agentId: row.agentId,
            runId: row.runId,
          },
        });
      }
    } catch (err) {
      logger.warn({ err, companyId }, "session-search: run events search failed");
    }
  }

  async function searchIssueComments(
    companyId: string,
    pattern: string,
    cutoff: Date,
    opts: SearchOptions,
    results: SearchResult[],
  ): Promise<void> {
    try {
      const conditions = [
        eq(issueComments.companyId, companyId),
        ilike(issueComments.body, pattern),
        sql`${issueComments.createdAt} >= ${cutoff}`,
      ];

      if (opts.agentId) {
        conditions.push(eq(issueComments.authorAgentId, opts.agentId));
      }

      const rows = await db
        .select({
          body: issueComments.body,
          createdAt: issueComments.createdAt,
          issueId: issueComments.issueId,
          authorAgentId: issueComments.authorAgentId,
          authorUserId: issueComments.authorUserId,
        })
        .from(issueComments)
        .where(and(...conditions))
        .orderBy(desc(issueComments.createdAt))
        .limit(MAX_RESULTS_PER_SOURCE);

      for (const row of rows) {
        results.push({
          source: "issue_comment",
          content: snippet(row.body),
          timestamp: row.createdAt.toISOString(),
          metadata: {
            issueId: row.issueId,
            authorAgentId: row.authorAgentId,
            authorUserId: row.authorUserId,
          },
        });
      }
    } catch (err) {
      logger.warn({ err, companyId }, "session-search: issue comments search failed");
    }
  }

  /**
   * Search specifically for past interactions with a lead by phone number or name.
   * Returns WhatsApp messages + any issue comments mentioning them.
   */
  async function searchLeadHistory(
    companyId: string,
    leadQuery: string,
    opts: { agentId?: string; daysBack?: number } = {},
  ): Promise<{
    lead: { id: string; name: string; phone: string | null; score: number } | null;
    conversations: SearchResult[];
  }> {
    // Try to find the lead first
    const leadPattern = `%${leadQuery.replace(/%/g, "\\%")}%`;
    const leads = await db
      .select({
        id: aygentLeads.id,
        name: aygentLeads.name,
        phone: aygentLeads.phone,
        score: aygentLeads.score,
      })
      .from(aygentLeads)
      .where(
        and(
          eq(aygentLeads.companyId, companyId),
          or(
            ilike(aygentLeads.name, leadPattern),
            ilike(aygentLeads.phone, leadPattern),
            ilike(aygentLeads.email, leadPattern),
          ),
        ),
      )
      .limit(1);

    const lead = leads[0] ?? null;

    // Search conversations — by leadId if found, or by text query
    const conversations = await search(companyId, leadQuery, {
      ...opts,
      leadId: lead?.id,
      sources: ["whatsapp", "issue_comment"],
    });

    return { lead, conversations };
  }

  return {
    search,
    searchLeadHistory,
  };
}
