import { useEffect } from "react";
import QovesShell from "./_QovesShell";

const TIERS = [
  {
    name: "Starter",
    price: "AED 999",
    cadence: "per month",
    summary: "For solo brokers and boutique agencies.",
    features: [
      "CEO agent + 2 specialist agents",
      "WhatsApp, Gmail, Instagram integrations",
      "Up to 500 leads in pipeline",
      "Approval queue and morning briefs",
      "Email support",
    ],
    cta: "Start trial",
    featured: false,
  },
  {
    name: "Growth",
    price: "AED 1,499",
    cadence: "per month",
    summary: "For growing agencies with 2–5 brokers.",
    features: [
      "CEO agent + 5 specialist agents",
      "All Starter integrations + PF, Bayut, Dubizzle",
      "Up to 2,000 leads in pipeline",
      "Multilingual lead handling (EN/AR/RU)",
      "Priority support & onboarding",
    ],
    cta: "Start trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "AED 2,499",
    cadence: "per month",
    summary: "For established agencies with 5+ brokers.",
    features: [
      "CEO agent + 10 specialist agents",
      "All Growth integrations + Meta Ads, Google Ads",
      "Unlimited leads",
      "Per-broker WhatsApp numbers",
      "Dedicated success manager",
    ],
    cta: "Start trial",
    featured: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "talk to us",
    summary: "White-label for agencies with 15+ brokers.",
    features: [
      "Unlimited agents",
      "Custom domain and branding",
      "Private AI infrastructure",
      "SLA-backed uptime",
      "Dedicated Dubai account team",
    ],
    cta: "Contact sales",
    featured: false,
  },
];

const FAQS = [
  { q: "Do I need a RERA licence?", a: "Yes. Aygentis is software. All brokerage activity is performed by you under your own RERA licence." },
  { q: "What about WhatsApp fees?", a: "Meta charges per-conversation fees (~$0.03–$0.08). A typical agency spends AED 150–250/month." },
  { q: "Can I change plans?", a: "Yes. Upgrade or downgrade anytime. Changes apply on your next billing cycle." },
  { q: "Do you offer annual billing?", a: "Yes — two months free when paid annually. Contact sales for details." },
];

export default function Pricing() {
  useEffect(() => { document.title = "Pricing — Aygentis"; }, []);

  return (
    <QovesShell>
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-20 text-center md:py-24">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Pricing</p>
          <h1 className="mt-5 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.4rem,5vw,4.5rem)] font-[600] leading-[1.04] tracking-[-0.028em]">
            Flat monthly rate.
            <br />
            <span className="text-[var(--ink-20)]">No per-message fees.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[52ch] text-[17px] font-[400] leading-[1.55] text-[var(--muted)]">
            No per-agent metering. Cancel anytime. Every plan includes the full Dubai real-estate
            tool library and role-scoped permissions.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1240px] px-8 py-16 md:py-20">
          <div className="grid gap-5 md:grid-cols-4">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-md border p-7 ${t.featured ? "border-[var(--ink)] bg-white" : "border-[var(--hairline)] bg-white"}`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-6 rounded bg-[var(--ink)] px-2.5 py-1 text-[10px] font-[600] uppercase tracking-[0.12em] text-white">
                    Most popular
                  </span>
                )}
                <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">{t.name}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="[font-family:'Hanken_Grotesk',system-ui] text-[32px] font-[600] leading-[1] tracking-[-0.02em] text-[var(--ink)]">
                    {t.price}
                  </span>
                  <span className="text-[12px] text-[var(--muted)]">{t.cadence}</span>
                </div>
                <p className="mt-3 text-[14px] font-[400] leading-[1.55] text-[var(--muted)]">{t.summary}</p>
                <ul className="mt-6 flex-1 space-y-3 border-t border-[var(--hairline)] pt-6">
                  {t.features.map((f) => (
                    <li key={f} className="grid grid-cols-[16px_1fr] items-start gap-3 text-[14px] leading-[1.5] text-[var(--muted)]">
                      <span className="mt-[7px] inline-block h-[1.5px] w-[10px] bg-[var(--ink)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/contact"
                  className={`mt-8 inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-[500] transition ${
                    t.featured
                      ? "bg-[var(--ink)] text-white hover:bg-black"
                      : "border border-[var(--hairline)] text-[var(--ink)] hover:border-[var(--ink)]"
                  }`}
                >
                  {t.cta} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[0.4fr_1fr] md:py-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">What&apos;s included</p>
          <ul className="space-y-4 text-[16px] font-[400] leading-[1.6] text-[var(--muted)]">
            <li>Full Dubai real-estate tool library: DLD transactions, RERA rent calculator, payment-plan generator.</li>
            <li>Role-scoped permissions — a Content agent can never send a WhatsApp.</li>
            <li>Encrypted at rest, multi-tenant isolation, UK GDPR compliant.</li>
            <li>Every outbound message requires your approval.</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[0.4fr_1fr] md:py-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Frequently asked</p>
          <dl className="space-y-7">
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt className="text-[17px] font-[500] leading-[1.4] text-[var(--ink)]">{f.q}</dt>
                <dd className="mt-2 max-w-[62ch] text-[15.5px] font-[400] leading-[1.65] text-[var(--muted)]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </QovesShell>
  );
}
