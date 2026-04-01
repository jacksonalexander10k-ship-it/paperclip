# OpenClaw: Memory, Learning & State Persistence — Deep Research

**Date:** 2026-04-01
**Sources:** github.com/openclaw/openclaw (344k stars, 24,370 commits), github.com/Gen-Verse/OpenClaw-RL (4.5k stars), docs.openclaw.ai, arXiv 2603.10165

---

## 1. How OpenClaw Agents Remember Things Across Conversations

OpenClaw uses a **file-based memory architecture** rooted in the agent workspace (`~/.openclaw/workspace`). Memory persists across sessions through several mechanisms:

### 1a. Workspace Bootstrap Files (Loaded Every Session)

Every session automatically injects these files from the workspace:

| File | Purpose | Loaded when |
|------|---------|-------------|
| `AGENTS.md` | Operating instructions for the agent, including **how it should use memory** | Every session start |
| `SOUL.md` | Persona, tone, and boundaries | Every session |
| `USER.md` | Who the user is and how to address them | Every session |
| `IDENTITY.md` | Agent's name, vibe, emoji (created during bootstrap ritual) | Every session |
| `TOOLS.md` | Notes about local tools and conventions (guidance only) | Every session |
| `HEARTBEAT.md` | Tiny checklist for heartbeat/cron runs | Heartbeat runs |
| `BOOT.md` | Startup checklist on gateway restart | Gateway restart |
| `BOOTSTRAP.md` | One-time first-run ritual, deleted after completion | First run only |

Large bootstrap files are truncated at injection; limits configurable via `agents.defaults.bootstrapMaxChars` (default: 20,000) and `agents.defaults.bootstrapTotalMaxChars` (default: 150,000).

### 1b. Daily Memory Logs

- `memory/YYYY-MM-DD.md` — one file per day, the agent's daily memory log
- Agent is instructed (via AGENTS.md) to read today's + yesterday's memory files on session start
- This gives the agent rolling short-term memory across conversations

### 1c. Long-Term Curated Memory

- `MEMORY.md` — optional curated long-term memory file
- Only loaded in the main private session (not in shared/group contexts)
- Supports an "automatic memory flush" workflow where the agent periodically consolidates important learnings into this file

### 1d. Session Persistence

- Session transcripts + metadata stored at `~/.openclaw/agents/<agentId>/sessions/`
- Sessions are per-source (DM isolation: each user gets their own session)
- Session state includes full conversation history until compacted

### 1e. Compaction (Context Window Management)

When a conversation approaches the model's context window limit:

1. Older turns are summarized into a compact entry
2. Summary is saved in the session log
3. Original messages are replaced with the summary
4. Conversation continues with the summary as context

- **Auto-compaction**: triggered automatically when approaching context limits
- **Manual compaction**: user can send `/compact` command
- Can use a different model for compaction than the conversation model
- **Compaction vs pruning**: compaction summarizes; pruning drops old messages entirely (configured via TTL/session pruning settings)

### 1f. Context Engine (Plugin-Based)

The Context Engine is a pluggable system that controls how context is assembled for each agent run:

- Plugin architecture via `ContextEngine` interface
- Plugins can control compaction behavior (`ownsCompaction` flag)
- Supports optional subagent lifecycle for context assembly
- Adds context to the system prompt dynamically
- Can be swapped out for custom implementations (e.g., RAG-based, vector-store-backed)
- "Legacy engine" is the built-in default; plugin engines extend/replace it

---

## 2. How OpenClaw Learns from User Corrections

### 2a. File-Based Learning (Built-in OpenClaw)

OpenClaw's learning from corrections is **agent-directed, not automatic**. The mechanism:

1. User corrects the agent in conversation
2. The agent (guided by AGENTS.md instructions) recognizes the correction
3. The agent updates `memory/YYYY-MM-DD.md` with the learned preference
4. Over time, the agent consolidates patterns into `MEMORY.md`
5. On future sessions, these memory files are re-injected, so the agent "remembers"

