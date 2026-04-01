import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentLearningsApi, type AgentLearning } from "@/api/agent-learnings";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Trash2, Archive, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentLearningsTabProps {
  agentId: string;
  companyId: string;
}

export function AgentLearningsTab({ agentId, companyId }: AgentLearningsTabProps) {
  const queryClient = useQueryClient();

  const { data: learnings, isLoading } = useQuery({
    queryKey: queryKeys.agentLearnings.list(companyId, agentId),
    queryFn: () => agentLearningsApi.list(companyId, agentId),
  });

  const { data: stats } = useQuery({
    queryKey: queryKeys.agentLearnings.stats(companyId, agentId),
    queryFn: () => agentLearningsApi.stats(companyId, agentId),
  });

  const deactivateMutation = useMutation({
    mutationFn: (learningId: string) =>
      agentLearningsApi.deactivate(companyId, learningId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.list(companyId, agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.stats(companyId, agentId) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (learningId: string) =>
      agentLearningsApi.remove(companyId, learningId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.list(companyId, agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.stats(companyId, agentId) });
    },
  });

  const compactMutation = useMutation({
    mutationFn: () => agentLearningsApi.compact(companyId, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.list(companyId, agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentLearnings.stats(companyId, agentId) });
    },
  });

  const activeLearnings = learnings?.filter((l) => l.active) ?? [];
  const archivedLearnings = learnings?.filter((l) => !l.active) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Active Learnings" value={stats.active} />
          <StatCard label="Corrections" value={stats.corrections} />
          <StatCard label="Rejections" value={stats.rejections} />
          <StatCard label="Times Applied" value={stats.totalApplied} />
        </div>
      )}

      {/* What I've Learned summary */}
      {activeLearnings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              What This Agent Has Learned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {activeLearnings
              .filter((l) => l.type === "compacted")
              .map((l) => (
                <p key={l.id} className="text-sm text-muted-foreground">
                  <Sparkles className="h-3 w-3 inline mr-1 text-amber-500" />
                  {l.corrected}
                </p>
              ))}
            {activeLearnings.filter((l) => l.type === "compacted").length === 0 && (
              <p className="text-sm text-muted-foreground">
                No compacted insights yet. Raw corrections are active and being applied to each run.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active learnings list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Active Learnings ({activeLearnings.length})
          </h3>
          {activeLearnings.length >= 20 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => compactMutation.mutate()}
              disabled={compactMutation.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {compactMutation.isPending ? "Compacting..." : "Compact"}
            </Button>
          )}
        </div>

        {activeLearnings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No learnings yet. This agent will start learning when you edit or reject its approval cards.
            </CardContent>
          </Card>
        )}

        {activeLearnings.map((learning) => (
          <LearningCard
            key={learning.id}
            learning={learning}
            onDeactivate={() => deactivateMutation.mutate(learning.id)}
            onRemove={() => removeMutation.mutate(learning.id)}
          />
        ))}
      </div>

      {/* Archived learnings */}
      {archivedLearnings.length > 0 && (
        <details className="group">
          <summary className="text-sm font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
            Archived ({archivedLearnings.length})
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {archivedLearnings.map((learning) => (
              <LearningCard
                key={learning.id}
                learning={learning}
                onRemove={() => removeMutation.mutate(learning.id)}
                archived
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function LearningCard({
  learning,
  onDeactivate,
  onRemove,
  archived,
}: {
  learning: AgentLearning;
  onDeactivate?: () => void;
  onRemove: () => void;
  archived?: boolean;
}) {
  const typeColors: Record<string, string> = {
    correction: "bg-blue-500/10 text-blue-600",
    rejection: "bg-red-500/10 text-red-600",
    compacted: "bg-amber-500/10 text-amber-600",
    observation: "bg-green-500/10 text-green-600",
    outcome: "bg-purple-500/10 text-purple-600",
  };

  return (
    <Card className={cn(archived && "opacity-60")}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded",
                  typeColors[learning.type] ?? "bg-muted text-muted-foreground",
                )}
              >
                {learning.type}
              </span>
              {learning.actionType && (
                <span className="text-xs text-muted-foreground">
                  {learning.actionType}
                </span>
              )}
              {learning.appliedCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  Applied {learning.appliedCount}x
                </span>
              )}
            </div>

            {learning.type === "correction" && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground line-through truncate">
                  {learning.original}
                </p>
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3 text-green-500 shrink-0" />
                  <p className="text-sm text-foreground truncate">
                    {learning.corrected}
                  </p>
                </div>
              </div>
            )}

            {learning.type === "rejection" && (
              <p className="text-sm text-muted-foreground line-through truncate">
                {learning.original}
              </p>
            )}

            {learning.type === "compacted" && (
              <p className="text-sm text-foreground">{learning.corrected}</p>
            )}

            {learning.reason && (
              <p className="text-xs text-muted-foreground italic">
                Reason: {learning.reason}
              </p>
            )}

            {learning.context && (
              <p className="text-xs text-muted-foreground">{learning.context}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!archived && onDeactivate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onDeactivate}
                title="Archive this learning"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onRemove}
              title="Delete this learning"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
