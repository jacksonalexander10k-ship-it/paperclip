# CEO Chat Architecture

## The Core Principle

**The CEO chat is NOT a Paperclip heartbeat. It is a streaming Anthropic API call — identical in architecture to AygentDesk.**

AygentDesk is proof this works. It responds in under 2 seconds AND executes 53 real tools (sends WhatsApp, searches leads, generates pitch decks, manages calendar). The CEO chat must be built exactly the same way.

The mistake to avoid: treating the CEO as a Paperclip subprocess because it "needs to do things". That is wrong. The Anthropic API supports streaming AND tool_use simultaneously. AygentDesk does both at the same time, on every message.

---

## Architecture Split

```
Owner types a message
         ↓
CEO Chat (streaming API — instant, like AygentDesk)
    ↓              ↓
Uses tools      Responds in real-time
(call Paperclip  (text streams to UI
 API, AygentDesk  character by character)
 API, etc.)
         ↓
Background agents (Paperclip heartbeats — async, slow is fine)
Lead Agent, Content Agent, Market Agent, etc.
```

The CEO talks to the owner via streaming API.
The CEO delegates to sub-agents by calling Paperclip's API (creating issues, assigning tasks).
Sub-agents do their work asynchronously as Paperclip heartbeats.
The CEO reports back to the owner when sub-agents complete.

---

## Reference Implementation: AygentDesk

AygentDesk is the live, working reference for exactly this pattern. Read it.

**Repo:** `/Users/alexanderjackson/AgentDXB/`

### Key files to read

| File | What it shows |
|------|--------------|
| `src/app/api/chat/route.ts` | Complete streaming + tool loop (492 lines) |
| `src/lib/ai/tools.ts` | All tool definitions + executors (~5,000 lines) |
| `src/lib/ai/prompts.ts` | System prompt construction |
| `src/lib/ai/models.ts` | Model configuration |
| `src/components/chat/ChatWindow.tsx` | SSE stream reading + UI (746 lines) |
| `src/components/chat/ToolIndicator.tsx` | Tool execution display |
| `src/components/chat/cards/` | Tool result card components |

---

## How AygentDesk's Chat Works — Step by Step

### 1. API Route: `POST /api/chat`

```typescript
// src/app/api/chat/route.ts

export async function POST(req: Request) {
  const session = await auth();
  const { conversationId, messages } = await req.json();

  // Load last 50 messages from DB for context
  const dbMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  // Build system prompt with memory + date
  const systemPrompt = await buildSystemPrompt(session.user.id);

  // Return a streaming response immediately
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let continueLoop = true;
      let currentMessages = [...anthropicMessages]; // conversation history

      while (continueLoop) {
        // Call Claude with streaming + tools
        const response = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          tools: toolDefinitions, // all 53 tools
          messages: currentMessages,
        });

        let stopReason = "";
        let toolUseBlocks: ToolUseBlock[] = [];
        let textInThisTurn = "";

        // Stream events as they arrive
        for await (const event of response) {
          if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              send({ type: "tool_start", tool: event.content_block.name });
            }
          }
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
              textInThisTurn += event.delta.text;
            }
          }
          if (event.type === "message_delta") {
            stopReason = event.delta.stop_reason ?? "";
          }
        }

        // If Claude wants to use tools, execute them
        if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
          // Build assistant message with tool_use blocks
          currentMessages.push({
            role: "assistant",
            content: [
              ...(textInThisTurn ? [{ type: "text", text: textInThisTurn }] : []),
              ...toolUseBlocks.map(t => ({
                type: "tool_use",
                id: t.id,
                name: t.name,
                input: t.parsedInput,
              })),
            ],
          });

          // Execute each tool
          const toolResults = [];
          for (const tool of toolUseBlocks) {
            const result = await executeToolCall(tool.name, tool.parsedInput, userId);

            send({ type: "tool_result", tool: tool.name, result });

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            });
          }

          // Add tool results so Claude can respond to them
          currentMessages.push({ role: "user", content: toolResults });
          continueLoop = true; // Loop back — Claude will respond to tool results

        } else {
          continueLoop = false; // No more tools — done
        }
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### 2. SSE Event Types

The server sends these events down the stream:

```
data: { "type": "text", "text": "Here are the " }
data: { "type": "text", "text": "top projects..." }
data: { "type": "tool_start", "tool": "search_leads" }
data: { "type": "tool_result", "tool": "search_leads", "result": {...} }
data: { "type": "text", "text": "I found 3 leads..." }
data: { "type": "done" }
```

Tool start fires as soon as Claude decides to use a tool.
Tool result fires as soon as the tool finishes executing.
Text events stream character-by-character.
Done fires when the entire response (including all tool loops) is complete.

### 3. Frontend: Reading the Stream

```typescript
// src/components/chat/ChatWindow.tsx

