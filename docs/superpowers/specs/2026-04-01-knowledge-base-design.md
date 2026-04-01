# Agency Knowledge Base — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Overview

A company-scoped file store where agencies upload documents (brand guides, brochures, payment plans, floor plans, logos, spreadsheets, etc.) that every agent can reference during runs. Files are stored on disk via the existing storage service, indexed with an auto-generated manifest, and injected into every agent's `--add-dir` so Claude Code can discover them without loading everything into context.

## Why

Agents need to know agency-specific information that isn't in code or the database: brand colours, project brochures, commission structures, floor plans, developer assets. Currently there's no way for the agency owner to make documents universally available to all agents. This feature gives every agent access to a shared knowledge base with zero configuration per-agent.

---

## Storage

### On Disk

Files stored via the existing `StorageService` (local disk or S3 depending on config).

Object key pattern: `{companyId}/knowledge-base/{uuid}-{sanitized-filename}`

### Database Schema

New table `knowledge_base_files` in `packages/db/src/schema/`:

```sql
knowledge_base_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  filename        text NOT NULL,          -- original filename as uploaded
  title           text,                   -- optional human-friendly title
  description     text,                   -- optional description (shown in manifest)
  content_type    text NOT NULL,          -- MIME type
  size_bytes      integer NOT NULL,
  storage_key     text NOT NULL,          -- key in storage service
  uploaded_by_user_id text,               -- who uploaded it
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)
```

Indexes:
- `knowledge_base_files_company_idx` on `(company_id)`

No revision tracking. Upload and delete only.

---

## Manifest Generation

On every agent heartbeat run, a `KNOWLEDGE-BASE.md` file is generated and written into the agent's skills temp directory. This manifest tells the agent what files are available without loading them all into context.

### Manifest Format

```markdown
# Agency Knowledge Base

These files are available in the knowledge-base/ directory below this file.
Only read files that are relevant to your current task.

| File | Description | Type | Size |
|------|-------------|------|------|
| Brand-Guidelines.pdf | Agency brand colours, fonts, logo usage rules | PDF | 2.4 MB |
| Damac-Lagoons-Brochure.pdf | Project brochure with pricing, plans, renders | PDF | 5.1 MB |
| Commission-Structure.md | Internal commission rates by deal type and area | Markdown | 4 KB |
| Logo-Primary.png | Primary agency logo (transparent background) | PNG | 156 KB |
```

### Manifest Generation Logic

1. Query `knowledge_base_files` for the agent's `company_id`
2. If no files exist, skip — no manifest, no directory
3. If files exist, generate markdown table from DB records
4. Write `KNOWLEDGE-BASE.md` into the skills temp dir root
5. Create `knowledge-base/` subdirectory in the skills temp dir
6. Symlink each file from its storage location into `knowledge-base/`

---

## Agent Injection

### Where: `buildSkillsDir()` in `packages/adapters/claude-local/src/server/execute.ts`

Currently this function:
1. Creates a temp dir with `.claude/skills/` structure
2. Symlinks desired skills into it
3. Returns the temp dir path (passed to `--add-dir`)

### Changes

After the existing skill symlinking, add a new step:

1. Receive `companyId` from the agent context (already available in `agent.companyId`)
2. Call a new function `injectKnowledgeBase(skillsDir, companyId)`
3. This function:
   - Queries `knowledge_base_files` for the company
   - If empty, returns (no-op)
   - Writes `KNOWLEDGE-BASE.md` to `{skillsDir}/.claude/skills/KNOWLEDGE-BASE.md`
   - Creates `{skillsDir}/.claude/skills/knowledge-base/` directory
   - Symlinks each file from storage into that directory

### Dependencies

The `buildSkillsDir` function currently only takes `config`. It will need access to:
- `companyId` from the agent
- Database connection (to query knowledge_base_files)
- Storage service (to resolve file paths for symlinking)

These are available in the calling scope (`executeClaudeLocal`) and can be passed through.

---

## API Routes

New route file: `server/src/routes/knowledge-base.ts`

Mounted at: `/companies/:companyId/knowledge-base`

### Endpoints

**GET `/companies/:companyId/knowledge-base`**
- Returns: `{ files: KnowledgeBaseFile[] }`
- Sorted by `created_at` descending (newest first)
- Auth: company member (any role)

