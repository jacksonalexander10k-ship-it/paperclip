// ui/src/pages/KnowledgeBase.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeBaseApi, type KnowledgeBaseFile } from "../api/knowledge-base";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { FolderOpen, Upload, Trash2, FileText, Image, FileSpreadsheet, File, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return Image;
  if (contentType.includes("spreadsheet") || contentType === "text/csv") return FileSpreadsheet;
  if (contentType === "application/pdf" || contentType.startsWith("text/")) return FileText;
  return File;
}

function typeLabel(contentType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "text/markdown": "Markdown",
    "text/plain": "Text",
    "text/csv": "CSV",
    "text/html": "HTML",
    "application/json": "JSON",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  };
  return map[contentType] || contentType.split("/").pop()?.toUpperCase() || "File";
}

function RelativeDate({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return <span>Today</span>;
  if (diffDays === 1) return <span>Yesterday</span>;
  if (diffDays < 30) return <span>{diffDays}d ago</span>;
  return <span>{d.toLocaleDateString()}</span>;
}

export function KnowledgeBase() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Knowledge Base" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!),
    queryFn: () => knowledgeBaseApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const files: KnowledgeBaseFile[] = data?.files ?? [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeBaseApi.upload(selectedCompanyId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      pushToast({ title: "File uploaded", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ fileId, description }: { fileId: string; description: string }) =>
      knowledgeBaseApi.update(selectedCompanyId!, fileId, { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      setEditingId(null);
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => knowledgeBaseApi.delete(selectedCompanyId!, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      setDeletingId(null);
      pushToast({ title: "File deleted", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      for (const file of Array.from(fileList)) {
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <PageHeader
        title="Knowledge Base"
        actions={
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Drag overlay */}
      {dragActive && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto text-primary/50 mb-2" />
            <p className="text-sm font-medium text-primary/70">Drop files here</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {files.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={FolderOpen}
              message="No files uploaded yet. Add brand guides, brochures, and other documents your agents can reference."
            />
            <div
              className="rounded-xl border-2 border-dashed border-border/50 p-10 text-center cursor-pointer hover:border-border/70 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDrop={handleDrop}
            >
              <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <div className="text-sm text-muted-foreground">
                Drop files here, or{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  click Upload
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground text-xs">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Size</th>
                  <th className="text-left px-4 py-2 font-medium">Uploaded</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const Icon = fileIcon(file.contentType);
                  return (
                    <tr key={file.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{file.title || file.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {editingId === file.id ? (
                          <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              updateMutation.mutate({ fileId: file.id, description: editDesc });
                            }}
                          >
                            <input
                              className="border border-border rounded px-2 py-0.5 text-sm flex-1 bg-background"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              autoFocus
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                            />
                          </form>
                        ) : (
                          <span
                            className={cn("cursor-pointer", !file.description && "italic text-muted-foreground/50")}
                            onClick={() => { setEditingId(file.id); setEditDesc(file.description || ""); }}
                          >
                            {file.description || "Click to add description"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {typeLabel(file.contentType)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(file.sizeBytes)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <RelativeDate date={file.createdAt} />
                      </td>
                      <td className="px-4 py-2.5">
                        {deletingId === file.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 text-xs px-2"
                              onClick={() => deleteMutation.mutate(file.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs px-2"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => setDeletingId(file.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
