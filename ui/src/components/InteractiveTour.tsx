import { useState, useEffect } from "react";
import {
  Zap, Shield, BarChart3, MessageCircle, Users, ChevronRight,
  Sparkles, Clock, TrendingUp, Eye,
} from "lucide-react";

interface TourStep {
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  headline: string;
  body: string;
  highlight?: string;
  cta?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    badge: "ALWAYS ON",
    badgeColor: "bg-emerald-500/20 text-emerald-400",
    headline: "Your Agents Work While You Sleep",
    body: "Your AI team is now monitoring leads, drafting content, and tracking the market 24/7. They handle the volume — you handle the closings.",
    highlight: "Look left — your agents are listed in the sidebar. Green dot = active.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    badge: "YOU'RE IN CONTROL",
    badgeColor: "bg-blue-500/20 text-blue-400",
    headline: "Nothing Goes Out Without Your OK",
    body: "Every WhatsApp message, email, Instagram post, and pitch deck lands here as an approval card. You review the content, edit if needed, and approve with one tap. No agent ever contacts a lead without your permission.",
    highlight: "Try saying \"Send a WhatsApp to Ahmed about JVC\" and watch the approval card appear.",
  },
  {
    icon: <Clock className="h-5 w-5" />,
    badge: "EVERY MORNING",
    badgeColor: "bg-amber-500/20 text-amber-400",
    headline: "Your Morning Brief — 8am Daily",
    body: "Every morning your CEO summarises overnight activity: new leads, messages sent, viewings booked, budget spent, and what needs your attention. No digging through dashboards.",
    cta: "Brief me",
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    badge: "LEAD PIPELINE",
    badgeColor: "bg-purple-500/20 text-purple-400",
    headline: "Sub-5-Minute Lead Response",
    body: "When a lead comes in from Property Finder, Bayut, or Instagram — your Lead Agent responds in under 5 minutes. Qualifies budget, timeline, and area preference. Scores them 1-10. Escalates the hot ones to you.",
    highlight: "Check the Leads page in the sidebar to see your pipeline.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    badge: "CONTENT ENGINE",
    badgeColor: "bg-pink-500/20 text-pink-400",
    headline: "Content Created, Not Outsourced",
    body: "Your Content Agent generates Instagram posts, pitch decks, landing pages, and drip campaigns — all tailored to your projects and audience. You approve the content, it gets published.",
    highlight: "Try: \"Create an Instagram post about our new JVC listings\"",
  },
  {
    icon: <Eye className="h-5 w-5" />,
    badge: "MARKET INTEL",
    badgeColor: "bg-cyan-500/20 text-cyan-400",
    headline: "Know Before Your Competitors",
    body: "Your Market Intel Agent tracks DLD transactions, new project launches, competitor listings, and price movements. You get insights, not raw data.",
    highlight: "Try: \"What's happening in the JVC market?\"",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    badge: "COST TRANSPARENT",
    badgeColor: "bg-orange-500/20 text-orange-400",
    headline: "Every Dirham Tracked",
    body: "See exactly what each agent costs — broken down by model, by task, by day. Set budget caps per agent or agency-wide. Get alerts at 80%. No surprises.",
    highlight: "Check Budget in the sidebar for real-time cost tracking.",
  },
];

// ── Injected styles ──────────────────────────────────────────────

const TOUR_STYLES = `
@keyframes tour-slide-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tour-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(16, 185, 129, 0.15); }
}
@keyframes tour-pulse-dot {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.4); opacity: 1; }
}
.tour-card { animation: tour-slide-in 0.5s ease-out both; }
.tour-glow { animation: tour-glow 2s ease-in-out infinite; }
.tour-dot { animation: tour-pulse-dot 1.5s ease-in-out infinite; }
`;

let _injected = false;
function injectTourStyles() {
  if (_injected) return;
  const s = document.createElement("style");
  s.textContent = TOUR_STYLES;
  document.head.appendChild(s);
  _injected = true;
}

// ── Tour component ───────────────────────────────────────────────

export function InteractiveTour({ onComplete, onSendMessage }: {
  onComplete: () => void;
  onSendMessage?: (msg: string) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => { injectTourStyles(); }, []);

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  function next() {
    if (isLast) {
      setVisible(false);
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleCta() {
    if (step.cta && onSendMessage) {
      onSendMessage(step.cta);
    }
    next();
  }

  return (
    <div className="tour-card mb-4">
      <div className="tour-glow rounded-2xl border border-primary/20 bg-gradient-to-b from-card to-card/80 overflow-hidden">

        {/* Progress bar */}
        <div className="h-[3px] bg-primary/10">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-5">

          {/* Badge + step counter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${step.badgeColor}`}>
                <div className="tour-dot w-1.5 h-1.5 rounded-full bg-current" />
                {step.badge}
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
          </div>

          {/* Icon + headline */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              {step.icon}
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-foreground leading-tight">
                {step.headline}
              </h3>
            </div>
          </div>

          {/* Body */}
          <p className="text-[13px] text-muted-foreground leading-[1.6] mb-3">
            {step.body}
          </p>

          {/* Highlight tip */}
          {step.highlight && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-[12px] text-primary/80 leading-[1.5]">
                {step.highlight}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step.cta ? (
              <button
                onClick={handleCta}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Try "{step.cta}"
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {isLast ? "Let's get to work" : "Next"}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}

            {!isLast && (
              <button
                onClick={() => { setVisible(false); onComplete(); }}
                className="rounded-xl px-4 py-2.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
