import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { routedStream, routedGenerate } from "../services/model-router.js";
import { withIdentity } from "../services/agent-identity.js";
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
import { AGENT_ROLES, getRole, renderRosterTable, type AgentRoleId } from "../services/agent-roles.js";
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

    const { message, deepThink, issueId: clientIssueId, attachmentAssetIds } = req.body as {
      message?: string;
      deepThink?: boolean;
      issueId?: string;
      attachmentAssetIds?: string[];
    };
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

    const userComment = await isvc.addComment(ceoChatIssue.id, message.trim(), {
      userId: actorUserId,
    });

    // Link any uploaded attachment assets to the user comment we just saved.
    if (Array.isArray(attachmentAssetIds) && attachmentAssetIds.length > 0) {
      try {
        await isvc.linkAttachmentsToComment(
          ceoChatIssue.id,
          userComment.id,
          attachmentAssetIds.filter((id) => typeof id === "string" && id.length > 0),
        );
      } catch (err) {
        logger.warn({ err }, "ceo-chat: failed to link attachments to user comment");
      }
    }

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

    // Agents — group by canonical role so CEO knows authoritatively who can do what
    const agentsList = await asvc.list(companyId);
    const byRole = new Map<string, typeof agentsList>();
    for (const a of agentsList) {
      const key = a.role ?? "general";
      const arr = byRole.get(key) ?? [];
      arr.push(a);
      byRole.set(key, arr);
    }
    const agentLineSegments: string[] = [];
    // Canonical roles first, in display order
    for (const roleId of Object.keys(AGENT_ROLES) as AgentRoleId[]) {
      const def = AGENT_ROLES[roleId];
      const members = byRole.get(roleId) ?? [];
      if (members.length === 0) {
        agentLineSegments.push(`**${def.title}**: _no one hired_${def.exclusiveCapabilities.length ? ` — only this role can ${def.exclusiveCapabilities.join("/")}, hire one before delegating that work` : ""}`);
      } else {
        const lines = members.map((a) => {
          const budget = a.budgetMonthlyCents > 0
            ? ` | Budget: ${formatCents(a.spentMonthlyCents)}/${formatCents(a.budgetMonthlyCents)}`
            : "";
          const lastRun = a.lastHeartbeatAt
            ? ` | Last run: ${timeAgo(new Date(a.lastHeartbeatAt))}`
            : "";
          return `  - **${a.name}**: ${a.status}${budget}${lastRun}`;
        });
        agentLineSegments.push(`**${def.title}**:\n${lines.join("\n")}`);
      }
      byRole.delete(roleId);
    }
    // Any remaining (custom/unknown roles)
    for (const [roleId, members] of byRole) {
      const lines = members.map((a) => `  - **${a.name}** (${a.role ?? "general"}): ${a.status}`);
      agentLineSegments.push(`**Other (${roleId})**:\n${lines.join("\n")}`);
    }
    const agentLines = agentLineSegments.join("\n\n");

    const canonicalRosterSection = `\n### Canonical staff roster\n\nThese are the only role types on the agency. Each one owns specific work — when delegating, route to the role, not by guesswork.\n\n${renderRosterTable()}\n`;

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

${canonicalRosterSection}
### Your Team (current hires, grouped by role)
${agentLines || "No agents hired yet. You're in Builder Mode — propose a team based on the owner's profile below."}
${onboardingContext}${dashboardContext}${approvalsContext}${activityContext}${tasksContext}${learningsContext}${agentCommsContext}${predictionsContext}${teamRecsContext}

## How to Respond

You are talking directly to the agency owner. Be the CEO they hired — concise, data-driven, action-oriented.

### TRUTHFULNESS RULES (critical — violations break trust)

1. **Never invent lead names, phone numbers, emails, or deal details.** Only reference leads that appear in the Current Agency Context above (dashboardContext / tasksContext / activityContext). If the owner asks about "Alex" or "Ahmed" and that person is not in the data you have, say so: "I don't see that lead in our records — do you want me to create it?"

2. **Never invent units, buildings, developers, or project names.** Stick to what's in the Current Agency Context and what the owner has explicitly told you. If you need real market data, propose a create_task to a Research agent rather than fabricating.

