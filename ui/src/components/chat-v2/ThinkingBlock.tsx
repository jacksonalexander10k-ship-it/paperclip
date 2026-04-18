import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// TODO: wire tool_start/tool_result SSE events in server/src/routes/ceo-chat.ts
// to populate this. For now this component only renders when `tools.length > 0`,
// which never happens until the backend emits those events.

export interface ToolUsage {
  id: string;
  name: string;
  startedAt: number;
  completedAt?: number;
  result?: unknown;
}

interface ThinkingBlockProps {
  tools: ToolUsage[];
  isStreaming: boolean;
}

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return "<1s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function toolLabel(name: string, past = false): string {
  const pretty = name.replace(/_/g, " ");
  return past ? pretty : pretty + "...";
}

export function ThinkingBlock({ tools, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  // Once the message is no longer streaming, every tool is effectively done —
  // a missing `completedAt` just means the tool_end event was dropped, not that
  // the tool is still running. Never show a perpetual spinner after stream end.
  const allDone = !isStreaming || tools.every((t) => t.completedAt);
  const showExpanded = isStreaming || expanded;

  if (tools.length === 0) return null;

  const activeTool = isStreaming ? tools.find((t) => !t.completedAt) : undefined;
  const primaryTool = activeTool ?? tools[0]!;

  const totalElapsed =
    allDone && tools.length > 0
      ? formatElapsed(
          Math.max(...tools.map((t) => Number(t.completedAt) || 0)) -
            Math.min(...tools.map((t) => Number(t.startedAt) || 0)),
        ) || null
      : null;

  return (
    <div className="mb-2 rounded-lg border-l-2 border-primary/30 py-1.5 pl-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <div className="flex flex-1 items-center gap-1.5">
          {!allDone ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{toolLabel(primaryTool.name)}</span>
            </>
          ) : (
            <>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showExpanded && "rotate-180",
                )}
              />
              {tools.length === 1 ? (
                <span>{toolLabel(tools[0]!.name, true)}</span>
              ) : (
                <span>Used {tools.length} tools</span>
              )}
            </>
          )}
        </div>
        {totalElapsed && (
          <span className="text-muted-foreground/40">{totalElapsed}</span>
        )}
      </button>

      {showExpanded && (
        <div className="mt-1.5 space-y-0.5 pl-5 overflow-hidden transition-all duration-200 ease-out">
          {tools.map((tool, i) => {
            const isDone = !!tool.completedAt;
            const elapsed = isDone
              ? formatElapsed(Number(tool.completedAt) - Number(tool.startedAt)) || null
              : null;
            return (
              <div
                key={i}
                className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground"
              >
                {isDone ? (
                  <Sparkles className="h-3 w-3" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <span>{toolLabel(tool.name, isDone)}</span>
                {elapsed && (
                  <span className="text-muted-foreground/50">{elapsed}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
