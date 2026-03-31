import { api } from "./client";

export interface WhatsAppMessage {
  id: string;
  companyId: string;
  agentId: string | null;
  chatJid: string;
  messageId: string;
  fromMe: boolean;
  senderName: string | null;
  senderPhone: string | null;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  status: string | null;
  timestamp: string;
}

export const whatsappApi = {
  messages: (companyId: string, chatJid: string, agentId?: string) => {
    const params = new URLSearchParams({ chatJid });
    if (agentId) params.set("agentId", agentId);
    return api.get<WhatsAppMessage[]>(
      `/companies/${companyId}/whatsapp/messages?${params}`,
    );
  },
};
