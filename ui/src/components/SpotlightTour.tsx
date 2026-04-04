import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

// ── Tour step definitions ──────────────────────────────────────────────────────

interface TourStep {
  /** data-tour attribute value to target, or null for full-screen centered card */
  target: string | null;
  headline: string;
  body: string;
  /** Preferred tooltip position relative to the spotlight hole */
  position: "above" | "below" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "ceo-chat-header",
    headline: "This Is Your Command Center",
    body: "Everything runs through this chat. Tell your CEO what you need — follow up with leads, create content, check the market. One conversation runs your entire agency.",
    position: "below",
  },
  {
    target: "sidebar-agents",
    headline: "Your AI Team — Working 24/7",
    body: "These agents handle your leads, content, viewings, and market intel around the clock. Green dot means active. Each one has specialized Dubai real estate skills — from RERA calculations to DLD fee breakdowns.",
    position: "right",
  },
  {
    target: "quick-actions",
    headline: "One-Tap Commands",
    body: "Morning brief, pending approvals, budget check, lead pipeline — all one tap away. Your CEO responds with live data, not generic answers.",
    position: "above",
  },
  {
    target: "chat-input",
    headline: "Talk Naturally — Your CEO Understands",
    body: "Say 'Follow up with Ahmed about the JVC 2BR' or 'What's happening in Dubai Marina?' — your CEO delegates to the right agent and gets it done.",
    position: "above",
  },
  {
    target: "sidebar-approvals",
    headline: "Nothing Goes Out Without Your Approval",
    body: "Every WhatsApp message, email, Instagram post, and pitch deck needs your OK. You approve, edit, or reject. Your agents prepare — you decide.",
    position: "right",
  },
  {
    target: "sidebar-dashboard",
    headline: "Your Agency at a Glance",
    body: "Active agents, open tasks, monthly spend, lead pipeline — all in real-time. Know exactly what your AI team is doing and what it costs.",
    position: "right",
  },
  {
    target: "sidebar-leads",
    headline: "Sub-5-Minute Lead Response",
    body: "Property Finder, Bayut, Instagram, Facebook — leads from every channel land here. Your Lead Agent scores them, qualifies them, and follows up before your competitors even see the notification.",
    position: "right",
  },
  {
    target: "sidebar-budget",
    headline: "Every Dirham Tracked",
    body: "See cost per agent, per model, per day. Set budget caps. Get alerts at 80%. Your AI team costs less than one junior broker's salary — and works 24/7.",
    position: "right",
  },
  {
    target: "sidebar-settings",
    headline: "Your Agency Learns From You",
    body: "Every time you edit a WhatsApp message before approving, your agents learn your tone, your style, your preferences. They get better the more you use them.",
    position: "right",
  },
  {
    target: null,
    headline: "You're Ready to Run Your Agency",
    body: "Your AI team is hired and standing by. Start by asking your CEO for a morning brief, or try one of the quick actions below. Welcome to the future of Dubai real estate.",
    position: "below",
  },
];

const STORAGE_KEY = "aygency_tour_completed";

// ── Spotlight hole + tooltip positioning logic ─────────────────────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_MAX_W = 360;

