# Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company-scoped file store where agencies upload documents that all agents can reference during runs via an auto-generated manifest.

**Architecture:** Files uploaded via API, stored via existing StorageService (local disk/S3), tracked in `knowledge_base_files` DB table. On each agent run, the heartbeat service injects file metadata into the context snapshot, and the claude-local adapter generates a `KNOWLEDGE-BASE.md` manifest + symlinks files into the skills temp dir for `--add-dir`.

**Tech Stack:** Drizzle ORM, Express + multer, React + TanStack Query, existing StorageService, claude-local adapter

---

### Task 1: Database Schema

**Files:**
- Create: `packages/db/src/schema/knowledge_base_files.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// packages/db/src/schema/knowledge_base_files.ts
import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const knowledgeBaseFiles = pgTable(
  "knowledge_base_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    filename: text("filename").notNull(),
    title: text("title"),
    description: text("description"),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: text("uploaded_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("knowledge_base_files_company_idx").on(table.companyId),
  }),
);
```

- [ ] **Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:

```typescript
export { knowledgeBaseFiles } from "./knowledge_base_files.js";
```

- [ ] **Step 3: Generate and run migration**

```bash
cd "/Users/alexanderjackson/Aygency World" && pnpm db:generate && pnpm db:migrate
```

Expected: Migration file created, table `knowledge_base_files` exists in DB.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/knowledge_base_files.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add knowledge_base_files schema"
```

---

### Task 2: Service Layer

**Files:**
- Create: `server/src/services/knowledge-base.ts`
- Modify: `server/src/services/index.ts` (export new service)

- [ ] **Step 1: Create the knowledge base service**

```typescript
// server/src/services/knowledge-base.ts
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeBaseFiles } from "@paperclipai/db";

export interface KnowledgeBaseFile {
  id: string;
  companyId: string;
  filename: string;
  title: string | null;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function knowledgeBaseService(db: Db) {
  return {
    list: async (companyId: string): Promise<KnowledgeBaseFile[]> => {
      return db
        .select()
        .from(knowledgeBaseFiles)
        .where(eq(knowledgeBaseFiles.companyId, companyId))
        .orderBy(desc(knowledgeBaseFiles.createdAt));
    },

    create: async (input: {
      companyId: string;
      filename: string;
      title?: string | null;
      description?: string | null;
      contentType: string;
      sizeBytes: number;
      storageKey: string;
      uploadedByUserId?: string | null;
    }): Promise<KnowledgeBaseFile> => {
      const [row] = await db
        .insert(knowledgeBaseFiles)
        .values({
          companyId: input.companyId,
          filename: input.filename,
          title: input.title ?? null,
          description: input.description ?? null,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedByUserId: input.uploadedByUserId ?? null,
        })
        .returning();
      return row;
    },

    update: async (
      companyId: string,
      fileId: string,
      input: { title?: string | null; description?: string | null },
    ): Promise<KnowledgeBaseFile | null> => {
      const [row] = await db
        .update(knowledgeBaseFiles)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeBaseFiles.id, fileId),
            eq(knowledgeBaseFiles.companyId, companyId),
          ),
        )
        .returning();
      return row ?? null;
    },

    delete: async (companyId: string, fileId: string): Promise<boolean> => {
      const [row] = await db
        .delete(knowledgeBaseFiles)
        .where(
          and(
            eq(knowledgeBaseFiles.id, fileId),
            eq(knowledgeBaseFiles.companyId, companyId),
          ),
        )
        .returning({ id: knowledgeBaseFiles.id });
      return !!row;
    },

    /** Returns file metadata needed for agent manifest injection. */
    listForManifest: async (companyId: string) => {
      return db
        .select({
          filename: knowledgeBaseFiles.filename,
          title: knowledgeBaseFiles.title,
          description: knowledgeBaseFiles.description,
          contentType: knowledgeBaseFiles.contentType,
          sizeBytes: knowledgeBaseFiles.sizeBytes,
          storageKey: knowledgeBaseFiles.storageKey,
        })
        .from(knowledgeBaseFiles)
        .where(eq(knowledgeBaseFiles.companyId, companyId))
        .orderBy(knowledgeBaseFiles.filename);
    },
  };
}
```

- [ ] **Step 2: Export from services index**

Add to `server/src/services/index.ts`:

```typescript
export { knowledgeBaseService } from "./knowledge-base.js";
```

Find the existing exports in the file and add this line alongside them.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/knowledge-base.ts server/src/services/index.ts
git commit -m "feat: knowledge base service with CRUD + manifest query"
```

