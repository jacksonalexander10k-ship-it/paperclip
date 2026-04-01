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

async function streamWords(
  res: import("express").Response,
  text: string,
  abortedRef: { current: boolean },
) {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (abortedRef.current) break;
    res.write(`data: ${JSON.stringify({ type: "text", text: word })}\n\n`);
    const isPause = /[.\n]$/.test(word.trim());
    const delay = isPause ? 120 : (40 + Math.random() * 30);
    await sleep(delay);
  }
}

function send(res: import("express").Response, data: Record<string, unknown>, abortedRef: { current: boolean }) {
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

async function insertAgentMessage(db: Db, companyId: string, from: DemoAgent, to: DemoAgent, priority: "info" | "action" | "urgent", messageType: string, summary: string) {
  await db.insert(aygentAgentMessages).values({
    companyId, fromAgentId: from.id, toAgentId: to.id,
    priority, messageType, summary, data: null,
    readByAgents: [], actedOn: false,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
  publishLiveEvent({ companyId, type: "activity.logged", payload: { fromAgent: from.name, toAgent: to.name, messageType, summary } });
}

// ---------------------------------------------------------------------------
// Main handler — realistic timeline
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

  const K = ceo.name;
  const L = layla.name;
  const O = omar.name;

  // Save user message
  await insertComment(db, companyId, ceoChatIssue.id, message, null, "demo-owner");

  // ── PHASE 1: CEO streams the plan (no approval cards) ──────────────

  const planText = `Good call. With everything happening geopolitically, now's the right time to re-engage the full pipeline.

Here's my plan: I'll get ${O} to pull together a quick market snapshot — how the conflict is affecting Dubai demand, transaction volumes, and foreign buyer sentiment. Once we have the data, ${L} will go through every lead in the pipeline and draft personalised check-in messages. Not a hard sell — just a warm "the market's changed, wanted to see if you're still interested in Dubai, whether that's buying or selling." Each one tailored to the lead's language and where they were in the pipeline.

${L} will start with the highest-scoring leads and work her way down. Should have the first batch ready within minutes.

Want me to go ahead with this?`;

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
  const [planApproval] = await db.insert(approvals).values({
    companyId,
    type: "approve_plan",
    requestedByAgentId: ceo.id,
    status: "pending",
    payload: {
      type: "approval_required",
      action: "approve_plan",
      plan: "Market data pull + full pipeline re-engagement campaign",
      context: "CEO proposes warming up all leads based on geopolitical market shift",
    },
  }).returning();

  // Save plan text with approval block
  const planPayloadWithId = {
    type: "approval_required",
    action: "approve_plan",
    approval_id: planApproval?.id,
    plan: "Market data pull + full pipeline re-engagement campaign",
    context: "CEO proposes warming up all leads based on geopolitical market shift",
  };
  const savedPlanText = `${planText}\n\n\`\`\`json\n${JSON.stringify(planPayloadWithId, null, 2)}\n\`\`\``;
  await insertComment(db, companyId, ceoChatIssue.id, savedPlanText, ceo.id, null);

  if (planApproval) {
    send(res, { type: "approvals_created", approvalIds: [planApproval.id] }, abortedRef);
  }
  send(res, { type: "done", model: "demo", deepThink: false }, abortedRef);
  res.end();

  publishLiveEvent({ companyId, type: "activity.logged", payload: { action: "ceo.plan_proposed" } });

  // ── PHASE 2: Background — agents work (regardless of plan approval for demo) ──

  setTimeout(async () => {
    try {
      // CEO kicks off in comms
      await insertAgentMessage(db, companyId, ceo, omar, "action", "market_brief",
        `@${O} the owner wants to warm up the entire pipeline. Can you pull together a market snapshot? How the conflict's affecting Dubai demand, transaction volumes, foreign buyer sentiment. Need it fast so @${L} can use it in her outreach`);

      await sleep(8000);
      await insertAgentMessage(db, companyId, omar, ceo, "info", "acknowledgement",
        `@${K} on it, pulling DLD data now`);

      await sleep(9000);
      await insertAgentMessage(db, companyId, omar, layla, "action", "data_share",
        `@${L} here's what I've got — DLD transactions up 8% month-on-month, international buyer enquiries spiked 23% since the tensions started. Dubai's being seen as a safe haven, same pattern as 2022. CIS capital inflows especially. Use whatever you need for the outreach`);

      await sleep(6000);
      await insertAgentMessage(db, companyId, ceo, layla, "action", "pipeline_reengagement",
        `@${L} you've got the data from @${O}. Go through every lead — warm check-in, not a hard sell. "Market's shifted, are you still interested in Dubai, buying or selling?" Personalise by language. Start with score 7+ and work down`);

      await sleep(7000);
      await insertAgentMessage(db, companyId, layla, ceo, "info", "acknowledgement",
        `@${K} on it. 15 leads in the pipeline. Starting with Ahmed (score 8, JVC interest), Dmitri (score 9, was mid-negotiation), and Sarah Williams (score 5, was looking at Business Bay). Top two could be hot again, Sarah's a long shot but worth the check-in`);

      await sleep(9000);
      await insertAgentMessage(db, companyId, layla, omar, "info", "question",
        `@${O} quick one — for the Russian leads, should I lead with the safe haven angle or the ROI numbers? Dmitri's an investor so I'm thinking numbers, but a couple of the others are lifestyle buyers`);

      await sleep(8000);
      await insertAgentMessage(db, companyId, omar, layla, "info", "advice",
        `@${L} for Dmitri definitely the numbers — 23% demand spike means capital appreciation potential. For lifestyle Russians go softer, more "Dubai is stable, life goes on" angle. They're not thinking ROI, they're thinking safety`);

      await sleep(11000);
      await insertAgentMessage(db, companyId, layla, ceo, "info", "drafts_ready",
        `@${K} first three messages drafted. Ahmed gets formal Arabic — "hope you and your family are well" tone. Dmitri gets Russian with investor numbers from @${O}. Sarah gets casual English check-in. Ready for the owner to review whenever`);

      await sleep(5000);
      await insertAgentMessage(db, companyId, ceo, layla, "info", "acknowledgement",
        `Nice work @${L}. Sending these to the owner now for approval. @${O} thanks for the fast data 🎯`);

      // ── PHASE 3: CEO surfaces approval cards in chat ──────────────

      await sleep(3000);

      const approval1 = {
        type: "approval_required", action: "send_whatsapp",
        to: "Ahmed Al Hashimi", phone: "+971501234567",
        message: "Dear Mr. Al Hashimi, I hope you and your family are well. With recent developments in the region, the Dubai property market has seen some notable shifts — increased demand from international buyers looking for stability, and some interesting movement on pricing. I wanted to check in and see if you're still considering the Dubai market, whether buying or selling. Happy to share a quick update if it's helpful.",
        lead_score: 8, context: "High-value lead, previously interested in JVC. Formal Arabic greeting. Warm re-engagement.",
      };
      const approval2 = {
        type: "approval_required", action: "send_whatsapp",
        to: "Dmitri Volkov", phone: "+971555678901",
        message: "Дмитрий, добрый день. В связи с последними событиями на Ближнем Востоке рынок Дубая заметно изменился — увеличился спрос со стороны международных инвесторов, ищущих стабильность. Хотел узнать, актуален ли для вас вопрос покупки или продажи недвижимости в Дубае? Могу подготовить краткий обзор текущей ситуации.",
        lead_score: 9, context: "Russian investor, score 9, was in negotiation. Geopolitical angle with numbers.",
      };
      const approval3 = {
        type: "approval_required", action: "send_whatsapp",
        to: "Sarah Williams", phone: "+971556789012",
        message: "Hi Sarah, hope you're doing well. I know it's been a little while since we last spoke about your plans in Dubai. With everything happening globally, the market here has shifted quite a bit — we're seeing a real uptick in international interest, especially from buyers looking for stability. Just wanted to check in and see if you're still thinking about the Dubai market? Happy to have a quick chat if it'd be useful.",
        lead_score: 5, context: "British lead, casual English. Was looking at Business Bay. Lower score but worth re-engaging.",
      };

      const createdIds: string[] = [];
      const blocks = [approval1, approval2, approval3];
      const enrichedBlocks: string[] = [];

      for (const block of blocks) {
        const [a] = await db.insert(approvals).values({
          companyId,
          type: String(block.action),
          requestedByAgentId: layla.id,
          status: "pending",
          payload: block,
        }).returning();
        if (a) {
          createdIds.push(a.id);
          enrichedBlocks.push("```json\n" + JSON.stringify({ ...block, approval_id: a.id }, null, 2) + "\n```");
        }
      }

      const ceoFollowUp = `${L} has finished drafting the first batch. Here are three messages ready for your approval — Ahmed, Dmitri, and Sarah. She's working through the remaining 12 leads now.\n\n${enrichedBlocks.join("\n\n")}`;
      await insertComment(db, companyId, ceoChatIssue.id, ceoFollowUp, ceo.id, null);

      publishLiveEvent({ companyId, type: "activity.logged", payload: { action: "ceo.approvals_ready", count: createdIds.length } });

      logger.info({ companyId, approvalCount: createdIds.length }, "demo-orchestrator: approval cards surfaced");

    } catch (err) {
      logger.error({ err }, "demo-orchestrator: background sequence failed");
    }
  }, 5000); // Start 5s after the plan streams
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
