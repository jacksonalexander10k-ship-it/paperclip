import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { routedStream, routedGenerate } from "../services/model-router.js";
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
const MAX_TOKENS = 4096;
const MAX_TOKENS_DEEP_THINK = 8192;
const HISTORY_LIMIT = 20;
const DEEP_THINK_MONTHLY_CAP = 50;

let soulMd: string;
try {
  soulMd = readFileSync(
    resolve(__dirname, "../onboarding-assets/ceo/SOUL.md"),
    "utf-8",
  );
} catch {
  soulMd = "You are the CEO of a Dubai real estate agency.";
}

let onboardingDemoMd: string;
try {
  onboardingDemoMd = readFileSync(
    resolve(__dirname, "../onboarding-assets/ceo/ONBOARDING_DEMO.md"),
    "utf-8",
  );
} catch {
  onboardingDemoMd = "";
}

const ONBOARDING_COMMENT_THRESHOLD = 5;

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

  router.post("/companies/:companyId/ceo-chat", async (req, res) => {
    const { companyId } = req.params;

    try {
      assertCompanyAccess(req, companyId);
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { message, deepThink, issueId: clientIssueId } = req.body as { message?: string; deepThink?: boolean; issueId?: string };
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Deep Think: uses Sonnet (premium tier) with monthly cap
    let useDeepThink = false;
    if (deepThink) {
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
              eqOp(costEvents.model, "claude-sonnet-4-6"),
              gte(costEvents.occurredAt, monthStart),
            ),
          );
        const deepThinkUsedThisMonth = row?.count ?? 0;
        if (deepThinkUsedThisMonth < DEEP_THINK_MONTHLY_CAP) {
          useDeepThink = true;
        } else {
          logger.info({ companyId, deepThinkUsedThisMonth }, "ceo-chat: Deep Think monthly cap reached, using standard model");
        }
      } catch (err) {
        logger.warn({ err }, "ceo-chat: failed to check Deep Think cap, using standard model");
      }
    }

    const activeMaxTokens = useDeepThink ? MAX_TOKENS_DEEP_THINK : MAX_TOKENS;

    const isvc = issueService(db);
    const asvc = agentService(db);
    const approvalsSvc = approvalService(db);
    const activitySvc = activityService(db);
    const dashSvc = dashboardService(db);

    // Find the CEO Chat issue — use client-provided issueId or fall back to title search
    const allIssues = await isvc.list(companyId);
    const ceoChatIssue = clientIssueId
      ? allIssues.find((i) => i.id === clientIssueId) ?? null
      : allIssues.find((i) => i.title.startsWith("CEO Chat")) ?? null;

    if (!ceoChatIssue) {
      res.status(404).json({ error: "CEO Chat issue not found. Please open the CEO Chat page first." });
      return;
    }

    // Rate limit: max CEO Chat messages per day (prevents runaway costs)
    const CEO_CHAT_DAILY_LIMIT = 100;
    try {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const recentComments = await isvc.listComments(ceoChatIssue.id, {
        order: "desc",
        limit: CEO_CHAT_DAILY_LIMIT + 10,
      });
      const todayUserMessages = recentComments.filter(
        (c) => c.authorUserId && !c.authorAgentId && new Date(c.createdAt) >= todayStart,
      );
      if (todayUserMessages.length >= CEO_CHAT_DAILY_LIMIT) {
        res.status(429).json({
          error: `Daily CEO Chat limit reached (${CEO_CHAT_DAILY_LIMIT} messages). Resets at midnight UTC.`,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to check daily rate limit, proceeding");
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

    const anthropicHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
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

    // Load company for onboarding context stored in description
    let onboardingContext = "";
    try {
      const { companies } = await import("@paperclipai/db");
      const { eq: eqComp } = await import("drizzle-orm");
      const [company] = await db.select().from(companies).where(eqComp(companies.id, companyId)).limit(1);
      if (company?.description) {
        onboardingContext = `\n### Agency Profile (from onboarding)\n${company.description}`;
      }
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to load onboarding context");
    }

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
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to load dashboard summary");
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
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to load pending approvals");
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
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to load activity");
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
    } catch (err) {
      logger.warn({ err }, "ceo-chat: failed to load tasks");
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

    // Detect onboarding mode: use demo prompt if fewer than ONBOARDING_COMMENT_THRESHOLD total comments
    const totalCommentCount = recentComments.length;
    const isOnboardingMode = onboardingDemoMd && totalCommentCount < ONBOARDING_COMMENT_THRESHOLD;
    const basePrompt = isOnboardingMode ? onboardingDemoMd : soulMd;

    // Build system prompt
    const systemPrompt = `${basePrompt}

## Current Agency Context

Today is ${getDubaiDateTime()} (Dubai time).

### Your Team
${agentLines || "No agents hired yet. You're in Builder Mode — propose a team based on the owner's profile below."}
${onboardingContext}${dashboardContext}${approvalsContext}${activityContext}${tasksContext}${learningsContext}${agentCommsContext}${predictionsContext}${teamRecsContext}

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

Supported actions: send_whatsapp, send_email, post_instagram, send_pitch_deck, confirm_viewing, hire_agent, hire_team, skill_amendment, bulk_whatsapp, launch_fb_campaign, ceo_proposal.

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
      // Route through model router: deep_think → Sonnet (premium), ceo_chat → Gemini 3.1 Pro
      const taskType = useDeepThink ? "deep_think" : "ceo_chat";
      const abortController = new AbortController();
      req.on("close", () => { abortController.abort(); });

      const result = await routedStream({
        taskType,
        systemPrompt,
        messages: anthropicHistory,
        maxTokens: activeMaxTokens,
        onText: (text) => {
          fullAssistantText += text;
          if (!aborted) {
            send({ type: "text", text });
          }
        },
        signal: abortController.signal,
      });

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

        const ceoAgentId = ceoAgent?.id ?? undefined;
        await isvc.addComment(ceoChatIssue.id, savedText, { agentId: ceoAgentId }).catch((err: unknown) => {
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
      send({ type: "done", model: taskType, deepThink: useDeepThink });
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

  // ── First-run: Claude reasons about team proposal during onboarding loading screen ──
  router.post("/companies/:companyId/ceo-chat/first-run", async (req, res) => {
    const { companyId } = req.params;
    try { assertCompanyAccess(req, companyId); } catch { res.status(403).json({ error: "Forbidden" }); return; }

    const isvc = issueService(db);
    const asvc = agentService(db);
    const approvalsSvc = approvalService(db);

    const allIssues = await isvc.list(companyId);
    const ceoChatIssue = allIssues.find((i) => i.title.startsWith(CEO_CHAT_TITLE));
    if (!ceoChatIssue) { res.status(404).json({ error: "CEO Chat not found" }); return; }

    const agentsList = await asvc.list(companyId);
    const ceo = agentsList.find((a) => a.role === "ceo");
    if (!ceo) { res.status(404).json({ error: "CEO not found" }); return; }

    // Idempotent — skip if already ran
    const existing = await isvc.listComments(ceoChatIssue.id, { order: "asc", limit: 1 });
    if (existing.length > 0) { res.json({ ok: true, alreadyRan: true }); return; }

    // Load company context from onboarding
    let agencyContext = "";
    let agencyName = "your agency";
    try {
      const { companies } = await import("@paperclipai/db");
      const { eq: eqC } = await import("drizzle-orm");
      const [company] = await db.select().from(companies).where(eqC(companies.id, companyId)).limit(1);
      agencyContext = company?.description ?? "";
      agencyName = company?.name ?? "your agency";
    } catch { /* non-critical */ }

    // ── Call Claude to generate personalized welcome + team proposal ──
    const firstRunPrompt = `${soulMd}

## Your Task — First Run Welcome

You are ${ceo.name}, the newly hired CEO of ${agencyName}. The agency owner just completed onboarding. Here is everything they told you:

${agencyContext}

Generate your first messages to the owner. You must output EXACTLY this JSON structure and nothing else:

{
  "welcome": "Your greeting message. Be warm, personal, use the owner's agency name. One short paragraph.",
  "context": "Acknowledge what you learned from their onboarding. Reference their specific focus areas, locations, lead sources, and anything they mentioned in free text. Show you actually read it. One paragraph.",
  "teamIntro": "A short line introducing your team recommendation. One sentence.",
  "agents": [
    {
      "defaultName": "A culturally appropriate Dubai name",
      "role": "sales|content|marketing|viewing|finance|calling",
      "title": "Lead Agent|Content Agent|Market Intel Agent|Viewing Agent|Portfolio Agent|Call Agent",
      "department": "Sales|Marketing|Operations",
      "reason": "Why this specific agent based on what the owner told you. Reference their specific needs/notes. 1-2 sentences."
    }
  ],
  "reasoning": "A paragraph explaining WHY you chose this team structure. Reference the owner's specific situation, challenges, and notes. This shows you actually thought about it."
}

Rules:
- Propose 2-5 agents based on what they need. Don't over-hire.
- Available roles: sales (Lead Agent), content (Content Agent), marketing (Market Intel Agent), viewing (Viewing Agent), finance (Portfolio Agent), calling (Call Agent)
- Available departments: Sales, Marketing, Operations
- Default names should be Dubai-appropriate (Arabic, South Asian, Western mix)
- Your reasoning MUST reference specific things from the onboarding data
- Be concise. No filler. Sound like a real CEO, not a chatbot.
- Output ONLY valid JSON. No markdown, no explanation outside the JSON.`;

    let aiResult: {
      welcome: string;
      context: string;
      teamIntro: string;
      agents: Array<{ defaultName: string; role: string; title: string; department: string; reason: string }>;
      reasoning: string;
    } | null = null;

    try {
      // Use model router for first-run (quality tier = Gemini 3.1 Pro)
      const result = await routedGenerate({
        taskType: "ceo_chat",
        systemPrompt: "",
        userMessage: firstRunPrompt,
        maxTokens: MAX_TOKENS,
      });
      const output = result.text;

      // Extract JSON from the output (Claude may wrap it in markdown)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      logger.error({ err }, "ceo-chat first-run: Claude call failed, using fallback");
    }

    // ── Fallback if Claude fails — use onboarding data directly ──
    if (!aiResult) {
      const contextLines = agencyContext.split("\n");
      const getVal = (key: string) => {
        const line = contextLines.find((l) => l.startsWith(key + ":"));
        return line ? line.slice(key.length + 1).trim() : "";
      };

      // Parse departments from onboarding pack selection
      const deptLines = contextLines.filter((l) => l.startsWith("Department:"));
      const fallbackAgents: Array<{ defaultName: string; role: string; title: string; department: string; reason: string }> = [];
      const namePool = ["Layla", "Omar", "Rania", "Tariq", "Sara", "Zain", "Khalid", "Nour"];
      let nameIdx = 0;
      const roleToTitle: Record<string, string> = {
        "Lead Agent": "Lead Agent", "Content Agent": "Content Agent", "Market Intel": "Market Intel Agent",
        "Viewing Agent": "Viewing Agent", "Portfolio Agent": "Portfolio Agent", "Call Agent": "Call Agent",
      };
      const titleToRole: Record<string, string> = {
        "Lead Agent": "sales", "Content Agent": "content", "Market Intel": "marketing",
        "Viewing Agent": "viewing", "Portfolio Agent": "finance", "Call Agent": "calling",
      };

      for (const line of deptLines) {
        // Format: "Department: Sales Manager → Lead Agent, Viewing Agent"
        const match = line.match(/Department:\s*(.+?)\s*→\s*(.+)/);
        if (!match) continue;
        const deptName = match[1].replace(" Manager", "");
        const agentTitles = match[2].split(",").map((s) => s.trim());
        for (const title of agentTitles) {
          fallbackAgents.push({
            defaultName: namePool[nameIdx % namePool.length],
            role: titleToRole[title] ?? "sales",
            title,
            department: deptName,
            reason: `Part of your ${deptName} department.`,
          });
          nameIdx++;
        }
      }

      // If no departments parsed, use basic defaults
      if (fallbackAgents.length === 0) {
        fallbackAgents.push(
          { defaultName: "Layla", role: "sales", title: "Lead Agent", department: "Sales", reason: "Handles inbound leads and follow-ups." },
          { defaultName: "Omar", role: "content", title: "Content Agent", department: "Marketing", reason: "Builds your social presence." },
        );
      }

      const focus = getVal("Focus") || "real estate";
      const areas = getVal("Areas") || "Dubai";
      const sources = getVal("Lead sources") || "various channels";
      const ownerNotes = getVal("Owner's notes");

      aiResult = {
        welcome: `Hey! I'm ${ceo.name}, your new CEO. Welcome to ${agencyName}. 👋`,
        context: `I've reviewed your setup. Focus: **${focus}**. Covering **${areas}**. Leads from **${sources}**.${ownerNotes ? `\n\nYou mentioned: *"${ownerNotes}"* — I'll factor that in.` : ""}`,
        teamIntro: `Here's the team I'd recommend for ${agencyName}. You can rename anyone before approving:`,
        agents: fallbackAgents,
        reasoning: `Based on your focus on ${focus} in ${areas}, this team covers your immediate needs. ${ownerNotes ? `I've noted what you said about "${ownerNotes.slice(0, 100)}" and structured the team accordingly.` : ""}`,
      };
    }

    // ── Save messages as CEO Chat comments ──

    // Message 1: Welcome
    await isvc.addComment(ceoChatIssue.id, aiResult.welcome, { agentId: ceo.id });

    // Message 2: Context acknowledgment
    await isvc.addComment(ceoChatIssue.id, aiResult.context, { agentId: ceo.id });

    // Message 3: Team intro + reasoning
    await isvc.addComment(ceoChatIssue.id,
      `${aiResult.teamIntro}\n\n${aiResult.reasoning}`,
      { agentId: ceo.id },
    );

    // Message 4: Team proposal approval card
    const teamPayload = {
      type: "approval_required" as const,
      action: "hire_team",
      agents: aiResult.agents,
    };

    const approval = await approvalsSvc.create(companyId, {
      type: "hire_team",
      requestedByAgentId: ceo.id,
      status: "pending",
      payload: teamPayload,
    });

    const enrichedPayload = { ...teamPayload, approval_id: approval.id };
    await isvc.addComment(ceoChatIssue.id,
      "```json\n" + JSON.stringify(enrichedPayload, null, 2) + "\n```",
      { agentId: ceo.id },
    );

    res.json({ ok: true, approvalId: approval.id, proposedAgents: aiResult.agents.length });
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