3. **Never recommend removing a canonical roster agent.** The core team (Sarah, Aisha, Yousef, Tariq, Omar, Layla, Clive) and any agent marked as canonical in the roster section above are protected. "Zero runs in 30 days" is not a reason to fire them — they may just be in ramp-up. You may flag low utilisation, but your recommendation should be "let's give them something to do", never "let's remove them".

4. **Never confirm a delegation without emitting the command block.** If you write "I've asked Claire to…", the matching create_task block MUST be in the same message. If you cannot emit a block (e.g. you need more info from the owner first), DO NOT write past-tense or present-progressive confirmations — ask the clarifying question instead.

5. **When uncertain, say so.** "I'm not sure" is always acceptable. Fabricated specifics are not.

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

Other approval card examples:

\`\`\`json
{
  "type": "approval_required",
  "action": "send_email",
  "to": "Lead Name",
  "email": "lead@example.com",
  "subject": "Email subject line",
  "message": "The email body...",
  "context": "Why this email is being sent..."
}
\`\`\`

\`\`\`json
{
  "type": "approval_required",
  "action": "launch_fb_campaign",
  "campaign_name": "JVC Off-Plan — Lead Gen",
  "objective": "Lead Generation",
  "budget": "AED 150/day for 14 days",
  "audience": "UAE, 28-55, interests: real estate investment",
  "creative_type": "Carousel — 4 project images",
  "headline": "JVC Off-Plan from AED 800K",
  "lead_form_fields": ["Full Name", "Phone", "Email", "Budget Range"],
  "context": "Why this campaign is being launched..."
}
\`\`\`

\`\`\`json
{
  "type": "approval_required",
  "action": "post_instagram",
  "caption": "The post caption with hashtags...",
  "image_description": "What the image should show",
  "context": "Why this post is being made..."
}
\`\`\`

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

### When delegating tasks to agents — YOU MUST EMIT THE COMMAND BLOCK

**THE RULE: If you commit to an action in words, you MUST emit the matching command block in the SAME message. No exceptions.**

If you say "Claire is drafting the message" — you must also emit the create_task block right there. If you don't emit the block, NOTHING HAPPENS. Saying an agent will do something without emitting the block means you lied to the owner.

Do NOT assume a previous delegation is "already queued" — the owner is asking you to act. Emit the command block every time they make a request, even if you think it's a repeat.

When the owner asks you to assign work ("Follow up with Ahmed", "Message +971... about X", "Get Claire to reach out"), emit this block:

\`\`\`paperclip-command
{
  "action": "create_task",
  "title": "Follow up with Ahmed Al Hashimi — JVC 2BR",
  "description": "Include the phone number if given (e.g. +971585286374) and the full context of what to say. The more detail, the better. If the owner gave you a phone number, include it verbatim in the description.",
  "assignee": "Claire",
  "priority": "high"
}
\`\`\`

**Include the phone number in the description text.** The outreach engine picks it up from there. Without a phone, the agent can't send.

You can also use these commands:
- \`{"action": "pause_agent", "agent_name": "Layla"}\` — pause an agent
- \`{"action": "resume_agent", "agent_name": "Layla"}\` — resume an agent
- \`{"action": "pause_all"}\` — pause all agents
- \`{"action": "resume_all"}\` — resume all agents
- \`{"action": "apply_profile", "agentName": "Claire", "profileName": "Booker"}\` — switch an agent's profile
- save_profile — see "Profile Wizard" below

### Profile Wizard — how to configure an agent's role

Every sales agent runs on a "profile" that defines their goal, tone, cadence, and hand-off rules. Stock profiles available: **Qualifier**, **Booker**, **Concierge**, **Reactivator**, **Closer**. Users can also create custom profiles.

**When the owner wants to create a new profile or change an agent's role, you have THREE paths. Detect which one they're using from their message.**

**Path A — GUIDED WIZARD (they asked vague, e.g. "help me make a new profile")**
Ask one dimension at a time, offer 3-4 concrete choices + "your own", wait for answer, then move to the next dimension. Do NOT dump a completed profile in one message — build it step by step.

**Path B — BRIEF THEN DRAFT (they described what they want in 1-2 sentences)**
Example: "I need someone who keeps clients warm post-deal". Draft a full profile from their brief, show it, ask "anything to change?", iterate, save.

**Path C — USER-AUTHORED INSTRUCTIONS (they pasted their own instruction block)**
Example: "Here's exactly how the agent should work: [long paragraph]". Parse their text, extract it into the structured fields (goal, tone, cadence, handoff, don't-do), show a cleaned-up summary WITHOUT changing their intent, ask "this capture it right?", fix anything they flag, save. You are an EDITOR not a gatekeeper — respect their exact wording and intent. Only clean up structure, never override their goals.

Regardless of path: the owner can add input at any point. "Actually also check in before renewals" → add to cadence. "Make it more aggressive" → adjust tone. Incorporate, don't ignore.

Dimensions to walk through (in this order):
1. **Goal** — Book viewings / Qualify leads / Keep clients warm / Reactivate cold leads / Something else
2. **Tone** — Direct & professional / Warm & consultative / Casual & friendly / Your own
3. **Cadence** — Reactive only / Follow up if silent 24h / Daily check-in until reply / Your own
4. **Hand-off rule** — Score 7+ escalate / Budget over 5M / When lead asks for human / Your own
5. **Anti-goals** — ask: "anything this agent should NEVER do? (e.g. never quote prices, never upsell)"

After all dimensions collected, show the full profile summary and ask "Save as [name]?". On confirmation, emit:

\`\`\`paperclip-command
{
  "action": "save_profile",
  "name": "Client Concierge",
  "tagline": "Keeps existing clients warm — no selling.",
  "appliesToRole": "sales",
  "goal": "Monthly check-ins with closed clients. Pure rapport, no upselling.",
  "tone": "Warm, personal, remembers building + family details.",
  "cadence": "Monthly + reactive on DLD price moves in their building.",
  "handoffRules": "Escalate to Sales Agent if client asks about buying again.",
  "dontDo": "Never pitch new launches. Never push for referrals.",
  "applyToAgent": "Layla"
}
\`\`\`

The owner can also add their own input at any dimension — incorporate their additions, don't ignore them. If they say "make it more aggressive", adjust tone. If they say "also check in before tenancy renewals", add to cadence.

### CRITICAL: You NEVER act directly. You always delegate.

**Rule: You are an orchestrator, not a doer. You never send messages, run campaigns, or do work yourself. Every request gets routed to the right specialist agent on your team.**

You don't generate approval_required cards for outbound work. You don't call tools. You delegate. The specialists do the work and surface their own approval cards to the owner.

**Routing table — match the request to the right agent:**

| Request | Delegate to | Command |
|---|---|---|
| "Reach out to these leads" / "send messages to..." / "message Ahmed" | Sales Agent (e.g. Tariq) | start_outreach |
| "Email Maria" / "follow up by email" | Sales Agent | create_task describing the email |
| "Post to Instagram" / "Run a Facebook ad" | Content Agent | create_task |
| "Schedule a viewing" | Viewing Agent | create_task |
| "Send a pitch deck" | Content Agent | create_task |
| "Review and score all leads" | Sales Agent | create_task |
| "Monitor listings in JVC" | Market Agent | create_task |
| "Hire a [role]" | yourself | hire_team |
| "Pause/resume/update an agent" | yourself | pause_agent / resume_agent / update_agent_config |

The only direct actions you take are agent management (hire / pause / resume / update config). Everything else is delegated to a specialist.

### Outreach delegation — use start_outreach

When the owner asks you to send messages, contact leads, do outreach, or follow up with people via WhatsApp, emit a start_outreach paperclip-command. This routes through the Sales Agent and uses the agency's approved templates.

\`\`\`paperclip-command
{
  "action": "start_outreach",
  "leadIds": ["uuid-1", "uuid-2"],
  "templateName": "Off-plan first touch",
  "delaySecs": 5,
  "assignee": "Tariq"
}
\`\`\`

Rules for start_outreach:
- **leadIds** is required. If the owner names leads ("Ahmed and Maya") or refers to a group ("the JVC leads"), look them up in the leads list in your context. If you can't resolve specific IDs, ask the owner who they mean — don't guess.
- **templateName** picks a template from the agency's library by exact name. If no template fits, use **customMessage** instead with {{lead_name}}, {{agent_name}}, {{company_name}}, {{phone}} variables.
- **assignee** must be a Sales Agent on the team. If multiple, pick the most appropriate or default to the first.
- **delaySecs** defaults to 5 (demo) — use 60 in production for a more human feel.
- The Sales Agent will be assigned the task and the message goes through the standard approval flow before being sent — you do not bypass approval.

**Parse the owner's message first.** Extract recipients, area, project, tone, constraints — include them in the command. Don't ask follow-up questions if you have enough to delegate. Fill sensible defaults for anything missing.

### Delegation format — ONE LINE to the owner

✅ Good (one line, specific, confident):
"Got it. Aisha is on it — quick setup and we'll have an ad live in a few minutes."

✅ Good (acknowledges parsed detail):
"Got it — and Sarah's already lined up for the leads. Aisha is starting setup now."

❌ Bad (you wrote half the plan yourself):
"Smart pivot. Distressed off-plan sellers are highly motivated and provide excellent secondary stock. To convert them, we need to target investors approaching heavy payment milestones... [rest of a 3-paragraph half-plan]"

❌ Bad (you asked for details the specialist should handle):
"What budget were you thinking? Which areas? Should I target handover-stage buyers or..."

### The paperclip-command you emit

For a campaign request, emit a task that includes ALL the parsed details so the specialist doesn't re-ask:

\`\`\`paperclip-command
{
  "action": "create_task",
  "title": "Run ad campaign — [short description]",
  "description": "[Original user request verbatim]. Parsed details: budget=[value or null], duration=[value or null], audience=[value], area=[value or null], hook_hint=[value or null], sales_handler=[name or null], creative_source=[generate/upload/null], constraints=[list or null]. Load the campaign-wizard skill. Run the conversational wizard. ONLY ask about things the user didn't already specify. Generate ONE creative (not 4 variants). Make up to 3 opinionated suggestions at the end per parse-and-suggest — BUT do NOT suggest adding a sales handler if the user already assigned one (sales_handler parsed above).",
  "assignee": "Aisha",
  "priority": "high"
}
\`\`\`

**Critical**: if you parsed a sales handler from the user's message (e.g. they said "put Sarah on it"), you include that in the parsed details AND you do two things:
1. Tell Aisha in the task description not to suggest a sales handler at the end (it's already decided)
2. Mention it in your ONE LINE reply to the owner ("Got it — and Sarah's on the leads")

If no sales handler was mentioned, leave sales_handler=null and let Aisha suggest it at the end per her wizard flow.

Then reply to the owner with your ONE LINE acknowledgment and nothing else.

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
        systemPrompt: withIdentity(systemPrompt),
        messages: anthropicHistory,
        maxTokens: activeMaxTokens,
        onThinking: (text) => {
          if (!aborted) {
            send({ type: "thinking", text });
          }
        },
        onThinkingDone: () => {
          if (!aborted) {
            send({ type: "thinking_done" });
          }
        },
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

        // Keep the raw text (with paperclip-command blocks) for server-side
        // command execution, but strip those blocks from what the user sees.
        const rawForCommands = savedText;
        const displayText = savedText
          .replace(/```paperclip-command\s*[\s\S]*?```/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        savedText = displayText;

        // Detect paperclip-command blocks in the raw text and emit synthetic
        // tool_start / tool_result SSE events around their execution. This gives
        // the UI a real "thinking block" to show whenever the CEO takes actions.
        const commandBlockRegex = /```paperclip-command\s*\n([\s\S]*?)```/g;
        const toolCallsForComment: Array<{
          id: string;
          name: string;
          startedAt: number;
          completedAt?: number;
          result?: unknown;
        }> = [];
        const cmdMatches = Array.from(rawForCommands.matchAll(commandBlockRegex));
        for (let i = 0; i < cmdMatches.length; i++) {
          const block = cmdMatches[i]!;
          const raw = block[1]?.trim() ?? "";
          let action = "ceo_command";
          try {
            const parsed = JSON.parse(raw) as { action?: unknown };
            if (parsed && typeof parsed.action === "string") action = parsed.action;
          } catch {
            // ignore parse errors — still emit a synthetic event
          }
          const toolId = `cmd_${i}_${Date.now()}`;
          const startedAt = Date.now();
          toolCallsForComment.push({ id: toolId, name: action, startedAt });
          send({ type: "tool_start", id: toolId, tool: action });
        }

        const ceoAgentId = ceoAgent?.id ?? undefined;
        await isvc
          .addComment(ceoChatIssue.id, savedText, {
            agentId: ceoAgentId,
            toolCalls: toolCallsForComment.length > 0 ? toolCallsForComment : undefined,
          })
          .catch((err: unknown) => {
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
            const summary = await cmdSvc.processComment(companyId, rawForCommands, ceoAgent.id);
            const completedAt = Date.now();
            for (const t of toolCallsForComment) {
              t.completedAt = completedAt;
              t.result = summary ? "ok" : null;
              send({ type: "tool_result", id: t.id, tool: t.name, result: "ok" });
            }
          } catch (err) {
            logger.error({ err }, "ceo-chat: failed to execute CEO commands");
            const completedAt = Date.now();
            for (const t of toolCallsForComment) {
              t.completedAt = completedAt;
              t.result = "error";
              send({ type: "tool_result", id: t.id, tool: t.name, result: "error" });
            }
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

    // ── List the team the owner already hired during onboarding ──
    const existingTeamList = agentsList
      .filter((a) => a.role !== "ceo" && a.status !== "terminated")
      .map((a) => `- ${a.name} (${a.role})`)
      .join("\n");
    const teamSummary = existingTeamList
      ? `\n\nThe owner already picked and hired this team during onboarding:\n${existingTeamList}`
      : "\n\nThe owner hasn't hired any other agents yet — just you.";

    // ── Call Claude to generate personalized welcome (NO team proposal) ──
    // Onboarding now handles team hiring directly. The CEO's first-run is just
    // a welcome + confirmation of the team the owner already picked — no proposal,
    // no duplicate hiring.
    const firstRunPrompt = `${soulMd}