const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ conversationId, messages: [{ role: "user", content: text }] }),
});

const reader = res.body?.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));

    if (event.type === "text") {
      // Buffer text, drip-feed to UI with adaptive chunk size
      textBufferRef.current += event.text;
      startDraining();
    }

    if (event.type === "tool_start") {
      // Show spinning loader for this tool
      addToolToMessage({ name: event.tool, startedAt: Date.now() });
    }

    if (event.type === "tool_result") {
      // Mark tool as done, attach result for card rendering
      markToolComplete({ name: event.tool, result: event.result });
    }

    if (event.type === "done") {
      setIsStreaming(false);
    }
  }
}
```

### 4. Smooth Text Drip-Feed

AygentDesk doesn't render text instantly — it buffers incoming text and releases it in adaptive chunks for a natural typing feel:

```typescript
function drain() {
  const bufLen = textBufferRef.current.length;
  if (bufLen === 0) return;

  // Adaptive chunk size based on buffer backlog
  let chunkSize: number;
  if (bufLen > 100) chunkSize = 20 + Math.floor(Math.random() * 20); // catch up
  else if (bufLen > 20) chunkSize = 5 + Math.floor(Math.random() * 10);
  else chunkSize = 2 + Math.floor(Math.random() * 3); // smooth

  // Try to break at word boundaries
  if (chunkSize < bufLen) {
    const nextSpace = textBufferRef.current.indexOf(" ", chunkSize);
    if (nextSpace !== -1 && nextSpace < chunkSize + 10) chunkSize = nextSpace + 1;
  }

  const chunk = textBufferRef.current.slice(0, chunkSize);
  textBufferRef.current = textBufferRef.current.slice(chunkSize);

  appendTextToLastMessage(chunk);
  setTimeout(drain, 30); // 30ms ticks
}
```

---

## CEO Chat Tools

The CEO needs a different set of tools than AygentDesk. Where AygentDesk tools call external services directly (WhatsApp, Gmail, Bayut), CEO tools interact with:

1. **Paperclip API** — create issues, assign to agents, check status, read activity
2. **AygentDesk API** — access leads, projects, WhatsApp, all 53 real estate tools
3. **Aygency World DB** — approvals, agent credentials, agency settings

### CEO Tool Categories

```
Paperclip (agent management):
  - create_task(agentId, title, description)     → assigns work to a sub-agent
  - get_agent_status(agentId)                    → check what an agent is doing
  - get_pending_tasks()                          → all open issues across agents
  - get_agent_activity(agentId, since)           → recent work by an agent
  - approve_agent_action(approvalId, decision)   → approve/reject pending approval

AygentDesk (all real estate tools):
  - search_leads(query)
  - update_lead(id, changes)
  - send_whatsapp(to, message)                   → still requires approval card
  - search_projects(query)
  - get_news()
  - ... all 53 tools available to the CEO

Agency management:
  - get_morning_brief()                          → summary of overnight activity
  - get_pending_approvals()                      → what needs owner sign-off
  - pause_agent(agentId)                         → stop an agent from running
  - hire_agent(role, config)                     → spin up a new sub-agent
  - get_agency_metrics()                         → leads, responses, costs
