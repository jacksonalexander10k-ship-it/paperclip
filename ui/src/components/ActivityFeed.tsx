import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { formatClockTime } from "../lib/format-time";
import { activityIconAndColor } from "./LiveActivityPanel";

// Re-export so callers that build ActivityEntry rows can use the same
// user-friendly formatter used by LiveActivityPanel (bug 16).
export { formatActivityEvent, activityIconAndColor } from "./LiveActivityPanel";
export type { FormattedActivity } from "./LiveActivityPanel";

/** Professional colour palette for agent names in the feed. */
const AGENT_COLORS = [
  "text-slate-600 dark:text-slate-400",
  "text-blue-600 dark:text-blue-400",
  "text-cyan-700 dark:text-cyan-400",
  "text-teal-600 dark:text-teal-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-violet-600 dark:text-violet-400",
  "text-rose-600 dark:text-rose-400",
  "text-amber-700 dark:text-amber-400",
] as const;

const MAX_ENTRIES = 100;

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  agentName: string;
  agentId: string;
  action: string;
  /** Optional icon/symbol prefix. */
  icon?: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
  className?: string;
}

function formatTime(date: Date): string {
  return formatClockTime(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Deterministic colour for an agent based on their ID.
 * Ensures the same agent always gets the same colour.
 */
function agentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

export function ActivityFeed({ entries, className }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const prevCountRef = useRef(entries.length);

  // Auto-scroll to bottom when new entries appear (unless user is hovering)
  useEffect(() => {
    if (isHovering) return;
    if (entries.length <= prevCountRef.current && prevCountRef.current > 0) {
      prevCountRef.current = entries.length;
      return;
    }
    prevCountRef.current = entries.length;

    const el = scrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [entries.length, isHovering]);

  const onMouseEnter = useCallback(() => setIsHovering(true), []);
  const onMouseLeave = useCallback(() => {
    setIsHovering(false);
    // Snap to bottom on mouse leave
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  const visibleEntries = entries.slice(-MAX_ENTRIES);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto scrollbar-auto-hide",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {visibleEntries.length === 0 && (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-8">
          No activity yet
        </div>
      )}
      <div className="flex flex-col gap-px p-2">
        {visibleEntries.map((entry, i) => {
          const { Icon: RowIcon, color: rowColor } = activityIconAndColor(entry.action);
          return (
            <div
              key={entry.id}
              className={cn(
                "flex items-start gap-2 px-2 py-1 rounded text-xs transition-opacity duration-300",
                i === visibleEntries.length - 1 && "animate-[fade-in_0.3s_ease-out]",
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground shrink-0 pt-px w-[60px]">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={cn(
                  "shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-muted/50 mt-px",
                  rowColor,
                )}
                aria-hidden="true"
              >
                <RowIcon className="w-3 h-3" />
              </span>
              <span
                className={cn(
                  "font-medium shrink-0 max-w-[90px] truncate",
                  agentColor(entry.agentId),
                )}
              >
                {entry.agentName}
              </span>
              <span className="text-foreground/80 min-w-0 break-words">
                {entry.icon && <span className="mr-1">{entry.icon}</span>}
                {entry.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
