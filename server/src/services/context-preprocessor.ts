import { routedGenerate } from "./model-router.js";
import { logger } from "../middleware/logger.js";

/**
 * Pre-processes agent context using Gemini Flash (cheap) to condense
 * large context blocks before they're injected into the main agent run (Sonnet).
 *
 * This is the "Sonnet-only-for-output" pipeline:
 * 1. Gemini Flash summarizes: knowledge base, learnings, messages, lead data
 * 2. Condensed summary injected as `paperclipContextSummary`
 * 3. Sonnet receives smaller context → cheaper runs
 */
export async function preprocessAgentContext(
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parts: string[] = [];

  // Collect all injectable context that could be condensed
  if (context.paperclipAgentLearnings && typeof context.paperclipAgentLearnings === "string") {
    parts.push(`LEARNINGS:\n${context.paperclipAgentLearnings}`);
  }

  if (context.paperclipAgentMessages && typeof context.paperclipAgentMessages === "string") {
    parts.push(`INTER-AGENT MESSAGES:\n${context.paperclipAgentMessages}`);
  }

  // Only preprocess if we have enough context to make it worthwhile
  // (under 500 chars, the overhead of calling Gemini isn't worth it)
  const combinedLength = parts.reduce((sum, p) => sum + p.length, 0);
  if (combinedLength < 500) {
    return context;
  }

  try {
    const result = await routedGenerate({
      taskType: "internal_reasoning",
      systemPrompt:
        "You are a context summarizer. Given raw agent context data (learnings, messages, etc.), produce a concise actionable summary. Keep specific names, numbers, and instructions. Remove redundancy. Output plain text, no JSON.",
      userMessage: parts.join("\n\n---\n\n"),
      maxTokens: 512,
    });

    if (result.text && result.text.length > 0) {
      // Replace verbose context with condensed summary
      context.paperclipContextSummary = result.text;
      // Keep originals for reference but mark as pre-processed
      context._preprocessed = true;

      logger.info(
        {
          originalChars: combinedLength,
          condensedChars: result.text.length,
          reduction: Math.round((1 - result.text.length / combinedLength) * 100),
          model: result.model,
        },
        "context-preprocessor: condensed agent context",
      );
    }
  } catch (err) {
    // Non-critical — agent runs with full context if preprocessing fails
    logger.warn({ err }, "context-preprocessor: failed, using full context");
  }

  return context;
}