**POST `/companies/:companyId/knowledge-base`**
- Body: `multipart/form-data` with `file` field + optional `title`, `description` text fields
- Multer middleware (memory storage), max 10MB
- Stores file via StorageService
- Creates DB record
- Returns: created `KnowledgeBaseFile`
- Auth: Owner or Manager role

**PATCH `/companies/:companyId/knowledge-base/:fileId`**
- Body: `{ title?: string, description?: string }`
- Updates title/description only (no re-upload)
- Returns: updated `KnowledgeBaseFile`
- Auth: Owner or Manager role

**DELETE `/companies/:companyId/knowledge-base/:fileId`**
- Deletes DB record + storage file
- Returns: `{ ok: true }`
- Auth: Owner or Manager role

### Accepted File Types

Reuse existing `DEFAULT_ALLOWED_TYPES` from `attachment-types.ts` plus additions:

```
image/png, image/jpeg, image/webp, image/gif
application/pdf
text/markdown, text/plain, text/csv, text/html
application/json
application/vnd.openxmlformats-officedocument.wordprocessingml.document  (.docx)
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet        (.xlsx)
application/vnd.openxmlformats-officedocument.presentationml.presentation (.pptx)
```

Max file size: 10MB (matches existing `MAX_ATTACHMENT_BYTES`).

---

## UI

### Navigation

New sidebar item: **"Knowledge Base"** with `FolderOpen` icon (Lucide).
Position: below existing nav items, above Settings.

### Page: Knowledge Base (`ui/src/pages/KnowledgeBase.tsx`)

**Layout:**
- Page header: "Knowledge Base" title + "Upload" button
- Drag-and-drop upload zone (full-page drop target, same pattern as IssueDetail)
- File list as a table

**File List Table Columns:**
| Column | Content |
|--------|---------|
| Name | Filename (or title if set) + file type icon |
| Description | Editable inline (click to edit) |
| Type | MIME type badge (PDF, Image, Doc, etc.) |
| Size | Human-readable (KB/MB) |
| Uploaded | Relative date |
| Actions | Delete button (with confirmation) |

**Upload Flow:**
1. Click "Upload" button or drag files onto the page
2. File input accepts all allowed types, supports multiple files
3. Each file uploads immediately via POST
4. TanStack Query invalidates the list on success
5. Toast notification on success/error

**Empty State:**
"No files uploaded yet. Drag and drop files here or click Upload to add brand guides, brochures, and other documents your agents can reference."

### API Client

New file: `ui/src/api/knowledge-base.ts`

```typescript
export const knowledgeBaseApi = {
  list: (companyId: string) => api.get<{ files: KnowledgeBaseFile[] }>(`/companies/${companyId}/knowledge-base`),
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

### Query Keys

Add to `ui/src/lib/queryKeys.ts`:
```typescript
knowledgeBase: (companyId: string) => ["knowledge-base", companyId] as const,
```

---

## What It Doesn't Do

- **No folders/categories** — flat list. Add folder structure later if agencies need it.
- **No agent-specific scoping** — all agents see all files. The manifest approach means agents self-select what's relevant to their task.
- **No file preview** — download only. Preview (PDF viewer, image lightbox) is a later enhancement.
- **No versioning** — delete and re-upload. Simple.
- **No search** — small file counts per agency don't need it yet.
- **No file size quota per agency** — add when needed (track total bytes in DB, enforce on upload).

---

## File Inventory (What Gets Created/Modified)

### New Files
- `packages/db/src/schema/knowledge_base_files.ts` — DB schema
- `server/src/routes/knowledge-base.ts` — API routes
- `server/src/services/knowledge-base.ts` — service layer (manifest generation, CRUD)
- `ui/src/pages/KnowledgeBase.tsx` — UI page
- `ui/src/api/knowledge-base.ts` — API client

### Modified Files
- `packages/db/src/schema/index.ts` — export new table
- `server/src/index.ts` — register new routes
- `packages/adapters/claude-local/src/server/execute.ts` — inject knowledge base into `buildSkillsDir`
- `ui/src/App.tsx` or router config — add Knowledge Base route
- `ui/src/components/Sidebar.tsx` (or equivalent nav) — add nav item
- `ui/src/lib/queryKeys.ts` — add query key
