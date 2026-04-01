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