```

### How CEO Delegates to Sub-Agents

The CEO creates Paperclip issues to assign work. Sub-agents pick them up on their next heartbeat.

```typescript
// CEO tool: create_task
async create_task({ agentId, title, description }) {
  // Call Paperclip API
  const issue = await fetch(`${PAPERCLIP_URL}/api/companies/${companyId}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAPERCLIP_JWT}` },
    body: JSON.stringify({
      title,
      description,
      assignedAgentId: agentId,
      status: "open",
    }),
  });
  return { issueId: issue.id, message: `Task assigned to ${agentId}` };
}
```

The Lead Agent's next heartbeat (runs every 5–15 minutes) picks up the issue and processes it.

---

## System Prompt for CEO

The CEO needs a system prompt similar to AygentDesk's but focused on agency management:

```typescript
async function buildCeoSystemPrompt(companyId: string, ownerId: string): Promise<string> {
  const agency = await getAgencyContext(companyId);
  const pendingApprovals = await getPendingApprovals(companyId);
  const agentStatuses = await getAgentStatuses(companyId);
  const memories = await getCeoMemories(companyId);

  return `
You are the CEO of ${agency.name} — a Dubai real estate agency run by AI agents.

The owner is talking to you directly. Your job is to:
- Keep them informed of what's happening across the agency
- Execute tasks immediately when asked (search leads, update records, etc.)
- Delegate complex or ongoing work to the right sub-agent
- Present approval cards for anything that will go out externally (WhatsApp, email, social)
- Give honest, direct answers. No filler. No "Great question!"

## Current agency status
Agents running: ${agentStatuses.map(a => `${a.role} (${a.status})`).join(", ")}

## Pending approvals (${pendingApprovals.length})
${pendingApprovals.map(a => `- ${a.type}: ${a.summary}`).join("\n")}

## Your memory
${memories}

## Tools
You have full access to all 53 AygentDesk tools plus Paperclip agent management tools.
For anything requiring external action (sending messages, posting content):
- Draft the content
- Present it as an approval card
- Wait for owner approval before sending

For information lookups and internal changes: just do it.

Today is ${getDubaiDateTime()}.
`;
}
```

---

## Approval Cards

Approval cards are rendered in the CEO chat when the CEO proposes an external action. They are NOT a separate Paperclip approval flow — they are React components rendered inline in the chat, identical to AygentDesk's approach.

```typescript
// When CEO calls send_whatsapp tool:
{
  type: "tool_result",
  tool: "send_whatsapp",
  result: {
    requiresApproval: true,
    approvalCard: {
      type: "whatsapp",
      to: "Ahmed Al Rashidi",
      phone: "+971501234567",
      message: "Hi Ahmed, following up on the Marina Gate unit...",
      preview: "..."
    }
  }
}
```

The frontend renders this as a WhatsApp approval card with approve/edit/reject buttons. On approve, it calls `POST /api/chat/approve` with the approval ID.

---

## What to Build

### Phase 1 (Demo — build this first)

1. **`server/src/routes/ceo-chat.ts`** — POST `/api/ceo-chat`
   - Same streaming pattern as AygentDesk's `/api/chat/route.ts`
   - CEO-specific tools (Paperclip API calls + AygentDesk proxy)
   - Per-company conversation history

2. **`ui/src/pages/CeoChat.tsx`** — The CEO chat page
   - Same SSE reading pattern as `ChatWindow.tsx`
   - Same drip-feed text buffering
   - Approval card components (WhatsApp, email, Instagram, lead escalation)
   - Tool execution indicators (spinner while tool runs)

3. **CEO tools** — start with these for the demo:
   - `get_morning_brief` — summarise overnight agent activity
   - `get_pending_approvals` — list what needs sign-off
   - `search_leads` — proxy to AygentDesk
   - `create_task` — assign work to a Paperclip agent
   - `send_whatsapp` — draft + approval card (no sending yet in Phase 1)

### Phase 2+

- Full tool set (all 53 AygentDesk tools + full Paperclip management)
- Memory extraction (same pattern as AygentDesk's `memory.ts`)
- Morning brief pinned card
- Push notifications on approval

---

## Critical: This is NOT a Paperclip Agent

The CEO chat route runs as a **Next.js/Express API route**, not as a Paperclip heartbeat subprocess.

Do NOT:
- Spawn `claude` as a subprocess for the chat
- Use Paperclip's heartbeat scheduler for real-time chat
- Route chat messages through Paperclip's issue system

DO:
- Call `anthropic.messages.stream()` directly from the API route
- Stream the response back to the browser as SSE
- Use Paperclip's API to delegate work to sub-agents (they run as heartbeats)
- Copy the exact streaming pattern from `/Users/alexanderjackson/AgentDXB/src/app/api/chat/route.ts`