---

### Task 3: API Routes

**Files:**
- Create: `server/src/routes/knowledge-base.ts`
- Modify: `server/src/app.ts` (register routes)

- [ ] **Step 1: Create the routes file**

```typescript
// server/src/routes/knowledge-base.ts
import { Router } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { knowledgeBaseService } from "../services/knowledge-base.js";
import { logActivity } from "../services/index.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound, unprocessable } from "../errors.js";

const KNOWLEDGE_BASE_ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "application/pdf",
  "text/markdown", "text/plain", "text/csv", "text/html",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function isAllowedKBType(contentType: string): boolean {
  return KNOWLEDGE_BASE_ALLOWED_TYPES.includes(contentType.toLowerCase());
}

export function knowledgeBaseRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = knowledgeBaseService(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });

  // List files
  router.get("/companies/:companyId/knowledge-base", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const files = await svc.list(companyId);
    res.json({ files });
  });

  // Upload file
  router.post("/companies/:companyId/knowledge-base", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field 'file'" });
      return;
    }

    if (!isAllowedKBType(file.mimetype)) {
      res.status(422).json({ error: `File type '${file.mimetype}' is not allowed` });
      return;
    }

    const stored = await storage.putFile({
      companyId,
      namespace: "knowledge-base",
      originalFilename: file.originalname || null,
      contentType: file.mimetype,
      body: file.buffer,
    });

    const actor = getActorInfo(req);
    const record = await svc.create({
      companyId,
      filename: file.originalname || "untitled",
      title: typeof req.body?.title === "string" ? req.body.title : null,
      description: typeof req.body?.description === "string" ? req.body.description : null,
      contentType: stored.contentType,
      sizeBytes: stored.byteSize,
      storageKey: stored.objectKey,
      uploadedByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge_base_file.created",
      entityType: "knowledge_base_file",
      entityId: record.id,
      details: { filename: record.filename, contentType: record.contentType },
    });

    res.status(201).json(record);
  });

  // Update file metadata
  router.patch("/companies/:companyId/knowledge-base/:fileId", async (req, res) => {
    const { companyId, fileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const updated = await svc.update(companyId as string, fileId as string, {
      title: req.body?.title,
      description: req.body?.description,
    });

    if (!updated) {
      throw notFound("File not found");
    }

    res.json(updated);
  });

  // Delete file
  router.delete("/companies/:companyId/knowledge-base/:fileId", async (req, res) => {
    const { companyId, fileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const files = await svc.list(companyId as string);
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      throw notFound("File not found");
    }

    await storage.deleteObject(companyId as string, file.storageKey);
    await svc.delete(companyId as string, fileId as string);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: companyId as string,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge_base_file.deleted",
      entityType: "knowledge_base_file",
      entityId: fileId as string,
      details: { filename: file.filename },
    });

    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 2: Register routes in app.ts**

In `server/src/app.ts`, add the import at the top alongside other route imports:

```typescript
import { knowledgeBaseRoutes } from "./routes/knowledge-base.js";
```

Then add this line in the route registration block (after the existing `api.use(...)` calls, before the `api.use(instanceSettingsRoutes(db))`):

```typescript
  api.use(knowledgeBaseRoutes(db, opts.storageService));