This is prompt-engineering-level learning — the model itself does not change weights. The agent simply accumulates written context that shapes future behavior.

### 2b. True Model-Level Learning (OpenClaw-RL)

OpenClaw-RL provides **actual reinforcement learning from conversations**. This is a separate framework that can be plugged into OpenClaw. See section 3 below.

---

## 3. OpenClaw-RL: Reinforcement Learning for Agents

**Paper:** arXiv 2603.10165 — "OpenClaw-RL: Train any agent simply by talking"
**Repo:** github.com/Gen-Verse/OpenClaw-RL

### 3a. Core Thesis

> "Every agent interaction generates a next-state signal — the user reply, tool output, terminal or GUI state change that follows each action — yet no existing agentic RL system recovers it as a live, online learning source."

OpenClaw-RL turns **everyday conversations into training signals** for personalized AI agents. The model actually improves its weights from being used.

### 3b. Architecture: Fully Asynchronous 4-Component Loop

The system decouples four components that run independently and never block each other:

1. **Agent Serving** — The model serves live requests via an OpenAI-compatible API (through OpenClaw)
2. **Rollout Collection** — Live multi-turn conversations are intercepted and stored as training trajectories
3. **PRM/Judge Evaluation** — A Process Reward Model scores each turn based on next-state feedback
4. **Policy Training** — The model weights are updated in the background using the scored trajectories

The model continues serving while training runs in the background. Zero coordination overhead.

### 3c. Two Types of Learning Signals

**Evaluative signals (scalar rewards):**
- Extracted via a PRM (Process Reward Model) judge
- Based on next-state feedback: did the user re-query (bad), correct the agent (bad), express satisfaction (good)?
- Scores each conversational turn

**Directive signals (token-level guidance via OPD):**
- "Hindsight-Guided On-Policy Distillation"
- When the next state reveals useful hindsight, a judge model extracts a textual hint
- This hint augments the original prompt to create an "enhanced teacher"
- The token-level log-probability gap between student and teacher becomes a directional advantage signal
- Richer than any scalar reward — tells the model HOW to change, not just whether it was good/bad

### 3d. Three Optimization Methods

| Method | How it works |
|--------|-------------|
| **Binary RL (GRPO)** | PRM scores each turn -> scalar reward -> GRPO advantage estimation -> PPO-style clipped surrogate loss |
| **On-Policy Distillation (OPD)** | Judge extracts hindsight hint -> enhanced teacher prompt -> token-level directional advantage from log-prob gap |
| **Combination** | Both Binary RL + OPD together. Dense scalar supervision + rich token-level signals. Strongest results. |

### 3e. How It Connects to OpenClaw

1. You self-host a model (e.g., Qwen3 4B) via SGLang or Tinker
2. Configure OpenClaw to route requests to the RL server as an OpenAI-compatible provider
3. Install the `rl-training-headers` extension in OpenClaw
4. Chat normally with your OpenClaw agent
5. The RL server automatically collects conversation trajectories, computes rewards, and trains the model
6. "Your agent gets better the more you use it"

### 3f. Supported Training Infrastructure

- **SGLang** (slime) — for GPU-equipped users
- **Tinker** (thinkingmachines.ai) — cloud-hosted RL training, no GPU needed
- **LoRA training** supported for efficient fine-tuning
- Supports both personal agent optimization (small-scale) and general agent optimization (large-scale with environment parallelization)

### 3g. Applicable Environments

| Setting | Environment | Signal Source | Horizon |
|---------|-------------|---------------|---------|
| Personal Agent | Conversations | User replies, corrections, feedback | Short-Medium |
| Terminal Agent | Shell sandbox | stdout/stderr, exit codes | Long |
| GUI Agent | Screen state + accessibility tree | Visual state diff, task progress | Long |
| SWE Agent | Code repo + test suite | Test verdicts, diff, lint output | Long |
| Tool-call Agent | API/function execution | Return values, error traces | Medium |

