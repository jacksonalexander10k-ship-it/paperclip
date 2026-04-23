/**
 * ElevenLabs Integration Routes
 *
 * Three endpoints:
 * 1. POST /elevenlabs/chat/completions  — Custom LLM webhook (OpenAI-compatible)
 *    ElevenLabs sends conversation messages here; we route through our model router
 *    and stream back SSE responses.
 *
 * 2. POST /elevenlabs/tools/:toolName   — Server tool endpoints
 *    ElevenLabs calls these when the agent invokes a tool mid-conversation.
 *    Tools: search_leads, create_lead, get_lead, search_properties, create_approval
 *
 * 3. POST /webhook/elevenlabs           — Post-call webhook
 *    ElevenLabs sends conversation transcripts after each conversation ends.
 *    We create Paperclip issues + lead records from transcripts.
 */

import { Router } from "express";
import crypto from "node:crypto";
import type { Db } from "@paperclipai/db";
import { aygentLeads, issues, agents, aygentWhatsappMessages } from "@paperclipai/db";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { routedGenerate, routedStream } from "../services/model-router.js";
import { withIdentity } from "../services/agent-identity.js";
import { leadService } from "../services/leads.js";
import { approvalService } from "../services/approvals.js";
import { logActivity } from "../services/activity-log.js";
import { issueService } from "../services/issues.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  // ElevenLabs custom fields
  company_id?: string;
  agent_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseChunk(id: string, content: string, finishReason: string | null = null): string {
  const chunk = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "aygency-world",
    choices: [{
      index: 0,
      delta: content ? { content } : {},
      finish_reason: finishReason,
    }],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Resolve company ID from the request.
 * ElevenLabs can send it as a custom body param, or we fall back to the first company.
 */
async function resolveCompanyId(db: Db, body: ChatCompletionRequest): Promise<string | null> {
  if (body.company_id) return body.company_id;

  // In single-tenant / dev mode, use the first company
  const { companies } = await import("@paperclipai/db");
  const [first] = await db.select({ id: companies.id }).from(companies).limit(1);
  return first?.id ?? null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function elevenlabsRoutes(db: Db) {
  const router = Router();
  const leads = leadService(db);
  const approvals = approvalService(db);
  const issueSvc = issueService(db);

  // =========================================================================
  // 1. Custom LLM Webhook — OpenAI Chat Completions format
  // =========================================================================

  router.post("/elevenlabs/chat/completions", async (req, res) => {
    try {
      const body = req.body as ChatCompletionRequest;
      const messages = body.messages ?? [];

      // Extract conversation context
      const systemMessage = messages.find((m) => m.role === "system")?.content ?? "";
      const userMessages = messages.filter((m) => m.role === "user");
      const lastUserMessage = userMessages[userMessages.length - 1]?.content ?? "";

      // Classify: if conversation is short (< 3 user messages), it's qualification
      // If longer, the agent is doing real work
      const taskType = userMessages.length <= 2 ? "heartbeat_scan" : "customer_facing";

      // Build the full prompt from conversation history
      const conversationHistory = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => `${m.role === "user" ? "Lead" : "Agent"}: ${m.content}`)
        .join("\n");

      const fullPrompt = conversationHistory
        ? `Conversation so far:\n${conversationHistory}\n\nRespond to the lead's latest message.`
        : lastUserMessage;

      // Stream response via SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const chatId = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;

      const result = await routedStream({
        taskType,
        systemPrompt: withIdentity(systemMessage),
        messages: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content ?? "",
          })),
        maxTokens: body.max_tokens ?? 500,
        onText: (text) => {
          res.write(sseChunk(chatId, text));
        },
      });

      // Final chunk with finish_reason
      res.write(sseChunk(chatId, "", "stop"));
      res.write("data: [DONE]\n\n");
      res.end();

      logger.info(
        {
          taskType,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
        "elevenlabs: LLM request served",
      );
    } catch (err) {
      logger.error({ err }, "elevenlabs: LLM webhook error");
      // If headers not sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({ error: "LLM processing failed" });
      } else {
        res.end();
      }
    }
  });

  // =========================================================================
  // 2. Server Tools — called by ElevenLabs agent mid-conversation
  // =========================================================================

  /**
   * Search leads by name, phone, or area interest.
   */
  router.post("/elevenlabs/tools/search_leads", async (req, res) => {
    try {
      const { query, company_id } = req.body as { query?: string; company_id?: string };
      const companyId = company_id ?? await resolveCompanyId(db, req.body);
      if (!companyId) return res.json({ leads: [], message: "No company found" });

      const results = await leads.list(companyId, { search: query ?? "" });
      const top = results.slice(0, 10).map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        stage: l.stage,
        score: l.score,
        budget: l.budget,
        preferredAreas: l.preferredAreas,
        propertyType: l.propertyType,
        lastContactAt: l.lastContactAt,
      }));

      res.json({ leads: top, count: results.length });
    } catch (err) {
      logger.error({ err }, "elevenlabs tool: search_leads failed");
      res.json({ error: "Search failed", leads: [] });
    }
  });

  /**
   * Create a new lead from conversation data.
   */
  router.post("/elevenlabs/tools/create_lead", async (req, res) => {
    try {
      const {
        name, phone, email, source, budget_min, budget_max,
        area_preference, property_type, timeline, language, notes, company_id,
      } = req.body as Record<string, string | undefined>;

      const companyId = company_id ?? await resolveCompanyId(db, req.body);
      if (!companyId) return res.json({ error: "No company found" });

      const budget = (budget_min || budget_max)
        ? { min: budget_min ? Number(budget_min) : undefined, max: budget_max ? Number(budget_max) : undefined }
        : null;

      const lead = await leads.create(companyId, {
        name: name ?? "Unknown",
        phone: phone ?? null,
        email: email ?? null,
        source: source ?? "whatsapp_elevenlabs",
        stage: "lead",
        score: 5,
        budget: budget as Record<string, unknown> | null,
        preferredAreas: area_preference ? [area_preference] : [],
        propertyType: property_type ?? null,
        timeline: timeline ?? null,
        language: language ?? "en",
        notes: notes ?? null,
      });

      logger.info({ leadId: lead.id, name }, "elevenlabs tool: lead created");
      res.json({ success: true, lead_id: lead.id, message: `Lead "${name}" created successfully.` });
    } catch (err) {
      logger.error({ err }, "elevenlabs tool: create_lead failed");
      res.json({ error: "Failed to create lead" });
    }
  });

  /**
   * Get a specific lead by ID.
   */
  router.post("/elevenlabs/tools/get_lead", async (req, res) => {
    try {
      const { lead_id, company_id } = req.body as { lead_id?: string; company_id?: string };
      const companyId = company_id ?? await resolveCompanyId(db, req.body);
      if (!companyId || !lead_id) return res.json({ error: "Missing lead_id or company" });

      const lead = await leads.getById(companyId, lead_id);
      if (!lead) return res.json({ error: "Lead not found" });

      res.json({ lead });
    } catch (err) {
      logger.error({ err }, "elevenlabs tool: get_lead failed");
      res.json({ error: "Failed to get lead" });
    }
  });

  /**
   * Create an approval card (e.g., for scheduling a viewing, sending a document).
   */
  router.post("/elevenlabs/tools/create_approval", async (req, res) => {
    try {
      const { type, payload, company_id } = req.body as {
        type?: string;
        payload?: Record<string, unknown>;
        company_id?: string;
      };
      const companyId = company_id ?? await resolveCompanyId(db, req.body);
      if (!companyId || !type || !payload) {
        return res.json({ error: "Missing type, payload, or company" });
      }

      // Find the sales agent to attribute the approval to
      const [salesAgent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.role, "sales")))
        .limit(1);

      const approval = await approvals.create(companyId, {
        type,
        payload,
        requestedByAgentId: salesAgent?.id ?? null,
      });

      logger.info({ approvalId: approval.id, type }, "elevenlabs tool: approval created");
      res.json({
        success: true,
        approval_id: approval.id,
        message: `Approval card created. The agency owner will review and approve this ${type} action.`,
      });
    } catch (err) {
      logger.error({ err }, "elevenlabs tool: create_approval failed");
      res.json({ error: "Failed to create approval" });
    }
  });

  /**
   * Log a conversation summary as a note on a lead.
   */
  router.post("/elevenlabs/tools/log_conversation", async (req, res) => {
    try {
      const { lead_id, summary, outcome, company_id } = req.body as Record<string, string | undefined>;
      const companyId = company_id ?? await resolveCompanyId(db, req.body);
      if (!companyId) return res.json({ error: "No company found" });

      if (lead_id) {
        // Update lead notes
        await db
          .update(aygentLeads)
          .set({
            notes: summary ?? "",
            lastContactAt: new Date(),
          })
          .where(and(eq(aygentLeads.id, lead_id), eq(aygentLeads.companyId, companyId)));
      }

      // Log activity
      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: "elevenlabs-agent",
        action: "lead.conversation_logged",
        entityType: "lead",
        entityId: lead_id ?? "unknown",
        details: { summary, outcome },
      });

      res.json({ success: true, message: "Conversation logged." });
    } catch (err) {
      logger.error({ err }, "elevenlabs tool: log_conversation failed");
      res.json({ error: "Failed to log conversation" });
    }
  });

  // =========================================================================
  // 3. Post-Call Webhook — conversation transcript after each conversation
  // =========================================================================

  router.post("/webhook/elevenlabs", async (req, res) => {
    // Ack immediately
    res.status(200).send("OK");

    try {
      const event = req.body;
      const type = event?.type;

      if (type !== "post_call_transcription") {
        logger.debug({ type }, "elevenlabs webhook: ignoring non-transcript event");
        return;
      }

      const data = event.data;
      const agentId = data?.agent_id;
      const conversationId = data?.conversation_id;
      const transcript = data?.transcript as Array<{ role: string; message: string }> | undefined;
      const analysis = data?.analysis as { summary?: string } | undefined;

      if (!transcript || transcript.length === 0) {
        logger.debug({ conversationId }, "elevenlabs webhook: empty transcript");
        return;
      }

      // Extract caller info from dynamic variables
      const clientData = data?.conversation_initiation_client_data ?? {};
      const callerId = clientData?.dynamic_variables?.system__caller_id;

      // Build transcript text
      const transcriptText = transcript
        .map((t) => `${t.role === "agent" ? "Agent" : "Lead"}: ${t.message}`)
        .join("\n");

      const summary = analysis?.summary ?? `WhatsApp conversation with ${callerId ?? "unknown lead"}`;

      // Resolve company from the ElevenLabs agent config or first company
      const companyId = await resolveCompanyId(db, {} as ChatCompletionRequest);
      if (!companyId) {
        logger.warn({ conversationId }, "elevenlabs webhook: no company found");
        return;
      }

      // Create a Paperclip issue for the sales team
      const [salesAgent] = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.role, "sales")))
        .limit(1);

      const issue = await issueSvc.create(companyId, {
        title: `ElevenLabs: ${summary.slice(0, 80)}`,
        description: `**Conversation transcript (ElevenLabs WhatsApp agent)**\n\nCaller: ${callerId ?? "Unknown"}\nConversation ID: ${conversationId}\n\n---\n\n${transcriptText}\n\n---\n\n**Summary:** ${summary}`,
        status: "todo",
        priority: "medium",
        assigneeAgentId: salesAgent?.id ?? null,
        originKind: "webhook",
        originId: conversationId,
      });

      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: "elevenlabs-webhook",
        action: "lead.elevenlabs_conversation",
        entityType: "issue",
        entityId: issue.id,
        details: {
          conversationId,
          callerId,
          messageCount: transcript.length,
          summary,
        },
      });

      logger.info(
        { issueId: issue.id, conversationId, messageCount: transcript.length },
        "elevenlabs webhook: conversation transcript processed",
      );
    } catch (err) {
      logger.error({ err }, "elevenlabs webhook: processing failed");
    }
  });

  return router;
}
