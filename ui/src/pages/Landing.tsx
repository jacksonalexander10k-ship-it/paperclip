import { useNavigate } from "@/lib/router";
import { Bot, Shield, MessageSquare } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-lg font-bold">Aygency World</span>
        <div className="flex gap-3">
          <button onClick={() => navigate("/auth")} className="text-sm text-muted-foreground hover:text-foreground">
            Sign In
          </button>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Your AI agency.<br />Always working.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Run a full Dubai real estate agency with AI agents that handle leads, content, market intel, and viewings — 24/7. You approve. They execute.
        </p>
        <button
          onClick={() => navigate("/auth?mode=signup")}
          className="mt-8 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
        >
          Start 7-Day Free Trial
        </button>
        <p className="mt-3 text-xs text-muted-foreground">No credit card required to explore. Card needed to activate agents.</p>
      </section>

      {/* Value props */}
      <section className="px-6 py-16 max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        {[
          { icon: Bot, title: "AI agents that never sleep", desc: "Lead response in under 5 minutes. Content posted daily. Market intel every 2 hours. While you sleep." },
          { icon: Shield, title: "You approve everything", desc: "No WhatsApp sent, no email fired, no post published without your explicit approval in the CEO Chat." },
          { icon: MessageSquare, title: "One chat, full control", desc: "Talk to your CEO agent. It manages the team, reports back, and escalates what matters." },
        ].map((p) => (
          <div key={p.title} className="rounded-xl border border-border p-6">
            <p.icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-2">{p.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </section>

      {/* Agent showcase */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Your AI team</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "\u{1F454}", name: "CEO", desc: "Strategy, delegation, morning briefs" },
            { icon: "\u{1F4AC}", name: "Lead Agent", desc: "Inbound leads, scoring, follow-ups" },
            { icon: "\u{1F3A8}", name: "Content Agent", desc: "Instagram, pitch decks, campaigns" },
            { icon: "\u{1F4CA}", name: "Market Agent", desc: "DLD data, listings, news alerts" },
          ].map((a) => (
            <div key={a.name} className="rounded-xl border border-border p-4 text-center">
              <span className="text-3xl">{a.icon}</span>
              <p className="font-semibold mt-2">{a.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Simple pricing</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "Starter", price: "$49", agents: "CEO + 2", highlight: false },
            { name: "Growth", price: "$99", agents: "CEO + 5", highlight: true },
            { name: "Scale", price: "$199", agents: "CEO + 10", highlight: false },
            { name: "Enterprise", price: "Custom", agents: "Unlimited", highlight: false },
          ].map((t) => (
            <div key={t.name} className={`rounded-xl border p-5 ${t.highlight ? "border-primary bg-primary/5" : "border-border"}`}>
              <p className="font-semibold">{t.name}</p>
              <p className="text-2xl font-bold mt-2">{t.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1">{t.agents} agents</p>
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium ${t.highlight ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
              >
                Start Free
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">Aygency World — Part of the Aygent ecosystem</p>
      </footer>
    </div>
  );
}
