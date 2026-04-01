import { api } from "./client";

export interface AgentLearning {
  id: string;
  companyId: string;
  agentId: string;
  approvalId: string | null;
  type: "correction" | "rejection" | "observation" | "outcome" | "compacted";
  actionType: string | null;
  context: string | null;
  original: string | null;
  corrected: string | null;
  reason: string | null;
  appliedCount: number;
  active: boolean;
  sourceIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningStats {
  total: number;
  active: number;
  corrections: number;
  rejections: number;
  totalApplied: number;
}

export const agentLearningsApi = {
  list: (companyId: string, agentId?: string) => {
    const params = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    return api.get<AgentLearning[]>(
      `/companies/${encodeURIComponent(companyId)}/agent-learnings${params}`,
    );
  },

  stats: (companyId: string, agentId?: string) => {
    const params = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    return api.get<LearningStats>(
      `/companies/${encodeURIComponent(companyId)}/agent-learnings/stats${params}`,
    );
  },

  deactivate: (companyId: string, learningId: string) =>
    api.post<AgentLearning>(
      `/companies/${encodeURIComponent(companyId)}/agent-learnings/${encodeURIComponent(learningId)}/deactivate`,
      {},
    ),

  remove: (companyId: string, learningId: string) =>
    api.delete<AgentLearning>(
      `/companies/${encodeURIComponent(companyId)}/agent-learnings/${encodeURIComponent(learningId)}`,
    ),

  compact: (companyId: string, agentId: string) =>
    api.post<{ compacted: number; insights: number } | { message: string }>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/learnings/compact`,
      {},
    ),
};
