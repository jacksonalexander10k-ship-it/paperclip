import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Star, ArrowLeft, ExternalLink, User, Send, Loader2, Mic, MessageSquarePlus, X, Smile, Pin, Archive, EyeOff, Paperclip, Bold, Italic } from "lucide-react";
import { Link } from "@/lib/router";
import { whatsappApi, type ConversationSummary, type WhatsAppMessage } from "../api/whatsapp";
import { baileysApi } from "../api/baileys";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { WhatsAppMessageList } from "./WhatsAppMessageList";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../lib/utils";
import { formatClockTime } from "../lib/format-time";

interface WhatsAppInboxProps {
  agentId?: string;
}

/** Format timestamp like WhatsApp: "10:09 PM", "Yesterday", "12/03/2026" */
function waTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return formatClockTime(d);
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "long" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Format phone number: 971585023018 → +971 58 502 3018 */
function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("971") && clean.length >= 12) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.length >= 10) {
    return `+${clean.slice(0, clean.length - 10)} ${clean.slice(-10, -7)} ${clean.slice(-7, -4)} ${clean.slice(-4)}`;
  }
  return `+${clean}`;
}

/** Clean message preview */
function cleanPreview(msg: string | null): string {
  if (!msg) return "";
  if (/^\[(protocolMessage|senderKeyDistributionMessage|messageContextInfo)\]$/.test(msg)) return "";
  if (msg === "[imageMessage]") return "📷 Photo";
  if (msg === "[videoMessage]") return "🎥 Video";
  if (msg === "[audioMessage]") return "🎤 Voice message";
  if (msg === "[documentMessage]" || msg === "[documentWithCaptionMessage]") return "📄 Document";
  if (msg === "[stickerMessage]") return "Sticker";
  if (msg === "[locationMessage]" || msg === "[liveLocationMessage]") return "📍 Location";
  if (msg === "[contactMessage]" || msg === "[contactsArrayMessage]") return "👤 Contact";
  if (msg.startsWith("[") && msg.endsWith("]")) return "📎 Attachment";
  return msg.length > 50 ? msg.slice(0, 50) + "…" : msg;
}

/** Consistent avatar color from string */
function avatarColor(name: string): string {
  const colors = [
    "#25D366", "#128C7E", "#075E54", "#34B7F1",
    "#00A884", "#1FA855", "#53BDEB", "#667781",
  ];
  let hash = 0;
  for (const ch of name) hash = hash + ch.charCodeAt(0);
  return colors[hash % colors.length];
}

// ── Emoji Data ───────────────────────────────────────────────────────

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
      "😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🫡",
      "🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴",
      "😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐",
    ],
  },
  {
    name: "People",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟",
      "🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏",
      "🙌","🫶","👐","🤲","🤝","🙏","✍️","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","👶",
    ],
  },
  {
    name: "Animals",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵",
      "🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
      "🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐",
      "☕","🍵","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧊","🍕","🍔","🍟","🌭",
    ],
  },
  {
    name: "Activities",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🥅","⛳",
      "🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂",
    ],
  },
  {
    name: "Travel",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵",
      "✈️","🛫","🛬","🛩️","🚀","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","🏠","🏡",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📷","📹",
      "🎥","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","⏱️","⏲️","⏰","🕰️","💡","🔦",
    ],
  },
  {
    name: "Symbols",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","✅","❌","⭕","❗","❓","💯","🔥","✨","⚡","💫","🌟","⭐","🎯","💬",
    ],
  },
];

// ── Context Menu ─────────────────────────────────────────────────────

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  chatJid: string;
}

