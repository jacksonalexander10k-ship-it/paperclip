import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Task classification — determines which model to use
// ---------------------------------------------------------------------------

export type TaskTier = "free" | "cheap" | "standard" | "premium";

export interface TaskClassification {
  tier: TaskTier;
  reason: string;
}

/**
 * Classify a task to determine which model tier it should use.
 *
 * - free:     Structured JSON inserts, no LLM needed
 * - cheap:    Internal summaries, learning compaction, inter-agent comms → Gemini Flash
 * - standard: Customer-facing output, CEO Chat → Claude Sonnet
 * - premium:  Deep strategic analysis → Claude Opus (Scale/Enterprise only)
 */
export function classifyTask(taskType: string): TaskClassification {
  switch (taskType) {
    // Free — no LLM call needed
    case "structured_alert":
    case "score_update":
    case "status_change":
      return { tier: "free", reason: "Structured data, no LLM required" };

    // Cheap — Gemini Flash
    case "learning_compaction":
    case "outcome_summary":
    case "inter_agent_message":
    case "lead_scoring":
    case "lead_enrichment":
    case "internal_reasoning":
    case "bulletin_summary":
      return { tier: "cheap", reason: "Internal processing, not customer-facing" };

    // Standard — Claude Sonnet
    case "whatsapp_draft":
    case "email_draft":
    case "instagram_caption":
    case "pitch_deck_content":
    case "ceo_chat":
    case "morning_brief":
    case "customer_facing":
      return { tier: "standard", reason: "Customer-facing or owner-facing output" };

    // Premium — Claude Opus
    case "deep_think":
    case "strategic_analysis":
    case "org_recommendation":
      return { tier: "premium", reason: "Deep strategic analysis" };

    default:
      return { tier: "standard", reason: "Unknown task type, defaulting to standard" };
  }
}

// ---------------------------------------------------------------------------
// Model router — wraps both Anthropic and Gemini
// ---------------------------------------------------------------------------

const GEMINI_MODEL = "gemini-2.5-flash";
const SONNET_MODEL = "claude-sonnet-4-5";
const OPUS_MODEL = "claude-opus-4";

export interface ModelResponse {
  text: string;
  model: string;
  provider: "anthropic" | "google";
  inputTokens: number;
  outputTokens: number;
}

let _gemini: GoogleGenerativeAI | null = null;
let _anthropic: Anthropic | null = null;

function getGemini(): GoogleGenerativeAI | null {
  if (_gemini) return _gemini;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function routedGenerate(opts: {
  taskType: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<ModelResponse> {
  const classification = classifyTask(opts.taskType);

  if (classification.tier === "free") {
    return {
      text: "",
      model: "none",
      provider: "google",
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  // Try Gemini Flash for cheap tasks
  if (classification.tier === "cheap") {
    const gemini = getGemini();
    if (gemini) {
      try {
        return await callGemini(gemini, opts);
      } catch (err) {
        logger.warn({ err, taskType: opts.taskType }, "model-router: Gemini Flash failed, falling back to Sonnet");
        // Fall through to Sonnet
      }
    }
    // No Gemini key or Gemini failed — fall through to Sonnet
  }

  // Claude Sonnet for standard, Claude Opus for premium
  const model = classification.tier === "premium" ? OPUS_MODEL : SONNET_MODEL;
  return callAnthropic(getAnthropic(), model, opts);
}

async function callGemini(
  gemini: GoogleGenerativeAI,
  opts: { systemPrompt: string; userMessage: string; maxTokens?: number },
): Promise<ModelResponse> {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: opts.systemPrompt,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 2048 },
  });

  const response = result.response;
  const text = response.text();
  const usage = response.usageMetadata;

  return {
    text,
    model: GEMINI_MODEL,
    provider: "google",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

async function callAnthropic(
  anthropic: Anthropic,
  model: string,
  opts: { systemPrompt: string; userMessage: string; maxTokens?: number },
): Promise<ModelResponse> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    text,
    model,
    provider: "anthropic",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
