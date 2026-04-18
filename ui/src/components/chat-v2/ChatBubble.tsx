import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GLASS } from "./glass";

interface ChatBubbleProps {
  role: "user" | "assistant";
  /** Whether to render the avatar + name label (first in a group) */
  showHeader?: boolean;
  /** Timestamp label rendered below the bubble (last in a group) */
  timestamp?: string;
  /** Bubble body content — text, markdown, thinking block, cards, etc. */
  children: ReactNode;
  /** Optional extra elements rendered below the bubble (e.g. approval card) */
  footer?: ReactNode;
  /** Tight spacing when this is a follow-up message from same sender */
  grouped?: boolean;
}

/**
 * Avatar-left layout for both user and assistant messages.
 * User = "You" + first initial on a soft neutral circle.
 * Assistant = "CEO" on a sage gradient circle.
 *
 * The bubble itself is a light-glass tile whose look is defined in
 * ./glass.ts so it can be flipped back in one edit.
 */
export function ChatBubbleV2({
  role,
  showHeader = true,
  timestamp,
  children,
  footer,
  grouped = false,
}: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-1",
        grouped ? "py-1" : "py-2",
      )}
      role="article"
      aria-label={isUser ? "Your message" : "CEO message"}
    >
      {/* Avatar column — always reserved so bubbles stay aligned */}
      <div className="w-7 shrink-0">
        {showHeader &&
          (isUser ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold text-foreground/70">
              Y
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-[10px] font-bold leading-none text-primary-foreground">
              CEO
            </div>
          ))}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        {showHeader && (
          <p className="mb-1 text-[12px] font-semibold text-foreground/80">
            {isUser ? "You" : "CEO"}
          </p>
        )}

        <div
          className={cn(
            "relative rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground",
            GLASS.card,
          )}
        >
          <div className={GLASS.specular} />
          {children}
        </div>

        {footer}

        {timestamp && (
          <span className="mt-[3px] block select-none px-1 text-[11px] text-muted-foreground/60">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