function ConversationContextMenu({
  state,
  onClose,
  onDelete,
  onSetState,
  conversations,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onDelete: (jid: string) => void;
  onSetState: (jid: string, opts: { pinned?: boolean; archived?: boolean; unread?: boolean }) => void;
  conversations: ConversationSummary[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!state.visible) return null;

  const conv = conversations.find((c) => c.chatJid === state.chatJid);
  const isPinned = !!conv?.pinnedAt;
  const isArchived = !!conv?.archivedAt;

  const items = [
    { label: isArchived ? "Unarchive chat" : "Archive chat", action: () => { onSetState(state.chatJid, { archived: !isArchived }); onClose(); } },
    { label: isPinned ? "Unpin chat" : "Pin chat", action: () => { onSetState(state.chatJid, { pinned: !isPinned }); onClose(); } },
    { label: "Mark as unread", action: () => { onSetState(state.chatJid, { unread: true }); onClose(); } },
    { label: "Delete chat", action: () => { onDelete(state.chatJid); onClose(); } },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[999] bg-white dark:bg-[#233138] rounded-lg shadow-lg py-2 min-w-[200px]"
      style={{ top: state.y, left: state.x }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="w-full text-left px-6 py-2.5 text-[14.5px] text-[#3b4a54] dark:text-[#d1d7db] hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Emoji Picker ─────────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-[320px] h-[280px] bg-white dark:bg-[#233138] rounded-lg shadow-lg flex flex-col z-50 border border-[#e9edef] dark:border-[#222d34]"
    >
      {/* Category tabs */}
      <div className="flex border-b border-[#e9edef] dark:border-[#222d34] px-1 shrink-0">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={cn(
              "flex-1 py-2 text-[11px] font-medium transition-colors truncate",
              i === activeCategory
                ? "text-[#00a884] border-b-2 border-[#00a884]"
                : "text-[#8696a0] hover:text-[#3b4a54] dark:hover:text-[#d1d7db]",
            )}
            title={cat.name}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="w-[34px] h-[34px] flex items-center justify-center text-[22px] rounded hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Conversation Row ──────────────────────────────────────────────────

function ConversationRow({
  conversation,
  selected,
  onClick,
  onContextMenu,
  agentId,
  hasUnread,
  unreadCount,
  isTyping,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  agentId?: string;
  hasUnread: boolean;
  unreadCount: number;
  isTyping?: boolean;
}) {
  const hasName = !!conversation.contactName;
  const displayName = conversation.contactName || formatPhone(conversation.contactPhone);
  const initial = hasName
    ? conversation.contactName!.charAt(0).toUpperCase()
    : null;
  const preview = cleanPreview(conversation.lastMessage);

  const { data: ppData } = useQuery({
    queryKey: ["wa-profile-pic", agentId, conversation.chatJid],
    queryFn: () => baileysApi.profilePicture(agentId!, conversation.chatJid),
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const profilePicUrl = ppData?.url ?? null;

  return (
    <button
      data-testid="wa-conversation-row"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors",
        selected
          ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
          : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]",
      )}
    >
      {/* Avatar — profile pic, initial, or person silhouette */}
      {profilePicUrl ? (
        <img
          src={profilePicUrl}
          alt={displayName}
          className="w-[49px] h-[49px] rounded-full shrink-0 object-cover"
        />
      ) : (
        <div
          className="w-[49px] h-[49px] rounded-full flex items-center justify-center shrink-0 text-white"
          style={{ background: avatarColor(displayName) }}
        >
          {initial ? (
            <span className="text-[18px] font-medium">{initial}</span>
          ) : (
            <User className="h-6 w-6 text-white/80" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#222d34] pb-3 -mb-3">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-[16px] truncate", hasUnread && "font-semibold")} style={{ color: "var(--foreground)" }}>
            {displayName}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-[12px]", hasUnread ? "text-[#25d366]" : "")} style={hasUnread ? undefined : { color: "var(--muted-foreground)" }}>
              {waTime(conversation.lastMessageAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isTyping ? (
            <span className="text-[13.5px] truncate italic" style={{ color: "#25d366" }}>
              typing...
            </span>
          ) : (
            <span className={cn("text-[13.5px] truncate", hasUnread && "font-medium")} style={{ color: hasUnread ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {conversation.lastMessageFromMe && (
                <svg viewBox="0 0 16 11" width="16" height="11" className="inline-block mr-0.5 align-[-1px]" style={{ color: "#8696a0" }}>
                  <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.457.457 0 0 0 0 .611l2.357 2.553a.463.463 0 0 0 .336.153.463.463 0 0 0 .35-.178l6.515-8.013a.392.392 0 0 0 0-.509V.653z" />
                  <path fill="currentColor" d="M14.757.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.457.457 0 0 0 0 .611l2.357 2.553a.463.463 0 0 0 .336.153.463.463 0 0 0 .35-.178l6.515-8.013a.392.392 0 0 0 0-.509V.653z" transform="translate(-3)" />
                </svg>
              )}
              {preview}
            </span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {conversation.pinnedAt && (
              <Pin className="w-3 h-3 text-[#8696a0] fill-current" />
            )}
            {conversation.leadScore != null && conversation.leadScore > 0 && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
                conversation.leadScore >= 8 ? "text-green-600 dark:text-green-400" :
                conversation.leadScore >= 5 ? "text-amber-600 dark:text-amber-400" :
                "text-muted-foreground",
              )}>
                <Star className="w-2.5 h-2.5 fill-current" />
                {conversation.leadScore}
              </span>
            )}
            {hasUnread && (
              <span
                className="inline-flex items-center justify-center rounded-full text-white font-bold px-1.5"
                style={{
                  backgroundColor: "#25d366",
                  minWidth: 20,
                  height: 20,
                  fontSize: 12,
                  lineHeight: "20px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function WhatsAppInbox({ agentId }: WhatsAppInboxProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [deletedJids, setDeletedJids] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "unread" | "pinned" | "archived">("all");
  const [starredOpen, setStarredOpen] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, chatJid: "",
  });

  // Thread search state
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<WhatsAppMessage | null>(null);

  // Compose ref for cursor position insertion
  const composeRef = useRef<HTMLInputElement>(null);

  // Presence state
  const [presenceText, setPresenceText] = useState<string | null>(null);

  const startNewChat = () => {
    const clean = newChatPhone.replace(/[\s\-\+\(\)]/g, "");
    if (clean.length < 7) return;
    const jid = `${clean}@s.whatsapp.net`;
    setSelectedJid(jid);
    setMobileShowThread(true);
    setShowNewChat(false);
    setNewChatPhone("");
  };

  const { data: baileysStatus } = useQuery({
    queryKey: agentId ? ["agent-baileys", agentId] : [],
    queryFn: () => baileysApi.status(agentId!),
    enabled: !!agentId,
    refetchInterval: 15_000,
  });

  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.whatsapp.conversations(selectedCompanyId, agentId)
      : [],
    queryFn: () => whatsappApi.conversations(selectedCompanyId!, agentId),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const selectedConv = useMemo(
    () => conversations.find((c) => c.chatJid === selectedJid) ?? null,
    [conversations, selectedJid],
  );

  // #19 typing-jids state only; effect wired later (after presenceText is declared)
  const [typingJids, setTypingJids] = useState<Set<string>>(new Set());

  const filteredConversations = useMemo(() => {
    let list = conversations.filter((c) => {
      if (!c.contactPhone || c.contactPhone === "0" || c.contactPhone.length < 5) return false;
      if (c.chatJid === "status@broadcast") return false;
      if (deletedJids.has(c.chatJid)) return false;
      // Groups allowed — no longer filtered. Render with a subtle indicator instead.
      // Filter tab
      if (tab === "unread" && c.unreadCount === 0) return false;
      if (tab === "pinned" && !c.pinnedAt) return false;
      if (tab === "archived" && !c.archivedAt) return false;
      // Archived hidden from "all" tab
      if (tab === "all" && c.archivedAt) return false;
      return true;
    });
    // Deduplicate by chatJid — keep the conversation with the most recent message
    const seen = new Map<string, typeof list[number]>();
    for (const c of list) {
      const existing = seen.get(c.chatJid);
      if (!existing || (c.lastMessageAt && (!existing.lastMessageAt || c.lastMessageAt > existing.lastMessageAt))) {
        seen.set(c.chatJid, c);
      }
    }
    list = Array.from(seen.values());
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(
        (c) =>
          (c.contactName?.toLowerCase().includes(q)) ||
          c.contactPhone.includes(q),
      );
    }
    return list;
  }, [conversations, searchFilter, deletedJids, tab]);

  const unreadCount = conversations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: selectedCompanyId && selectedJid
      ? queryKeys.whatsapp.messages(selectedCompanyId, selectedJid, agentId)
      : [],
    queryFn: () => whatsappApi.messages(selectedCompanyId!, selectedJid!, agentId),
    enabled: !!selectedCompanyId && !!selectedJid,
    refetchInterval: 30_000,
  });

  // Filtered messages for thread search
  const displayMessages = useMemo(() => {
    if (!threadSearchQuery.trim()) return messages;
    const q = threadSearchQuery.toLowerCase();
    return messages.filter((m) => m.content?.toLowerCase().includes(q));
  }, [messages, threadSearchQuery]);

  const rawPhone = selectedJid?.includes("@") ? selectedJid.split("@")[0] : selectedJid ?? "";
  const phoneDisplay = formatPhone(rawPhone);
  const contactDisplay = selectedConv?.contactName || phoneDisplay;
  const isConnected = baileysStatus?.status === "connected";

  // Profile picture for selected conversation header
  const { data: headerPpData } = useQuery({
    queryKey: ["wa-profile-pic", agentId, selectedJid],
    queryFn: () => baileysApi.profilePicture(agentId!, selectedJid!),
    enabled: !!agentId && !!selectedJid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const headerProfilePicUrl = headerPpData?.url ?? null;

  // #22 Keyboard shortcuts: Ctrl+F/Cmd+F focus search, Escape closes thread, ↑/↓ navigate chats
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search or start new chat"]');
        searchInput?.focus();
        searchInput?.select();
        return;
      }
      if (e.key === "Escape") {
        if (selectedJid) {
          setMobileShowThread(false);
        }
        return;
      }
      if (!inInput && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const list = filteredConversations;
        if (list.length === 0) return;
        const currentIdx = list.findIndex((c) => c.chatJid === selectedJid);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (currentIdx + delta + list.length) % list.length;
        const next = list[nextIdx];
        if (next) {
          setSelectedJid(next.chatJid);
          setMobileShowThread(true);
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredConversations, selectedJid]);

  // Presence polling
  useEffect(() => {
    if (!agentId || !selectedJid) {
      setPresenceText(null);
      return;
    }
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const data = await baileysApi.presence(agentId, selectedJid);
        if (cancelled) return;
        if (data?.presence === "composing") {
          setPresenceText("typing...");
        } else if (data?.presence === "available") {
          setPresenceText("online");
        } else {
          setPresenceText(null);
        }
      } catch {
        if (!cancelled) setPresenceText(null);
      }
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [agentId, selectedJid]);

  // #19 Typing in list — mirror the open chat's presence to the list badge
  useEffect(() => {
    if (!selectedJid) return;
    if (presenceText === "typing...") {
      setTypingJids((prev) => {
        if (prev.has(selectedJid)) return prev;
        const n = new Set(prev);
        n.add(selectedJid);
        return n;
      });
      const t = setTimeout(() => {
        setTypingJids((prev) => {
          const n = new Set(prev);
          n.delete(selectedJid);
          return n;
        });
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [selectedJid, presenceText]);

  // Compose state
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!composeText.trim() || !agentId || !selectedJid || sending) return;
    setSending(true);
    try {
      // Pass the full JID (e.g. "XXX@lid" or "XXX@s.whatsapp.net") — the backend
      // will route it correctly. Stripping to rawPhone breaks @lid senders.
      await baileysApi.send(agentId, selectedJid, composeText.trim());
      setComposeText("");
      setReplyTo(null);
      queryClient.invalidateQueries({
        queryKey: selectedCompanyId
          ? queryKeys.whatsapp.messages(selectedCompanyId, selectedJid, agentId)
          : [],
      });
      queryClient.invalidateQueries({
        queryKey: selectedCompanyId
          ? queryKeys.whatsapp.conversations(selectedCompanyId, agentId)
          : [],
      });
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  // #16 + #29: handle file attachment send via Baileys sendMedia
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const handleSendMedia = async (file: File, caption?: string) => {
    if (!agentId || !selectedJid) return;
    const jid = selectedJid.includes("@") ? selectedJid : `${selectedJid}@s.whatsapp.net`;
    // Convert file to data URL for Baileys sendMedia (matches existing API)
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const endpoint = `/api/agents/${encodeURIComponent(agentId)}/baileys/send-media`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jid,
          mediaUrl: dataUrl,
          mimetype: file.type || "application/octet-stream",
          filename: file.name,
          caption,
        }),
      });
      if (!res.ok) throw new Error(`send-media failed: ${res.status}`);
      setComposeText("");
      queryClient.invalidateQueries({ queryKey: selectedCompanyId ? queryKeys.whatsapp.messages(selectedCompanyId, selectedJid, agentId) : [] });
      queryClient.invalidateQueries({ queryKey: selectedCompanyId ? queryKeys.whatsapp.conversations(selectedCompanyId, agentId) : [] });
    } catch (err) {
      console.error(err);
      alert(`Failed to send attachment: ${(err as Error).message}`);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleSendMedia(f, composeText.trim() || undefined);
    e.target.value = "";
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const input = composeRef.current;
    if (input) {
      const start = input.selectionStart ?? composeText.length;
      const end = input.selectionEnd ?? composeText.length;
      const newText = composeText.slice(0, start) + emoji + composeText.slice(end);
      setComposeText(newText);
      // Restore cursor after emoji
      requestAnimationFrame(() => {
        input.focus();
        const pos = start + emoji.length;
        input.setSelectionRange(pos, pos);
      });
    } else {
      setComposeText((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  }, [composeText]);

  // Context menu handlers
  const handleConversationContextMenu = useCallback((e: React.MouseEvent, chatJid: string) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, chatJid });
  }, []);

  const handleDeleteConversation = useCallback(async (jid: string) => {
    if (!selectedCompanyId || !agentId) return;
    if (!confirm(`Delete all messages in this chat? This clears the conversation from the dashboard. The other side still has it on their phone.`)) return;
    try {
      await fetch(
        `/api/companies/${encodeURIComponent(selectedCompanyId)}/whatsapp/conversations/${encodeURIComponent(jid)}?agentId=${encodeURIComponent(agentId)}`,
        { method: "DELETE", credentials: "include" },
      );
      setDeletedJids((prev) => new Set(prev).add(jid));
      if (selectedJid === jid) {
        setSelectedJid(null);
        setMobileShowThread(false);
      }
      // Trigger refetch of conversations + messages
      queryClient.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey[0];
        return k === "whatsapp-conversations" || k === "whatsapp-messages";
      }});
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      alert("Couldn't delete chat — try again.");
    }
  }, [selectedJid, selectedCompanyId, agentId, queryClient]);

  // Message action callbacks for WhatsAppMessageList
  const handleReplyTo = useCallback((msg: WhatsAppMessage | null) => {
    setReplyTo(msg);
    if (msg) composeRef.current?.focus();
  }, []);

  const handleReact = useCallback(async (messageId: string, fromMe: boolean, emoji: string) => {
    if (!agentId || !selectedJid) return;
    try {
      await baileysApi.react(agentId, { jid: selectedJid, messageId, fromMe, emoji });
    } catch (err) {
      console.error("Failed to react:", err);
    }
  }, [agentId, selectedJid]);

  const handleDelete = useCallback(async (messageId: string, fromMe: boolean, forEveryone: boolean) => {
    if (!agentId || !selectedJid) return;
    try {
      await baileysApi.deleteMessage(agentId, { jid: selectedJid, messageId, fromMe, forEveryone });
      queryClient.invalidateQueries({
        queryKey: selectedCompanyId
          ? queryKeys.whatsapp.messages(selectedCompanyId, selectedJid, agentId)
          : [],
      });
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  }, [agentId, selectedJid, selectedCompanyId, queryClient]);

  const handleStarMessage = useCallback(async (messageId: string, fromMe: boolean) => {
    if (!agentId || !selectedJid) return;
    try {
      await baileysApi.star(agentId, { jid: selectedJid, messageId, fromMe, star: true });
    } catch (err) {
      console.error("Failed to star message:", err);
    }
  }, [agentId, selectedJid]);

  const handleForward = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.messageId === messageId);
    if (msg?.content) {
      setComposeText(msg.content);
      composeRef.current?.focus();
    }
  }, [messages]);

  const handleEdit = useCallback(async (messageId: string, newText: string) => {
    if (!agentId || !selectedJid) return;
    try {
      await baileysApi.editMessage(agentId, { jid: selectedJid, messageId, fromMe: true, newText });
      queryClient.invalidateQueries({
        queryKey: selectedCompanyId
          ? queryKeys.whatsapp.messages(selectedCompanyId, selectedJid, agentId)
          : [],
      });
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  }, [agentId, selectedJid, selectedCompanyId, queryClient]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: conversation list ── */}
      <div
        className={cn(
          "w-full md:w-[340px] md:block flex-shrink-0 flex flex-col border-r border-[#e9edef] dark:border-[#222d34] bg-white dark:bg-[#111b21]",
          mobileShowThread ? "hidden md:flex" : "flex",
        )}
      >
        {/* Header bar */}
        <div className="h-[60px] flex items-center px-4 bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
          <span className="text-[16px] font-semibold text-[#111b21] dark:text-[#e9edef] flex-1">Chats</span>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
            )}
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors text-[#54656f]"
              title="New chat"
            >
              <MessageSquarePlus className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* New chat input */}
        {showNewChat && (
          <div className="px-3 py-2.5 bg-white dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222d34] shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") startNewChat(); }}
                placeholder="Enter phone number (e.g. 971501234567)"
                autoFocus
                className="flex-1 h-[38px] px-3 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] text-[14px] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] outline-none border-none"
              />
              <button
                onClick={startNewChat}
                disabled={newChatPhone.replace(/[\s\-\+\(\)]/g, "").length < 7}
                className="h-[38px] px-4 rounded-lg bg-[#00a884] text-white text-[13px] font-medium hover:bg-[#008f72] disabled:opacity-40 transition-colors"
              >
                Chat
              </button>
              <button
                onClick={() => { setShowNewChat(false); setNewChatPhone(""); }}
                className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-2.5 py-1.5 bg-white dark:bg-[#111b21] shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full h-[35px] pl-10 pr-3 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] text-[13px] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0] outline-none border-none"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-2.5 py-1.5 bg-white dark:bg-[#111b21] shrink-0 flex gap-1.5 overflow-x-auto">
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "unread" as const, label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
              { id: "pinned" as const, label: "Pinned" },
              { id: "archived" as const, label: "Archived" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors shrink-0",
                tab === t.id
                  ? "bg-[#d9fdd3] text-[#00a884] dark:bg-[#103629] dark:text-[#00a884]"
                  : "bg-[#f0f2f5] text-[#667781] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#8696a0]",
              )}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setStarredOpen(true)}
            title="Starred messages"
            className="shrink-0 px-2 py-1 rounded-full text-[12px] text-[#667781] hover:bg-[#f0f2f5] dark:text-[#8696a0] dark:hover:bg-[#202c33]"
          >
            <Star className="w-3.5 h-3.5 inline" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {convLoading && (
            <div className="p-3 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3.5">
                  <Skeleton className="w-[49px] h-[49px] rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!convLoading && filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-[72px] h-[72px] rounded-full bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-center">
                <User className="h-8 w-8 text-[#8696a0]" />
              </div>
              <p className="text-[14px] text-[#667781] dark:text-[#8696a0] leading-[1.4]">
                {searchFilter ? "No results found" : "No conversations yet. Messages will appear here when someone contacts this number."}
              </p>
            </div>
          )}

          {!convLoading && filteredConversations.map((conv) => {
            const unreadCount = conv.unreadCount ?? 0;
            const hasUnread = unreadCount > 0 && conv.chatJid !== selectedJid;
            return (
              <ConversationRow
                key={conv.chatJid}
                conversation={conv}
                selected={conv.chatJid === selectedJid}
                agentId={agentId}
                hasUnread={hasUnread}
                unreadCount={unreadCount}
                isTyping={typingJids.has(conv.chatJid)}
                onClick={() => {
                  setSelectedJid(conv.chatJid);
                  setMobileShowThread(true);
                  // Mark as read on the server, then invalidate conversations query
                  if (agentId && selectedCompanyId && unreadCount > 0) {
                    whatsappApi.markRead(selectedCompanyId, conv.chatJid, agentId)
                      .then(() => {
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.whatsapp.conversations(selectedCompanyId, agentId),
                        });
                      })
                      .catch(() => {});
                  }
                }}
                onContextMenu={(e) => handleConversationContextMenu(e, conv.chatJid)}
              />
            );
          })}
        </div>
      </div>

      {/* Context menu */}
      <ConversationContextMenu
        state={contextMenu}
        conversations={conversations}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onDelete={handleDeleteConversation}
        onSetState={(jid, opts) => {
          if (!agentId || !selectedCompanyId) return;
          whatsappApi.setChatState(selectedCompanyId, jid, agentId, opts)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(selectedCompanyId, agentId) });
            })
            .catch(() => {});
        }}
      />

      {/* ── Right panel: message thread ── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          mobileShowThread ? "flex" : "hidden md:flex",
        )}
      >
        {selectedJid ? (
          <>
            {/* Thread header */}
            <div className="h-[60px] flex items-center gap-3 px-4 bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
              <button
                onClick={() => setMobileShowThread(false)}
                className="md:hidden w-[28px] h-[28px] rounded-lg flex items-center justify-center"
              >
                <ArrowLeft className="h-5 w-5 text-[#54656f]" />
              </button>
              {headerProfilePicUrl ? (
                <img
                  src={headerProfilePicUrl}
                  alt={contactDisplay}
                  className="w-[40px] h-[40px] rounded-full shrink-0 object-cover"
                />
              ) : (
                <div
                  className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ background: avatarColor(contactDisplay) }}
                >
                  {selectedConv?.contactName ? (
                    <span className="text-[16px] font-medium">
                      {selectedConv.contactName.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <User className="h-5 w-5 text-white/80" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate text-[#111b21] dark:text-[#e9edef]">
                  {contactDisplay}
                </p>
                {presenceText ? (
                  <p className="text-[12px] truncate" style={{ color: "#25d366" }}>
                    {presenceText}
                  </p>
                ) : selectedConv?.contactName ? (
                  <p className="text-[12px] truncate text-[#667781] dark:text-[#8696a0]">
                    {phoneDisplay}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowThreadSearch(!showThreadSearch); setThreadSearchQuery(""); }}
                  className="w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors text-[#54656f]"
                  title="Search in conversation"
                >
                  <Search className="w-[18px] h-[18px]" />
                </button>
                {selectedConv?.leadId && (
                  <Link
                    to="/leads"
                    className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-[#008069] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors"
                  >
                    View Lead
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Thread search bar */}
            {showThreadSearch && (
              <div className="h-[50px] flex items-center gap-2 px-4 bg-white dark:bg-[#1f2c34] border-b border-[#e9edef] dark:border-[#222d34] shrink-0">
                <Search className="w-4 h-4 text-[#54656f] shrink-0" />
                <input
                  type="text"
                  value={threadSearchQuery}
                  onChange={(e) => setThreadSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  autoFocus
                  className="flex-1 h-[35px] px-2 bg-transparent text-[14px] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0] outline-none border-none"
                />
                {threadSearchQuery && (
                  <span className="text-[12px] text-[#667781] shrink-0">
                    {displayMessages.length} result{displayMessages.length !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={() => { setShowThreadSearch(false); setThreadSearchQuery(""); }}
                  className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages area — WhatsApp wallpaper + drag-drop overlay */}
            <div
              className="flex-1 overflow-y-auto px-[6%] py-3 relative"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleSendMedia(f, composeText.trim() || undefined);
              }}
              style={{
                backgroundColor: "#efeae2",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              }}
            >
              {dragOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 pointer-events-none">
                  <div className="bg-white px-5 py-3 rounded-lg shadow-lg text-[14px] font-medium text-[#111b21]">
                    Drop to send
                  </div>
                </div>
              )}
              <div className="max-w-[920px] mx-auto">
                <WhatsAppMessageList
                  messages={displayMessages}
                  isLoading={msgLoading}
                  searchQuery={threadSearchQuery}
                  onReplyTo={handleReplyTo}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onStar={handleStarMessage}
                  onForward={handleForward}
                  onEdit={handleEdit}
                />
              </div>
            </div>

            {/* Reply preview bar */}
            {replyTo && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#f0f2f5] dark:bg-[#1f2c34] border-t border-[#e9edef] dark:border-[#222d34] shrink-0">
                <div className="flex-1 min-w-0 border-l-4 border-[#25d366] pl-3 py-1 bg-white dark:bg-[#2a3942] rounded-r-lg">
                  <p className="text-[12px] font-bold" style={{ color: "#25d366" }}>
                    {replyTo.fromMe ? "You" : (replyTo.senderName || formatPhone(replyTo.senderPhone || ""))}
                  </p>
                  <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">
                    {replyTo.content || (replyTo.mediaType ? cleanPreview(`[${replyTo.mediaType}]`) : "")}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Compose bar — WhatsApp Web style */}
            <div className="h-[62px] flex items-center gap-2.5 px-4 bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
              {/* Emoji picker button */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors shrink-0 text-[#54656f] hover:text-[#3b4a54]"
                >
                  <Smile className="w-[22px] h-[22px]" />
                </button>
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>

              {/* #16 Attachment */}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,video/*,audio/*,application/pdf" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors shrink-0 text-[#54656f] hover:text-[#3b4a54]"
                title="Attach file"
              >
                <Paperclip className="w-[22px] h-[22px]" />
              </button>

              <input
                ref={composeRef}
                type="text"
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message"
                disabled={sending}
                className="flex-1 h-[42px] px-3.5 rounded-lg bg-white dark:bg-[#2a3942] text-[15px] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0] outline-none border-none disabled:opacity-50"
              />
              {composeText.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-colors shrink-0 text-[#54656f] hover:text-[#3b4a54]"
                >
                  {sending ? (
                    <Loader2 className="w-[22px] h-[22px] animate-spin" />
                  ) : (
                    <Send className="w-[22px] h-[22px]" />
                  )}
                </button>
              ) : (
                <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 text-[#54656f]">
                  <Mic className="w-[22px] h-[22px]" />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state — WhatsApp Web style */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
            <div className="text-center max-w-[360px]">
              <div className="w-[200px] h-[200px] mx-auto mb-6 rounded-full bg-[#e9edef] dark:bg-[#2a3942] flex items-center justify-center">
                <svg viewBox="0 0 303 172" className="w-[140px] h-[80px] text-[#8696a0]">
                  <path fill="currentColor" d="M229.565 160.23c-12.57 7.266-27.176 11.44-42.882 11.44-22.567 0-43.058-8.728-58.384-22.99l-2.7-2.602c-.26-.26-.52-.52-.78-.78l-1.69-1.82c-1.43-1.56-2.86-3.12-4.29-4.68-5.2-5.72-9.1-12.48-11.44-19.76l-.78-2.6c-.52-1.82-.91-3.64-1.3-5.46-.39-1.82-.65-3.64-.91-5.46-.26-1.82-.39-3.64-.52-5.46-.13-1.82-.13-3.64-.13-5.46 0-1.82.13-3.64.26-5.46.13-1.82.39-3.64.65-5.46.26-1.82.65-3.64 1.04-5.46s.91-3.64 1.43-5.46c1.04-3.64 2.34-7.15 3.9-10.53l1.04-2.08c.52-1.04 1.04-2.08 1.56-3.12l1.69-2.99c.52-.91 1.17-1.82 1.69-2.73l1.82-2.6 1.95-2.47c.65-.78 1.3-1.56 1.95-2.34l2.08-2.21c.65-.65 1.3-1.3 2.08-1.95l2.08-1.82c.78-.65 1.43-1.17 2.21-1.69l2.21-1.56c.78-.52 1.56-1.04 2.34-1.43l2.34-1.3 2.47-1.17c.78-.39 1.69-.78 2.47-1.04l2.6-.91c.91-.26 1.69-.52 2.6-.78l2.6-.65c.91-.13 1.82-.39 2.73-.52l2.73-.39c.91-.13 1.82-.13 2.73-.26.91-.13 1.82-.13 2.86-.13s1.95 0 2.86.13c.91.13 1.82.13 2.73.26l2.73.39c.91.13 1.82.39 2.73.52l2.6.65 2.6.78c.91.26 1.69.65 2.47 1.04l2.47 1.17 2.34 1.3c.78.39 1.56.91 2.34 1.43l2.21 1.56c.78.52 1.43 1.04 2.21 1.69l2.08 1.82c.65.65 1.43 1.3 2.08 1.95l2.08 2.21c.65.78 1.3 1.56 1.95 2.34l1.95 2.47 1.82 2.6c.52.91 1.17 1.82 1.69 2.73l1.69 2.99c.52 1.04 1.04 2.08 1.56 3.12l1.04 2.08c1.56 3.38 2.86 6.89 3.9 10.53.52 1.82 1.04 3.64 1.43 5.46s.78 3.64 1.04 5.46c.26 1.82.52 3.64.65 5.46.13 1.82.26 3.64.26 5.46 0 47.02-38.1 85.12-85.12 85.12z" />
                </svg>
              </div>
              <h2 className="text-[28px] font-light text-[#41525d] dark:text-[#e9edef] mb-3">
                WhatsApp
              </h2>
              <p className="text-[14px] text-[#667781] dark:text-[#8696a0] leading-[1.5]">
                Send and receive messages from your leads and clients. Select a conversation to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* #27 Starred messages modal */}
      {starredOpen && selectedCompanyId && (
        <StarredModal
          companyId={selectedCompanyId}
          agentId={agentId}
          onClose={() => setStarredOpen(false)}
        />
      )}
    </div>
  );
}

function StarredModal({
  companyId,
  agentId,
  onClose,
}: {
  companyId: string;
  agentId?: string;
  onClose: () => void;
}) {
  const { data: starred = [], isLoading } = useQuery({
    queryKey: ["whatsapp-starred", companyId, agentId],
    queryFn: () => whatsappApi.starred(companyId, agentId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#202c33] rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-current text-amber-500" />
            <h2 className="text-[15px] font-semibold text-[#111b21] dark:text-[#e9edef]">Starred messages</h2>
          </div>
          <button onClick={onClose} className="text-[#54656f] hover:text-[#3b4a54]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <p className="text-[12px] text-[#667781]">Loading...</p>
          ) : starred.length === 0 ? (
            <p className="text-[13px] text-[#667781] text-center py-8">No starred messages yet.</p>
          ) : (
            starred.map((m) => (
              <div key={m.id} className="p-3 rounded-md bg-[#f0f2f5] dark:bg-[#111b21]">
                <div className="text-[11px] text-[#667781] mb-1">
                  {m.fromMe ? "You" : (m.senderName ?? "Them")} · {new Date(m.timestamp).toLocaleDateString()}
                </div>
                <div className="text-[13.5px] text-[#111b21] dark:text-[#e9edef]">
                  {m.content || "(no content)"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
