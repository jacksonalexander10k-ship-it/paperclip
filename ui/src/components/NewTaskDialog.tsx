import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function NewTaskDialog() {
  const { newIssueOpen, newIssueDefaults, closeNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newIssueOpen,
  });

  useEffect(() => {
    if (newIssueOpen) {
      setTitle(newIssueDefaults.title ?? "");
      setDescription(newIssueDefaults.description ?? "");
      setAssigneeAgentId(newIssueDefaults.assigneeAgentId ?? "");
      setPriority(newIssueDefaults.priority ?? "medium");
    }
  }, [newIssueOpen, newIssueDefaults]);

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      issuesApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      pushToast({ title: "Task created" });
      reset();
      closeNewIssue();
    },
  });

  function reset() {
    setTitle("");
    setDescription("");
    setAssigneeAgentId("");
    setPriority("medium");
  }

  function handleSubmit() {
    if (!selectedCompanyId || !title.trim() || createTask.isPending) return;
    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status: "todo",
      priority,
      assigneeAgentId: assigneeAgentId || undefined,
    });
  }

  return (
    <Dialog
      open={newIssueOpen}
      onOpenChange={(open) => {
        if (!open && !createTask.isPending) closeNewIssue();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="sm:max-w-md gap-0 p-0"
        onEscapeKeyDown={(e) => {
          if (createTask.isPending) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">New Task</DialogTitle>
        <div className="p-4 space-y-3">
          <div className="text-sm font-semibold">New Task</div>

          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />

          <div className="flex gap-2">
            <select
              value={assigneeAgentId}
              onChange={(e) => setAssigneeAgentId(e.target.value)}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Unassigned</option>
              {(agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-28 h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {createTask.isError && (
            <p className="text-xs text-destructive">
              {createTask.error instanceof Error
                ? createTask.error.message
                : "Failed to create task."}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => closeNewIssue()}
            disabled={createTask.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || createTask.isPending}
            onClick={handleSubmit}
          >
            {createTask.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
