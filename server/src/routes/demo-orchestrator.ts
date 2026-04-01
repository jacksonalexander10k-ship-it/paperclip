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

interface DemoAgent { id: string; name: string; role: string; }

async function resolveAgents(db: Db, companyId: string): Promise<Map<string, DemoAgent>> {
  const rows = await db.select({ id: agents.id, name: agents.name, role: agents.role }).from(agents).where(eq(agents.companyId, companyId));
  const map = new Map<string, DemoAgent>();
  for (const r of rows) { map.set(r.role, r); map.set(r.name.toLowerCase(), r); }
  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamWords(res: import("express").Response, text: string, abortedRef: { current: boolean }) {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (abortedRef.current) break;
    res.write(`data: ${JSON.stringify({ type: "text", text: word })}\n\n`);
    const isPause = /[.\n]$/.test(word.trim());
    await sleep(isPause ? 120 : (40 + Math.random() * 30));
  }
}

function sseSend(res: import("express").Response, data: Record<string, unknown>, abortedRef: { current: boolean }) {
  if (abortedRef.current) return;
  try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { abortedRef.current = true; }
}

async function insertComment(db: Db, companyId: string, issueId: string, body: string, agentId: string | null, userId: string | null) {
  await db.insert(issueComments).values({
    id: randomUUID(), companyId, issueId, body,
    authorAgentId: agentId, authorUserId: userId,
    createdAt: new Date(), updatedAt: new Date(),
  });
}

