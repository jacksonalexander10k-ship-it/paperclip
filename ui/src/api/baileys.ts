import { api } from "./client";

export interface BaileysConnectResult {
  status: "disconnected" | "qr_pending" | "connecting" | "connected";
  qrDataUrl?: string;
}

export interface BaileysStatus {
  status: "disconnected" | "qr_pending" | "connecting" | "connected";
  phoneNumber?: string;
}

export const baileysApi = {
  connect: (agentId: string, companyId: string) =>
    api.post<BaileysConnectResult>(`/agents/${agentId}/baileys/connect`, { companyId }),

  status: (agentId: string) =>
    api.get<BaileysStatus>(`/agents/${agentId}/baileys/status`),

  disconnect: (agentId: string, logout = false) =>
    api.post<{ status: string; loggedOut: boolean }>(
      `/agents/${agentId}/baileys/disconnect${logout ? "?logout=true" : ""}`,
      {},
    ),

  send: (agentId: string, phone: string, message: string) =>
    api.post<{ success: boolean; messageId?: string; error?: string }>(
      `/agents/${agentId}/baileys/send`,
      { phone, message },
    ),
};
