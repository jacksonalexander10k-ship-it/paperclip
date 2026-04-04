import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Task classification — determines which model to use
// ---------------------------------------------------------------------------

export type TaskTier = "free" | "cheap" | "quality" | "premium";

export interface TaskClassification {
  tier: TaskTier;
  reason: string;
}

/**
 * Four-tier model strategy (decided 2026-04-04):
 *
 * - free:     Structured data, no LLM needed
 * - cheap:    Internal processing → Gemini 3.1 Flash Lite ($0.002/run)
 * - quality:  Customer-facing output → Gemini 3.1 Pro ($0.016/run)
 * - premium:  Deep Think mode → Claude Sonnet 4.6 ($0.021/run) — Scale/Enterprise only
 */
export function classifyTask(taskType: string): TaskClassification {
  switch (taskType) {
    // Free — no LLM call needed
    case "structured_alert":
    case "score_update":
    case "status_change":
      return { tier: "free", reason: "Structured data, no LLM required" };

    // Cheap — Gemini 3.1 Flash Lite
    case "learning_compaction":
    case "outcome_summary":
    case "inter_agent_message":
    case "lead_scoring":
    case "lead_enrichment":
    case "internal_reasoning":
    case "bulletin_summary":
    case "context_assembly":
    case "qualification_flow":
    case "ad_analysis":
    case "content_planning":
    case "report_generation":
    case "market_sweep":
    case "spam_check":
      return { tier: "cheap", reason: "Internal processing, not customer-facing" };

    // Quality — Gemini 3.1 Pro
    case "whatsapp_draft":
    case "email_draft":
    case "instagram_caption":
    case "pitch_deck_content":
    case "landing_page_content":
    case "ceo_chat":
    case "morning_brief":
    case "customer_facing":
    case "agent_heartbeat":
      return { tier: "quality", reason: "Customer-facing or owner-facing output" };

    // Premium — Claude Sonnet (Scale/Enterprise only)
    case "deep_think":
    case "strategic_analysis":
    case "org_recommendation":
    case "custom_code_generation":
      return { tier: "premium", reason: "Deep strategic analysis or complex code generation" };

    default:
      return { tier: "quality", reason: "Unknown task type, defaulting to quality" };
  }
}

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

const GEMINI_FLASH_LITE = "gemini-3.1-flash-lite-preview";
const GEMINI_PRO = "gemini-3.1-pro-preview";
const SONNET_MODEL = "claude-sonnet-4-6";

function getModelForTier(tier: TaskTier): { model: string; provider: "google" | "anthropic" } {
  switch (tier) {
    case "free":
      return { model: "none", provider: "google" };
    case "cheap":
      return { model: GEMINI_FLASH_LITE, provider: "google" };
    case "quality":
      return { model: GEMINI_PRO, provider: "google" };
    case "premium":
      return { model: SONNET_MODEL, provider: "anthropic" };
  }
}

// ---------------------------------------------------------------------------
// Model router — wraps Anthropic and Gemini
// ---------------------------------------------------------------------------

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

/**
 * Generate a response using the appropriate model for the task type.
 * Falls back gracefully: Gemini → Sonnet if Gemini unavailable.
 */
export async function routedGenerate(opts: {
  taskType: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<ModelResponse> {
  const classification = classifyTask(opts.taskType);
  const { model, provider } = getModelForTier(classification.tier);

  if (classification.tier === "free") {
    return { text: "", model: "none", provider: "google", inputTokens: 0, outputTokens: 0 };
  }

  // Try Gemini for cheap and quality tiers
  if (provider === "google") {
    const gemini = getGemini();
    if (gemini) {
      try {
        return await callGemini(gemini, model, opts);
      } catch (err) {
        logger.warn({ err, taskType: opts.taskType, model }, "model-router: Gemini failed, falling back to Sonnet");
      }
    } else {
      logger.warn({ taskType: opts.taskType }, "model-router: No GEMINI_API_KEY, falling back to Sonnet");
    }
    // Gemini unavailable or failed → fall through to Sonnet
  }

  // Anthropic (premium tier or fallback)
  return callAnthropic(getAnthropic(), provider === "anthropic" ? model : SONNET_MODEL, opts);
}

/**
 * Stream a response using the appropriate model for the task type.
 * Used by CEO Chat for real-time streaming to the UI.
 */
export async function routedStream(opts: {
  taskType: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  onText: (text: string) => void;
  signal?: AbortSignal;
}): Promise<ModelResponse> {
  const classification = classifyTask(opts.taskType);
  const { model, provider } = getModelForTier(classification.tier);

  // Try Gemini streaming for cheap and quality tiers
  if (provider === "google") {
    const gemini = getGemini();
    if (gemini) {
      try {
        return await streamGemini(gemini, model, opts);
      } catch (err) {
        logger.warn({ err, taskType: opts.taskType, model }, "model-router: Gemini stream failed, falling back to Sonnet");
      }
    } else {
      logger.warn({ taskType: opts.taskType }, "model-router: No GEMINI_API_KEY, falling back to Sonnet stream");
    }
  }

  // Anthropic streaming (premium or fallback)
  return streamAnthropic(
    getAnthropic(),
    provider === "anthropic" ? model : SONNET_MODEL,
    opts,
  );
}

// ---------------------------------------------------------------------------
// Gemini calls
// ---------------------------------------------------------------------------

async function callGemini(
  gemini: GoogleGenerativeAI,
  modelName: string,
  opts: { systemPrompt: string; userMessage: string; maxTokens?: number },
): Promise<ModelResponse> {
  const model = gemini.getGenerativeModel({
    model: modelName,
    systemInstruction: opts.systemPrompt,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
  });

  const response = result.response;
  const text = response.text();
  const usage = response.usageMetadata;

  return {
    text,
    model: modelName,
    provider: "google",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

async function streamGemini(
  gemini: GoogleGenerativeAI,
  modelName: string,
  opts: {
    systemPrompt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    maxTokens?: number;
    onText: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<ModelResponse> {
  const model = gemini.getGenerativeModel({
    model: modelName,
    systemInstruction: opts.systemPrompt,
  });

  // Convert messages to Gemini format
  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const result = await model.generateContentStream({
    contents,
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
  });

  let fullText = "";
  for await (const chunk of result.stream) {
    if (opts.signal?.aborted) break;
    const text = chunk.text();
    if (text) {
      fullText += text;
      opts.onText(text);
    }
  }

  const response = await result.response;
  const usage = response.usageMetadata;

  return {
    text: fullText,
    model: modelName,
    provider: "google",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Anthropic calls
// ---------------------------------------------------------------------------

async function callAnthropic(
  anthropic: Anthropic,
  model: string,
  opts: { systemPrompt: string; userMessage: string; maxTokens?: number },
): Promise<ModelResponse> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
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

async function streamAnthropic(
  anthropic: Anthropic,
  model: string,
  opts: {
    systemPrompt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    maxTokens?: number;
    onText: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<ModelResponse> {
  const stream = anthropic.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.systemPrompt,
    messages: opts.messages,
  });

  let fullText = "";
  stream.on("text", (text) => {
    fullText += text;
    opts.onText(text);
  });

  if (opts.signal) {
    opts.signal.addEventListener("abort", () => stream.abort(), { once: true });
  }

  const finalMessage = await stream.finalMessage();

  return {
    text: fullText,
    model,
    provider: "anthropic",
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };
}
