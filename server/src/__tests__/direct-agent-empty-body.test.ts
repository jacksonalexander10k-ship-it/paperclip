/**
 * REGRESSION TEST — empty-body inbound WhatsApp MUST produce a recovery prompt.
 *
 * Background: Baileys fails to decrypt @lid (privacy-mode) messages, delivering
 * them with an empty body. If the direct-agent silently drops these, Claire
 * stops replying mid-conversation — which is exactly what happened during the
 * 2026-04-16 demo.
 *
 * This test guards that the prompt construction continues to include a
 * recovery instruction when incomingText is empty. Do not remove this test
 * without a deliberate replacement for the safeguard.
 */
import { describe, it, expect } from "vitest";
import { _buildUserPromptForTest } from "../services/direct-agent.js";

// Minimal db stub — returns empty rows for every query. The prompt builder
// does one select for the lead (none) and one select for conversation history
// (none). Both chains end at .limit(10) returning a promise-like array.
function makeMockDb() {
  const emptyArray: unknown[] = [];
  const asyncChain: any = {
    from: () => asyncChain,
    where: () => asyncChain,
    orderBy: () => asyncChain,
    limit: () => Promise.resolve(emptyArray),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(emptyArray)),
  };
  return {
    select: () => asyncChain,
  } as any;
}

describe("direct-agent empty-body recovery prompt", () => {
  it("inserts unreadable hint when incomingText is empty", async () => {
    const { prompt } = await _buildUserPromptForTest(makeMockDb(), {
      kind: "inbound_whatsapp",
      incomingText: "",
      chatJid: "971585286374@s.whatsapp.net",
      senderPhone: "971585286374",
      contactName: "James",
    });
    expect(prompt).toContain("couldn't read");
    expect(prompt).toContain("resend");
    expect(prompt).not.toContain("[LEAD just said]: \n");
  });

  it("inserts unreadable hint when incomingText is whitespace-only", async () => {
    const { prompt } = await _buildUserPromptForTest(makeMockDb(), {
      kind: "inbound_whatsapp",
      incomingText: "   \n\t  ",
      chatJid: "971585286374@s.whatsapp.net",
      senderPhone: "971585286374",
      contactName: "James",
    });
    expect(prompt).toContain("couldn't read");
  });

  it("uses the normal 'LEAD just said' line when incomingText is real", async () => {
    const { prompt } = await _buildUserPromptForTest(makeMockDb(), {
      kind: "inbound_whatsapp",
      incomingText: "yes please tell me more",
      chatJid: "971585286374@s.whatsapp.net",
      senderPhone: "971585286374",
      contactName: "James",
    });
    expect(prompt).toContain("[LEAD just said]: yes please tell me more");
    expect(prompt).not.toContain("couldn't read");
  });
});
