import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./EmptyState";
import { TaskRow } from "./TaskRow";
import { Search, CheckCircle2, Loader2, Clock } from "lucide-react";
import type { Issue } from "@paperclipai/shared";

interface Agent {
  id: string;
  name: string;
}

interface TaskListProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
}

type Tab = "active" | "queued" | "completed";

const activeStatuses = new Set(["in_progress", "in_review"]);
const queuedStatuses = new Set(["backlog", "todo", "blocked"]);
const completedStatuses = new Set(["done", "cancelled"]);

function categorize(issue: Issue): Tab {
  if (activeStatuses.has(issue.status)) return "active";
  if (completedStatuses.has(issue.status)) return "completed";
  return "queued";
}

export function TaskList({ issues, agents, liveIssueIds }: TaskListProps) {
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const q = search.trim().toLowerCase();
    return issues.filter((i) => i.title.toLowerCase().includes(q));
  }, [issues, search]);

  const grouped = useMemo(() => {
    const active: Issue[] = [];
    const queued: Issue[] = [];
    const completed: Issue[] = [];

    for (const issue of filtered) {
      const cat = categorize(issue);
      if (cat === "active") active.push(issue);
      else if (cat === "queued") queued.push(issue);
      else completed.push(issue);
    }

    active.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    queued.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    completed.sort((a, b) => {
      const aTime = a.completedAt ?? a.cancelledAt ?? a.updatedAt;
      const bTime = b.completedAt ?? b.cancelledAt ?? b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return { active, queued, completed };
  }, [filtered]);

  const renderList = (items: Issue[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
        {items.map((issue) => (
          <TaskRow
            key={issue.id}
            issue={issue}
            agents={agents}
            isLive={liveIssueIds?.has(issue.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="flex items-center gap-3">
          <TabsList variant="line">
            <TabsTrigger value="active" className="gap-1.5">
              <Loader2 className="h-3 w-3" />
              Active
              {grouped.active.length > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {grouped.active.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="queued" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Queued
              {grouped.queued.length > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {grouped.queued.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </TabsTrigger>
          </TabsList>

          <div className="relative ml-auto w-48">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-7 text-xs h-8"
            />
          </div>
        </div>

        <TabsContent value="active" className="mt-3">
          {renderList(grouped.active, "No active tasks right now.")}
        </TabsContent>
        <TabsContent value="queued" className="mt-3">
          {renderList(grouped.queued, "Nothing queued.")}
        </TabsContent>
        <TabsContent value="completed" className="mt-3">
          {renderList(grouped.completed, "No completed tasks yet.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
