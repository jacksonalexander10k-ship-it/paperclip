import { cn } from "@/lib/utils";
import { GLASS } from "./glass";
import type { ToolUsage } from "./ThinkingBlock";

const GENERIC_SUGGESTIONS = [
  "Show me the hottest leads",
  "What should I focus on today?",
  "Draft a follow-up message",
];

// Context-aware suggestions keyed by the most recent tool / CEO command.
// Unknown tools fall through to generic.
const TOOL_SUGGESTIONS: Record<string, string[]> = {
  hire_team: [
    "Show me what each agent is doing",
    "Set guardrails for the team",
    "Draft the team's first tasks",
  ],
  create_task: [
    "Show me all active tasks",
    "Who's assigned to this?",
    "Bump the priority",
  ],
  pause_agent: ["Resume the agent", "Explain why this was paused"],
  resume_agent: ["What did it work on today?", "Show recent activity"],
  pause_all: ["Resume all agents", "Why did everything pause?"],
  search_projects: [
    "Generate a pitch deck for this",
    "Compare these projects",
    "Send details to a lead",
  ],
  search_leads: [
    "Draft a follow-up to the hot leads",
    "Score these leads",
    "Assign to a broker",
  ],
  update_agent_config: ["Show current config", "Revert last change"],
};

interface Props {
  onSuggestionClick: (text: string) => void;
  toolsUsed?: ToolUsage[];
}

export function SuggestionChips({ onSuggestionClick, toolsUsed = [] }: Props) {
  const lastTool = toolsUsed.length > 0 ? toolsUsed[toolsUsed.length - 1] : null;
  const suggestions =
    (lastTool && TOOL_SUGGESTIONS[lastTool.name]) || GENERIC_SUGGESTIONS;

  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSuggestionClick(s)}
          className={cn(
            "rounded-full px-3 py-1 text-xs text-foreground/70",
            GLASS.interactive,
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
