import { Router } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, aygentAgentMessages, issueComments, issues } from "@paperclipai/db";
import { publishLiveEvent } from "../services/live-events.js";
import { logActivity } from "../services/activity-log.js";
import { logger } from "../middleware/logger.js";

const CEO_CHAT_TITLE = "CEO Chat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DemoAgent {
  id: string;
  name: string;
  role: string;
}

async function resolveAgents(db: Db, companyId: string): Promise<Map<string, DemoAgent>> {
  const rows = await db.select({ id: agents.id, name: agents.name, role: agents.role }).from(agents).where(eq(agents.companyId, companyId));
  const map = new Map<string, DemoAgent>();
  for (const r of rows) {
    map.set(r.role, r);
    map.set(r.name.toLowerCase(), r);
  }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CEO response — clean text, no markdown, approval JSON blocks separate
// ---------------------------------------------------------------------------

function buildCeoResponse(agentMap: Map<string, DemoAgent>) {
  const layla = agentMap.get("sales")?.name ?? "Layla";
  const omar = agentMap.get("marketing")?.name ?? "Omar";
  const nour = agentMap.get("content")?.name ?? "Nour";

  // The text the CEO streams — natural language, no markdown formatting
  const spokenText = `Good call. With the geopolitical situation shifting, now's the right time to re-engage the full pipeline.

I've asked ${omar} to pull together a quick market snapshot — how the conflict is affecting Dubai demand, any changes in transaction volume, and what the sentiment looks like for foreign buyers.

${layla} is going through every lead in the pipeline. She's segmenting them into buyers and sellers, and drafting personalised check-in messages. Not a hard sell — just a warm, genuine "the market's changed, are you still interested?" tailored to each person's language and situation.

${nour} is putting together a market update post — something that positions us as the agency that keeps clients informed, not just the one that sells.

Here are the first two ready for your review. ${layla} will work through the rest of the pipeline over the next few hours.`;

  const approval1 = {
    type: "approval_required",
    action: "send_whatsapp",
    to: "Ahmed Al Hashimi",
    phone: "+971501234567",
    message: "Dear Mr. Al Hashimi, I hope you and your family are well. With recent developments in the region, the Dubai property market has seen some notable shifts — increased demand from international buyers looking for stability, and some interesting movement on pricing. I wanted to check in and see if you're still considering the Dubai market, whether buying or selling. Happy to share a quick update if it's helpful.",
    lead_score: 8,
    context: "High-value lead, previously interested in JVC. Formal Arabic greeting. Warm re-engagement, not a hard sell.",
  };

  const approval2 = {
    type: "approval_required",
    action: "send_whatsapp",
    to: "Dmitri Volkov",
    phone: "+971555678901",
    message: "Дмитрий, добрый день. В связи с последними событиями на Ближнем Востоке рынок Дубая заметно изменился — увеличился спрос со стороны международных инвесторов, ищущих стабильность. Хотел узнать, актуален ли для вас вопрос покупки или продажи недвижимости в Дубае? Могу подготовить краткий обзор текущей ситуации.",
    lead_score: 9,
    context: "Russian investor, score 9, was in negotiation stage. Geopolitical angle highly relevant. Metrics-focused follow-up.",
  };

  const approval3 = {
    type: "approval_required",
    action: "post_instagram",
    caption: "The world is changing. Dubai's property market is responding.\n\nWith global uncertainty driving demand for safe-haven assets, Dubai continues to attract international investors.\n\nWhether you're looking to buy, sell, or simply understand what's happening — we're here.\n\nDM us for a confidential market update.\n\n#DubaiRealEstate #PropertyMarket #DubaiInvestment #SafeHaven #MarketUpdate",
    context: "Market shift content. Positions the agency as informed and advisory, not salesy. Designed to generate inbound enquiries.",
  };

  // The full saved text includes JSON blocks (rendered as cards after save)
  const savedText = `${spokenText}

\`\`\`json
${JSON.stringify(approval1, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(approval2, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(approval3, null, 2)}
\`\`\``;

  return {
    spokenText,
    savedText,
    approvalBlocks: [
      { action: "send_whatsapp", payload: approval1 },
      { action: "send_whatsapp", payload: approval2 },
      { action: "post_instagram", payload: approval3 },
    ],
  };
}

// ---------------------------------------------------------------------------
// SSE streaming — realistic typing speed
// ---------------------------------------------------------------------------

async function streamText(
  res: import("express").Response,
  text: string,
  abortedRef: { current: boolean },
) {
  // Stream word-by-word for natural feel, with variable delays
  const words = text.split(/(\s+)/); // split keeping whitespace
  for (const word of words) {
    if (abortedRef.current) break;
    res.write(`data: ${JSON.stringify({ type: "text", text: word })}\n\n`);
    // Vary delay: longer pause after periods/newlines, shorter for regular words
    const isPause = /[.\n]$/.test(word.trim());
    const delay = isPause ? 120 : (40 + Math.random() * 30);
    await sleep(delay);
  }
}

// ---------------------------------------------------------------------------
// Background sequence — realistic timing, casual colleague tone
// ---------------------------------------------------------------------------

async function runBackgroundSequence(
  db: Db,
  companyId: string,
  agentMap: Map<string, DemoAgent>,
) {
  const ceo = agentMap.get("ceo");
  const layla = agentMap.get("sales");
  const omar = agentMap.get("marketing");
  const nour = agentMap.get("content");

  if (!ceo || !layla || !omar || !nour) return;

  const K = ceo.name;
  const L = layla.name;
  const O = omar.name;
  const N = nour.name;

  const steps: Array<{
    delayMs: number;
    from: DemoAgent;
    to: DemoAgent;
    priority: "info" | "action" | "urgent";
    messageType: string;
    summary: string;
  }> = [
    {
      delayMs: 4000,
      from: ceo,
      to: omar,
      priority: "action",
      messageType: "market_brief",
      summary: `@${O} owner wants to warm up the entire pipeline. Can you put together a quick market snapshot? How the conflict's affecting Dubai demand, transaction volumes, foreign buyer sentiment. Need it fast so @${L} can use it in her outreach`,
    },
    {
      delayMs: 11000,
      from: omar,
      to: ceo,
      priority: "info",
      messageType: "market_update",
      summary: `@${K} got it. Quick summary: DLD transactions up 8% month-on-month, international buyer enquiries spiked 23% since the tensions started. Dubai being seen as a safe haven — same pattern we saw in 2022. Capital inflows from CIS countries especially. I'll write this up properly for @${N} to use in content`,
    },
    {
      delayMs: 18000,
      from: ceo,
      to: layla,
      priority: "action",
      messageType: "pipeline_reengagement",
      summary: `@${L} here's the play — go through every lead in the pipeline and send a warm check-in. Not a hard sell. The angle is: "the market's shifted because of what's happening globally, wanted to see if you're still interested in Dubai — buying or selling." Personalise by language and previous interest. Start with score 7+ and work your way down`,
    },
    {
      delayMs: 24000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "acknowledgement",
      summary: `@${K} on it. I've got 15 leads in the pipeline. Starting with Ahmed (score 8, was looking at JVC), Dmitri (score 9, was mid-negotiation on Marina Gate), and Hassan (score 10, the Downtown penthouse buyer). These three could be hot again with the right message`,
    },
    {
      delayMs: 31000,
      from: layla,
      to: nour,
      priority: "action",
      messageType: "content_request",
      summary: `@${N} we're doing a full pipeline warm-up. Can you draft a market update post for Instagram? Something that positions us as the informed agency — not "BUY NOW" energy, more like "the world's changing, here's what it means for Dubai property, DM us if you want to talk." @${O} has the data`,
    },
    {
      delayMs: 38000,
      from: nour,
      to: layla,
      priority: "info",
      messageType: "acknowledgement",
      summary: `Love that angle @${L}. Less salesy, more advisory. I'll use @${O}'s numbers about the 23% spike in international enquiries. Give me a few minutes`,
    },
    {
      delayMs: 45000,
      from: omar,
      to: nour,
      priority: "info",
      messageType: "data_share",
      summary: `@${N} here's the key stats for your post: DLD transactions +8% MoM, international enquiries +23%, CIS buyer registrations doubled since March. Dubai ranked #1 for capital preservation in the MENA region. Use whatever you need`,
    },
    {
      delayMs: 52000,
      from: nour,
      to: ceo,
      priority: "info",
      messageType: "content_ready",
      summary: `@${K} post is drafted and queued for approval. Went with the "safe haven" angle — felt right given the sentiment. @${L} I kept it soft enough that it won't put off anyone who's nervous about the region`,
    },
    {
      delayMs: 58000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "status_update",
      summary: `@${K} first two messages are drafted — Ahmed and Dmitri. Both personalised. Ahmed gets formal Arabic with a "checking in on you" tone. Dmitri gets the investor angle in Russian with the numbers @${O} pulled. Working through the rest of the pipeline now, should have all 15 done within the hour`,
    },
    {
      delayMs: 64000,
      from: ceo,
      to: layla,
      priority: "info",
      messageType: "acknowledgement",
      summary: `Perfect @${L}. First two plus @${N}'s post are up for the owner to approve. @${O} @${N} @${L} — good work, this was fast. Let's see which leads bite 🎯`,
    },
  ];

  for (const step of steps) {
    await sleep(step.delayMs);

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.insert(aygentAgentMessages).values({
      companyId,
      fromAgentId: step.from.id,
      toAgentId: step.to.id,
      priority: step.priority,
      messageType: step.messageType,
      summary: step.summary,
      data: null,
      readByAgents: [],
      actedOn: false,
      expiresAt,
    });

    await logActivity(db, {
      companyId,
      actorType: "agent",
      actorId: step.from.id,
      action: "agent.message_sent",
      entityType: "agent_message",
      entityId: step.to.id,
      details: {
        fromAgent: step.from.name,
        toAgent: step.to.name,
        messageType: step.messageType,
        summary: step.summary,
      },
    });

    publishLiveEvent({
      companyId,
      type: "activity.logged",
      payload: {
        fromAgent: step.from.name,
        toAgent: step.to.name,
        messageType: step.messageType,
        summary: step.summary,
      },
    });

    logger.info(
      { from: step.from.name, to: step.to.name, messageType: step.messageType },
      "demo-orchestrator: agent message",
    );
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleDemoChat(
  db: Db,
  companyId: string,
  message: string,
  req: import("express").Request,
  res: import("express").Response,
) {
  const agentMap = await resolveAgents(db, companyId);
  const ceoAgent = agentMap.get("ceo");

  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE);

  if (!ceoChatIssue) {
    res.status(404).json({ error: "CEO Chat issue not found" });
    return;
  }

  // Save user message
  await db.insert(issueComments).values({
    id: randomUUID(),
    companyId,
    issueId: ceoChatIssue.id,
    body: message,
    authorUserId: "demo-owner",
    authorAgentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { spokenText, savedText, approvalBlocks } = buildCeoResponse(agentMap);

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const abortedRef = { current: false };
  req.on("close", () => { abortedRef.current = true; });

  function send(data: Record<string, unknown>) {
    if (abortedRef.current) return;
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { abortedRef.current = true; }
  }

  // Typing pause
  await sleep(1200);

  // Stream ONLY the spoken text (no JSON blocks — those appear as cards after)
  await streamText(res, spokenText, abortedRef);

  // Create real approval records
  const createdApprovalIds: string[] = [];
  let enrichedSavedText = savedText;

  for (const block of approvalBlocks) {
    const [approval] = await db.insert(approvals).values({
      companyId,
      type: String(block.payload.action ?? "ceo_proposal"),
      requestedByAgentId: ceoAgent?.id ?? null,
      status: "pending",
      payload: block.payload,
    }).returning();

    if (approval) {
      createdApprovalIds.push(approval.id);
      const enrichedPayload = { ...block.payload, approval_id: approval.id };
      const originalBlock = "```json\n" + JSON.stringify(block.payload, null, 2) + "\n```";
      const enrichedBlock = "```json\n" + JSON.stringify(enrichedPayload, null, 2) + "\n```";
      enrichedSavedText = enrichedSavedText.replace(originalBlock, enrichedBlock);
    }
  }

  // Save full comment (with JSON blocks — UI parses them into cards)
  await db.insert(issueComments).values({
    id: randomUUID(),
    companyId,
    issueId: ceoChatIssue.id,
    body: enrichedSavedText,
    authorAgentId: ceoAgent?.id ?? null,
    authorUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (createdApprovalIds.length > 0) {
    send({ type: "approvals_created", approvalIds: createdApprovalIds });
  }
  send({ type: "done", model: "demo", deepThink: false });
  res.end();

  publishLiveEvent({
    companyId,
    type: "activity.logged",
    payload: { action: "ceo.response", summary: "CEO responded to owner message" },
  });

  // Background inter-agent messages (realistic delays: 3s to 35s)
  runBackgroundSequence(db, companyId, agentMap).catch((err) => {
    logger.error({ err }, "demo-orchestrator: background sequence failed");
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export function demoOrchestratorRoutes(db: Db) {
  const router = Router();

  router.post("/companies/:companyId/demo-chat", async (req, res) => {
    const { companyId } = req.params;
    const { message } = req.body as { message?: string };
    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }
    await handleDemoChat(db, companyId, message.trim(), req, res);
  });

  return router;
}
