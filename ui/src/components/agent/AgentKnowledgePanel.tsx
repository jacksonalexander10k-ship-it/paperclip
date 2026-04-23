import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface KnowledgeFile {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  summary: string | null;
  userNotes: string | null;
  createdAt: string;
}

interface AgentKnowledgePanelProps {
  agentId: string;
  companyId: string;
}

/**
 * Drag-and-drop knowledge base uploader. Lists files agent can reference.
 * Backend routes expected:
 *   GET  /api/companies/:cid/agents/:aid/knowledge       → list files
 *   POST /api/companies/:cid/agents/:aid/knowledge       → multipart/form-data upload
 *   PATCH /api/companies/:cid/agents/:aid/knowledge/:id  → { userNotes }
 *   DELETE /api/companies/:cid/agents/:aid/knowledge/:id → delete
 */
export function AgentKnowledgePanel({ agentId, companyId }: AgentKnowledgePanelProps) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery<KnowledgeFile[]>({
    queryKey: ["agent-knowledge", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/knowledge`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/knowledge`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-knowledge", agentId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/knowledge/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-knowledge", agentId] }),
  });

  const notesMutation = useMutation({
    mutationFn: async ({ fileId, userNotes }: { fileId: string; userNotes: string }) => {
      const res = await fetch(`/api/companies/${companyId}/agents/${agentId}/knowledge/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userNotes }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-knowledge", agentId] }),
  });

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      uploadMutation.mutate(file);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border/60 hover:border-border bg-card/40",
        )}
      >
        <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
        <div className="text-[12.5px] font-medium">
          Drop files here or click to choose
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          PDF, DOCX, CSV, images — up to 20MB each
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFilePick}
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
        />
      </div>

      {uploadMutation.isPending && (
        <div className="text-[11.5px] text-muted-foreground">Uploading...</div>
      )}

      {/* File list */}
      {isLoading && <div className="text-[12px] text-muted-foreground">Loading...</div>}

      {files && files.length === 0 && (
        <div className="text-[11.5px] text-muted-foreground py-2 text-center">
          No files yet. Add brochures, price lists, area guides, FAQs — this agent will reference them when relevant.
        </div>
      )}

      {files && files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <KnowledgeFileRow
              key={file.id}
              file={file}
              onDelete={() => {
                if (confirm(`Delete "${file.filename}"?`)) deleteMutation.mutate(file.id);
              }}
              onNotesChange={(notes) => notesMutation.mutate({ fileId: file.id, userNotes: notes })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeFileRow({
  file,
  onDelete,
  onNotesChange,
}: {
  file: KnowledgeFile;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(file.userNotes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  function commit() {
    if (!notesDirty) return;
    onNotesChange(notes);
    setNotesDirty(false);
  }

  const sizeKb = Math.round(file.sizeBytes / 1024);
  const sizeDisplay = sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`;

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium truncate">{file.filename}</span>
            <span className="text-[10.5px] text-muted-foreground shrink-0">{sizeDisplay}</span>
          </div>
          {file.summary && (
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              {file.summary}
            </div>
          )}
          <input
            type="text"
            placeholder="What this file is for (optional)"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
            onBlur={commit}
            className="w-full mt-2 px-2 py-1 text-[11.5px] bg-transparent border border-border/40 rounded outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete file"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