```

- [ ] **Step 3: Verify server compiles**

```bash
cd "/Users/alexanderjackson/Aygency World" && pnpm build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/knowledge-base.ts server/src/app.ts
git commit -m "feat: knowledge base API routes (list, upload, update, delete)"
```

---

### Task 4: Agent Injection — Heartbeat Context + Adapter

**Files:**
- Modify: `server/src/services/heartbeat.ts` (inject KB file list into context snapshot)
- Modify: `packages/adapters/claude-local/src/server/execute.ts` (generate manifest + symlink files)

This is the core feature — making uploaded files available to agents during runs.

- [ ] **Step 1: Inject knowledge base metadata into context snapshot**

In `server/src/services/heartbeat.ts`, find the function that assembles the `contextSnapshot` before starting a run. Search for where `contextSnapshot` is built (around the `startRun` or `prepareRun` area).

Add after the existing context assembly:

```typescript
// Inject knowledge base file list for the adapter
import { knowledgeBaseService } from "./knowledge-base.js";
```

In the context assembly section, add:

```typescript
const kbSvc = knowledgeBaseService(db);
const kbFiles = await kbSvc.listForManifest(agent.companyId);
if (kbFiles.length > 0) {
  contextSnapshot.paperclipKnowledgeBase = kbFiles;
}
```

The exact location depends on where `contextSnapshot` is assembled — look for the block that builds it before passing to the adapter's `execute()`. The key is adding `paperclipKnowledgeBase` to the context object.

- [ ] **Step 2: Generate manifest and symlink files in the adapter**

In `packages/adapters/claude-local/src/server/execute.ts`, modify the `execute` function. After the line:

```typescript
const skillsDir = await buildSkillsDir(config);
```

Add the knowledge base injection:

```typescript
// Inject knowledge base files if available
const kbFiles = Array.isArray(context.paperclipKnowledgeBase)
  ? (context.paperclipKnowledgeBase as Array<{
      filename: string;
      title: string | null;
      description: string | null;
      contentType: string;
      sizeBytes: number;
      storageKey: string;
    }>)
  : [];

