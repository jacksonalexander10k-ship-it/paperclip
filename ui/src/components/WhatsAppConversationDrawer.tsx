import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, MessageCircle } from "lucide-react";
import { whatsappApi } from "../api/whatsapp";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { Skeleton } from "@/components/ui/skeleton";

interface WhatsAppConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  chatJid: string;
  agentId?: string;
  contactName?: string;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function WhatsAppConversationDrawer({
  open,
  onClose,
  chatJid,
  agentId,
  contactName,
}: WhatsAppConversationDrawerProps) {
  const { selectedCompanyId } = useCompany();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.whatsapp.messages(selectedCompanyId, chatJid, agentId)
      : [],
    queryFn: () => whatsappApi.messages(selectedCompanyId!, chatJid, agentId),
    enabled: open && !!selectedCompanyId && !!chatJid,
  });

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group messages by date
  const groupedMessages: { date: string; messages: typeof messages }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  }

  // Extract phone from chatJid (strip @s.whatsapp.net etc)
  const phoneDisplay = chatJid.includes("@") ? chatJid.split("@")[0] : chatJid;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 h-full w-[380px] z-50 flex flex-col"
        style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.48 0.17 162 / 0.15)" }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {contactName ?? "WhatsApp Conversation"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
              {phoneDisplay}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] rounded-lg flex items-center justify-center transition-colors hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
            aria-label="Close conversation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton
                    className={`h-[52px] rounded-xl ${i % 2 === 0 ? "w-[55%]" : "w-[65%]"}`}
                  />
                </div>
              ))}
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <MessageCircle className="h-8 w-8" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
              <p className="text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                No messages yet
              </p>
            </div>
          )}

          {!isLoading && groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span
                  className="text-[10px] px-2 shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {group.date}
                </span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex mb-2 ${msg.fromMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 ${
                      msg.fromMe
                        ? "rounded-xl rounded-tr-sm"
                        : "rounded-xl rounded-tl-sm"
                    }`}
                    style={{
                      background: msg.fromMe
                        ? "oklch(0.48 0.17 162 / 0.12)"
                        : "var(--accent)",
                    }}
                  >
                    {/* Sender name for inbound messages */}
                    {!msg.fromMe && (msg.senderName ?? msg.senderPhone) && (
                      <p
                        className="text-[11px] font-bold mb-0.5 truncate"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {msg.senderName ?? msg.senderPhone}
                      </p>
                    )}

                    {/* Message content */}
                    {msg.content && (
                      <p
                        className="text-[13px] leading-[1.5] whitespace-pre-wrap break-words"
                        style={{ color: "var(--foreground)" }}
                      >
                        {msg.content}
                      </p>
                    )}

                    {/* Media indicator */}
                    {msg.mediaType && !msg.content && (
                      <p
                        className="text-[12px] italic"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        [{msg.mediaType}]
                      </p>
                    )}

                    {/* Timestamp */}
                    <p
                      className="text-[10px] mt-1 text-right"
                      style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </>
  );
}
