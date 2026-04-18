/**
 * CEO Command Handler
 *
 * Detects and executes structured commands emitted by the CEO agent
 * in comment bodies. Commands are wrapped in ```paperclip-command fenced blocks.
 */

import type { Db } from "@paperclipai/db";
import { and, eq, gte, inArray, desc } from "drizzle-orm";
import { issues as issuesTable } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { issueService } from "./issues.js";
import { routineService } from "./routines.js";
import { projectService } from "./projects.js";
import { publishLiveEvent } from "./live-events.js";
import { heartbeatService } from "./heartbeat.js";
import {
  startOutreachForAssignedLead,
  findTemplateByName,
  getLeadsForOutreach,
} from "./outreach.js";
import { leadService } from "./leads.js";
import { AGENT_ROLES, getRole } from "./agent-roles.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HireAgentSpec {
  name: string;
  role: string;
  title: string;
  heartbeat_minutes: number;
  department?: string;
  skills?: string[];
  tool_groups?: string[];
  custom_instructions?: string;
}

interface HireTeamCommand {
  action: "hire_team";
  agents: HireAgentSpec[];
  departments?: HireDepartmentSpec[];
}

interface HireDepartmentSpec {
  name: string;
  title: string;
  /** Which agent names from the agents array belong to this department */
  members: string[];
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

interface CreateTaskCommand {
  action: "create_task";
  title: string;
  description?: string;
  assignee?: string;
  priority?: string;
}

interface StartOutreachCommand {
  action: "start_outreach";
  leadIds: string[];
  /** Pick a template from the company library by name (preferred) */
  templateName?: string;
  /** Or pass an explicit template UUID */
  templateId?: string;
  /** Or write a one-off message with {{vars}} */
  customMessage?: string;
  /** Sales agent name to assign + send from. Defaults to first sales agent. */
  assignee?: string;
  /** Send delay seconds (default 5 for demo, use 60 in prod) */
  delaySecs?: number;
}

interface SaveProfileCommand {
  action: "save_profile";
  /** Short label e.g. "Booker", "Concierge" */
  name: string;
  /** One-line description */
  tagline: string;
  /** sales | content | etc. — defaults to sales if omitted */
  appliesToRole?: string;
  /** Profile config */
  goal: string;
  secondary?: string;
  tone?: string;
  cadence?: string;
  handoffRules?: string;
  dontDo?: string;
  custom?: string;
  /** If set, immediately apply this profile to the named agent after saving */
  applyToAgent?: string;
}

interface ApplyProfileCommand {
  action: "apply_profile";
  agentName: string;
  /** Apply by template name (e.g. "Concierge") or by id */
  profileName?: string;
  profileId?: string;
}

type CeoCommand =
  | HireTeamCommand
  | PauseAgentCommand
  | ResumeAgentCommand
  | PauseAllCommand
  | ResumeAllCommand
  | UpdateAgentConfigCommand
  | CreateTaskCommand
  | StartOutreachCommand
  | SaveProfileCommand
  | ApplyProfileCommand;

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

    // Step 1: Create department managers (paused, cosmetic — zero cost)
    const deptManagerIds = new Map<string, string>(); // dept name → manager agent ID

