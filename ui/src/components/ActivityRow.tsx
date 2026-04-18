import { Link } from "@/lib/router";
import { Identity } from "./Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@paperclipai/shared";

const ACTION_VERBS: Record<string, string> = {
  "issue.created": "created task",
  "issue.updated": "updated",
  "issue.checked_out": "started working on",
  "issue.released": "finished with",
  "issue.comment_added": "commented on",
  "issue.attachment_added": "attached a file to",
  "issue.attachment_removed": "removed a file from",
  "issue.document_created": "created a document for",
  "issue.document_updated": "updated a document on",
  "issue.document_deleted": "deleted a document from",
  "issue.commented": "commented on",
  "issue.deleted": "removed",
  "issue.read_marked": "viewed",
  // Agent-centric events — translate raw event types so the feed doesn't
  // render "Claire tool call Claire" or "System agent direct response".
  "tool_call": "used a tool",
  "agent.tool_call": "used a tool",
  "agent.direct_response": "replied to a message",
  "whatsapp.received": "received a WhatsApp message",
  "whatsapp.sent": "sent a WhatsApp message",
  "comment.created": "posted a comment",
  "agent.created": "hired",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "removed",
  "agent.key_created": "set up access for",
  "agent.budget_updated": "updated budget for",
  "agent.runtime_session_reset": "reset memory for",
  "heartbeat.invoked": "activated",
  "heartbeat.cancelled": "stopped",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "declined",
  "project.created": "created",
  "project.updated": "updated",
  "project.deleted": "removed",
  "goal.created": "set a goal",
  "goal.updated": "updated goal",
  "goal.deleted": "removed goal",
  "cost.reported": "logged cost for",
  "cost.recorded": "recorded cost for",
  "company.created": "set up agency",
  "company.updated": "updated agency settings",
  "company.archived": "archived",
  "company.budget_updated": "updated budget for",
  // Hide noisy internal events
  "lead.inbound_whatsapp": "received WhatsApp from",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function formatVerb(action: string, details?: Record<string, unknown> | null): string {
  if (action === "issue.updated" && details) {
    const previous = (details._previous ?? {}) as Record<string, unknown>;
    if (details.status !== undefined) {
      const from = previous.status;
      return from
        ? `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`
        : `changed status to ${humanizeValue(details.status)} on`;
    }
    if (details.priority !== undefined) {
      const from = previous.priority;
      return from
        ? `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`
        : `changed priority to ${humanizeValue(details.priority)} on`;
    }
  }
  return ACTION_VERBS[action] ?? action.replace(/[._]/g, " ");
}

function entityLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "goal": return `/goals/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface ActivityRowProps {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  className?: string;
}

export function ActivityRow({ event, agentMap, entityNameMap, entityTitleMap, className }: ActivityRowProps) {
  const verb = formatVerb(event.action, event.details);

  const isHeartbeatEvent = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatAgentId ? entityNameMap.get(`agent:${heartbeatAgentId}`) : null)
    : entityNameMap.get(`${event.entityType}:${event.entityId}`);

  const entityTitle = entityTitleMap?.get(`${event.entityType}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatAgentId
    ? `/agents/${heartbeatAgentId}/runs/${event.entityId}`
    : entityLink(event.entityType, event.entityId, name);

  const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
  const actorName = actor?.name ?? (event.actorType === "system" ? "System" : event.actorType === "user" ? "You" : event.actorId || "Unknown");

  /* .frow from C design: flex, gap:9px, padding:11px 15px, border-bottom */
  const inner = (
    <div className="flex items-center gap-[8px]">
      {/* .fdot */}
      <div className="w-[5px] h-[5px] rounded-full bg-muted-foreground/25 shrink-0" />
      {/* .ft */}
      <p className="flex-1 min-w-0 text-[12.5px] text-muted-foreground/80 leading-[1.4]">
        <span className="font-semibold text-foreground">{actorName}</span>{" "}
        {verb}{" "}
        {name && <span className="font-medium text-foreground">{name}</span>}
      </p>
      {/* .fts */}
      <span className="text-[10.5px] text-muted-foreground shrink-0 ml-auto">{timeAgo(event.createdAt)}</span>
    </div>
  );

  const classes = cn(
    "py-[10px] px-[15px] border-b border-border last:border-b-0",
    link && "cursor-pointer hover:bg-muted/30 transition-[background] duration-150",
    className,
  );

  if (link) {
    return (
      <Link to={link} className={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes}>
      {inner}
    </div>
  );
}
