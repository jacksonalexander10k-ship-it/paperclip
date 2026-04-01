import { useQuery } from "@tanstack/react-query";
import { agentMessagesApi, type AgentMessage } from "@/api/agent-messages";
import { agentsApi } from "@/api/agents";
import { queryKeys } from "@/lib/queryKeys";
import { relativeTime } from "@/lib/utils";
import { Lightbulb, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import type { Agent } from "@paperclipai/shared";

interface AgentInsightBannerProps {
  companyId: string;
}

/**
 * Shows a banner at the top of CEO Chat when agents have recently coordinated
 * on something that produced actionable output (action/urgent messages).
 */
export function AgentInsightBanner({ companyId }: AgentInsightBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: messages } = useQuery({
    queryKey: queryKeys.agentMessages.recent(companyId),
    queryFn: () => agentMessagesApi.listRecent(companyId, 10),
    refetchInterval: 30_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const agentName = (id: string) =>
    (agents as Agent[] | undefined)?.find((a: Agent) => a.id === id)?.name ?? "Agent";

  // Find recent action/urgent messages (these are the "insights")
  const insights = (messages ?? [])
    .filter(
      (m: AgentMessage) =>
        (m.priority === "action" || m.priority === "urgent") &&
        !dismissed.has(m.id),
    )
    .slice(0, 3);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {insights.map((msg: AgentMessage) => (
        <div
          key={msg.id}
          className="relative rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-3"
        >
          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed((prev) => new Set(prev).add(msg.id))}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                Agency Insight
              </p>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{agentName(msg.fromAgentId)}</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span className="font-medium text-foreground">
                  {msg.toAgentId ? agentName(msg.toAgentId) : "All Agents"}
                </span>
                <span className="ml-1">({msg.messageType})</span>
                <span className="ml-auto">{relativeTime(msg.createdAt)}</span>
              </div>
              {msg.summary && (
                <p className="text-xs text-foreground leading-relaxed">{msg.summary}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