async function postAgentMessage(db: Db, companyId: string, from: DemoAgent, to: DemoAgent, priority: "info" | "action" | "urgent", messageType: string, summary: string) {
  await db.insert(aygentAgentMessages).values({
    companyId, fromAgentId: from.id, toAgentId: to.id,
    priority, messageType, summary, data: null,
    readByAgents: [], actedOn: false,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
  publishLiveEvent({ companyId, type: "activity.logged", payload: { fromAgent: from.name, toAgent: to.name, messageType, summary } });
}

// ---------------------------------------------------------------------------
// PHASE 1: CEO streams the plan (called from ceo-chat.ts)
// ---------------------------------------------------------------------------

export async function handleDemoChat(
  db: Db,
  companyId: string,
  message: string,
  req: import("express").Request,
  res: import("express").Response,
) {
  const agentMap = await resolveAgents(db, companyId);
  const ceo = agentMap.get("ceo");
  const layla = agentMap.get("sales");
  const omar = agentMap.get("marketing");

  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE);

  if (!ceoChatIssue || !ceo || !layla || !omar) {
    res.status(404).json({ error: "CEO Chat issue or agents not found" });
    return;
  }

  // Save user message
  await insertComment(db, companyId, ceoChatIssue.id, message, null, "demo-owner");

  const planText = `Good call. With everything that's happening right now, this is exactly the right time to reach back out to everyone in the pipeline.

Here's what I'd suggest. I'll get ${omar.name} to pull together a snapshot of what's actually happening in the market right now — how the situation is affecting demand in Dubai, what the transaction data is showing, and what international buyers are doing. That way ${layla.name} has something real to reference when she reaches out, not just a vague "things have changed."

Then ${layla.name} goes through every lead in the pipeline — all 15 of them — and sends a personal check-in. Not a sales pitch. Just a genuine message saying we've been keeping an eye on the market, things have shifted, and we wanted to see if they're still thinking about Dubai. Whether that's buying or selling. Each message matched to their language and where they left off with us.

She'll start with the highest-scoring leads and batch them up for your approval so you can review before anything goes out.

Shall I go ahead with this?`;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const abortedRef = { current: false };
  req.on("close", () => { abortedRef.current = true; });

  await sleep(1200);
  await streamWords(res, planText, abortedRef);

  // Create plan approval
  const planPayload = {
    type: "approval_required",
    action: "approve_plan",
    plan: "Full pipeline re-engagement: market data pull + personalised check-in messages to all 15 leads",
    context: "CEO proposes warming up the entire pipeline based on geopolitical market shift. Nothing starts until approved.",
  };

  const [planApproval] = await db.insert(approvals).values({
    companyId, type: "approve_plan", requestedByAgentId: ceo.id, status: "pending", payload: planPayload,
  }).returning();

  const savedPlanText = `${planText}\n\n\`\`\`json\n${JSON.stringify({ ...planPayload, approval_id: planApproval?.id }, null, 2)}\n\`\`\``;
  await insertComment(db, companyId, ceoChatIssue.id, savedPlanText, ceo.id, null);

  if (planApproval) {
    sseSend(res, { type: "approvals_created", approvalIds: [planApproval.id] }, abortedRef);
  }
  sseSend(res, { type: "done", model: "demo", deepThink: false }, abortedRef);
  res.end();

  publishLiveEvent({ companyId, type: "activity.logged", payload: { action: "ceo.plan_proposed" } });

  // NOTHING ELSE HAPPENS. Agents are silent. Comms stays empty.
  // Phase 2 is triggered by runDemoAfterPlanApproval() when the user approves.
}

// ---------------------------------------------------------------------------
// PHASE 2: Agents work (called from approvals.ts AFTER plan is approved)
// ---------------------------------------------------------------------------

export async function runDemoAfterPlanApproval(db: Db, companyId: string) {
  const agentMap = await resolveAgents(db, companyId);
  const ceo = agentMap.get("ceo");
  const layla = agentMap.get("sales");
  const omar = agentMap.get("marketing");

  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE);

  if (!ceo || !layla || !omar || !ceoChatIssue) return;

  try {
    // ── Agent conversation (triggered by plan approval) ──────────

    await sleep(2000);
    await postAgentMessage(db, companyId, ceo, omar, "action", "market_brief",
      `@${omar.name} we've got the green light from the owner. He wants to re-engage the whole pipeline — everyone who's gone quiet. Can you pull together a quick market snapshot for me? I need to know what's actually happening with demand since the conflict started, what DLD is showing, and whether international buyers are moving. ${layla.name} needs something solid to reference when she reaches out.`);

    await sleep(9000);
    await postAgentMessage(db, companyId, omar, ceo, "info", "market_data",
      `@${ceo.name} done. So here's the picture — DLD transactions are up 8% month-on-month, which is significant given what's happening globally. International buyer enquiries have jumped 23% since the tensions escalated. It's the same pattern we saw in 2022 — when things get unstable elsewhere, money moves to Dubai. We're seeing it especially from CIS countries and parts of Europe. I'll share the numbers directly with @${layla.name} so she can weave them into the outreach.`);

    await sleep(7000);
    await postAgentMessage(db, companyId, omar, layla, "action", "data_handover",
      `@${layla.name} sharing the market data with you. The key numbers: DLD transactions up 8% month-on-month, international enquiries up 23%, and CIS buyer registrations have basically doubled since March. Dubai's being positioned as a safe haven again. Feel free to use any of this in the messages — it gives the outreach more weight than just "checking in."`);

    await sleep(8000);
    await postAgentMessage(db, companyId, ceo, layla, "action", "delegation",
      `@${layla.name} you should have ${omar.name}'s data now. Here's what I need you to do — go through every single lead in the pipeline. Each one gets a personal message. The tone is warm, not salesy. Something like "with everything going on in the world, the Dubai market has shifted, and I wanted to check in to see if you're still thinking about it — whether that's buying or selling." Match the language to each lead. Arabic leads get formal Arabic. Russian leads get the investor angle with the numbers. English leads get a friendly casual check-in. Start with the highest scores and work your way down.`);

    await sleep(10000);
    await postAgentMessage(db, companyId, layla, ceo, "info", "progress",
      `@${ceo.name} going through the pipeline now. I've got 15 leads total. I'm starting with the top three — Ahmed Al Hashimi is score 8, he was looking at JVC before he went quiet. Dmitri Volkov is score 9, he was actually mid-negotiation on a Marina Gate unit before things stalled. And Sarah Williams is score 5, she was interested in Business Bay but we haven't heard from her in a while. I'll have the first batch of messages drafted in a few minutes.`);

    await sleep(12000);
    await postAgentMessage(db, companyId, layla, omar, "info", "question",
      `@${omar.name} quick question before I draft Dmitri's message — should I lead with the safe haven narrative or go straight to the investment numbers? He's definitely an investor type, but I don't want to come across as tone-deaf given what's happening. What do you think works better right now?`);

    await sleep(9000);
    await postAgentMessage(db, companyId, omar, layla, "info", "advice",
      `@${layla.name} good question. For Dmitri, I'd go with the numbers but frame them through the stability lens. Something like "demand is up 23% because investors are looking for safe places to put their money, and Dubai is at the top of that list." That way you're giving him the data he wants but it doesn't feel like you're capitalising on a crisis. For the other Russian leads who are more lifestyle buyers, keep it softer — just the stability angle without the percentages.`);

    await sleep(11000);
    await postAgentMessage(db, companyId, layla, ceo, "info", "drafts_complete",
      `@${ceo.name} first three are done. Ahmed's getting a formal Arabic message — I've gone with the "I hope you and your family are well" opening and then eased into the market shift, asking if he's still considering Dubai. Dmitri's getting a Russian message with the investment angle — I've referenced the 23% demand increase and positioned Dubai as a safe haven for capital. Sarah's getting a casual English check-in, very low-pressure, just seeing if she's still interested. All three are ready for the owner to look at whenever you want to send them up.`);

    await sleep(6000);
    await postAgentMessage(db, companyId, ceo, layla, "info", "acknowledgement",
      `That's exactly what I was looking for @${layla.name}. I'm going to send these up to the owner now for approval. Keep working through the rest of the pipeline — batch them in groups of three or four so it's easy for him to review. @${omar.name} thanks for turning that data around quickly, it made a real difference to the outreach.`);

    // ── PHASE 3: CEO surfaces approval cards in CEO Chat ──────────

    await sleep(4000);

    const approval1 = {
      type: "approval_required", action: "send_whatsapp",
      to: "Ahmed Al Hashimi", phone: "+971501234567",
      message: "Dear Mr. Al Hashimi, I hope you and your family are well. With everything that's been happening in the region recently, the Dubai property market has seen quite a shift — there's been a noticeable increase in demand from international buyers who are looking for somewhere stable to invest. I wanted to reach out and see if you're still thinking about Dubai, whether that's buying or looking at selling. I'd be happy to put together a quick update on where things stand if that would be useful for you.",
      lead_score: 8,
      context: "High-value lead, previously interested in JVC. Formal Arabic greeting. Warm re-engagement, not a sales pitch.",
    };
    const approval2 = {
      type: "approval_required", action: "send_whatsapp",
      to: "Dmitri Volkov", phone: "+971555678901",
      message: "Дмитрий, добрый день. Хотел связаться с вами в связи с тем, как изменилась ситуация на рынке Дубая за последнее время. Спрос со стороны международных инвесторов вырос на 23% — многие рассматривают Дубай как безопасное направление для вложений в текущих условиях. Хотел узнать, актуален ли для вас по-прежнему вопрос недвижимости в Дубае — покупка или, возможно, продажа? Буду рад подготовить для вас актуальную аналитику.",
      lead_score: 9,
      context: "Russian investor, score 9, was mid-negotiation. Investment angle with market data. Positioned Dubai as safe haven.",
    };
    const approval3 = {
      type: "approval_required", action: "send_whatsapp",
      to: "Sarah Williams", phone: "+971556789012",
      message: "Hi Sarah, hope you're doing well. It's been a little while since we last chatted about your plans in Dubai and I just wanted to check in. Quite a lot has changed in the market recently — there's been a real increase in international interest, especially from people looking for somewhere stable. I was wondering if you're still thinking about Dubai at all? No pressure either way — just thought it was worth reaching out given how much things have moved. Happy to have a quick chat if you'd like to catch up on where things stand.",
      lead_score: 5,
      context: "British lead, casual English. Was looking at Business Bay. Friendly low-pressure check-in.",
    };

    const createdIds: string[] = [];
    const blocks = [approval1, approval2, approval3];
    const enrichedBlocks: string[] = [];

    for (const block of blocks) {
      const [a] = await db.insert(approvals).values({
        companyId, type: String(block.action), requestedByAgentId: layla.id,
        status: "pending", payload: block,
      }).returning();
      if (a) {
        createdIds.push(a.id);
        enrichedBlocks.push("```json\n" + JSON.stringify({ ...block, approval_id: a.id }, null, 2) + "\n```");
      }
    }

    const ceoFollowUp = `Layla's finished the first batch. Here are three messages ready for you to review — one for Ahmed, one for Dmitri, and one for Sarah. Each one's been tailored to their language and where they were in the pipeline. She's working through the remaining 12 leads now and will send them up in batches.\n\n${enrichedBlocks.join("\n\n")}`;
    await insertComment(db, companyId, ceoChatIssue.id, ceoFollowUp, ceo.id, null);

    publishLiveEvent({ companyId, type: "activity.logged", payload: { action: "ceo.approvals_ready", count: createdIds.length } });
    logger.info({ companyId, approvalCount: createdIds.length }, "demo-orchestrator: WhatsApp approval cards surfaced after agent work");

  } catch (err) {
    logger.error({ err }, "demo-orchestrator: background sequence failed");
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export function demoOrchestratorRoutes(db: Db) {
  const router = Router();
  router.post("/companies/:companyId/demo-chat", async (req, res) => {
    const { companyId } = req.params;
    const { message } = req.body as { message?: string };
    if (!message) { res.status(400).json({ error: "message required" }); return; }
    await handleDemoChat(db, companyId, message.trim(), req, res);
  });
  return router;
}