function getTooltipStyle(
  rect: Rect | null,
  position: "above" | "below" | "left" | "right",
): React.CSSProperties {
  // Full-screen centered card
  if (!rect) {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: TOOLTIP_MAX_W,
      width: "90vw",
    };
  }

  const style: React.CSSProperties = {
    position: "fixed",
    maxWidth: TOOLTIP_MAX_W,
    width: "90vw",
  };

  const padded = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  switch (position) {
    case "below":
      style.top = padded.top + padded.height + TOOLTIP_GAP;
      style.left = Math.max(12, padded.left + padded.width / 2 - TOOLTIP_MAX_W / 2);
      break;
    case "above":
      style.bottom = window.innerHeight - padded.top + TOOLTIP_GAP;
      style.left = Math.max(12, padded.left + padded.width / 2 - TOOLTIP_MAX_W / 2);
      break;
    case "right":
      style.top = Math.max(12, padded.top + padded.height / 2 - 60);
      style.left = padded.left + padded.width + TOOLTIP_GAP;
      break;
    case "left":
      style.top = Math.max(12, padded.top + padded.height / 2 - 60);
      style.right = window.innerWidth - padded.left + TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  if (style.left != null && typeof style.left === "number") {
    style.left = Math.max(12, Math.min(style.left, window.innerWidth - TOOLTIP_MAX_W - 12));
  }
  if (style.top != null && typeof style.top === "number") {
    style.top = Math.max(12, Math.min(style.top, window.innerHeight - 200));
  }

  return style;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SpotlightTourProps {
  /** Whether the tour is currently active */
  active: boolean;
  /** Called when the tour finishes or is skipped */
  onComplete: () => void;
}

export function SpotlightTour({ active, onComplete }: SpotlightTourProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const prevTargetElRef = useRef<HTMLElement | null>(null);

  const currentStep = TOUR_STEPS[step];

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!currentStep) return;

    // Restore previous target element z-index
    if (prevTargetElRef.current) {
      prevTargetElRef.current.style.removeProperty("position");
      prevTargetElRef.current.style.removeProperty("z-index");
      prevTargetElRef.current.classList.remove("spotlight-tour-target");
      prevTargetElRef.current = null;
    }

    if (!currentStep.target) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`) as HTMLElement | null;
    if (!el) {
      // Element not found — skip to next or show centered
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    // Elevate target element above overlay
    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }
    el.style.zIndex = "10000";
    el.classList.add("spotlight-tour-target");
    prevTargetElRef.current = el;
  }, [currentStep]);

  // Activate / deactivate
  useEffect(() => {
    if (active) {
      setStep(0);
      setVisible(false);
      // Small delay for entrance animation
      requestAnimationFrame(() => {
        setVisible(true);
      });
    } else {
      setVisible(false);
      // Clean up elevated element
      if (prevTargetElRef.current) {
        prevTargetElRef.current.style.removeProperty("position");
        prevTargetElRef.current.style.removeProperty("z-index");
        prevTargetElRef.current.classList.remove("spotlight-tour-target");
        prevTargetElRef.current = null;
      }
    }
  }, [active]);

  // Re-measure on step change and on resize
  useEffect(() => {
    if (!active) return;
    measureTarget();

    const handleResize = () => measureTarget();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [active, step, measureTarget]);

  const handleNext = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  }, [step]);

  const handleFinish = useCallback(() => {
    // Clean up elevated element
    if (prevTargetElRef.current) {
      prevTargetElRef.current.style.removeProperty("position");
      prevTargetElRef.current.style.removeProperty("z-index");
      prevTargetElRef.current.classList.remove("spotlight-tour-target");
      prevTargetElRef.current = null;
    }
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    // Wait for fade-out before calling onComplete
    setTimeout(onComplete, 300);
  }, [onComplete]);

  if (!active || !currentStep) return null;

  const isLastStep = step === TOUR_STEPS.length - 1;
  const hasTarget = currentStep.target !== null && targetRect !== null;

  // Spotlight hole dimensions with padding
  const holeStyle: React.CSSProperties = hasTarget
    ? {
        position: "fixed",
        top: targetRect!.top - PADDING,
        left: targetRect!.left - PADDING,
        width: targetRect!.width + PADDING * 2,
        height: targetRect!.height + PADDING * 2,
        borderRadius: 12,
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
        transition: "all 300ms ease-out",
        zIndex: 9999,
        pointerEvents: "none" as const,
      }
    : {};

  const tooltipStyle = getTooltipStyle(
    hasTarget ? targetRect : null,
    currentStep.position,
  );

  return (
    <>
      {/* Full-screen overlay with backdrop blur */}
      <div
        className="fixed inset-0 z-[9998] transition-opacity duration-300"
        style={{
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={(e) => {
          // Only close if clicking the dark overlay area itself (not the hole or tooltip)
          if (e.target === e.currentTarget) {
            // Don't close on overlay click — require explicit Skip/Next
          }
        }}
      >
        {/* Dark background — always visible. When there's a target, the hole's box-shadow punches through. When no target, this provides the backdrop. */}
        {!hasTarget && (
          <div
            className="absolute inset-0 bg-black/60 transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          />
        )}
      </div>

      {/* Spotlight hole — box-shadow creates the dark overlay with a cutout */}
      {hasTarget && (
        <div style={holeStyle}>
          {/* Glow ring around the cutout */}
          <div
            className="absolute inset-0 rounded-[12px] transition-all duration-300"
            style={{
              boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.4), 0 0 20px 4px rgba(34, 197, 94, 0.15)",
            }}
          />
        </div>
      )}

      {/* Tooltip card */}
      <div
        className="z-[10001] transition-all duration-300 ease-out"
        style={{
          ...tooltipStyle,
          opacity: visible ? 1 : 0,
          transform: visible
            ? tooltipStyle.transform ?? "translateY(0)"
            : tooltipStyle.transform ?? "translateY(8px)",
        }}
      >
        <div className="rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-2xl shadow-black/40 px-5 py-4 relative">
          {/* Close button */}
          <button
            onClick={handleFinish}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step counter */}
          <p className="text-[11px] text-zinc-500 font-medium mb-2">
            {step + 1} / {TOUR_STEPS.length}
          </p>

          {/* Headline */}
          <h3 className="text-[16px] font-semibold text-white leading-snug mb-1.5">
            {currentStep.headline}
          </h3>

          {/* Body */}
          <p className="text-[13px] text-zinc-300 leading-[1.55] mb-4">
            {currentStep.body}
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {isLastStep ? (
              <button
                onClick={handleFinish}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors"
              >
                Let's Go
              </button>
            ) : (
              <>
                <button
                  onClick={handleNext}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                >
                  Next
                </button>
                <button
                  onClick={handleFinish}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Skip tour
                </button>
              </>
            )}
          </div>

          {/* Green accent line at top */}
          <div className="absolute top-0 left-5 right-5 h-[2px] rounded-full bg-emerald-500/60" />
        </div>
      </div>
    </>
  );
}

// ── Helper to check if tour was already completed ──────────────────────────────

export function isTourCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function resetTour(): void {
  localStorage.removeItem(STORAGE_KEY);
}
