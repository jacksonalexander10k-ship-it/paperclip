/**
 * CEO Command Handler
 *
 * Detects and executes structured commands emitted by the CEO agent
 * in comment bodies. Commands are wrapped in ```paperclip-command fenced blocks.
 */

import type { Db } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { routineService } from "./routines.js";
import { projectService } from "./projects.js";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HireAgentSpec {
  name: string;
  role: string;
  title: string;
  heartbeat_minutes: number;
  skills?: string[];
  tool_groups?: string[];
  custom_instructions?: string;
}

interface HireTeamCommand {
  action: "hire_team";
  agents: HireAgentSpec[];
}

interface PauseAgentCommand {
  action: "pause_agent";
  agent_name: string;
}

interface ResumeAgentCommand {
  action: "resume_agent";
  agent_name: string;
}

interface PauseAllCommand {
  action: "pause_all";
}

interface ResumeAllCommand {
  action: "resume_all";
}

interface UpdateAgentConfigCommand {
  action: "update_agent_config";
  agent_name: string;
  custom_instructions?: string;
  add_skills?: string[];
  remove_skills?: string[];
}

type CeoCommand =
  | HireTeamCommand
  | PauseAgentCommand
  | ResumeAgentCommand
  | PauseAllCommand
  | ResumeAllCommand
  | UpdateAgentConfigCommand;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMAND_BLOCK_RE = /```paperclip-command\s*\n([\s\S]*?)```/g;

/**
 * Extract all paperclip-command JSON blocks from a comment body.
 */
export function extractCommands(body: string): CeoCommand[] {
  const commands: CeoCommand[] = [];
  const regex = new RegExp(COMMAND_BLOCK_RE.source, COMMAND_BLOCK_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.action === "string") {
        commands.push(parsed as CeoCommand);
      }
    } catch {
      // Malformed JSON -- skip this block
      logger.warn({ block: match[1]?.slice(0, 200) }, "ceo-commands: failed to parse command block");
    }
  }
  return commands;
}

/**
 * Convert a heartbeat interval in minutes to a cron expression.
 */
export function minutesToCron(minutes: number): string {
  if (minutes <= 0) return "0 */4 * * *"; // fallback to every 4 hours
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes === 60) return "0 * * * *";
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `0 */${hours} * * *`;
  }
  // Daily or longer -- run once at 8am Dubai (4am UTC)
  return "0 4 * * *";
}

// ---------------------------------------------------------------------------
// Command executor
// ---------------------------------------------------------------------------

