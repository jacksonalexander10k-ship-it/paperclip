import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoReplyService } from "../services/auto-reply.ts";

// ── External dependencies ────────────────────────────────────────────────────

const mockGetByAgentAndService = vi.hoisted(() => vi.fn());
vi.mock("../services/agent-credentials.js", () => ({
  agentCredentialService: vi.fn(() => ({
    getByAgentAndService: mockGetByAgentAndService,
  })),
}));

const mockIsConnected = vi.hoisted(() => vi.fn(() => false));
const mockSendMessage = vi.hoisted(() => vi.fn());
vi.mock("../services/baileys-session-manager.js", () => ({
  baileysSessionManager: {
    isConnected: mockIsConnected,
    sendMessage: mockSendMessage,
  },
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

// ── DB stub builder ──────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

function buildRule(overrides: AnyRow = {}) {
  return {
    id: "rule-1",
    companyId: "co-1",
    leadSource: "whatsapp",
    replyChannel: "whatsapp",
    enabled: "true",
    delaySecs: 60,
    fixedMessage: "Hi {{lead_name}}, thanks for reaching out!",
    templateId: null,
    emailSubject: null,
    ...overrides,
  };
}

function buildQueueEntry(overrides: AnyRow = {}) {
  return {
    id: "q-1",
    companyId: "co-1",
    agentId: "agent-1",
    leadId: "lead-1",
    channel: "whatsapp",
    recipient: "+971501234567",
    messageContent: "Hi Ahmed, thanks for reaching out!",
    emailSubject: null,
    leadSource: "whatsapp",
    status: "pending",
    attempts: 0,
    sendAt: new Date(Date.now() - 1000), // already due
    ...overrides,
  };
}

/**
 * Minimal chainable Drizzle-style db stub.
 *
 * selectQueue: consumed in order by each .select().from().where() call.
 * insertRows:  returned by .insert().values().returning().
 * updateRows:  returned by .update().set().where().
 */
function buildDb(selectQueue: AnyRow[][] = [], insertRows: AnyRow[] = [], updateRows: AnyRow[] = []) {
  const selects = [...selectQueue];
  const inserts = [...insertRows];
  const updates = [...updateRows];

  // Drizzle query chain: .select().from().where().limit()
  // The tail must be self-referential so each chained call returns the SAME
  // result holder — only one batch is consumed per top-level query.
  const makeSelectTail = () => {
    const result = selects.shift() ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tail: any = {
      where: () => tail,
      limit: () => tail,
      // make awaitable
      then: (resolve: (v: AnyRow[]) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
      catch: (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject),
      finally: (fn: () => void) => Promise.resolve(result).finally(fn),
    };
    return tail;
  };

  const selectFrom = vi.fn(() => makeSelectTail());
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertReturning = vi.fn(async () => [inserts.shift() ?? { id: "inserted" }]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  // update().set().where() — each call creates a fresh where spy so call counts are accurate
  const updateWhere = vi.fn(async () => updates.shift() ?? []);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  return { db: { select, insert, update } as unknown, insertValues, updateSet, updateWhere };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("autoReplyService.enqueue()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no matching rule exists", async () => {
    const { db } = buildDb([[]]); // empty select result
    const svc = autoReplyService(db as any);
    const result = await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      recipientPhone: "+971501234567",
    });
    expect(result).toBeNull();
  });

  it("returns null when recipient is missing for the channel", async () => {
    const { db } = buildDb([[buildRule()]]);
    const svc = autoReplyService(db as any);
    const result = await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      // no recipientPhone provided
    });
    expect(result).toBeNull();
  });

  it("returns null when rule has no message content and no templateId", async () => {
    const { db } = buildDb([[buildRule({ fixedMessage: null, templateId: null })]]);
    const svc = autoReplyService(db as any);
    const result = await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      recipientPhone: "+971501234567",
    });
    expect(result).toBeNull();
  });

  it("uses fixedMessage as-is (variable substitution only applies to templateId content)", async () => {
    const rule = buildRule({ fixedMessage: "Hi {{lead_name}}, I'm {{agent_name}}!" });
    const { db, insertValues } = buildDb([[rule]], [{ id: "q-new" }]);
    const svc = autoReplyService(db as any);
    await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      recipientPhone: "+971501234567",
      leadName: "Ahmed",
      agentName: "Sarah",
    });

    // fixedMessage is stored verbatim — substitution only runs for template-based rules
    const inserted = insertValues.mock.calls[0][0] as AnyRow;
    expect(inserted.messageContent).toBe("Hi {{lead_name}}, I'm {{agent_name}}!");
  });

  it("merges template variables when rule uses a templateId", async () => {
    const rule = buildRule({ fixedMessage: null, templateId: "tmpl-1" });
    const template = { id: "tmpl-1", content: "Hi {{lead_name}}, I'm {{agent_name}}!", usageCount: 0 };
    // First select: the rule; second select: the template
    const { db, insertValues } = buildDb([[rule], [template]], [{ id: "q-new" }]);
    const svc = autoReplyService(db as any);
    await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      recipientPhone: "+971501234567",
      leadName: "Ahmed",
      agentName: "Sarah",
    });

    const inserted = insertValues.mock.calls[0][0] as AnyRow;
    expect(inserted.messageContent).toBe("Hi Ahmed, I'm Sarah!");
  });

  it("calculates sendAt using rule.delaySecs", async () => {
    const before = Date.now();
    const rule = buildRule({ delaySecs: 90 });
    const { db, insertValues } = buildDb([[rule]], [{ id: "q-new" }]);
    const svc = autoReplyService(db as any);
    await svc.enqueue({
      companyId: "co-1",
      agentId: "agent-1",
      leadSource: "whatsapp",
      recipientPhone: "+971501234567",
    });

    const inserted = insertValues.mock.calls[0][0] as AnyRow;
    const sendAt = (inserted.sendAt as Date).getTime();
    expect(sendAt).toBeGreaterThanOrEqual(before + 90_000);
    expect(sendAt).toBeLessThan(before + 91_000);
  });
});

