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
  const spokenText = `On it. Here's what I'm doing right now.

I've asked ${omar} to pull the latest JVC transaction data from DLD. He just confirmed — 1BR prices dropped 12% this week. Binghatti Hills is now starting from AED 748K.

${layla} cross-referenced your pipeline and found 6 leads who stalled on JVC pricing. She's drafted messages for the two highest-scoring leads — Ahmed Al Hashimi (score 8, Arabic) and Elena Kuznetsova (score 7, Russian). Both personalised to their language and style.

${nour} is preparing an Instagram post about the price drop to drive more inbound.

All three are below for your approval. One tap to send.`;

  const approval1 = {
    type: "approval_required",
    action: "send_whatsapp",
    to: "Ahmed Al Hashimi",
    phone: "+971501234567",
    message: "Dear Mr. Al Hashimi, great news — JVC 1BR prices have dropped 12% this week. Binghatti Hills now starts from AED 748,000 with a 60/40 payment plan. Would you like to view the updated options this week?",
    lead_score: 8,
    context: "Re-engagement triggered by Market Agent price drop alert. Ahmed previously stalled on JVC pricing.",
  };

  const approval2 = {
    type: "approval_required",
    action: "send_whatsapp",
    to: "Elena Kuznetsova",
    phone: "+971552223344",
    message: "Елена, добрый день. Цены на 1BR в JVC снизились на 12% — от AED 748K. ROI 8.4% годовых при текущей арендной ставке. Интересно обсудить?",
    lead_score: 7,
    context: "Russian-speaking lead, metrics-first approach. Price drop creates re-engagement opportunity.",
  };

  const approval3 = {
    type: "approval_required",
    action: "post_instagram",
    caption: "JVC 1BR prices just dropped 12% 📉\n\nBinghatti Hills — now from AED 748K\n60/40 payment plan | Q3 2026 handover\nBest entry point this year.\n\nDM 'JVC' for floor plans.\n\n#JVC #DubaiRealEstate #OffPlan #BinghattiHills #DubaiProperty",
    context: "Market Agent detected JVC price drop. Content designed for maximum engagement based on previous post performance.",
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

  const steps: Array<{
    delayMs: number;
    from: DemoAgent;
    to: DemoAgent;
    priority: "info" | "action" | "urgent";
    messageType: string;
    summary: string;
  }> = [
    {
      delayMs: 3000,
      from: ceo,
      to: omar,
      priority: "action",
      messageType: "data_request",
      summary: "Omar, can you pull the latest JVC 1BR numbers from DLD? Owner wants to push JVC hard this week.",
    },
    {
      delayMs: 8000,
      from: omar,
      to: layla,
      priority: "action",
      messageType: "price_alert",
      summary: "Layla — heads up, JVC 1BR dropped 12% this week. Binghatti Hills now from 748K. You've got 6 leads sitting on JVC. Might be time to re-engage.",
    },
    {
      delayMs: 14000,
      from: ceo,
      to: layla,
      priority: "action",
      messageType: "campaign_request",
      summary: "Layla, draft re-engagement messages for the top JVC leads. Omar just sent you the pricing — use the new numbers. Prioritise score 7+.",
    },
    {
      delayMs: 20000,
      from: layla,
      to: nour,
      priority: "action",
      messageType: "content_request",
      summary: "Hey Nour — we're pushing JVC this week. Can you put together an Instagram post about the 12% price drop? The 748K starting price is the hook. Owner wants it today.",
    },
    {
      delayMs: 28000,
      from: nour,
      to: layla,
      priority: "info",
      messageType: "content_ready",
      summary: "Done — drafted the JVC post. Used the same format as last week's one that got 520 likes. Queued for owner approval.",
    },
    {
      delayMs: 35000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "status_update",
      summary: "All done. Drafted WhatsApp messages for Ahmed (score 8) and Elena (score 7). Nour's Instagram post is queued too. Everything's waiting for the owner to approve.",
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
