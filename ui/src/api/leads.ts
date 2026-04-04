import { api } from "./client";

export interface Lead {
  id: string;
  companyId: string;
  agentId: string | null;
  assignedBrokerId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  budget: Record<string, unknown> | null;
  preferredAreas: string[] | null;
  propertyType: string | null;
  timeline: string | null;
  marketPreference: string | null;
  source: string | null;
  stage: string;
  notes: string | null;
  score: number;
  scoreBreakdown: Record<string, unknown> | null;
  scoredAt: string | null;
  language: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilters {
  source?: string;
  stage?: string;
  scoreMin?: number;
  scoreMax?: number;
  search?: string;
}

function buildQuery(filters?: LeadFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.scoreMin !== undefined) params.set("scoreMin", String(filters.scoreMin));
  if (filters.scoreMax !== undefined) params.set("scoreMax", String(filters.scoreMax));
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const leadsApi = {
  list: (companyId: string, filters?: LeadFilters) =>
    api.get<Lead[]>(
      `/companies/${encodeURIComponent(companyId)}/leads${buildQuery(filters)}`,
    ),

  get: (companyId: string, leadId: string) =>
    api.get<Lead>(
      `/companies/${encodeURIComponent(companyId)}/leads/${encodeURIComponent(leadId)}`,
    ),

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Lead>(`/companies/${encodeURIComponent(companyId)}/leads`, data),

  update: (companyId: string, leadId: string, data: Record<string, unknown>) =>
    api.patch<Lead>(
      `/companies/${encodeURIComponent(companyId)}/leads/${encodeURIComponent(leadId)}`,
      data,
    ),

  remove: (companyId: string, leadId: string) =>
    api.delete<Lead>(
      `/companies/${encodeURIComponent(companyId)}/leads/${encodeURIComponent(leadId)}`,
    ),

  importCsv: (companyId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.postForm<{ imported: number; errors: string[] }>(
      `/companies/${encodeURIComponent(companyId)}/leads/import-csv`,
      form,
    );
  },
};
