import { and, desc, eq, gt, inArray, isNull, not, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, heartbeatRuns, issueComments, issueReadStates, issues } from "@paperclipai/db";
import type { SidebarBadges } from "@paperclipai/shared";

const CEO_CHAT_TITLE = "CEO Chat";

const ACTIONABLE_APPROVAL_STATUSES = ["pending", "revision_requested"];
const FAILED_HEARTBEAT_STATUSES = ["failed", "timed_out"];

export function sidebarBadgeService(db: Db) {
  return {
    get: async (
      companyId: string,
      extra?: { joinRequests?: number; unreadTouchedIssues?: number; userId?: string },
    ): Promise<SidebarBadges> => {
      const actionableApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            inArray(approvals.status, ACTIONABLE_APPROVAL_STATUSES),
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      const latestRunByAgent = await db
        .selectDistinctOn([heartbeatRuns.agentId], {
          runStatus: heartbeatRuns.status,
        })
        .from(heartbeatRuns)
        .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            eq(agents.companyId, companyId),
            not(eq(agents.status, "terminated")),
          ),
        )
        .orderBy(heartbeatRuns.agentId, desc(heartbeatRuns.createdAt));

      const failedRuns = latestRunByAgent.filter((row) =>
        FAILED_HEARTBEAT_STATUSES.includes(row.runStatus),
      ).length;

      // ── CEO Chat unread count ─────────────────────────────────────────────
      let ceoChatUnread = 0;
      if (extra?.userId) {
        // Find the CEO Chat issue for this company
        const [ceoChatIssue] = await db
          .select({ id: issues.id })
          .from(issues)
          .where(and(eq(issues.companyId, companyId), eq(issues.title, CEO_CHAT_TITLE)))
          .limit(1);

        if (ceoChatIssue) {
          // Get the user's lastReadAt for this issue
          const [readState] = await db
            .select({ lastReadAt: issueReadStates.lastReadAt })
            .from(issueReadStates)
            .where(
              and(
                eq(issueReadStates.companyId, companyId),
                eq(issueReadStates.issueId, ceoChatIssue.id),
                eq(issueReadStates.userId, extra.userId),
              ),
            )
            .limit(1);

          // Count agent-authored comments newer than lastReadAt (only unread AI messages)
          const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(issueComments)
            .where(
              and(
                eq(issueComments.companyId, companyId),
                eq(issueComments.issueId, ceoChatIssue.id),
                not(isNull(issueComments.authorAgentId)),
                readState
                  ? gt(issueComments.createdAt, readState.lastReadAt)
                  : undefined,
              ),
            );
          ceoChatUnread = Number(countRow?.count ?? 0);
        }
      }

      const joinRequests = extra?.joinRequests ?? 0;
      const unreadTouchedIssues = extra?.unreadTouchedIssues ?? 0;
      return {
        inbox: actionableApprovals + failedRuns + joinRequests + unreadTouchedIssues,
        approvals: actionableApprovals,
        failedRuns,
        joinRequests,
        ceoChatUnread,
      };
    },
  };
}
