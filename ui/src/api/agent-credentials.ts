import { api } from "./client";

export interface AgentWhatsAppStatus {
  connected: boolean;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  connectedAt: string | null;
}

export interface AgentGmailStatus {
  connected: boolean;
  gmailAddress: string | null;
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

  /** Get Gmail connection status for an agent */
  getGmailStatus: (agentId: string) =>
    api.get<AgentGmailStatus>(`/agents/${agentId}/connect/gmail`),

  /** Connect Gmail to an agent (manual token entry or OAuth callback) */
  connectGmail: (agentId: string, data: {
    accessToken: string;
    refreshToken: string;
    gmailAddress: string;
    expiresAt?: string;
  }) =>
    api.post<{ connected: boolean }>(`/agents/${agentId}/connect/gmail`, data),

  /** Disconnect Gmail from an agent */
  disconnectGmail: (agentId: string) =>
    api.delete(`/agents/${agentId}/connect/gmail`),

  /** Start Gmail OAuth flow — returns the Google OAuth URL to redirect to */
  getGmailOAuthUrl: (agentId: string) =>
    api.get<{ url: string }>(`/agents/${agentId}/connect/gmail/oauth-url`),

  /** List all credentials for an agent */
  list: (agentId: string) =>
    api.get<Array<{ id: string; service: string; connectedAt: string | null }>>(`/agents/${agentId}/credentials`),
};