### 3h. Roadmap

- Track 1 (Personal Agent): Binary RL + OPD released, LoRA training, Tinker deployment. Next: low-precision training, **extending learning to skills and memory** (not yet implemented)
- Track 2 (General Agents): Scalable infra for terminal, GUI, SWE, tool-call environments

---

## 4. Memory/State Persistence Architecture Summary

```
~/.openclaw/
├── openclaw.json                    # Config (NOT in workspace)
├── credentials/                     # OAuth tokens, API keys
├── agents/<agentId>/sessions/       # Session transcripts + metadata
├── skills/                          # Managed/installed skills
├── sandboxes/                       # Sandbox workspaces (if enabled)
└── workspace/                       # THE AGENT'S HOME (= memory)
    ├── AGENTS.md                    # Operating instructions + memory rules
    ├── SOUL.md                      # Persona, tone, boundaries
    ├── USER.md                      # User profile
    ├── IDENTITY.md                  # Agent identity
    ├── TOOLS.md                     # Tool guidance notes
    ├── HEARTBEAT.md                 # Cron run checklist
    ├── BOOT.md                      # Gateway restart checklist
    ├── MEMORY.md                    # Curated long-term memory
    ├── memory/
    │   ├── 2026-03-30.md            # Daily memory log
    │   ├── 2026-03-31.md
    │   └── 2026-04-01.md
    ├── skills/                      # Workspace-specific skills (override managed)
    └── canvas/                      # Canvas UI files
```

**Key design decisions:**
- Memory is **file-based markdown**, not a database
- Workspace is recommended to be backed up as a **private git repo**
- Session state is separate from workspace (sessions are ephemeral transcripts; workspace is persistent memory)
- The workspace IS the agent's identity — "treat it as memory"
- Skills can be both managed (installed via ClawHub registry) and workspace-local (in `skills/` directory)

---

## 5. How Skills Work and Evolve

### Current State (OpenClaw core)

- Skills are markdown files: `~/.openclaw/workspace/skills/<skill>/SKILL.md`
- Also available as managed skills via `~/.openclaw/skills/` (installed from ClawHub registry)
- Workspace skills override managed skills when names collide
- Skills are **loaded on-demand** (not all injected upfront) to keep context small
- The agent decides which skill is relevant and loads it when needed
- Skills can be edited by the agent itself (via file tools) or by the user

### Future State (OpenClaw-RL roadmap)

- The roadmap explicitly lists: **"Beyond the policy: extend learning to skills and memory"**
- This means RL-based optimization of skills and memory is planned but NOT yet implemented
- Currently, skill evolution is manual: user edits SKILL.md or agent edits it based on conversation feedback
- The vision is that RL signals would automatically update skill files based on usage patterns

---

## 6. Key Takeaways for Aygency World

| OpenClaw Feature | Relevance to Aygency World |
|-----------------|---------------------------|
| File-based memory (daily logs + curated MEMORY.md) | Could adopt same pattern for per-agent memory in workspace |
| SOUL.md / AGENTS.md / USER.md separation | Already have similar concept in company template; could formalize |
| Compaction for long conversations | Relevant for CEO Chat which is one long-running conversation |
| Context Engine plugin system | Could build custom context engine that injects agency_context from DB |
| OpenClaw-RL's conversational RL | Future opportunity: agents that genuinely improve from owner corrections over time |
| OPD (hindsight distillation) | Powerful for learning from "the owner edited the WhatsApp message before approving" |
| Session isolation per user/channel | Already handled by Paperclip's session model |
| Skills as workspace files that agent can edit | Could allow CEO to teach agents new skills by conversation |

### Most Actionable Insight

OpenClaw-RL's approach of treating **user corrections as training signal** is directly applicable to Aygency World's approval system. Every time an owner edits a WhatsApp message before approving, that edit is a correction signal. Every rejection is a negative signal. This data could eventually train per-agency models that draft better messages over time — even without full RL, just by logging corrections and injecting them as examples in agent context.
