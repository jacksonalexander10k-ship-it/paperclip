import { eq, and, like } from "drizzle-orm";
import { issueWorkProducts, issues } from "@paperclipai/db";
import type { ToolContext } from "../types.js";

/**
 * Resolve the issue ID for storing a deliverable.
 * Uses ctx.issueId if available, otherwise falls back to the CEO Chat issue.
 */
async function resolveIssueId(ctx: ToolContext): Promise<string | null> {
  if (ctx.issueId) return ctx.issueId;

  const rows = await ctx.db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.companyId, ctx.companyId), like(issues.title, "CEO Chat%")))
    .limit(1);

  return rows[0]?.id ?? null;
}

export interface DeliverableInput {
  type: string;
  title: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Store a deliverable in the issue_work_products table.
 * Silently skips if no issue can be resolved (non-fatal).
 */
export async function storeDeliverable(
  ctx: ToolContext,
  input: DeliverableInput,
): Promise<string | null> {
  try {
    const issueId = await resolveIssueId(ctx);
    if (!issueId) return null;

    const rows = await ctx.db
      .insert(issueWorkProducts)
      .values({
        companyId: ctx.companyId,
        issueId,
        type: input.type,
        provider: "aygent",
        title: input.title,
        status: "completed",
        summary: input.summary,
        metadata: {
          ...input.metadata,
          generatedBy: ctx.agentId,
        },
      })
      .returning({ id: issueWorkProducts.id });

    return rows[0]?.id ?? null;
  } catch {
    // Non-fatal — the tool result is still returned to the agent
    return null;
  }
}
