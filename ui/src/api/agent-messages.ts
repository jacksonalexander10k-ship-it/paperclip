import { api } from "./client";

export interface AgentMessage {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string | null;
  priority: "info" | "action" | "urgent";
  messageType: string;
  summary: string | null;
  data: Record<string, unknown> | null;
  readByAgents: string[];
  actedOn: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface NetworkEdge {
  fromAgentId: string;
  toAgentId: string | null;
  count: number;
}

export const agentMessagesApi = {
  listRecent: (companyId: string, limit = 50) =>
    api.get<AgentMessage[]>(
      `/companies/${encodeURIComponent(companyId)}/agent-messages?limit=${limit}`,
    ),

  listBetween: (companyId: string, agentA: string, agentB: string, limit = 20) =>
    api.get<AgentMessage[]>(
      `/companies/${encodeURIComponent(companyId)}/agent-messages/between?agentA=${encodeURIComponent(agentA)}&agentB=${encodeURIComponent(agentB)}&limit=${limit}`,
    ),

  networkStats: (companyId: string, days = 7) =>
    api.get<NetworkEdge[]>(
      `/companies/${encodeURIComponent(companyId)}/agent-messages/network?days=${days}`,
    ),
};