export function ceoCommandService(db: Db) {
  const agentsSvc = agentService(db);
  const routinesSvc = routineService(db);
  const projectsSvc = projectService(db);

  /**
   * Find an agent by display name within a company.
   * Returns null if not found.
   */
  async function findAgentByName(companyId: string, name: string) {
    const allAgents = await agentsSvc.list(companyId);
    const lower = name.toLowerCase().trim();
    return allAgents.find((a) => a.name.toLowerCase() === lower) ?? null;
  }

  /**
   * Find the CEO agent for a company.
   */
  async function findCeoAgent(companyId: string) {
    const allAgents = await agentsSvc.list(companyId);
    return allAgents.find((a) => a.role === "ceo") ?? null;
  }

  /**
   * Get or create the default project for a company.
   * Routines require a projectId -- use the first available project.
   */
  async function getDefaultProjectId(companyId: string): Promise<string> {
    const projectList = await projectsSvc.list(companyId);
    if (projectList.length > 0) return projectList[0].id;
    // Create a default project if none exists
    const created = await projectsSvc.create(companyId, {
      name: "Agency Operations",
      description: "Default project for agent routines",
    });
    return created.id;
  }

  // -------------------------------------------------------------------------
  // Individual command handlers
  // -------------------------------------------------------------------------

  async function handleHireTeam(
    companyId: string,
    cmd: HireTeamCommand,
    actorAgentId: string,
  ): Promise<string> {
    const results: string[] = [];
    const ceoAgent = await findCeoAgent(companyId);
    const ceoId = ceoAgent?.id ?? actorAgentId;
    const projectId = await getDefaultProjectId(companyId);

    for (const spec of cmd.agents) {
      try {
        // Create the agent
        const created = await agentsSvc.create(companyId, {
          name: spec.name,
          role: spec.role,
          title: spec.title,
          reportsTo: ceoId,
          adapterType: "claude_local",
          adapterConfig: {},
          runtimeConfig: {},
          status: "idle",
          capabilities: null,
          budgetMonthlyCents: 5000, // $50/month default
          metadata: {
            skills: spec.skills ?? [],
            tool_groups: spec.tool_groups ?? [],
            custom_instructions: spec.custom_instructions ?? "",
          },
          permissions: undefined,
        });

        // Create a routine with a cron trigger for the heartbeat
        const routine = await routinesSvc.create(
          companyId,
          {
            projectId,
            title: `${spec.name} Heartbeat`,
            description: `Scheduled heartbeat for ${spec.name} (${spec.title}). Runs every ${spec.heartbeat_minutes} minutes.`,
            assigneeAgentId: created.id,
            priority: "medium",
            status: "active",
            concurrencyPolicy: "skip_if_active",
            catchUpPolicy: "skip_missed",
          },
          { agentId: actorAgentId },
        );

        // Create a cron trigger on the routine
        const cronExpr = minutesToCron(spec.heartbeat_minutes);
        await routinesSvc.createTrigger(
          routine.id,
          {
            kind: "schedule",
            label: `Every ${spec.heartbeat_minutes}m`,
            enabled: true,
            cronExpression: cronExpr,
            timezone: "Asia/Dubai",
          },
          { agentId: actorAgentId },
        );

        // Publish live event
        publishLiveEvent({
          companyId,
          type: "agent.status",
          payload: { agentId: created.id, status: "idle" },
        });

        results.push(`${spec.name} (${spec.title}) -- hired, heartbeat every ${spec.heartbeat_minutes}m`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err, agentSpec: spec.name }, "ceo-commands: failed to hire agent");
        results.push(`${spec.name} -- FAILED: ${message}`);
      }
    }

    return `Team hiring results:\n${results.map((r) => `- ${r}`).join("\n")}`;
  }

  async function handlePauseAgent(
    companyId: string,
    cmd: PauseAgentCommand,
  ): Promise<string> {
    const agent = await findAgentByName(companyId, cmd.agent_name);
    if (!agent) return `Agent "${cmd.agent_name}" not found.`;

    await agentsSvc.pause(agent.id, "manual");

    // Pause all routines assigned to this agent
    const allRoutines = await routinesSvc.list(companyId);
    const agentRoutines = allRoutines.filter((r) => r.assigneeAgentId === agent.id);
    for (const routine of agentRoutines) {
      if (routine.status === "active") {
        await routinesSvc.update(routine.id, { status: "paused" }, { agentId: null });
      }
    }

    publishLiveEvent({
      companyId,
      type: "agent.status",
      payload: { agentId: agent.id, status: "paused" },
    });

    return `${agent.name} paused. ${agentRoutines.length} routine(s) paused.`;
  }

  async function handleResumeAgent(
    companyId: string,
    cmd: ResumeAgentCommand,
  ): Promise<string> {
    const agent = await findAgentByName(companyId, cmd.agent_name);
    if (!agent) return `Agent "${cmd.agent_name}" not found.`;

    await agentsSvc.resume(agent.id);

    // Resume all routines assigned to this agent
    const allRoutines = await routinesSvc.list(companyId);
    const agentRoutines = allRoutines.filter((r) => r.assigneeAgentId === agent.id);
    for (const routine of agentRoutines) {
      if (routine.status === "paused") {
        await routinesSvc.update(routine.id, { status: "active" }, { agentId: null });
      }
    }

    publishLiveEvent({
      companyId,
      type: "agent.status",
      payload: { agentId: agent.id, status: "idle" },
    });

    return `${agent.name} resumed. ${agentRoutines.length} routine(s) reactivated.`;
  }

  async function handlePauseAll(companyId: string): Promise<string> {
    const allAgents = await agentsSvc.list(companyId);
    const nonCeo = allAgents.filter((a) => a.role !== "ceo" && a.status !== "paused");
    let paused = 0;

    for (const agent of nonCeo) {
      try {
        await agentsSvc.pause(agent.id, "manual");
        paused++;
        publishLiveEvent({
          companyId,
          type: "agent.status",
          payload: { agentId: agent.id, status: "paused" },
        });
      } catch {
        // Skip agents that can't be paused (terminated, etc.)
      }
    }

    // Pause all active routines for non-CEO agents
    const allRoutines = await routinesSvc.list(companyId);
    const nonCeoIds = new Set(nonCeo.map((a) => a.id));
    for (const routine of allRoutines) {
      if (nonCeoIds.has(routine.assigneeAgentId) && routine.status === "active") {
        await routinesSvc.update(routine.id, { status: "paused" }, { agentId: null });
      }
    }

    return `All agents paused. ${paused} agent(s) affected.`;
  }

  async function handleResumeAll(companyId: string): Promise<string> {
    const allAgents = await agentsSvc.list(companyId);
    const pausedAgents = allAgents.filter((a) => a.role !== "ceo" && a.status === "paused");
    let resumed = 0;

    for (const agent of pausedAgents) {
      try {
        await agentsSvc.resume(agent.id);
        resumed++;
        publishLiveEvent({
          companyId,
          type: "agent.status",
          payload: { agentId: agent.id, status: "idle" },
        });
      } catch {
        // Skip agents that can't be resumed
      }
    }

    // Resume all paused routines for these agents
    const allRoutines = await routinesSvc.list(companyId);
    const pausedIds = new Set(pausedAgents.map((a) => a.id));
    for (const routine of allRoutines) {
      if (pausedIds.has(routine.assigneeAgentId) && routine.status === "paused") {
        await routinesSvc.update(routine.id, { status: "active" }, { agentId: null });
      }
    }

    return `All agents resumed. ${resumed} agent(s) reactivated.`;
  }

  async function handleUpdateAgentConfig(
    companyId: string,
    cmd: UpdateAgentConfigCommand,
    actorAgentId: string,
  ): Promise<string> {
    const agent = await findAgentByName(companyId, cmd.agent_name);
    if (!agent) return `Agent "${cmd.agent_name}" not found.`;

    const currentMetadata = (agent.metadata as Record<string, unknown>) ?? {};
    const currentSkills = Array.isArray(currentMetadata.skills) ? [...currentMetadata.skills] as string[] : [];
    const changes: string[] = [];

    // Update skills
    if (cmd.add_skills?.length) {
      for (const skill of cmd.add_skills) {
        if (!currentSkills.includes(skill)) {
          currentSkills.push(skill);
          changes.push(`added skill: ${skill}`);
        }
      }
    }
    if (cmd.remove_skills?.length) {
      for (const skill of cmd.remove_skills) {
        const idx = currentSkills.indexOf(skill);
        if (idx >= 0) {
          currentSkills.splice(idx, 1);
          changes.push(`removed skill: ${skill}`);
        }
      }
    }

    // Update custom instructions
    if (cmd.custom_instructions !== undefined) {
      changes.push("updated custom instructions");
    }

    const newMetadata = {
      ...currentMetadata,
      skills: currentSkills,
      ...(cmd.custom_instructions !== undefined
        ? { custom_instructions: cmd.custom_instructions }
        : {}),
    };

    await agentsSvc.update(agent.id, { metadata: newMetadata }, {
      recordRevision: {
        createdByAgentId: actorAgentId,
        source: "ceo_command",
      },
    });

    if (changes.length === 0) return `${agent.name} -- no changes needed.`;
    return `${agent.name} updated: ${changes.join(", ")}.`;
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  return {
    extractCommands,
    minutesToCron,

    /**
     * Process all commands found in a comment body.
     * Returns a summary string of what was executed, or null if no commands found.
     */
    processComment: async (
      companyId: string,
      commentBody: string,
      actorAgentId: string,
    ): Promise<string | null> => {
      const commands = extractCommands(commentBody);
      if (commands.length === 0) return null;

      const results: string[] = [];

      for (const cmd of commands) {
        try {
          switch (cmd.action) {
            case "hire_team":
              results.push(await handleHireTeam(companyId, cmd, actorAgentId));
              break;
            case "pause_agent":
              results.push(await handlePauseAgent(companyId, cmd));
              break;
            case "resume_agent":
              results.push(await handleResumeAgent(companyId, cmd));
              break;
            case "pause_all":
              results.push(await handlePauseAll(companyId));
              break;
            case "resume_all":
              results.push(await handleResumeAll(companyId));
              break;
            case "update_agent_config":
              results.push(await handleUpdateAgentConfig(companyId, cmd, actorAgentId));
              break;
            default:
              results.push(`Unknown command action: ${(cmd as { action: string }).action}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err, action: cmd.action }, "ceo-commands: command execution failed");
          results.push(`Command ${cmd.action} failed: ${message}`);
        }
      }

      return results.join("\n\n");
    },
  };
}
