import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclipai/db";
import { agentService, issueService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";
import { logger } from "../middleware/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CEO_CHAT_TITLE = "CEO Chat";
const MODEL = "claude-sonnet-4-5-20251001";
const MAX_TOKENS = 2048;
const HISTORY_LIMIT = 20;

let soulMd: string;
try {
  soulMd = readFileSync(
    resolve(__dirname, "../onboarding-assets/ceo/SOUL.md"),
    "utf-8",
  );
} catch {
  soulMd = "You are the CEO of a Dubai real estate agency.";
}

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

export function ceoChatRoutes(db: Db) {
  const router = Router();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  router.post("/companies/:companyId/ceo-chat", async (req, res) => {
    const { companyId } = req.params;

    try {
      assertCompanyAccess(req, companyId);
    } catch {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { message } = req.body as { message?: string };
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const isvc = issueService(db);
    const asvc = agentService(db);

    // Find the CEO Chat issue
    const allIssues = await isvc.list(companyId);
    const ceoChatIssue = allIssues.find((i) => i.title === CEO_CHAT_TITLE) ?? null;

    if (!ceoChatIssue) {
      res.status(404).json({ error: "CEO Chat issue not found. Please open the CEO Chat page first." });
      return;
    }

    // Save the owner's message as a comment
    const actorUserId =
      req.actor.type === "board" && req.actor.userId ? req.actor.userId : undefined;

    await isvc.addComment(ceoChatIssue.id, message.trim(), {
      userId: actorUserId,
    });

    // Load last N comments for conversation history
    const recentComments = await isvc.listComments(ceoChatIssue.id, {
      order: "desc",
      limit: HISTORY_LIMIT + 1, // +1 so we can drop the message we just added if it appears
    });

    // Build Anthropic message history (oldest-first, excluding the just-saved user msg)
    const sortedComments = [...recentComments].reverse();
    // Drop the very last comment (the one we just saved — the current user message)
    const historyComments = sortedComments.slice(0, -1);

    const anthropicHistory: Anthropic.Messages.MessageParam[] = [];
    for (const c of historyComments) {
      const role: "user" | "assistant" =
        c.authorUserId !== null && c.authorAgentId === null ? "user" : "assistant";
      if (anthropicHistory.length > 0 && anthropicHistory[anthropicHistory.length - 1]?.role === role) {
        // Merge consecutive same-role messages
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

    // Build the CEO agents context
    const agentsList = await asvc.list(companyId);
    const agentStatusLines = agentsList
      .map((a) => `- ${a.name} (${a.role ?? "general"}): ${a.status}`)
      .join("\n");

    // Build system prompt
    const systemPrompt = `${soulMd}

## Current agency context

Today is ${getDubaiDateTime()}.

### Agents
${agentStatusLines || "No agents configured yet."}

### Instructions for this chat
You are responding directly to the agency owner. Be concise and direct. No filler phrases.
For anything requiring an external action (sending a WhatsApp, email, or posting content), propose it clearly and format it as a JSON approval block so the owner can approve before it is sent.
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
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicHistory,
      });

      for await (const event of stream) {
        if (aborted) break;

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullAssistantText += event.delta.text;
          send({ type: "text", text: event.delta.text });
        }
      }

      // Save the full assistant response as a comment
      if (fullAssistantText && !aborted) {
        await isvc.addComment(ceoChatIssue.id, fullAssistantText, {}).catch((err: unknown) => {
          logger.error({ err }, "ceo-chat: failed to persist assistant reply");
        });
      }

      send({ type: "done" });
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

  return router;
}
