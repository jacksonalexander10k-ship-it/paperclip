import { api } from "./client";

export interface WhatsappTemplate {
  id: string;
  companyId: string;
  name: string;
  category: string | null;
  content: string | null;
  isDefault: boolean | null;
  usageCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  name: string;
  category?: string | null;
  content: string;
  isDefault?: boolean;
}

export const whatsappTemplatesApi = {
  list: (companyId: string, category?: string) =>
    api.get<WhatsappTemplate[]>(
      `/companies/${encodeURIComponent(companyId)}/whatsapp-templates${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),

  get: (companyId: string, templateId: string) =>
    api.get<WhatsappTemplate>(
      `/companies/${encodeURIComponent(companyId)}/whatsapp-templates/${encodeURIComponent(templateId)}`,
    ),

  create: (companyId: string, data: TemplateInput) =>
    api.post<WhatsappTemplate>(
      `/companies/${encodeURIComponent(companyId)}/whatsapp-templates`,
      data as unknown as Record<string, unknown>,
    ),

  update: (companyId: string, templateId: string, data: Partial<TemplateInput>) =>
    api.put<WhatsappTemplate>(
      `/companies/${encodeURIComponent(companyId)}/whatsapp-templates/${encodeURIComponent(templateId)}`,
      data as unknown as Record<string, unknown>,
    ),

  remove: (companyId: string, templateId: string) =>
    api.delete<{ deleted: boolean; id: string }>(
      `/companies/${encodeURIComponent(companyId)}/whatsapp-templates/${encodeURIComponent(templateId)}`,
    ),
};

/** Replace {{var}} placeholders client-side for live preview */
export function renderTemplate(template: string, vars: Record<string, string | undefined | null>): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key) => String(vars[key] ?? ""));
}
