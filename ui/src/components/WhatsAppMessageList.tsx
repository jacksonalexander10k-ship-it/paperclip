import { useEffect, useRef, useState, useCallback } from "react";
import { Image, Video, FileText, Mic, MapPin, Phone, User, ChevronDown, Reply, Copy, Forward, Star, Pencil, Trash2, Info, X, SmilePlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhatsAppMessage } from "../api/whatsapp";
import { formatClockTime } from "../lib/format-time";

/** Internal WhatsApp types that should never be shown */
const HIDDEN_TYPES = new Set([
  "protocolMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
  "ephemeralMessage",
  "reactionMessage",
  "encReactionMessage",
]);

/** Map raw Baileys media types to friendly labels */
const MEDIA_LABELS: Record<string, { label: string; icon: typeof Image }> = {
  imageMessage: { label: "Photo", icon: Image },
  videoMessage: { label: "Video", icon: Video },
  audioMessage: { label: "Voice message", icon: Mic },
  documentMessage: { label: "Document", icon: FileText },
  documentWithCaptionMessage: { label: "Document", icon: FileText },
  stickerMessage: { label: "Sticker", icon: Image },
  locationMessage: { label: "Location", icon: MapPin },
  liveLocationMessage: { label: "Live location", icon: MapPin },
  contactMessage: { label: "Contact", icon: Phone },
  contactsArrayMessage: { label: "Contacts", icon: Phone },
};

const QUICK_REACTIONS = ["\u{1F44D}", "\u{2764}\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F64F}", "\u{1F44E}"];

/** WhatsApp-style delivery ticks: sent (single grey) / delivered (double grey) / read (double blue) */
function StatusTicks({ status }: { status: string | null }) {
  const isRead = status === "read";
  const isDelivered = status === "delivered" || status === "read";
  const color = isRead ? "#53bdeb" : "#8696a0";
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" className="ml-0.5" style={{ color }}>
      <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.457.457 0 0 0 0 .611l2.357 2.553a.463.463 0 0 0 .336.153.463.463 0 0 0 .35-.178l6.515-8.013a.392.392 0 0 0 0-.509V.653z" />
      {isDelivered && (
        <path fill="currentColor" d="M14.757.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.457.457 0 0 0 0 .611l2.357 2.553a.463.463 0 0 0 .336.153.463.463 0 0 0 .35-.178l6.515-8.013a.392.392 0 0 0 0-.509V.653z" transform="translate(-3)" />
      )}
    </svg>
  );
}

/** 15 minutes in ms */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function formatTime(timestamp: string): string {
  try {
    return formatClockTime(timestamp);
  } catch {
    return "";
  }
}

function formatFullDateTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
    return d.toLocaleDateString([], {
      day: "numeric",
      month: "long",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function isWithinEditWindow(timestamp: string): boolean {
  try {
    return Date.now() - new Date(timestamp).getTime() < EDIT_WINDOW_MS;
  } catch {
    return false;
  }
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message: WhatsAppMessage | null;
}

interface WhatsAppMessageListProps {
  messages: WhatsAppMessage[];
  isLoading: boolean;
  searchQuery?: string;
  onReplyTo?: (msg: WhatsAppMessage | null) => void;
  onReact?: (messageId: string, fromMe: boolean, emoji: string) => void;
  onDelete?: (messageId: string, fromMe: boolean, forEveryone: boolean) => void;
  onStar?: (messageId: string, fromMe: boolean) => void;
  onForward?: (messageId: string) => void;
  onEdit?: (messageId: string, newText: string) => void;
}

export function WhatsAppMessageList({
  messages,
  isLoading,
  searchQuery,
  onReplyTo,
  onReact,
  onDelete,
  onStar,
  onForward,
  onEdit,
}: WhatsAppMessageListProps) {
  const highlightMatch = (text: string): React.ReactNode => {
    if (!searchQuery?.trim() || !text) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: "#ffeb3b", color: "#000", borderRadius: 2, padding: "0 1px" }}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    messageId: null,
    message: null,
  });
  const [showReactBar, setShowReactBar] = useState(false);
  const [showDeleteSub, setShowDeleteSub] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Scroll tracking for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 120);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Close context menu on click outside, scroll, or Escape
  useEffect(() => {
    if (!contextMenu.open) return;

    const closeMenu = () => {
      setContextMenu((prev) => ({ ...prev, open: false }));
      setShowReactBar(false);
      setShowDeleteSub(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", handleKeyDown);
    scrollContainerRef.current?.addEventListener("scroll", closeMenu);

    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", handleKeyDown);
      scrollContainerRef.current?.removeEventListener("scroll", closeMenu);
    };
  }, [contextMenu.open]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, msg: WhatsAppMessage) => {
      e.preventDefault();
      e.stopPropagation();

      // Position: ensure menu stays in viewport
      const menuW = 200;
      const menuH = 320;
      let x = e.clientX;
      let y = e.clientY;
      if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
      if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;

      setContextMenu({ open: true, x, y, messageId: msg.id, message: msg });
      setShowReactBar(false);
      setShowDeleteSub(false);
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleCopy = useCallback(() => {
    if (contextMenu.message?.content) {
      navigator.clipboard.writeText(contextMenu.message.content);
    }
  }, [contextMenu.message]);

  // Determine which menu items to show for this message
  const msg = contextMenu.message;
  const isText = !!msg?.content && !msg?.mediaType;
  const canEdit = msg?.fromMe && isText && isWithinEditWindow(msg.timestamp);

  // Filter out protocol/internal messages + deleted-for-me
  const visibleMessages = messages.filter((m) => {
    if (m.deletedForMeAt) return false; // #26
    if (m.mediaType && HIDDEN_TYPES.has(m.mediaType)) return false;
    if (m.content && /^\[(protocolMessage|senderKeyDistributionMessage|messageContextInfo|ephemeralMessage|reactionMessage)\]$/.test(m.content)) return false;
    if (!m.content && !m.mediaType) return false;
    if (m.content === "" && (!m.mediaType || HIDDEN_TYPES.has(m.mediaType))) return false;
    return true;
  });

  // Count hidden-because-decrypt-failed messages so we can warn the user
  const decryptFailCount = messages.filter((m) => {
    if (m.fromMe) return false;
    if (m.content || m.mediaType) return false;
    return true;
  }).length;

  // Group by date
  const groupedMessages: { date: string; messages: WhatsAppMessage[] }[] = [];
  for (const m of visibleMessages) {
    const date = formatDate(m.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.messages.push(m);
    } else {
      groupedMessages.push({ date, messages: [m] });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <Skeleton className={`h-[44px] rounded-lg ${i % 2 === 0 ? "w-[45%]" : "w-[55%]"}`} />
          </div>
        ))}
      </div>
    );
  }

  if (visibleMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <div className="w-[56px] h-[56px] rounded-full bg-white/60 flex items-center justify-center">
          <User className="h-6 w-6 text-[#8696a0]" />
        </div>
        <p className="text-[13px] text-[#667781]">No messages yet</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
      {decryptFailCount > 0 && (
        <div className="flex justify-center my-3">
          <span className="text-[11.5px] px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shadow-sm flex items-center gap-1.5">
            🔒 {decryptFailCount} message{decryptFailCount === 1 ? "" : "s"} couldn't be decrypted — reconnect WhatsApp to resync
          </span>
        </div>
      )}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date pill */}
          <div className="flex justify-center my-3">
            <span className="text-[12px] px-3 py-1.5 rounded-lg bg-white/90 dark:bg-[#1f2c34] text-[#54656f] dark:text-[#8696a0] shadow-sm">
              {group.date}
            </span>
          </div>

          {group.messages.map((m) => {
            const mediaInfo = m.mediaType ? MEDIA_LABELS[m.mediaType] : null;
            const hasContent = m.content && !m.content.startsWith("[");
            const MediaIcon = mediaInfo?.icon;

            return (
              <div
                key={m.id}
                data-testid="wa-message"
                className={`flex mb-[3px] ${m.fromMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[65%] px-2.5 py-1.5 relative group/bubble"
                  style={{
                    background: m.fromMe ? "#d9fdd3" : "white",
                    borderRadius: m.fromMe ? "7.5px 0 7.5px 7.5px" : "0 7.5px 7.5px 7.5px",
                    boxShadow: "0 1px 0.5px rgba(11,20,26,0.08)",
                  }}
                  onContextMenu={(e) => handleContextMenu(e, m)}
                >
                  {/* Quoted reply — rendered above content when this message quotes another */}
                  {m.quotedContent && (
                    <div
                      className="mb-1.5 pl-2 pr-2 py-1.5 rounded-md border-l-4"
                      style={{
                        background: m.fromMe ? "rgba(6,150,95,0.08)" : "rgba(134,150,160,0.08)",
                        borderColor: m.quotedFromMe ? "#25d366" : "#53bdeb",
                      }}
                    >
                      <div className="text-[11.5px] font-semibold" style={{ color: m.quotedFromMe ? "#25d366" : "#53bdeb" }}>
                        {m.quotedFromMe ? "You" : "Them"}
                      </div>
                      <div className="text-[12.5px] text-[#667781] truncate">
                        {m.quotedContent}
                      </div>
                    </div>
                  )}

                  {/* Inline edit UI */}
                  {editingId === m.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingText && editingText !== m.content) onEdit?.(m.id, editingText);
                            setEditingId(null);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 rounded text-[14.2px] bg-white border border-[#25d366] outline-none"
                      />
                      <button
                        onClick={() => { setEditingId(null); }}
                        className="text-[11px] text-[#667781]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (editingText && editingText !== m.content) onEdit?.(m.id, editingText);
                          setEditingId(null);
                        }}
                        className="text-[11px] text-[#25d366] font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  ) : hasContent ? (
                    <span className="text-[14.2px] leading-[19px] text-[#111b21] whitespace-pre-wrap break-words">
                      {highlightMatch(m.content!)}
                    </span>
                  ) : mediaInfo ? (
                    <span className="flex items-center gap-1.5">
                      {MediaIcon && <MediaIcon className="h-4 w-4 text-[#8696a0]" />}
                      <span className="text-[14px] italic text-[#667781]">{mediaInfo.label}</span>
                    </span>
                  ) : m.content ? (
                    <span className="text-[14.2px] leading-[19px] text-[#111b21] whitespace-pre-wrap break-words">
                      {highlightMatch(m.content)}
                    </span>
                  ) : null}

                  {/* Timestamp + ticks */}
                  <span
                    className="float-right ml-2 mt-1 text-[11px] leading-[15px] select-none flex items-center gap-0.5 cursor-default"
                    style={{ color: "#667781" }}
                    title={formatFullDateTime(m.timestamp)}
                  >
                    {formatTime(m.timestamp)}
                    {m.fromMe && (
                      <StatusTicks status={m.status} />
                    )}
                  </span>

                  {/* Reaction chips — grouped by emoji with count */}
                  {Array.isArray(m.reactions) && m.reactions.length > 0 && (
                    <div
                      className="absolute -bottom-2 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-white border border-[#e9edef] shadow-sm"
                      style={m.fromMe ? { right: 8 } : { left: 8 }}
                    >
                      {Object.entries(
                        m.reactions.reduce((acc: Record<string, number>, r) => {
                          acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                          return acc;
                        }, {}),
                      ).map(([emoji, count]) => (
                        <span key={emoji} className="inline-flex items-center text-[12px] leading-none">
                          {emoji}
                          {count > 1 && (
                            <span className="ml-0.5 text-[10px] text-[#667781]">{count}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div ref={messagesEndRef} />

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="fixed z-30 flex items-center justify-center transition-opacity duration-200"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(11,20,26,0.16), 0 2px 8px rgba(11,20,26,0.08)",
            bottom: 80,
            right: 24,
          }}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5 text-[#54656f]" />
        </button>
      )}

      {/* Context menu */}
      {contextMenu.open && msg && (
        <div
          className="fixed z-50"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              boxShadow: "0 2px 12px rgba(11,20,26,0.16), 0 0 2px rgba(11,20,26,0.08)",
              overflow: "hidden",
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            {/* Reply */}
            <ContextMenuItem
              icon={<Reply className="h-4 w-4" />}
              label="Reply"
              onClick={() => onReplyTo?.(msg)}
            />

            {/* React */}
            <div
              className="relative"
              onMouseEnter={() => setShowReactBar(true)}
              onMouseLeave={() => setShowReactBar(false)}
            >
              <ContextMenuItem
                icon={<SmilePlus className="h-4 w-4" />}
                label="React"
                onClick={() => setShowReactBar((v) => !v)}
                hasSubmenu
              />
              {showReactBar && (
                <div
                  className="absolute z-50"
                  style={{
                    top: -4,
                    left: "100%",
                    marginLeft: 4,
                    background: "white",
                    borderRadius: 24,
                    boxShadow: "0 2px 12px rgba(11,20,26,0.16)",
                    padding: "4px 8px",
                    display: "flex",
                    gap: 2,
                  }}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact?.(msg.id, msg.fromMe, emoji);
                        setContextMenu((prev) => ({ ...prev, open: false }));
                      }}
                      className="hover:scale-125 transition-transform p-1 text-[20px] leading-none"
                      style={{ cursor: "pointer", background: "none", border: "none" }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Copy (text only) */}
            {isText && (
              <ContextMenuItem
                icon={<Copy className="h-4 w-4" />}
                label="Copy"
                onClick={handleCopy}
              />
            )}

            {/* Forward */}
            <ContextMenuItem
              icon={<Forward className="h-4 w-4" />}
              label="Forward"
              onClick={() => onForward?.(msg.id)}
            />

            {/* Star */}
            <ContextMenuItem
              icon={<Star className="h-4 w-4" />}
              label="Star"
              onClick={() => onStar?.(msg.id, msg.fromMe)}
            />

            {/* Edit (own text messages within 15 min) */}
            {canEdit && (
              <ContextMenuItem
                icon={<Pencil className="h-4 w-4" />}
                label="Edit"
                onClick={() => {
                  setEditingId(msg.id);
                  setEditingText(msg.content ?? "");
                  setContextMenu((prev) => ({ ...prev, open: false }));
                }}
              />
            )}

            {/* Delete */}
            <div
              className="relative"
              onMouseEnter={() => setShowDeleteSub(true)}
              onMouseLeave={() => setShowDeleteSub(false)}
            >
              <ContextMenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete"
                onClick={() => setShowDeleteSub((v) => !v)}
                hasSubmenu
              />
              {showDeleteSub && (
                <div
                  className="absolute z-50"
                  style={{
                    top: -4,
                    left: "100%",
                    marginLeft: 4,
                    background: "white",
                    borderRadius: 8,
                    boxShadow: "0 2px 12px rgba(11,20,26,0.16)",
                    overflow: "hidden",
                    minWidth: 180,
                    paddingTop: 4,
                    paddingBottom: 4,
                  }}
                >
                  <ContextMenuItem
                    label="Delete for me"
                    onClick={() => {
                      onDelete?.(msg.id, msg.fromMe, false);
                      setContextMenu((prev) => ({ ...prev, open: false }));
                    }}
                  />
                  {msg.fromMe && (
                    <ContextMenuItem
                      label="Delete for everyone"
                      onClick={() => {
                        onDelete?.(msg.id, msg.fromMe, true);
                        setContextMenu((prev) => ({ ...prev, open: false }));
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <ContextMenuItem
              icon={<Info className="h-4 w-4" />}
              label="Info"
              onClick={() => {
                alert(formatFullDateTime(msg.timestamp));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Reply preview bar — exported for WhatsAppInbox to render
   above the compose input
   ──────────────────────────────────────────────────────────── */

interface ReplyPreviewBarProps {
  message: WhatsAppMessage;
  onCancel: () => void;
}

export function ReplyPreviewBar({ message, onCancel }: ReplyPreviewBarProps) {
  const senderLabel = message.fromMe ? "You" : message.senderName ?? message.senderPhone ?? "Unknown";
  const preview = (message.content ?? "").slice(0, 120) + ((message.content?.length ?? 0) > 120 ? "..." : "");

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-t"
      style={{
        background: "#f0f2f5",
        borderLeft: "4px solid #25d366",
      }}
    >
      <Reply className="h-4 w-4 shrink-0 text-[#25d366]" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-[#25d366] truncate">{senderLabel}</div>
        <div className="text-[12px] text-[#667781] truncate">{preview || "[Media]"}</div>
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4 text-[#8696a0]" />
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Context menu item component
   ──────────────────────────────────────────────────────────── */

interface ContextMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  hasSubmenu?: boolean;
}

function ContextMenuItem({ icon, label, onClick, hasSubmenu }: ContextMenuItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-3 w-full text-left px-3 transition-colors"
      style={{
        height: 36,
        fontSize: 14,
        color: "#111b21",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#f5f6f6";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {icon && <span className="text-[#8696a0]">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hasSubmenu && <ChevronDown className="h-3 w-3 text-[#8696a0] -rotate-90" />}
    </button>
  );
}
