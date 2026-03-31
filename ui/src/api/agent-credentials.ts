import { api } from "./client";

export interface AgentWhatsAppStatus {
  connected: boolean;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  connectedAt: string | null;
}

export const agentCredentialsApi = {
  /** Get WhatsApp connection status for an agent */
  getWhatsAppStatus: (agentId: string) =>
    api.get<AgentWhatsAppStatus>(`/agents/${agentId}/connect/whatsapp`),

  /** Connect WhatsApp to an agent (manual API key entry) */
  connectWhatsApp: (agentId: string, data: { apiKey: string; phoneNumberId: string; phoneNumber?: string }) =>
    api.post<{ connected: boolean }>(`/agents/${agentId}/connect/whatsapp`, data),

  /** Disconnect WhatsApp from an agent */
  disconnectWhatsApp: (agentId: string) =>
    api.delete(`/agents/${agentId}/connect/whatsapp`),

  /** List all credentials for an agent */
  list: (agentId: string) =>
    api.get<Array<{ id: string; service: string; connectedAt: string | null }>>(`/agents/${agentId}/credentials`),
};
