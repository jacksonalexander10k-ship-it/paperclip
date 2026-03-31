import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { ShieldCheck } from "lucide-react";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { approvalLabel, typeIcon, defaultTypeIcon } from "./ApprovalPayload";
import { Button } from "@/components/ui/button";
import type { Agent } from "@paperclipai/shared";

export function PendingApprovalsBanner({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(companyId),
    queryFn: () => approvalsApi.list(companyId),
    refetchInterval: 15_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const pending = (approvals ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  );

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) }),
  });

  if (pending.length === 0) return null;

  const agentMap = new Map<string, Agent>();
  for (const a of agents ?? []) agentMap.set(a.id, a);

  const shown = pending.slice(0, 3);
  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden shadow-[0_0_0_1px_hsl(var(--primary)/0.05)] backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-primary/5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Needs Your Attention</span>
        </div>
        {pending.length > 3 && (
          <Link
            to="/approvals/pending"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See all {pending.length} →
          </Link>
        )}
      </div>
      <div className="divide-y divide-border">
        {shown.map((approval) => {
          const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
          const label = approvalLabel(
            approval.type,
            approval.payload as Record<string, unknown> | null,
          );
          const agent = approval.requestedByAgentId
            ? agentMap.get(approval.requestedByAgentId)
            : null;

          return (
            <div key={approval.id} className="flex items-center gap-3 px-4 py-2.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate">{label}</span>
                {agent && (
                  <span className="text-xs text-muted-foreground ml-1.5">· {agent.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                  disabled={isBusy}
                  onClick={() => approveMutation.mutate(approval.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                  disabled={isBusy}
                  onClick={() => rejectMutation.mutate(approval.id)}
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {pending.length > 3 && (
        <div className="px-4 py-2 border-t border-border">
          <Link
            to="/approvals/pending"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            +{pending.length - 3} more approval{pending.length - 3 !== 1 ? "s" : ""} waiting →
          </Link>
        </div>
      )}
    </div>
  );
}