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
// Pre-written demo script
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

function buildCeoResponse(agentMap: Map<string, DemoAgent>): {
  text: string;
  approvalBlocks: Array<{ action: string; payload: Record<string, unknown> }>;
} {
  const layla = agentMap.get("sales")?.name ?? "Layla";
  const omar = agentMap.get("marketing")?.name ?? "Omar";
  const nour = agentMap.get("content")?.name ?? "Nour";

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

  const text = `On it. Here's what I'm doing right now:

**1. Market data** — I've asked ${omar} to pull the latest JVC transaction data from DLD. He confirms 1BR prices dropped 12% this week — now starting from AED 748K at Binghatti Hills.

**2. Lead re-engagement** — ${layla} cross-referenced your pipeline and found 6 leads who stalled on JVC pricing. She's drafted personalised messages for the two highest-scoring leads:

\`\`\`json
${JSON.stringify(approval1, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(approval2, null, 2)}
\`\`\`

**3. Content** — ${nour} is preparing an Instagram post to capitalise on the price movement:

\`\`\`json
${JSON.stringify(approval3, null, 2)}
\`\`\`

**Team coordination:** ${omar} shared the pricing data with ${layla}, who forwarded lead requirements to ${nour}. Three agents, one pipeline, under 30 seconds.

3 actions pending your approval above. One tap to send.`;

  return {
    text,
    approvalBlocks: [
      { action: "send_whatsapp", payload: approval1 },
      { action: "send_whatsapp", payload: approval2 },
      { action: "post_instagram", payload: approval3 },
    ],
  };
}

// ---------------------------------------------------------------------------
// SSE streaming (fake token-by-token)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamText(
  res: import("express").Response,
  text: string,
  chunkSize = 4,
  delayMs = 25,
) {
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    res.write(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`);
    await sleep(delayMs);
  }
}

// ---------------------------------------------------------------------------
// Background sequence (inter-agent messages + live events)
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
      delayMs: 2000,
      from: ceo,
      to: omar,
      priority: "action",
      messageType: "data_request",
      summary: "Pull latest JVC 1BR pricing from DLD transactions — need current market rate for re-engagement campaign.",
    },
    {
      delayMs: 4000,
      from: ceo,
      to: layla,
      priority: "action",
      messageType: "campaign_request",
      summary: "Re-engage all JVC leads who stalled on pricing. Omar is pulling fresh data — draft messages once you have it.",
    },
    {
      delayMs: 6000,
      from: omar,
      to: layla,
      priority: "action",
      messageType: "price_alert",
      summary: "JVC 1BR prices dropped 12% this week (DLD data). Binghatti Hills now from AED 748K. You have 6 leads in pipeline who match.",
    },
    {
      delayMs: 8000,
      from: layla,
      to: nour,
      priority: "action",
      messageType: "content_request",
      summary: "Need an Instagram post about JVC price drop — 12% down, now from AED 748K. Make it engagement-optimised.",
    },
    {
      delayMs: 10000,
      from: nour,
      to: layla,
      priority: "info",
      messageType: "content_ready",
      summary: "Instagram post drafted and queued for approval. Used the high-performing format from last week's JVC post (520 likes).",
    },
    {
      delayMs: 12000,
      from: layla,
      to: ceo,
      priority: "info",
      messageType: "status_update",
      summary: "Done — 2 WhatsApp messages drafted (Ahmed score 8, Elena score 7). Instagram post queued. All pending owner approval.",
    },
  ];

  for (const step of steps) {
    await sleep(step.delayMs);

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Insert inter-agent message
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

    // Log activity
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

    // Publish live event so UI updates
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
      "demo-orchestrator: inter-agent message sent",
    );
  }
}

// ---------------------------------------------------------------------------
// Exported handler (called from ceo-chat.ts for DPP company)
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

  // Find the CEO Chat issue
  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE);

  if (!ceoChatIssue) {
    res.status(404).json({ error: "CEO Chat issue not found" });
    return;
  }

  // Save the user's message as a comment
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

  // Build the scripted CEO response
  const { text, approvalBlocks } = buildCeoResponse(agentMap);

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let aborted = false;
  req.on("close", () => { aborted = true; });

  function send(data: Record<string, unknown>) {
    if (aborted) return;
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { aborted = true; }
  }

  // Pause before "typing"
  await sleep(800);

  // Stream the CEO response token-by-token
  await streamText(res, text);

  // Create real approval records
  const createdApprovalIds: string[] = [];
  let savedText = text;

  for (const block of approvalBlocks) {
    const approval = await db.insert(approvals).values({
      companyId,
      type: String(block.payload.action ?? "ceo_proposal"),
      requestedByAgentId: ceoAgent?.id ?? null,
      status: "pending",
      payload: block.payload,
    }).returning();

    if (approval[0]) {
      createdApprovalIds.push(approval[0].id);

      const enrichedPayload = { ...block.payload, approval_id: approval[0].id };
      const originalBlock = "```json\n" + JSON.stringify(block.payload, null, 2) + "\n```";
      const enrichedBlock = "```json\n" + JSON.stringify(enrichedPayload, null, 2) + "\n```";
      savedText = savedText.replace(originalBlock, enrichedBlock);
    }
  }

  // Save the CEO's response as a comment
  await db.insert(issueComments).values({
    id: randomUUID(),
    companyId,
    issueId: ceoChatIssue.id,
    body: savedText,
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

  // Publish live events for UI updates
  publishLiveEvent({
    companyId,
    type: "activity.logged",
    payload: { action: "ceo.response", summary: "CEO responded to owner message" },
  });

  // Fire the background sequence (inter-agent messages with delays)
  runBackgroundSequence(db, companyId, agentMap).catch((err) => {
    logger.error({ err }, "demo-orchestrator: background sequence failed");
  });
}

// ---------------------------------------------------------------------------
// Route (standalone, also registered in app.ts)
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
