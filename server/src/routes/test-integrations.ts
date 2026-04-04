/**
 * TEST-ONLY routes for simulating OAuth connections and seeding fake data.
 * These endpoints exist solely for development and testing — they should
 * NEVER be exposed in production.
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  aygentAgentCredentials,
  aygentWhatsappMessages,
  aygentWhatsappWindows,
  costEvents,
  approvals,
} from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// #79-82: Mock OAuth callback endpoints
// ---------------------------------------------------------------------------

function makeCredentialValues(
  companyId: string,
  agentId: string,
  service: string,
  extras: Record<string, unknown> = {},
) {
  return {
    id: randomUUID(),
    companyId,
    agentId,
    service,
    accessToken: `fake_${service}_token_${randomUUID().slice(0, 8)}`,
    refreshToken: `fake_${service}_refresh_${randomUUID().slice(0, 8)}`,
    providerAccountId: `fake_provider_${randomUUID().slice(0, 8)}`,
    connectedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// #55-56, 93-95: Seed fake WhatsApp messages
// ---------------------------------------------------------------------------

const FAKE_WHATSAPP_MESSAGES = [
  { fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "Hi, I'm interested in JVC apartments. What's available under 1.5M AED?", status: "read" },
  { fromMe: true, senderName: null, senderPhone: null, content: "Hi Ahmed! Thanks for reaching out. We have several great options in JVC starting from AED 800K. Are you looking for 1-bed or 2-bed?", status: "delivered" },
  { fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "2-bed would be ideal. I'd also like to know about the payment plans.", status: "read" },
  { fromMe: true, senderName: null, senderPhone: null, content: "Perfect! Binghatti Hills JVC has 2-beds from AED 1.2M with a 60/40 payment plan. Shall I send you the floor plans?", status: "sent" },
  { fromMe: false, senderName: "Fatima Al Mazrouei", senderPhone: "+971559876543", content: "Hello, I saw your listing for DAMAC Hills 2. Is the 3-bed villa still available?", status: "read" },
  { fromMe: true, senderName: null, senderPhone: null, content: "Hi Fatima! Yes, the 3-bed villa in DAMAC Hills 2 is still available at AED 2.1M. Would you like to schedule a viewing?", status: "delivered" },
  { fromMe: false, senderName: "Fatima Al Mazrouei", senderPhone: "+971559876543", content: "Yes please, can we do Thursday afternoon?", status: "read" },
  { fromMe: true, senderName: null, senderPhone: null, content: "Thursday at 3 PM works perfectly. I'll send you a confirmation shortly. Looking forward to showing you the property!", status: "sent" },
  { fromMe: false, senderName: "Raj Patel", senderPhone: "+971507654321", content: "Hi, following up on the JVC viewing we did last week. I'd like to proceed with the booking.", status: "read" },
  { fromMe: true, senderName: null, senderPhone: null, content: "Great news, Raj! I'll prepare the booking form and send it over. The developer requires a 10% down payment to secure the unit. Shall I walk you through the process?", status: "delivered" },
];

// ---------------------------------------------------------------------------
// #71, 100: Seed cost events + landing page approval
// ---------------------------------------------------------------------------

const MODEL_OPTIONS = [
  { model: "claude-haiku-4-5", inputTokens: 2000, outputTokens: 500, costCents: 1 },
  { model: "claude-haiku-4-5", inputTokens: 3500, outputTokens: 800, costCents: 2 },
  { model: "claude-sonnet-4-6", inputTokens: 8000, outputTokens: 2000, costCents: 12 },
  { model: "claude-sonnet-4-6", inputTokens: 12000, outputTokens: 3500, costCents: 18 },
  { model: "claude-sonnet-4-6", inputTokens: 15000, outputTokens: 4000, costCents: 22 },
  { model: "claude-opus-4-6", inputTokens: 25000, outputTokens: 6000, costCents: 55 },
];

export function testIntegrationRoutes(db: Db) {
  const router = Router();

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/connect-whatsapp
  // Creates a fake whatsapp_baileys credential for the given agent.
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/connect-whatsapp", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });

      const [row] = await db
        .insert(aygentAgentCredentials)
        .values(
          makeCredentialValues(companyId, agentId, "whatsapp_baileys", {
            whatsappPhoneNumberId: `fake_phone_${randomUUID().slice(0, 8)}`,
            scopes: "whatsapp_business_messaging",
          }),
        )
        .returning();

      logger.info({ companyId, agentId }, "test: fake WhatsApp credential created");
      res.json({ ok: true, credential: row });
    } catch (err) {
      logger.error({ err }, "test: failed to create fake WhatsApp credential");
      res.status(500).json({ error: "Failed to create fake credential" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/connect-gmail
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/connect-gmail", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });

      const [row] = await db
        .insert(aygentAgentCredentials)
        .values(
          makeCredentialValues(companyId, agentId, "gmail", {
            gmailAddress: `agent-${agentId.slice(0, 6)}@fakerealestate.ae`,
            scopes: "gmail.readonly,gmail.send,gmail.modify",
          }),
        )
        .returning();

      logger.info({ companyId, agentId }, "test: fake Gmail credential created");
      res.json({ ok: true, credential: row });
    } catch (err) {
      logger.error({ err }, "test: failed to create fake Gmail credential");
      res.status(500).json({ error: "Failed to create fake credential" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/connect-instagram
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/connect-instagram", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });

      const [row] = await db
        .insert(aygentAgentCredentials)
        .values(
          makeCredentialValues(companyId, agentId, "instagram", {
            providerAccountId: `fake_ig_${randomUUID().slice(0, 8)}`,
            scopes: "instagram_basic,instagram_content_publish,instagram_manage_messages",
          }),
        )
        .returning();

      logger.info({ companyId, agentId }, "test: fake Instagram credential created");
      res.json({ ok: true, credential: row });
    } catch (err) {
      logger.error({ err }, "test: failed to create fake Instagram credential");
      res.status(500).json({ error: "Failed to create fake credential" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/connect-calendar
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/connect-calendar", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: "agentId is required" });

      const [row] = await db
        .insert(aygentAgentCredentials)
        .values(
          makeCredentialValues(companyId, agentId, "google_calendar", {
            gmailAddress: `agent-${agentId.slice(0, 6)}@fakerealestate.ae`,
            scopes: "calendar.events",
          }),
        )
        .returning();

      logger.info({ companyId, agentId }, "test: fake Google Calendar credential created");
      res.json({ ok: true, credential: row });
    } catch (err) {
      logger.error({ err }, "test: failed to create fake Google Calendar credential");
      res.status(500).json({ error: "Failed to create fake credential" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/seed-whatsapp-messages
  // Inserts 10 fake WhatsApp messages + a whatsapp_window entry.
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/seed-whatsapp-messages", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { agentId } = req.body;

      // Resolve an agent to associate messages with
      let targetAgentId = agentId;
      if (!targetAgentId) {
        const [firstAgent] = await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.companyId, companyId))
          .limit(1);
        if (!firstAgent) return res.status(400).json({ error: "No agents found for this company. Pass agentId or create an agent first." });
        targetAgentId = firstAgent.id;
      }

      const chatJidAhmed = "+971501234567@s.whatsapp.net";
      const chatJidFatima = "+971559876543@s.whatsapp.net";
      const chatJidRaj = "+971507654321@s.whatsapp.net";

      const now = Date.now();
      const messages = FAKE_WHATSAPP_MESSAGES.map((msg, i) => {
        // Determine chatJid based on the sender
        let chatJid = chatJidAhmed;
        if (msg.senderName === "Fatima Al Mazrouei" || (msg.fromMe && i >= 4 && i <= 7)) chatJid = chatJidFatima;
        if (msg.senderName === "Raj Patel" || (msg.fromMe && i >= 8)) chatJid = chatJidRaj;

        return {
          id: randomUUID(),
          companyId,
          agentId: targetAgentId,
          leadId: null,
          chatJid,
          messageId: `fake_msg_${randomUUID().slice(0, 12)}`,
          fromMe: msg.fromMe,
          senderName: msg.senderName,
          senderPhone: msg.senderPhone,
          content: msg.content,
          mediaType: null,
          mediaUrl: null,
          status: msg.status,
          timestamp: new Date(now - (FAKE_WHATSAPP_MESSAGES.length - i) * 5 * 60 * 1000), // 5 min apart
          createdAt: new Date(),
        };
      });

      await db.insert(aygentWhatsappMessages).values(messages);

      // Seed a WhatsApp window for Ahmed (most recent conversation)
      const windowOpened = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
      await db
        .insert(aygentWhatsappWindows)
        .values({
          id: randomUUID(),
          companyId,
          agentId: targetAgentId,
          chatJid: chatJidAhmed,
          windowOpenedAt: windowOpened,
          windowExpiresAt: new Date(windowOpened.getTime() + 24 * 60 * 60 * 1000), // +24h
        })
        .onConflictDoNothing();

      logger.info({ companyId, count: messages.length }, "test: fake WhatsApp messages seeded");
      res.json({ ok: true, messagesInserted: messages.length, windowSeeded: true });
    } catch (err) {
      logger.error({ err }, "test: failed to seed WhatsApp messages");
      res.status(500).json({ error: "Failed to seed WhatsApp messages" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/seed-cost-events
  // Inserts 12 fake cost events spread over the last 7 days.
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/seed-cost-events", async (req, res) => {
    try {
      const { companyId } = req.params;

      // Get all agents for the company so we can distribute costs
      const companyAgents = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      if (companyAgents.length === 0) {
        return res.status(400).json({ error: "No agents found for this company." });
      }

      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const events = [];

      for (let i = 0; i < 12; i++) {
        const agent = companyAgents[i % companyAgents.length];
        const modelInfo = MODEL_OPTIONS[i % MODEL_OPTIONS.length];
        const occurredAt = new Date(now - Math.random() * sevenDaysMs);

        events.push({
          id: randomUUID(),
          companyId,
          agentId: agent.id,
          issueId: null,
          projectId: null,
          goalId: null,
          heartbeatRunId: null,
          billingCode: null,
          provider: "anthropic",
          biller: "anthropic",
          billingType: "llm",
          model: modelInfo.model,
          inputTokens: modelInfo.inputTokens + Math.floor(Math.random() * 1000),
          cachedInputTokens: Math.floor(Math.random() * 500),
          outputTokens: modelInfo.outputTokens + Math.floor(Math.random() * 500),
          costCents: modelInfo.costCents + Math.floor(Math.random() * 5),
          occurredAt,
          createdAt: occurredAt,
        });
      }

      await db.insert(costEvents).values(events);

      logger.info({ companyId, count: events.length }, "test: fake cost events seeded");
      res.json({ ok: true, eventsInserted: events.length });
    } catch (err) {
      logger.error({ err }, "test: failed to seed cost events");
      res.status(500).json({ error: "Failed to seed cost events" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /companies/:companyId/test/seed-landing-page-approval
  // Creates a fake "generate_landing_page" approval with realistic payload.
  // -----------------------------------------------------------------------
  router.post("/companies/:companyId/test/seed-landing-page-approval", async (req, res) => {
    try {
      const { companyId } = req.params;

      // Find a content-type agent, or fall back to any agent
      const companyAgents = await db
        .select({ id: agents.id, name: agents.name, role: agents.role })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      if (companyAgents.length === 0) {
        return res.status(400).json({ error: "No agents found for this company." });
      }

      const contentAgent =
        companyAgents.find((a) => a.role === "content") ||
        companyAgents.find((a) => a.role === "ceo") ||
        companyAgents[0];

      const [row] = await db
        .insert(approvals)
        .values({
          id: randomUUID(),
          companyId,
          type: "generate_landing_page",
          requestedByAgentId: contentAgent.id,
          requestedByUserId: null,
          status: "pending",
          payload: {
            url: "https://dubaiproperties.ae/binghatti-hills-jvc",
            projectName: "Binghatti Hills",
            developer: "Binghatti Developers",
            location: "Jumeirah Village Circle (JVC)",
            startingPrice: "AED 800,000",
            paymentPlan: "60/40",
            handoverDate: "Q4 2027",
            propertyTypes: ["Studio", "1-Bed", "2-Bed", "3-Bed"],
            highlights: [
              "Premium finishes and smart home technology",
              "Rooftop infinity pool with JVC skyline views",
              "Walking distance to Circle Mall",
              "5 minutes from Al Khail Road",
            ],
            ctaText: "Register for Exclusive Pricing",
            targetAudience: "Investors and end-users looking for off-plan JVC apartments",
            language: "en",
          },
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      logger.info({ companyId, approvalId: row.id }, "test: fake landing page approval seeded");
      res.json({ ok: true, approval: row });
    } catch (err) {
      logger.error({ err }, "test: failed to seed landing page approval");
      res.status(500).json({ error: "Failed to seed landing page approval" });
    }
  });

  return router;
}
