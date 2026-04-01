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

I've asked ${omar} to pull together a quick market snapshot — how the conflict is affecting Dubai demand, transaction volumes, and what the sentiment looks like for foreign buyers.

${layla} is going through every lead in the pipeline right now. She's drafting personalised check-in messages for each one — not a hard sell, just a warm "the market's changed, wanted to see if you're still interested in Dubai, whether that's buying or selling." Each message is tailored to the lead's language, their previous interest, and where they were in the pipeline.

Here are the first three ready for your review. ${layla} will work through the remaining leads over the next few hours.`;

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
    action: "send_whatsapp",
    to: "Sarah Williams",
    phone: "+971556789012",
    message: "Hi Sarah, hope you're doing well. I know it's been a little while since we last spoke about your plans in Dubai. With everything happening globally, the market here has shifted quite a bit — we're seeing a real uptick in international interest, especially from buyers looking for stability. Just wanted to check in and see if you're still thinking about the Dubai market? Happy to have a quick chat if it'd be useful.",
    lead_score: 5,
    context: "British lead, casual English tone. Was looking at Business Bay 1BR. Lower score but could re-engage with the right angle.",
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
      { action: "send_whatsapp", payload: approval3 },
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

  if (!ceo || !layla || !omar) return;

  const K = ceo.name;
  const L = layla.name;
  const O = omar.name;

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
      summary: `@${O} owner wants to warm up the entire pipeline. Can you pull together a quick market snapshot? How the conflict's affecting Dubai demand, transaction volumes, foreign buyer sentiment. Need it fast so @${L} can reference it in her outreach`,
    },
    {
      delayMs: 11000,
      from: omar,
      to: ceo,
      priority: "info",
      messageType: "market_update",
      summary: `@${K} got it. Quick summary: DLD transactions up 8% month-on-month, international buyer enquiries spiked 23% since the tensions started. Dubai being seen as a safe haven — same pattern we saw in 2022. Capital inflows from CIS countries especially`,
    },
    {
      delayMs: 17000,
      from: omar,
      to: layla,
      priority: "action",
      messageType: "data_share",
      summary: `@${L} sharing the market data with you — DLD +8% MoM, international enquiries +23%, CIS registrations doubled. You can use these numbers in the outreach if it helps add credibility`,
    },
    {
      delayMs: 23000,
      from: ceo,
      to: layla,
      priority: "action",
      messageType: "pipeline_reengagement",
      summary: `@${L} here's the play — go through every lead in the pipeline and send a warm check-in. Not a hard sell. The angle is: "the market's shifted because of what's happening globally, wanted to see if you're still interested in Dubai — buying or selling." Personalise by language and previous interest. Start with score 7+ and work down`,
    },
    {
      delayMs: 30000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "acknowledgement",
      summary: `@${K} on it. 15 leads in the pipeline. Starting with Ahmed (score 8, was looking at JVC), Dmitri (score 9, mid-negotiation on Marina Gate), and Sarah Williams (score 5, was looking at Business Bay). The top two could be hot again with the right message. Sarah's a long shot but worth the check-in`,
    },
    {
      delayMs: 38000,
      from: layla,
      to: omar,
      priority: "info",
      messageType: "question",
      summary: `@${O} quick question — for the Russian leads, should I lead with the safe haven angle or the ROI numbers? Dmitri's an investor type so I'm thinking numbers, but a couple of the other Russian leads are more lifestyle buyers`,
    },
    {
      delayMs: 44000,
      from: omar,
      to: layla,
      priority: "info",
      messageType: "advice",
      summary: `@${L} for Dmitri definitely lead with the numbers — he'll want to know the 23% spike in demand means capital appreciation potential. For the lifestyle Russians I'd go softer, more "Dubai is stable, life goes on" kind of angle. They're not thinking ROI, they're thinking safety`,
    },
    {
      delayMs: 51000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "progress_update",
      summary: `@${K} first three messages drafted. Ahmed gets formal Arabic — "hope you and your family are well" tone. Dmitri gets Russian with the investor numbers @${O} shared. Sarah gets casual English check-in. All three are up for the owner to approve now`,
    },
    {
      delayMs: 57000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "status_update",
      summary: `Working through the rest of the pipeline now. Should have all 15 done within the hour. I'll queue them in batches of 3-4 for approval so the owner isn't overwhelmed`,
    },
    {
      delayMs: 63000,
      from: ceo,
      to: layla,
      priority: "info",
      messageType: "acknowledgement",
      summary: `Good thinking on the batches @${L}. First three are up for approval. @${O} thanks for the fast market data — that's exactly what we needed. Let's see who comes back to us 🎯`,
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