describe("autoReplyService.processQueue() — WhatsApp delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when queue is empty", async () => {
    const { db } = buildDb([[]]); // no pending entries
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();
    expect(sent).toBe(0);
  });

  it("sends via Baileys when connected and marks entry as sent", async () => {
    mockIsConnected.mockReturnValue(true);
    mockGetByAgentAndService.mockResolvedValue({ accessToken: "tok" });
    mockSendMessage.mockResolvedValue({ success: true, messageId: "msg-1" });

    const entry = buildQueueEntry();
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();

    expect(sent).toBe(1);
    expect(mockSendMessage).toHaveBeenCalledOnce();
    // Final update should set status to "sent"
    const finalSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(finalSet.status).toBe("sent");
  });

  it("falls back to 360dialog when Baileys is not connected", async () => {
    mockIsConnected.mockReturnValue(false);
    mockGetByAgentAndService.mockImplementation(async (_agentId: string, service: string) => {
      if (service === "whatsapp") return { accessToken: "dialog-tok" };
      return null;
    });
    mockFetch.mockResolvedValue({ ok: true });

    const entry = buildQueueEntry();
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();

    expect(sent).toBe(1);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockSendMessage).not.toHaveBeenCalled();
    const finalSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(finalSet.status).toBe("sent");
  });

  it("throws when 360dialog returns non-200 and no Baileys credentials", async () => {
    mockIsConnected.mockReturnValue(false);
    mockGetByAgentAndService.mockImplementation(async (_agentId: string, service: string) => {
      if (service === "whatsapp") return { accessToken: "dialog-tok" };
      return null;
    });
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });

    const entry = buildQueueEntry({ attempts: 0 });
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();

    expect(sent).toBe(0);
    // Error branch: status set back to "pending" (attempts = 1, below MAX_ATTEMPTS)
    const errorSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(errorSet.status).toBe("pending");
    expect(errorSet.attempts).toBe(1);
  });

  it("marks entry as failed after MAX_ATTEMPTS (3) consecutive errors", async () => {
    mockIsConnected.mockReturnValue(false);
    mockGetByAgentAndService.mockResolvedValue({ accessToken: "dialog-tok" });
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });

    // Entry already has 2 attempts — next failure is the 3rd (= MAX_ATTEMPTS)
    const entry = buildQueueEntry({ attempts: 2 });
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    await svc.processQueue();

    const errorSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(errorSet.status).toBe("failed");
    expect(errorSet.attempts).toBe(3);
  });

  it("skips entry with no WhatsApp credentials on either path", async () => {
    mockIsConnected.mockReturnValue(false);
    mockGetByAgentAndService.mockResolvedValue(null); // no credentials at all

    const entry = buildQueueEntry({ attempts: 0 });
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();

    expect(sent).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    const errorSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(errorSet.status).toBe("pending"); // still retryable
  });
});

describe("autoReplyService.processQueue() — email delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email via Gmail API when channel is email", async () => {
    mockGetByAgentAndService.mockResolvedValue({
      accessToken: "gmail-tok",
      gmailAddress: "agent@example.com",
    });
    mockFetch.mockResolvedValue({ ok: true });

    const entry = buildQueueEntry({
      channel: "email",
      recipient: "lead@example.com",
      emailSubject: "Your enquiry",
    });
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    const sent = await svc.processQueue();

    expect(sent).toBe(1);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("gmail.googleapis.com");
    const finalSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(finalSet.status).toBe("sent");
  });

  it("throws when Gmail credentials are missing", async () => {
    mockGetByAgentAndService.mockResolvedValue(null);

    const entry = buildQueueEntry({ channel: "email", recipient: "lead@example.com", attempts: 2 });
    const { db, updateSet } = buildDb([[entry]]);
    const svc = autoReplyService(db as any);
    await svc.processQueue();

    const errorSet = updateSet.mock.calls[updateSet.mock.calls.length - 1][0] as AnyRow;
    expect(errorSet.status).toBe("failed"); // 3rd attempt → failed
  });
});
