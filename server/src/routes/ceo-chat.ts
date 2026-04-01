import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclipai/db";
import {
  agentService,
  issueService,
  approvalService,
  activityService,
  dashboardService,
  ceoCommandService,
  pushNotificationService,
  agentLearningService,
  agentMessageService,
  predictiveActionsService,
  selfOptimizingTeamsService,
} from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";
import { logger } from "../middleware/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CEO_CHAT_TITLE = "CEO Chat";
const MODEL_SONNET = "claude-sonnet-4-5";
const MODEL_OPUS = "claude-opus-4";
const MAX_TOKENS = 4096;
const MAX_TOKENS_OPUS = 8192;
const HISTORY_LIMIT = 20;
const OPUS_MONTHLY_CAP = 50;

let soulMd: string;
try {
  soulMd = readFileSync(
    resolve(__dirname, "../onboarding-assets/ceo/SOUL.md"),
    "utf-8",
  );
} catch {
  soulMd = "You are the CEO of a Dubai real estate agency.";
}

function getDubaiDateTime(): string {
  return new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ceoChatRoutes(db: Db) {
  const router = Router();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  router.post("/companies/:companyId/ceo-chat", async (req, res) => {
    const { companyId } = req.params;

    try {
      assertCompanyAccess(req, companyId);
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { message, deepThink } = req.body as { message?: string; deepThink?: boolean };
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Resolve model: Opus for Deep Think mode (with monthly cap)
    let useOpus = false;
    if (deepThink) {
      // Check monthly Opus usage via cost events
      try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const { costEvents } = await import("@paperclipai/db");
        const { and: andOp, eq: eqOp, gte, sql } = await import("drizzle-orm");
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(costEvents)
          .where(
            andOp(
              eqOp(costEvents.companyId, companyId),
              eqOp(costEvents.model, MODEL_OPUS),
              gte(costEvents.occurredAt, monthStart),
            ),
          );
        const opusUsedThisMonth = row?.count ?? 0;
        if (opusUsedThisMonth < OPUS_MONTHLY_CAP) {
          useOpus = true;
        } else {
          logger.info({ companyId, opusUsedThisMonth }, "ceo-chat: Opus monthly cap reached, falling back to Sonnet");
        }
      } catch (err) {
        logger.warn({ err }, "ceo-chat: failed to check Opus cap, falling back to Sonnet");
      }
    }

    const activeModel = useOpus ? MODEL_OPUS : MODEL_SONNET;
    const activeMaxTokens = useOpus ? MAX_TOKENS_OPUS : MAX_TOKENS;

    const isvc = issueService(db);
    const asvc = agentService(db);
    const approvalsSvc = approvalService(db);
    const activitySvc = activityService(db);
    const dashSvc = dashboardService(db);

    // Find the CEO Chat issue
    const allIssues = await isvc.list(companyId);
    const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE) ?? null;

    if (!ceoChatIssue) {
      res.status(404).json({ error: "CEO Chat issue not found. Please open the CEO Chat page first." });
      return;
    }

    // Save the owner's message as a comment
    const actorUserId =
      req.actor.type === "board" && req.actor.userId ? req.actor.userId : undefined;

    await isvc.addComment(ceoChatIssue.id, message.trim(), {
      userId: actorUserId,
    });

    // Load last N comments for conversation history
    const recentComments = await isvc.listComments(ceoChatIssue.id, {
      order: "desc",
      limit: HISTORY_LIMIT + 1,
    });

    // Build Anthropic message history (oldest-first, excluding the just-saved user msg)
    const sortedComments = [...recentComments].reverse();
    const historyComments = sortedComments.slice(0, -1);

    const anthropicHistory: Anthropic.Messages.MessageParam[] = [];
    for (const c of historyComments) {
      const role: "user" | "assistant" =
        c.authorUserId !== null && c.authorAgentId === null ? "user" : "assistant";
      if (anthropicHistory.length > 0 && anthropicHistory[anthropicHistory.length - 1]?.role === role) {
        const last = anthropicHistory[anthropicHistory.length - 1];
        if (typeof last.content === "string") {
          last.content = `${last.content}\n\n${c.body}`;
        }
      } else {
        anthropicHistory.push({ role, content: c.body });
      }
    }

    // Append the current user message
    anthropicHistory.push({ role: "user", content: message.trim() });

    // -----------------------------------------------------------------------
    // Build rich agency context for the system prompt
    // -----------------------------------------------------------------------

    // Agents
    const agentsList = await asvc.list(companyId);
    const agentLines = agentsList
      .map((a) => {
        const budget = a.budgetMonthlyCents > 0
          ? ` | Budget: ${formatCents(a.spentMonthlyCents)}/${formatCents(a.budgetMonthlyCents)}`
          : "";
        const lastRun = a.lastHeartbeatAt
          ? ` | Last run: ${timeAgo(new Date(a.lastHeartbeatAt))}`
          : "";
        return `- **${a.name}** (${a.role ?? "general"}): ${a.status}${budget}${lastRun}`;
      })
      .join("\n");

    // Dashboard summary
    let dashboardContext = "";
    try {
      const summary = await dashSvc.summary(companyId);
      dashboardContext = `
### Agency Metrics
- Agents: ${summary.agents.active} active, ${summary.agents.running} running, ${summary.agents.paused} paused
- Tasks: ${summary.tasks.open ?? 0} open, ${summary.tasks.inProgress ?? 0} in progress, ${summary.tasks.done ?? 0} done
- Month spend: ${formatCents(summary.costs.monthSpendCents)} of ${formatCents(summary.costs.monthBudgetCents)} budget (${summary.costs.monthUtilizationPercent}%)
- Pending approvals: ${summary.pendingApprovals}`;
    } catch {
      // Dashboard data not critical — continue without it
    }

    // Pending approvals detail
    let approvalsContext = "";
    try {
      const pending = await approvalsSvc.list(companyId, "pending");
      if (pending.length > 0) {
        const lines = pending.map((a) => {
          const payload = a.payload as Record<string, unknown> | null;
          const action = payload?.action ?? a.type;
          const to = payload?.to ?? payload?.agentName ?? "";
          const ago = timeAgo(new Date(a.createdAt));
          return `- **${action}** ${to ? `to ${to} ` : ""}(${ago} ago, requested by agent)`;
        });
        approvalsContext = `\n### Pending Approvals (${pending.length})\n${lines.join("\n")}`;
      }
    } catch {
      // Non-critical
    }

    // Recent activity (last 10 events)
    let activityContext = "";
    try {
      const allActivity = await activitySvc.list({ companyId });
      const activity = allActivity.slice(0, 10);
      if (activity.length > 0) {
        const lines = activity.map((a) => {
          const actor = a.actorType === "system" ? "System" : (a.actorId ?? "Unknown");
          const details = a.details as Record<string, unknown> | null;
          const summary = details?.summary ?? details?.title ?? details?.agentName ?? "";
          return `- ${timeAgo(new Date(a.createdAt))} ago: ${a.action}${summary ? ` — ${summary}` : ""}`;
        });
        activityContext = `\n### Recent Activity\n${lines.join("\n")}`;
      }
    } catch {
      // Non-critical
    }

    // Open tasks
    let tasksContext = "";
    try {
      const openTasks = allIssues
        .filter((i) => i.title !== CEO_CHAT_TITLE && ["todo", "in_progress", "in_review"].includes(i.status))
        .slice(0, 10);
      if (openTasks.length > 0) {
        const lines = openTasks.map((t) => {
          const assignee = agentsList.find((a) => a.id === t.assigneeAgentId);
          const name = assignee ? assignee.name : "Unassigned";
          return `- [${t.identifier ?? ""}] ${t.title} (${t.status}, ${t.priority}) → ${name}`;
        });
        tasksContext = `\n### Open Tasks (${openTasks.length})\n${lines.join("\n")}`;
      }
    } catch {
      // Non-critical
    }

    // Agent learnings and inter-agent messages
    const learningSvc = agentLearningService(db);
    const messageSvc = agentMessageService(db);

    let learningsContext = "";
    let agentCommsContext = "";
    try {
      const ceoAgent = agentsList.find((a) => a.role === "ceo");
      if (ceoAgent) {
        learningsContext = await learningSvc.formatForPrompt(companyId, ceoAgent.id);
      }
    } catch { /* non-critical */ }

    try {
      const recentComms = await messageSvc.listRecent(companyId, 10);
      if (recentComms.length > 0) {
        const lines = recentComms.map((m) => {
          const fromAgent = agentsList.find((a) => a.id === m.fromAgentId);
          const toAgent = m.toAgentId ? agentsList.find((a) => a.id === m.toAgentId) : null;
          const from = fromAgent?.name ?? "Unknown";
          const to = toAgent?.name ?? "All agents";
          const ago = timeAgo(new Date(m.createdAt));
          return `- ${from} → ${to} (${m.messageType}, ${ago} ago): ${m.summary ?? ""}`;
        });
        agentCommsContext = `\n### Recent Agent Communications (${recentComms.length})\n${lines.join("\n")}`;
      }
    } catch { /* non-critical */ }

    let predictionsContext = "";
    let teamRecsContext = "";
    try {
      const predSvc = predictiveActionsService(db);
      predictionsContext = await predSvc.formatForBrief(companyId);
    } catch { /* non-critical */ }

    try {
      const teamSvc = selfOptimizingTeamsService(db);
      teamRecsContext = await teamSvc.formatForBrief(companyId);
    } catch { /* non-critical */ }

    // Build system prompt
    const systemPrompt = `${soulMd}

## Current Agency Context

Today is ${getDubaiDateTime()} (Dubai time).

### Your Team
${agentLines || "No agents hired yet. You're in Builder Mode — interview the owner and propose a team."}
${dashboardContext}${approvalsContext}${activityContext}${tasksContext}${learningsContext}${agentCommsContext}${predictionsContext}${teamRecsContext}

## How to Respond

You are talking directly to the agency owner. Be the CEO they hired — concise, data-driven, action-oriented.

### Quick actions the owner may request
- **"Brief me"** → Generate a morning-brief-style summary: overnight activity, pending approvals, costs, priorities for today. Use the data above.
- **"What's pending?"** → List all pending approvals with details. For each, ask if they want to approve, reject, or edit.
- **"Pause all agents"** / **"Pause [name]"** → Confirm and note that you'll pause the agent(s).
- **"Show budget"** / **"How much have we spent?"** → Break down costs by agent for the current month.
- **"Find leads"** / **"How are leads doing?"** → Summarise the lead pipeline from open tasks.

### When proposing external actions
When you want to send a WhatsApp, email, Instagram post, or any outbound communication, format it as a JSON approval block inside a fenced code block. The UI will render this as an approval card:

\`\`\`json
{
  "type": "approval_required",
  "action": "send_whatsapp",
  "to": "Lead Name",
  "phone": "+971...",
  "message": "The message text...",
  "lead_score": 7,
  "context": "Why this message is being sent..."
}
\`\`\`

Supported actions: send_whatsapp, send_email, post_instagram, send_pitch_deck, confirm_viewing, hire_agent, skill_amendment.

### When proposing a skill improvement
When accumulated learnings reveal a pattern worth codifying into a skill file, propose a skill amendment:

\`\`\`json
{
  "type": "approval_required",
  "action": "skill_amendment",
  "skillFile": "behaviour/lead-response.md",
  "currentText": "First reply: max 3 sentences, never quote a specific price",
  "proposedText": "First reply: max 3 sentences, always include payment plan details upfront",
  "evidence": "Based on 15 corrections where the owner added payment plan info. Messages with payment plans get 35% more replies.",
  "context": "Updating lead-response skill based on accumulated owner corrections"
}
\`\`\`

### When delegating tasks to agents
When the owner asks you to assign work ("Follow up with Ahmed", "Get Nour to make a post about Damac"), create a task by emitting a paperclip-command block:

\`\`\`paperclip-command
{
  "action": "create_task",
  "title": "Follow up with Ahmed Al Hashimi — JVC 2BR",
  "description": "Draft a WhatsApp follow-up about Binghatti Hills pricing. Lead score 7, cash buyer.",
  "assignee": "Layla",
  "priority": "high"
}
\`\`\`

You can also use these commands:
- \`{"action": "pause_agent", "agent_name": "Layla"}\` — pause an agent
- \`{"action": "resume_agent", "agent_name": "Layla"}\` — resume an agent
- \`{"action": "pause_all"}\` — pause all agents
- \`{"action": "resume_all"}\` — resume all agents

### Communication style
- Lead with the answer, then context. Never bury the important part.
- Short messages: 2-3 sentences typical. Longer only for briefs or team proposals.
- Quantify impact: "3 leads scored 7+, 1 viewing booked" not "good progress today."
- Cost-conscious: frame value against cost. "Layla handled 40 leads for $12."
- No filler. Never say "I'd be happy to", "Great question!", "Absolutely!"
`;

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    function send(data: Record<string, unknown>) {
      if (aborted) return;
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        aborted = true;
      }
    }

    let fullAssistantText = "";

    try {
      const stream = anthropic.messages.stream({
        model: activeModel,
        max_tokens: activeMaxTokens,
        system: systemPrompt,
        messages: anthropicHistory,
      });

      for await (const event of stream) {
        if (aborted) break;

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullAssistantText += event.delta.text;
          send({ type: "text", text: event.delta.text });
        }
      }

      // Parse for approval blocks and create real approval records
      let savedText = fullAssistantText;
      const createdApprovalIds: string[] = [];

      if (fullAssistantText && !aborted) {
        // Find the CEO agent for this company
        const ceoAgent = agentsList.find((a) => a.role === "ceo");

        const approvalBlocks = extractApprovalBlocks(fullAssistantText);
        for (const block of approvalBlocks) {
          try {
            const approval = await approvalsSvc.create(companyId, {
              type: String(block.payload.action ?? "ceo_proposal"),
              requestedByAgentId: ceoAgent?.id ?? null,
              status: "pending",
              payload: block.payload,
            });
            createdApprovalIds.push(approval.id);

            // Inject approval_id into the JSON block so the UI can use it
            const enrichedPayload = { ...block.payload, approval_id: approval.id };
            savedText = savedText.replace(
              block.rawBlock,
              "```json\n" + JSON.stringify(enrichedPayload, null, 2) + "\n```",
            );
          } catch (err) {
            logger.error({ err }, "ceo-chat: failed to create approval from response");
          }
        }

        await isvc.addComment(ceoChatIssue.id, savedText, {}).catch((err: unknown) => {
          logger.error({ err }, "ceo-chat: failed to persist assistant reply");
        });

        // Send push notification for CEO reply
        pushNotificationService(db).sendToCompany(companyId, {
          title: "CEO Update",
          body: "New message from your CEO agent",
          url: "/ceo-chat",
          tag: "ceo-chat",
        }).catch(() => {});

        // Execute any CEO commands (hire_team, pause_agent, create_task, etc.)
        if (ceoAgent) {
          const cmdSvc = ceoCommandService(db);
          try {
            await cmdSvc.processComment(companyId, savedText, ceoAgent.id);
          } catch (err) {
            logger.error({ err }, "ceo-chat: failed to execute CEO commands");
          }
        }
      }

      if (createdApprovalIds.length > 0) {
        send({ type: "approvals_created", approvalIds: createdApprovalIds });
      }
      send({ type: "done", model: activeModel, deepThink: useOpus });
    } catch (error) {
      if (!aborted) {
        const msg = error instanceof Error ? error.message : "Streaming error";
        logger.error({ err: error }, "ceo-chat: stream error");
        send({ type: "error", message: msg });
      }
    } finally {
      res.end();
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApprovalBlock {
  rawBlock: string;
  payload: Record<string, unknown>;
}

function extractApprovalBlocks(text: string): ApprovalBlock[] {
  const blocks: ApprovalBlock[] = [];
  const pattern = /```json\s*([\s\S]*?)```/g;
  let match = pattern.exec(text);
  while (match !== null) {
    try {
      const parsed = JSON.parse(match[1]!);
      if (parsed?.type === "approval_required") {
        blocks.push({ rawBlock: match[0], payload: parsed });
      }
    } catch {
      // Not valid JSON — skip
    }
    match = pattern.exec(text);
  }
  return blocks;
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}