if (kbFiles.length > 0) {
  const kbSkillsTarget = path.join(skillsDir, ".claude", "skills");
  const kbDir = path.join(kbSkillsTarget, "knowledge-base");
  await fs.mkdir(kbDir, { recursive: true });

  // Resolve storage base directory from environment
  const storageBaseDir = process.env.PAPERCLIP_STORAGE_LOCAL_DIR
    || path.join(
      process.env.PAPERCLIP_HOME || path.join(os.homedir(), ".paperclip"),
      "instances",
      process.env.PAPERCLIP_INSTANCE_ID || "default",
      "data",
      "storage",
    );

  // Generate manifest
  const lines = [
    "# Agency Knowledge Base",
    "",
    "These files are available in the knowledge-base/ directory alongside this file.",
    "Only read files that are relevant to your current task.",
    "",
    "| File | Description | Type | Size |",
    "|------|-------------|------|------|",
  ];

  for (const file of kbFiles) {
    const desc = file.description || file.title || "—";
    const typeParts = file.contentType.split("/");
    const typeLabel = typeParts[1]?.toUpperCase() || file.contentType;
    const sizeLabel = file.sizeBytes < 1024
      ? `${file.sizeBytes} B`
      : file.sizeBytes < 1024 * 1024
        ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
        : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    lines.push(`| ${file.filename} | ${desc} | ${typeLabel} | ${sizeLabel} |`);

    // Symlink file from storage to knowledge-base dir
    const storagePath = path.resolve(storageBaseDir, file.storageKey);
    const targetPath = path.join(kbDir, file.filename);
    try {
      await fs.symlink(storagePath, targetPath);
    } catch {
      // File may not exist on disk (S3 storage) — skip symlink
      await onLog("stderr", `[paperclip] Knowledge base file not found on disk: ${file.filename}\n`);
    }
  }

  await fs.writeFile(
    path.join(kbSkillsTarget, "KNOWLEDGE-BASE.md"),
    lines.join("\n") + "\n",
    "utf-8",
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/alexanderjackson/Aygency World" && pnpm build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/heartbeat.ts packages/adapters/claude-local/src/server/execute.ts
git commit -m "feat: inject knowledge base manifest + files into agent runs"
```

---

### Task 5: UI — API Client + Query Keys

**Files:**
- Create: `ui/src/api/knowledge-base.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Create the API client**

```typescript
// ui/src/api/knowledge-base.ts
import { api } from "./client";

export interface KnowledgeBaseFile {
  id: string;
  companyId: string;
  filename: string;
  title: string | null;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const knowledgeBaseApi = {
  list: (companyId: string) =>
    api.get<{ files: KnowledgeBaseFile[] }>(`/companies/${companyId}/knowledge-base`),

  upload: (companyId: string, file: File, title?: string, description?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (description) form.append("description", description);
    return api.postForm<KnowledgeBaseFile>(`/companies/${companyId}/knowledge-base`, form);
  },

  update: (companyId: string, fileId: string, data: { title?: string; description?: string }) =>
    api.patch<KnowledgeBaseFile>(`/companies/${companyId}/knowledge-base/${fileId}`, data),

  delete: (companyId: string, fileId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/knowledge-base/${fileId}`),
};
```

- [ ] **Step 2: Add query keys**

In `ui/src/lib/queryKeys.ts`, add inside the `queryKeys` object (alongside the other top-level entries):

```typescript
  knowledgeBase: {
    list: (companyId: string) => ["knowledge-base", companyId] as const,
  },
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/knowledge-base.ts ui/src/lib/queryKeys.ts
git commit -m "feat(ui): knowledge base API client + query keys"
```

---

### Task 6: UI — Knowledge Base Page

**Files:**
- Create: `ui/src/pages/KnowledgeBase.tsx`
- Modify: `ui/src/App.tsx` (add route)
- Modify: `ui/src/components/Sidebar.tsx` (add nav item)

- [ ] **Step 1: Create the Knowledge Base page**

```tsx
// ui/src/pages/KnowledgeBase.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeBaseApi, type KnowledgeBaseFile } from "../api/knowledge-base";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { FolderOpen, Upload, Trash2, FileText, Image, FileSpreadsheet, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  const files = data?.files ?? [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeBaseApi.upload(selectedCompanyId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      toast.success("File uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ fileId, description }: { fileId: string; description: string }) =>
      knowledgeBaseApi.update(selectedCompanyId!, fileId, { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => knowledgeBaseApi.delete(selectedCompanyId!, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.list(selectedCompanyId!) });
      setDeletingId(null);
      toast.success("File deleted");
    },
    onError: (err: Error) => toast.error(err.message),
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
      className="flex flex-col h-full"
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
        icon={FolderOpen}
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
          <EmptyState
            icon={FolderOpen}
            title="No files uploaded yet"
            description="Drag and drop files here or click Upload to add brand guides, brochures, and other documents your agents can reference."
          />
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
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate font-medium">{file.title || file.filename}</span>
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
```

- [ ] **Step 2: Add route in App.tsx**

In `ui/src/App.tsx`, add the import at the top:

```typescript
import { KnowledgeBase } from "./pages/KnowledgeBase";
```

In the `boardRoutes()` function, add the route alongside other pages (after `<Route path="deliverables" ...>` for example):

```tsx
<Route path="knowledge-base" element={<KnowledgeBase />} />
```

- [ ] **Step 3: Add sidebar nav item**

In `ui/src/components/Sidebar.tsx`, add the import:

```typescript
import { FolderOpen } from "lucide-react";
```

(If `FolderOpen` is already imported, skip this.)

Find the "AGENCY" `SidebarSection` and add the Knowledge Base item before the Settings item:

```tsx
<SidebarNavItem to="/knowledge-base" label="Knowledge Base" icon={FolderOpen} />
```

- [ ] **Step 4: Verify UI compiles**

```bash
cd "/Users/alexanderjackson/Aygency World" && pnpm build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/KnowledgeBase.tsx ui/src/App.tsx ui/src/components/Sidebar.tsx
git commit -m "feat(ui): knowledge base page with drag-drop upload, inline edit, delete"
```

---

### Task 7: Manual E2E Verification

- [ ] **Step 1: Start the dev server**

```bash
cd "/Users/alexanderjackson/Aygency World" && pnpm dev
```

- [ ] **Step 2: Verify the Knowledge Base page**

1. Navigate to the sidebar — confirm "Knowledge Base" appears in the Agency section
2. Click it — confirm empty state shows
3. Click Upload — pick a PDF — confirm it appears in the table
4. Click description — type something — press Enter — confirm it saves
5. Click the delete icon — confirm the confirmation buttons appear — click Confirm
6. Drag a file onto the page — confirm it uploads

- [ ] **Step 3: Verify agent injection**

1. Ensure at least one file is in the Knowledge Base
2. Trigger an agent run (via issue assignment or manual run)
3. Check the agent's run log — look for `KNOWLEDGE-BASE.md` in the skills dir
4. Verify the agent can reference the uploaded file content

- [ ] **Step 4: Commit any fixes**

If any issues found during verification, fix and commit with appropriate message.
