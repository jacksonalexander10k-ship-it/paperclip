import { useEffect, useMemo, useCallback } from "react";
import { useLocation, useSearchParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { createIssueDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { EmptyState } from "../components/EmptyState";
import { IssuesList } from "../components/IssuesList";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { CircleDot, Filter, CheckCircle2, ListTodo } from "lucide-react";

export function Issues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialog();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const initialSearch = searchParams.get("q") ?? "";
  const participantAgentId = searchParams.get("participantAgentId") ?? undefined;
  const handleSearchChange = useCallback((search: string) => {
    const trimmedSearch = search.trim();
    const currentSearch = new URLSearchParams(window.location.search).get("q") ?? "";
    if (currentSearch === trimmedSearch) return;

    const url = new URL(window.location.href);
    if (trimmedSearch) {
      url.searchParams.set("q", trimmedSearch);
    } else {
      url.searchParams.delete("q");
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, []);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const issueLinkState = useMemo(
    () =>
      createIssueDetailLocationState(
        "Issues",
        `${location.pathname}${location.search}${location.hash}`,
      ),
    [location.pathname, location.search, location.hash],
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Tasks" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "participant-agent", participantAgentId ?? "__all__"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { participantAgentId }),
    enabled: !!selectedCompanyId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="Select a company to view tasks." />;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tasks"
        actions={
          <>
            <Button variant="ghost" size="sm" className="text-[11.5px] h-7 gap-1.5">
              <Filter className="h-3 w-3" />
              Filter
            </Button>
            <Button size="sm" className="text-[11.5px] h-7" onClick={() => openNewIssue()}>
              + New Task
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Task completion summary bar */}
        {issues && issues.length > 0 && (() => {
          const total = issues.length;
          const done = issues.filter((i) => i.status === "done").length;
          const inProgress = issues.filter((i) => i.status === "in_progress").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-sm">
                <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium tabular-nums">{total}</span>
                <span className="text-muted-foreground">total</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-medium tabular-nums">{done}</span>
                <span className="text-muted-foreground">done</span>
              </div>
              {inProgress > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <CircleDot className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-medium tabular-nums">{inProgress}</span>
                  <span className="text-muted-foreground">in progress</span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
              </div>
            </div>
          );
        })()}
        <IssuesList
          issues={issues ?? []}
          isLoading={isLoading}
          error={error as Error | null}
          agents={agents}
          projects={projects}
          liveIssueIds={liveIssueIds}
          viewStateKey="paperclip:issues-view"
          issueLinkState={issueLinkState}
          initialAssignees={searchParams.get("assignee") ? [searchParams.get("assignee")!] : undefined}
          initialSearch={initialSearch}
          onSearchChange={handleSearchChange}
          onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
          searchFilters={participantAgentId ? { participantAgentId } : undefined}
        />
      </div>
    </div>
  );
}