    if (cmd.departments && cmd.departments.length > 0) {
      for (const dept of cmd.departments) {
        try {
          const manager = await agentsSvc.create(companyId, {
            name: dept.name,
            role: "general",
            title: dept.title,
            reportsTo: ceoId,
            adapterType: "gemini_local",
            adapterConfig: {},
            runtimeConfig: {},
            status: "paused",
            pauseReason: "cosmetic",
            capabilities: null,
            budgetMonthlyCents: 500,
            metadata: {
              isDepartmentManager: true,
              departmentMembers: dept.members,
            },
            permissions: undefined,
          });
          deptManagerIds.set(dept.name, manager.id);

          publishLiveEvent({
            companyId,
            type: "agent.status",
            payload: { agentId: manager.id, status: "paused" },
          });

          results.push(`📁 ${dept.name} (${dept.title}) — department created`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err, dept: dept.name }, "ceo-commands: failed to create department manager");
          results.push(`📁 ${dept.name} — FAILED: ${message}`);
        }
      }
    }

    // Step 2: Create worker agents
    // Build a lookup: agent name → department manager ID
    const agentToDeptManager = new Map<string, string>();
    if (cmd.departments) {
      for (const dept of cmd.departments) {
        const managerId = deptManagerIds.get(dept.name);
        if (managerId) {
          for (const memberName of dept.members) {
            agentToDeptManager.set(memberName.toLowerCase(), managerId);
          }
        }
      }
    }

    for (const spec of cmd.agents) {
      try {
        // Determine who this agent reports to:
        // 1. If a department was specified on the agent spec, use that manager
        // 2. If the agent's name matches a department's members list, use that manager
        // 3. Fall back to CEO
        let reportsTo = ceoId;
        if (spec.department && deptManagerIds.has(spec.department)) {
          reportsTo = deptManagerIds.get(spec.department)!;
        } else {
          const deptManagerId = agentToDeptManager.get(spec.name.toLowerCase());
          if (deptManagerId) reportsTo = deptManagerId;
        }

        // Budget per agent scales by role — customer-facing agents cost more
        const roleBudgets: Record<string, number> = {
          sales: 3000,     // $30/mo — highest volume (lead response, follow-ups)
          content: 2000,   // $20/mo — daily content generation
          marketing: 1500, // $15/mo — market sweeps, reports
          viewing: 1000,   // $10/mo — scheduling only, low volume
          finance: 1000,   // $10/mo — daily checks, low volume
          calling: 1500,   // $15/mo — call handling
          general: 2000,   // $20/mo — default
        };
        const agentBudget = roleBudgets[spec.role] ?? 2000;

        // Create the agent
        const created = await agentsSvc.create(companyId, {
          name: spec.name,
          role: spec.role,
          title: spec.title,
          reportsTo,
          adapterType: "claude_local",
          adapterConfig: {},
          runtimeConfig: {
            heartbeatIntervalSec: spec.heartbeat_minutes * 60,
            wakeOnDemand: true,
          },
          status: "idle",
          capabilities: null,
          budgetMonthlyCents: agentBudget,
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

        const deptLabel = reportsTo !== ceoId ? ` → reports to ${cmd.departments?.find(d => deptManagerIds.get(d.name) === reportsTo)?.name ?? "manager"}` : "";
        results.push(`${spec.name} (${spec.title}) — hired, heartbeat every ${spec.heartbeat_minutes}m${deptLabel}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err, agentSpec: spec.name }, "ceo-commands: failed to hire agent");
        results.push(`${spec.name} — FAILED: ${message}`);
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
  // start_outreach
  // -------------------------------------------------------------------------

  async function handleStartOutreach(
    companyId: string,
    cmd: StartOutreachCommand,
    actorAgentId: string,
  ): Promise<string> {
    if (!Array.isArray(cmd.leadIds) || cmd.leadIds.length === 0) {
      return `start_outreach failed: leadIds required`;
    }

    const allAgents = await agentsSvc.list(companyId);

    // Resolve assignee — MUST be a sales-role agent (canonical roster enforcement)
    let assignee = cmd.assignee
      ? allAgents.find((a) => a.name.toLowerCase() === cmd.assignee!.toLowerCase())
      : allAgents
          .filter((a) => a.role === "sales" && a.status !== "paused")
          .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (!assignee) {
      return `start_outreach failed: no sales agent available${cmd.assignee ? ` (looked for "${cmd.assignee}")` : ""}. Only the Sales Agent can do outreach — hire one or pick a different action.`;
    }

    // Enforce: only role="sales" can do outreach
    if (assignee.role !== "sales") {
      const salesAgents = allAgents.filter((a) => a.role === "sales" && a.status !== "paused");
      const suggestion = salesAgents.length
        ? ` Sales agents available: ${salesAgents.map((a) => a.name).join(", ")}.`
        : ` No Sales Agent on the team — hire one first.`;
      const roleLabel = getRole(assignee.role)?.title ?? assignee.role;
      return `start_outreach blocked: ${assignee.name} is a ${roleLabel}, not a Sales Agent. Only Sales Agents can do outreach.${suggestion}`;
    }

    // Resolve template (by name OR explicit ID)
    let templateId = cmd.templateId;
    if (!templateId && cmd.templateName) {
      const tpl = await findTemplateByName(db, companyId, cmd.templateName);
      if (!tpl) {
        return `start_outreach failed: template "${cmd.templateName}" not found`;
      }
      templateId = tpl.id;
    }

    // Assign all leads to the chosen agent first (so they show up in his queue)
    const leadsSvc = leadService(db);
    await leadsSvc.bulkAssign(companyId, cmd.leadIds, assignee.id);

    // Then queue outreach for each
    const candidates = await getLeadsForOutreach(db, companyId, cmd.leadIds);
    let enqueued = 0;
    let skipped = 0;
    for (const lead of candidates) {
      const r = await startOutreachForAssignedLead(
        db,
        companyId,
        lead,
        {
          templateId,
          customMessage: cmd.customMessage,
          delaySecs: cmd.delaySecs ?? 5,
        },
      );
      if (r.enqueued) enqueued++;
      else skipped++;
    }

    publishLiveEvent({
      companyId,
      type: "activity.logged",
      payload: {
        action: "ceo.delegated_outreach",
        assignee: assignee.name,
        enqueued,
        skipped,
        templateId: templateId ?? null,
      },
    });

    const what = cmd.templateName
      ? `using template "${cmd.templateName}"`
      : cmd.customMessage
        ? `using a custom message`
        : `using the default rule`;
    return `Outreach delegated to ${assignee.name} ${what} — ${enqueued} queued, ${skipped} skipped (${cmd.leadIds.length - candidates.length} of ${cmd.leadIds.length} leads ineligible: missing phone or unassigned)`;
  }

  // -------------------------------------------------------------------------
  // create_task
  // -------------------------------------------------------------------------

  async function handleCreateTask(
    companyId: string,
    cmd: CreateTaskCommand,
    actorAgentId: string,
  ): Promise<string> {
    const issueSvc = issueService(db);
    const allAgents = await agentsSvc.list(companyId);

    let assigneeAgentId: string | undefined;
    if (cmd.assignee) {
      const match = allAgents.find(
        (a) => a.name.toLowerCase() === cmd.assignee!.toLowerCase(),
      );
      if (match) assigneeAgentId = match.id;
    }

    // ── Dedup guard ──────────────────────────────────────────────────────
    // Prevent CEO from issuing duplicate "process newly assigned leads"-style
    // tasks that pile up in an agent's queue when the underlying queue isn't
    // draining. If an open task with a matching normalised title exists for
    // this assignee in the last 48h, reuse it instead of creating a new one.
    const normalisedTitle = cmd.title.trim().toLowerCase().replace(/\s+/g, " ");
    const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const conditions = [
      eq(issuesTable.companyId, companyId),
      inArray(issuesTable.status, ["todo", "in_progress"]),
      gte(issuesTable.createdAt, windowStart),
    ];
    if (assigneeAgentId) {
      conditions.push(eq(issuesTable.assigneeAgentId, assigneeAgentId));
    }
    const existingOpen = await db
      .select({ id: issuesTable.id, title: issuesTable.title })
      .from(issuesTable)
      .where(and(...conditions))
      .orderBy(desc(issuesTable.createdAt))
      .limit(10);
    const duplicate = existingOpen.find(
      (row) => row.title.trim().toLowerCase().replace(/\s+/g, " ") === normalisedTitle,
    );
    if (duplicate) {
      const assigneeName =
        (assigneeAgentId && allAgents.find((a) => a.id === assigneeAgentId)?.name) ?? "unassigned";
      logger.info(
        { existingIssueId: duplicate.id, title: cmd.title, assigneeName },
        "ceo-commands: deduped create_task — reusing existing open task",
      );
      return `${assigneeName} already has this on their queue (task ${duplicate.id}). I'll bump the priority instead of duplicating.`;
    }

    const created = await issueSvc.create(companyId, {
      title: cmd.title,
      description: cmd.description ?? "",
      status: "todo",
      priority: cmd.priority ?? "medium",
      assigneeAgentId,
      createdByAgentId: actorAgentId,
      originKind: "agent",
    });

    const assignee = assigneeAgentId ? allAgents.find((a) => a.id === assigneeAgentId) : undefined;
    const assigneeName = assignee?.name ?? "unassigned";

    publishLiveEvent({
      companyId,
      type: "activity.logged",
      payload: {
        action: "issue.created",
        issueId: created.id,
        title: created.title,
        assignee: assigneeName,
      },
    });

    // ── Immediate wakeup ──────────────────────────────────────────────────
    // Don't wait up to 30s for the scheduler to tick. When CEO creates a
    // task for an assignee, wake the assignee right now so their heartbeat
    // picks it up in the next few seconds. This is the pattern the CEO
    // prompt commits to ("You'll see approval cards pop up shortly").
    if (assigneeAgentId) {
      try {
        const heartbeat = heartbeatService(db);
        void heartbeat
          .wakeup(assigneeAgentId, {
            source: "on_demand",
            reason: "ceo_delegation",
            triggerDetail: "manual",
            requestedByActorType: "agent",
            requestedByActorId: actorAgentId,
            contextSnapshot: { issueId: created.id, kind: "ceo_delegation" },
          })
          .catch((err) =>
            logger.warn(
              { err, issueId: created.id, assigneeAgentId },
              "ceo-commands: wakeup after create_task failed",
            ),
          );
      } catch (err) {
        logger.warn({ err, issueId: created.id }, "ceo-commands: could not schedule wakeup");
      }
    }

    // ── Bulletproof outreach dispatch ────────────────────────────────────
    // For ANY outreach-shaped task assigned to a sales agent, we do NOT rely
    // on the agent's heartbeat to do the work. That path is hallucination-prone
    // (agent describes work without calling tools). Instead, the server itself:
    //
    //   1. Identifies target leads (from phone in task, OR from the agent's
    //      assigned queue).
    //   2. Fires direct-agent for each lead — deterministic Gemini → approval
    //      row written by the server, not by the agent.
    //
    // The agent never gets a chance to hallucinate completion.

    const taskText = `${cmd.title} ${cmd.description ?? ""}`;
    const isOutreachTask = /reach out|message|whatsapp|contact|text|follow[- ]?up|outreach|get onto|get on to/i.test(taskText);
    const isSalesAssignee = assignee && assignee.role === "sales" && assigneeAgentId !== actorAgentId;

    if (isSalesAssignee && isOutreachTask) {
      try {
        const { directAgentService } = await import("./direct-agent.js");
        const direct = directAgentService(db);
        const agentCtx = assignee as unknown as { id: string; name: string; role: string; companyId: string; metadata: Record<string, unknown> };

        // Path 1 — explicit phone in task
        const phoneMatch = taskText.match(/\+?\d[\d\s().-]{6,}\d/);
        if (phoneMatch) {
          const phone = phoneMatch[0].replace(/[^\d+]/g, "");
          const nameMatch = taskText.match(/(?:with|to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
          void direct.respondToEvent(agentCtx, {
            kind: "ceo_delegation",
            instruction: taskText.trim(),
            phone,
            contactName: nameMatch?.[1],
          }).then((res) => logger.info({ issueId: created.id, assignee: assigneeName, approvalId: res.approvalId }, "ceo-commands: outreach dispatched (explicit phone)"))
            .catch((err) => logger.warn({ err, issueId: created.id }, "ceo-commands: outreach dispatch failed"));
          return `${assigneeName} is drafting the message now. Approval card coming in the inbox.`;
        }

        // Path 2 — vague command ("message all leads assigned", "contact her queue").
        // Rule: only target leads never contacted (lastContactAt IS NULL).
        // If the broker has unassigned leads, auto-assign them to this agent first
        // — they said "message the lead", clearly they want someone on it.
        const { aygentLeads, aygentWhatsappTemplates } = await import("@paperclipai/db");
        const { eq: eqL, and: andL, inArray: inArrayL, isNull, or } = await import("drizzle-orm");

        // Auto-assign: any company leads with no agent yet → assign to this agent.
        const unassigned = await db
          .select({ id: aygentLeads.id })
          .from(aygentLeads)
          .where(andL(
            eqL(aygentLeads.companyId, companyId),
            isNull(aygentLeads.agentId),
            inArrayL(aygentLeads.stage, ["lead", "new"]),
            isNull(aygentLeads.lastContactAt),
          ));
        let autoAssignedCount = 0;
        if (unassigned.length > 0) {
          await db
            .update(aygentLeads)
            .set({ agentId: assigneeAgentId!, updatedAt: new Date() })
            .where(inArrayL(aygentLeads.id, unassigned.map((l) => l.id)));
          autoAssignedCount = unassigned.length;
        }

        const candidates = await db
          .select()
          .from(aygentLeads)
          .where(andL(
            eqL(aygentLeads.companyId, companyId),
            eqL(aygentLeads.agentId, assigneeAgentId!),
            inArrayL(aygentLeads.stage, ["lead", "new"]),
            isNull(aygentLeads.lastContactAt),
          ))
          .limit(100);

        const actionable = candidates.filter((l) => l.phone && l.phone.trim().length > 0);

        if (actionable.length === 0) {
          return `${assigneeName} has no new leads to contact. They've all been messaged already, or none exist yet.`;
        }

        // Pick the template to follow. Preference order:
        //   1. default template (any category)
        //   2. first_touch template
        //   3. any template the user has
        const templates = await db
          .select()
          .from(aygentWhatsappTemplates)
          .where(eqL(aygentWhatsappTemplates.companyId, companyId));
        const defaultTemplate =
          templates.find((t) => t.isDefault) ??
          templates.find((t) => t.category === "first_touch") ??
          templates[0] ??
          null;

        // Fire direct-agent for each (parallel, fire-and-forget).
        for (const lead of actionable) {
          void direct.respondToEvent(agentCtx, {
            kind: "ceo_delegation",
            instruction: `${cmd.title}. ${cmd.description ?? ""}`.trim(),
            leadId: lead.id,
            templateId: defaultTemplate?.id,
          }).then((res) => logger.info({ issueId: created.id, leadId: lead.id, approvalId: res.approvalId, success: res.success }, "ceo-commands: outreach dispatched"))
            .catch((err) => logger.warn({ err, leadId: lead.id }, "ceo-commands: outreach failed"));
        }

        const previewNames = actionable.map((l) => l.name).slice(0, 3).join(", ");
        const extra = actionable.length > 3 ? ` and ${actionable.length - 3} more` : "";
        const templateNote = defaultTemplate ? ` Using the "${defaultTemplate.name}" template.` : "";
        const assignedNote = autoAssignedCount > 0 ? ` (Assigned ${autoAssignedCount} unassigned lead${autoAssignedCount > 1 ? "s" : ""} to ${assigneeName} first.)` : "";
        return `${assigneeName} is drafting messages to ${previewNames}${extra} now.${templateNote}${assignedNote} Approval cards coming in your inbox.`;
      } catch (err) {
        logger.error({ err, issueId: created.id }, "ceo-commands: outreach dispatch hard failure");
        return `Task created but outreach dispatch failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // Non-outreach work: wake the assignee's heartbeat as before.
    if (assigneeAgentId && assigneeAgentId !== actorAgentId) {
      const { wakeAgentNow } = await import("./agent-wakeup.js");
      await wakeAgentNow(db, companyId, assigneeAgentId, {
        reason: "ceo_delegation",
        triggerDetail: `task:${created.id}`,
        payload: { issueId: created.id, title: created.title },
        requestedBy: { actorType: "agent", actorId: actorAgentId },
      });
    }

    return `Task created: "${created.title}" → ${assigneeName}`;
  }

  // -------------------------------------------------------------------------
  // save_profile — create a new profile template, optionally apply to an agent
  // -------------------------------------------------------------------------

  async function handleSaveProfile(
    companyId: string,
    cmd: SaveProfileCommand,
  ): Promise<string> {
    const { profileTemplatesService } = await import("./profile-templates.js");
    const svc = profileTemplatesService(db);
    const created = await svc.create({
      companyId,
      name: cmd.name,
      tagline: cmd.tagline,
      appliesToRole: cmd.appliesToRole ?? "sales",
      config: {
        goal: cmd.goal,
        secondary: cmd.secondary,
        tone: cmd.tone,
        cadence: cmd.cadence,
        handoffRules: cmd.handoffRules,
        dontDo: cmd.dontDo,
        custom: cmd.custom,
      },
    });
    let applyMsg = "";
    if (cmd.applyToAgent) {
      const agent = await findAgentByName(companyId, cmd.applyToAgent);
      if (agent) {
        await svc.applyToAgent(companyId, agent.id, created.id);
        applyMsg = ` and applied to ${agent.name}`;
      }
    }
    return `Profile "${created.name}" saved${applyMsg}.`;
  }

  // -------------------------------------------------------------------------
  // apply_profile — switch an agent's profile to an existing template
  // -------------------------------------------------------------------------

  async function handleApplyProfile(
    companyId: string,
    cmd: ApplyProfileCommand,
  ): Promise<string> {
    const agent = await findAgentByName(companyId, cmd.agentName);
    if (!agent) return `Agent not found: ${cmd.agentName}`;
    const { profileTemplatesService } = await import("./profile-templates.js");
    const svc = profileTemplatesService(db);
    let templateId = cmd.profileId ?? null;
    if (!templateId && cmd.profileName) {
      const found = await svc.findByName(companyId, cmd.profileName, agent.role);
      if (!found) return `Profile not found: "${cmd.profileName}" for ${agent.role}`;
      templateId = found.id;
    }
    if (!templateId) return `apply_profile needs profileName or profileId`;
    const ok = await svc.applyToAgent(companyId, agent.id, templateId);
    if (!ok) return `Failed to apply profile to ${agent.name}`;
    const tmpl = await svc.get(companyId, templateId);
    return `Applied "${tmpl?.name}" profile to ${agent.name}.`;
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
            case "create_task":
              results.push(await handleCreateTask(companyId, cmd, actorAgentId));
              break;
            case "start_outreach":
              results.push(await handleStartOutreach(companyId, cmd, actorAgentId));
              break;
            case "save_profile":
              results.push(await handleSaveProfile(companyId, cmd));
              break;
            case "apply_profile":
              results.push(await handleApplyProfile(companyId, cmd));
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
