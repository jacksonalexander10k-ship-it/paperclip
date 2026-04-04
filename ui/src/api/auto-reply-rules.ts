import { api } from "./client";

export interface AutoReplyRule {
  id: string;
  companyId: string;
  leadSource: string;
  replyChannel: string;
  templateId: string | null;
  fixedMessage: string | null;
  emailSubject: string | null;
  delaySecs: number;
  enabled: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutoReplyRuleInput {
  leadSource: string;
  replyChannel: string;
  templateId?: string | null;
  fixedMessage?: string | null;
  emailSubject?: string | null;
  delaySecs?: number;
  enabled?: string;
}

export type UpdateAutoReplyRuleInput = Partial<CreateAutoReplyRuleInput>;

export const autoReplyRulesApi = {
  /** List all auto-reply rules for a company */
  list: (companyId: string) =>
    api.get<AutoReplyRule[]>(`/companies/${companyId}/auto-reply-rules`),

  /** Create a new auto-reply rule */
  create: (companyId: string, data: CreateAutoReplyRuleInput) =>
    api.post<AutoReplyRule>(`/companies/${companyId}/auto-reply-rules`, data),

  /** Update an existing auto-reply rule */
  update: (companyId: string, ruleId: string, data: UpdateAutoReplyRuleInput) =>
    api.put<AutoReplyRule>(`/companies/${companyId}/auto-reply-rules/${ruleId}`, data),

  /** Delete an auto-reply rule */
  remove: (companyId: string, ruleId: string) =>
    api.delete<AutoReplyRule>(`/companies/${companyId}/auto-reply-rules/${ruleId}`),
};