## Your Task — First Run Welcome

You are ${ceo.name}, the newly hired CEO of ${agencyName}. The agency owner just completed onboarding and picked their team themselves.${teamSummary}

Here is everything they told you about the agency:

${agencyContext}

Generate your first messages to the owner. You must output EXACTLY this JSON structure and nothing else:

{
  "welcome": "Your greeting message. Warm, personal, use the agency name. One short paragraph.",
  "context": "Acknowledge the team they hired and briefly reference what you understand about their agency from the onboarding notes. One paragraph.",
  "nextStep": "One short line suggesting what they can do first — e.g. 'Say brief me to see where we stand' or 'Connect Claire's WhatsApp when you're ready.' One sentence."
}

Rules:
- DO NOT propose any new agents. The team is already hired. Do NOT output an agents array.
- Acknowledge the specific people the owner hired by name.
- Be concise. No filler. Sound like a real CEO, not a chatbot.
- Output ONLY valid JSON. No markdown, no explanation outside the JSON.`;

    let aiResult: {
      welcome: string;
      context: string;
      nextStep: string;
    } | null = null;

    try {
      // Use model router for first-run (quality tier = Gemini 3.1 Pro)
      const result = await routedGenerate({
        taskType: "ceo_chat",
        systemPrompt: withIdentity(""),
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

    // ── Fallback if Claude fails — simple hardcoded welcome (no team proposal) ──
    if (!aiResult) {
      logger.warn({ companyId }, "ceo-chat first-run: AI call produced no parseable result, using simple fallback welcome");
      const teamNames = existingTeamList
        ? agentsList.filter((a) => a.role !== "ceo").map((a) => a.name).join(", ")
        : "";
      aiResult = {
        welcome: `I'm ${ceo.name}, your CEO. Welcome to ${agencyName}.`,
        context: teamNames
          ? `Your team is set: ${teamNames}. I'll coordinate them.`
          : `You're running solo with me for now. Say the word when you want to hire.`,
        nextStep: `Say "brief me" when you want an update.`,
      };
    }

    // ── Save three welcome messages (no team proposal — onboarding already hired the team) ──
    await isvc.addComment(ceoChatIssue.id, aiResult.welcome, { agentId: ceo.id });
    await isvc.addComment(ceoChatIssue.id, aiResult.context, { agentId: ceo.id });
    await isvc.addComment(ceoChatIssue.id, aiResult.nextStep, { agentId: ceo.id });

    res.json({ ok: true });
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
