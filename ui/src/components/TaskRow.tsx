import { Link } from "@/lib/router";
import { StatusIcon } from "./StatusIcon";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import type { Issue } from "@paperclipai/shared";

interface Agent {
  id: string;
  name: string;
}

interface TaskRowProps {
  issue: Issue;
  agents?: Agent[];
  isLive?: boolean;
}

export function TaskRow({ issue, agents, isLive }: TaskRowProps) {
  const issuePathId = issue.identifier ?? issue.id;
  const agentName = issue.assigneeAgentId
    ? agents?.find((a) => a.id === issue.assigneeAgentId)?.name ?? null
    : null;

  return (
    <Link
      to={`/issues/${issuePathId}`}
      className={cn(
        "group flex items-center gap-3 border-b border-border/50 py-2.5 px-3 text-sm no-underline text-inherit transition-colors hover:bg-accent/50 last:border-b-0",
      )}
    >
      <StatusIcon status={issue.status} />
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      {isLive && (
        <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {agentName && (
        <span className="shrink-0 text-xs text-muted-foreground truncate max-w-[120px]">
          {agentName}
        </span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground/60 tabular-nums">
        {timeAgo(issue.updatedAt)}
      </span>
    </Link>
  );
}
