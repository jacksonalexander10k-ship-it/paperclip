import type { Db } from "@paperclipai/db";
import { agents, companies, issues } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import { dashboardService, issueService } from "../services/index.js";
import { logger } from "../middleware/logger.js";

const CEO_CHAT_TITLE = "CEO Chat";

/**
 * Generate a morning brief for a single company.
 * Exported so it can be called directly from test endpoints.
 */
export async function generateBriefForCompany(db: Db, companyId: string) {
  const dashSvc = dashboardService(db);
  const isvc = issueService(db);

  // Find CEO agent
  const companyAgents = await db
    .select({ id: agents.id, name: agents.name, role: agents.role })
    .from(agents)
    .where(
      and(
        eq(agents.companyId, companyId),
        eq(agents.status, "active"),
      ),
    );

  const ceoAgent = companyAgents.find(
    (a) => a.role === "ceo" || a.name?.toLowerCase().includes("ceo"),
  );
  if (!ceoAgent) return;

  // Find CEO Chat issue
  const allIssues = await isvc.list(companyId);
  const ceoChatIssue = allIssues.find((i) => i.title?.startsWith(CEO_CHAT_TITLE));
  if (!ceoChatIssue) return;

  // Get dashboard summary
  const summary = await dashSvc.summary(companyId);

  // Build morning brief
  const dubaiTime = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const agentCount = summary.agents.active + summary.agents.running;
  const pendingApprovals = summary.pendingApprovals + (summary.budgets?.pendingApprovals ?? 0);

  const brief = [
    `**Morning Brief** -- ${dubaiTime}`,
    "",
    `Your agency has **${agentCount}** agents operational, **${summary.agents.running}** currently working.`,
    `There are **${summary.tasks.open}** open tasks (${summary.tasks.inProgress} in progress${summary.tasks.blocked > 0 ? `, ${summary.tasks.blocked} blocked` : ""}).`,
    pendingApprovals > 0
      ? `**${pendingApprovals}** items are waiting for your approval.`
      : "No pending approvals -- all clear.",
    summary.tasks.done > 0 ? `**${summary.tasks.done}** tasks completed to date.` : "",
    "",
    "Let me know if you need a deeper dive into any area, or say **\"What's pending?\"** to see the full approval queue.",
  ]
    .filter(Boolean)
    .join("\n");

  // Post as a comment from the CEO agent
  await isvc.addComment(ceoChatIssue.id, brief, {
    agentId: ceoAgent.id,
  });

  logger.info(
    { companyId, agentId: ceoAgent.id },
    "morning-brief: posted daily brief",
  );
}

/**
 * Background worker that triggers a daily morning brief at 8am Dubai time (UTC+4).
 * For each company, finds the CEO agent and CEO Chat issue, then posts a summary
 * as a comment from the CEO agent.
 */
export function startMorningBriefWorker(db: Db) {
  const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
  let lastBriefDate = ""; // Track the last date we ran briefs (YYYY-MM-DD in Dubai time)

  function getDubaiDate(): { dateStr: string; hour: number; minute: number } {
    const dubaiStr = new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // Format: "DD/MM/YYYY, HH:MM"
    const [datePart, timePart] = dubaiStr.split(", ");
    const [day, month, year] = datePart.split("/");
    const [hour, minute] = timePart.split(":").map(Number);
    return { dateStr: `${year}-${month}-${day}`, hour, minute };
  }

  async function checkAndRunBriefs() {
    try {
      const { dateStr, hour, minute } = getDubaiDate();

      // Only run at 8:00am Dubai time, and only once per day
      if (hour !== 8 || minute > 1 || dateStr === lastBriefDate) return;

      lastBriefDate = dateStr;
      logger.info("morning-brief: triggering daily briefs for all companies");

      const allCompanies = await db.select({ id: companies.id }).from(companies);

      for (const company of allCompanies) {
        try {
          await generateBriefForCompany(db, company.id);
        } catch (err) {
          logger.error(
            { err, companyId: company.id },
            "morning-brief: failed for company",
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "morning-brief: check failed");
    }
  }

  // Run immediately to check, then every minute
  void checkAndRunBriefs();
  setInterval(() => {
    void checkAndRunBriefs();
  }, CHECK_INTERVAL_MS);

  logger.info("morning-brief: worker started (triggers at 8:00am Dubai time daily)");
}
