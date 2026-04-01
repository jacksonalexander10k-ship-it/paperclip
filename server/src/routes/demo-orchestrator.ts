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
  try {
    await db.insert(aygentAgentMessages).values({
      companyId, fromAgentId: from.id, toAgentId: to.id,
      priority, messageType, summary, data: null,
      readByAgents: [], actedOn: false,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    publishLiveEvent({ companyId, type: "activity.logged", payload: { fromAgent: from.name, toAgent: to.name, messageType, summary } });
    logger.info({ from: from.name, to: to.name, messageType }, "demo: agent message posted");
  } catch (err) {
    logger.error({ err, from: from.name, to: to.name }, "demo: FAILED to post agent message");
  }
}

// ---------------------------------------------------------------------------
// PHASE 1: CEO streams the plan (called from ceo-chat.ts)
// ---------------------------------------------------------------------------

export async function handleDemoChat(
  db: Db,
  companyId: string,
  message: string,
  clientIssueId: string | null,
  req: import("express").Request,
  res: import("express").Response,
) {
  const agentMap = await resolveAgents(db, companyId);
  const ceo = agentMap.get("ceo");
  const layla = agentMap.get("sales");
  const omar = agentMap.get("marketing");

  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = clientIssueId
    ? allIssues.find((i) => i.id === clientIssueId) ?? null
    : allIssues.find((i) => i.title.startsWith(CEO_CHAT_TITLE)) ?? null;

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
    ceoChatIssueId: ceoChatIssue.id,
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

export async function runDemoAfterPlanApproval(db: Db, companyId: string, ceoChatIssueId?: string) {
  logger.info({ companyId, ceoChatIssueId }, "demo-orchestrator: runDemoAfterPlanApproval STARTED");

  const agentMap = await resolveAgents(db, companyId);
  const ceo = agentMap.get("ceo");
  const layla = agentMap.get("sales");
  const omar = agentMap.get("marketing");

  logger.info({ ceo: ceo?.name, layla: layla?.name, omar: omar?.name }, "demo-orchestrator: agents resolved");

  const allIssues = await db.select().from(issues).where(eq(issues.companyId, companyId));
  const ceoChatIssue = ceoChatIssueId
    ? allIssues.find((i) => i.id === ceoChatIssueId) ?? null
    : allIssues.find((i) => i.title.startsWith(CEO_CHAT_TITLE)) ?? null;

  logger.info({ ceoChatIssue: ceoChatIssue?.id, ceoChatIssueTitle: ceoChatIssue?.title }, "demo-orchestrator: issue resolved");

  if (!ceo || !layla || !omar || !ceoChatIssue) {
    logger.error({ ceo: !!ceo, layla: !!layla, omar: !!omar, ceoChatIssue: !!ceoChatIssue }, "demo-orchestrator: MISSING REQUIRED DATA — aborting");
    return;
  }

  try {
    // ── Agent conversation (triggered by plan approval) ──────────

    // CEO kicks things off
    await sleep(2000);
    await postAgentMessage(db, companyId, ceo, omar, "action", "market_brief",
      `@${omar.name} we've got the green light. The owner wants to re-engage the entire pipeline — 200 leads who've gone quiet. Before @${layla.name} starts the outreach, I need you to pull together a market snapshot. What's actually happening with demand since the conflict escalated? What's DLD showing? Are international buyers moving? I need real data, not guesswork.`);

    // Omar acknowledges
    await sleep(6000);
    await postAgentMessage(db, companyId, omar, ceo, "info", "acknowledgement",
      `@${ceo.name} on it. Pulling DLD transaction data, international buyer registration figures, and cross-referencing with the enquiry volume we've been tracking. Give me a couple of minutes.`);

    // ── RESEARCH DELAY — Omar is researching (15-20s of silence) ──
    // Activity tab will show "Omar is searching DLD data..." during this time
    await logActivity(db, { companyId, actorType: "agent", actorId: omar.id, action: "agent.researching", entityType: "market_data", entityId: omar.id, details: { summary: "Searching DLD transaction database for recent activity...", agent: omar.name } });
    await sleep(8000);
    await logActivity(db, { companyId, actorType: "agent", actorId: omar.id, action: "agent.researching", entityType: "market_data", entityId: omar.id, details: { summary: "Analysing international buyer registration trends...", agent: omar.name } });
    await sleep(7000);
    await logActivity(db, { companyId, actorType: "agent", actorId: omar.id, action: "agent.researching", entityType: "market_data", entityId: omar.id, details: { summary: "Compiling market snapshot report...", agent: omar.name } });
    await sleep(5000);

    // Omar comes back with findings
    await postAgentMessage(db, companyId, omar, ceo, "info", "market_data",
      `@${ceo.name} done. Here's the picture — DLD transactions are up 8% month-on-month, which is significant given what's happening globally. International buyer enquiries have jumped 23% since the tensions escalated. Same pattern as 2022 — instability elsewhere pushes capital to Dubai. CIS countries and European buyers leading the charge. I'll send the full data pack to @${layla.name} now.`);

    await sleep(5000);
    await postAgentMessage(db, companyId, omar, layla, "action", "data_handover",
      `@${layla.name} here's the market data for the outreach. Key numbers: DLD transactions +8% MoM, international enquiries +23%, CIS registrations doubled since March. Dubai ranked top safe haven in the region. Use whatever you need — it'll give the messages more weight than just "checking in."`);

    // CEO delegates to Layla
    await sleep(7000);
    await postAgentMessage(db, companyId, ceo, layla, "action", "delegation",
      `@${layla.name} you've got ${omar.name}'s data. Here's the brief — we're sending a batch message to all 200 leads in the pipeline. One template per language, personalised with their name. Tone is warm and advisory, not salesy. The angle: "the market has shifted because of what's happening globally, we wanted to check in, are you still interested in Dubai — buying or selling?" Three templates needed: English, Arabic, and Russian. Each lead gets the template in their language with their name swapped in.`);

    await sleep(10000);
    await postAgentMessage(db, companyId, layla, ceo, "info", "progress",
      `@${ceo.name} understood. I've segmented the 200 leads by language — 120 English, 45 Arabic, 35 Russian. Drafting the three templates now. I'll reference ${omar.name}'s data in each one to make it feel informed, not generic.`);

    // Layla drafting (activity shows her working)
    await logActivity(db, { companyId, actorType: "agent", actorId: layla.id, action: "agent.drafting", entityType: "whatsapp_template", entityId: layla.id, details: { summary: "Drafting English template for 120 leads...", agent: layla.name } });
    await sleep(8000);
    await logActivity(db, { companyId, actorType: "agent", actorId: layla.id, action: "agent.drafting", entityType: "whatsapp_template", entityId: layla.id, details: { summary: "Drafting Arabic template for 45 leads...", agent: layla.name } });
    await sleep(6000);
    await logActivity(db, { companyId, actorType: "agent", actorId: layla.id, action: "agent.drafting", entityType: "whatsapp_template", entityId: layla.id, details: { summary: "Drafting Russian template for 35 leads...", agent: layla.name } });
    await sleep(7000);

    await postAgentMessage(db, companyId, layla, ceo, "info", "drafts_complete",
      `@${ceo.name} all three templates are ready. English template covers 120 leads, Arabic covers 45, Russian covers 35. Each one references the market shift and asks if they're still interested — buying or selling. I've kept the tone warm and genuine across all three. Ready for the owner to review and approve the batch send.`);

    await sleep(5000);
    await postAgentMessage(db, companyId, ceo, layla, "info", "acknowledgement",
      `Perfect @${layla.name}. Sending the templates up for approval now. Once he approves, we'll fire them out to all 200. @${omar.name} thanks for the fast research — made all the difference.`);

    // ── PHASE 3: CEO surfaces batch approval card in CEO Chat ──────────

    await sleep(3000);

    const batchApproval = {
      type: "approval_required",
      action: "bulk_whatsapp",
      total_leads: 200,
      languages: { english: 120, arabic: 45, russian: 35 },
      templates: {
        english: "Hi {name}, hope you're doing well. It's been a while since we last spoke and I wanted to check in. With everything happening globally, the Dubai property market has shifted quite a bit — international buyer enquiries are up 23% and we're seeing real demand from people looking for stability. I was wondering if you're still thinking about Dubai, whether that's buying or selling? No pressure — just thought it was worth reaching out. Happy to chat if you'd like an update on where things stand.",
        arabic: "عزيزي {name}، أتمنى أن تكون بخير أنت وعائلتك. مع التطورات الأخيرة في المنطقة، شهد سوق العقارات في دبي تحولات ملحوظة — زيادة في الطلب من المشترين الدوليين الباحثين عن الاستقرار. أردت أن أتواصل معك لأرى إن كنت لا تزال مهتماً بسوق دبي، سواء للشراء أو البيع. يسعدني مشاركة آخر المستجدات إن كان ذلك مفيداً لك.",
        russian: "Здравствуйте, {name}. Хотел связаться с вами в связи с тем, как изменилась ситуация на рынке Дубая. Спрос со стороны международных инвесторов вырос на 23% — многие рассматривают Дубай как безопасное направление для вложений. Хотел узнать, актуален ли для вас вопрос недвижимости в Дубае — покупка или продажа? Буду рад подготовить актуальную аналитику.",
      },
      context: "Full pipeline re-engagement. 200 leads segmented by language. Each lead receives the template in their language with {name} replaced. Market data referenced: DLD +8% MoM, international enquiries +23%.",
    };

    const [batchApprovalRecord] = await db.insert(approvals).values({
      companyId, type: "bulk_whatsapp", requestedByAgentId: layla.id,
      status: "pending", payload: batchApproval,
    }).returning();

    const enrichedPayload = { ...batchApproval, approval_id: batchApprovalRecord?.id };
    const ceoFollowUp = `Layla's finished drafting the templates. Here's the batch send ready for your approval — 200 leads across three languages.\n\n\`\`\`json\n${JSON.stringify(enrichedPayload, null, 2)}\n\`\`\``;
    await insertComment(db, companyId, ceoChatIssue.id, ceoFollowUp, ceo.id, null);

    publishLiveEvent({ companyId, type: "activity.logged", payload: { action: "ceo.approvals_ready", count: 1 } });
    logger.info({ companyId }, "demo-orchestrator: batch WhatsApp approval surfaced after agent work");

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
    const { message, issueId } = req.body as { message?: string; issueId?: string };
    if (!message) { res.status(400).json({ error: "message required" }); return; }
    await handleDemoChat(db, companyId, message.trim(), issueId ?? null, req, res);
  });
  return router;
}
