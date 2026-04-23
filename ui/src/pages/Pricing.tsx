import { useEffect } from "react";
import { COMPANY_INFO } from "@/lib/company-info";

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
    cta: { label: "Start 14-day trial", href: "/signup" },
    featured: false,
  },
  {
    name: "Growth",
    price: "AED 1,499",
    cadence: "per month",
    summary: "For growing agencies with 2–5 brokers.",
    features: [
      "CEO agent + 5 specialist agents",
      "All Starter integrations + Property Finder, Bayut, Dubizzle",
      "Up to 2,000 leads in pipeline",
      "Multilingual lead handling (EN/AR/RU)",
      "Priority support & onboarding call",
    ],
    cta: { label: "Start 14-day trial", href: "/signup" },
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
    cta: { label: "Start 14-day trial", href: "/signup" },
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
      "Dedicated Dubai-based account team",
    ],
    cta: { label: "Contact sales", href: "/contact" },
    featured: false,
  },
];

export default function Pricing() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="legal-root">
        <nav className="legal-nav">
          <div className="legal-nav-inner">
            <a href="/landing" className="legal-logo">
              <div className="legal-logo-mark" />
              <span>{COMPANY_INFO.name}</span>
            </a>
            <div className="legal-nav-links">
              <a href="/about">About</a>
              <a href="/pricing" className="active">Pricing</a>
              <a href="/contact">Contact</a>
              <a href="/login" className="nav-login">Log in</a>
            </div>
          </div>
        </nav>

        <main className="pricing-content">
          <div className="pricing-header">
            <h1>Pricing</h1>
            <p>Flat monthly rate. No per-message fees. No per-agent metering. Cancel anytime.</p>
          </div>

          <div className="tier-grid">
            {TIERS.map((t) => (
              <div key={t.name} className={`tier ${t.featured ? "tier-featured" : ""}`}>
                {t.featured && <div className="tier-badge">Most popular</div>}
                <h2>{t.name}</h2>
                <div className="tier-price">
                  <span className="tier-price-main">{t.price}</span>
                  <span className="tier-price-cadence">{t.cadence}</span>
                </div>
                <p className="tier-summary">{t.summary}</p>
                <ul className="tier-features">
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href={t.cta.href} className="tier-cta">{t.cta.label}</a>
              </div>
            ))}
          </div>

          <div className="pricing-notes">
            <h3>What's included in every plan</h3>
            <ul>
              <li>Full Dubai real-estate tool library: DLD transactions, RERA rent calculator, payment-plan generator</li>
              <li>Role-scoped permissions — a Content agent can never send a WhatsApp</li>
              <li>Encrypted at rest, multi-tenant isolation, UAE PDPA compliant</li>
              <li>Every outbound message requires your approval</li>
            </ul>

            <h3>Frequently asked</h3>
            <dl className="pricing-faq">
              <dt>Do I need a RERA licence?</dt>
              <dd>Yes. Aygentis is a software platform. All real-estate brokerage activity is performed by you under your own RERA licence.</dd>

              <dt>What about WhatsApp fees?</dt>
              <dd>Meta charges per-conversation fees (~$0.03–$0.08 USD) billed separately. A typical agency spends AED 150–250/month.</dd>

              <dt>Can I change plans?</dt>
              <dd>Yes. Upgrade or downgrade anytime. Changes apply on your next billing cycle.</dd>

              <dt>Do you offer annual billing?</dt>
              <dd>Yes — two months free when you pay annually. <a href="/contact">Contact sales</a>.</dd>
            </dl>
          </div>
        </main>

        <footer className="legal-footer">
          <p>&copy; {new Date().getFullYear()} {COMPANY_INFO.name}. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

const styles = `
.legal-root {
  --l-bg: #09090b;
  --l-text: #e8e8ec;
  --l-text-dim: #7a7a88;
  --l-text-muted: #4a4a55;
  --l-accent: #7c9a8e;
  --l-border: #1a1a22;
  --l-font: 'Outfit', -apple-system, sans-serif;
  background: var(--l-bg); color: var(--l-text); font-family: var(--l-font);
  min-height: 100vh; -webkit-font-smoothing: antialiased;
}
.legal-nav { border-bottom: 1px solid var(--l-border); backdrop-filter: blur(20px); background: rgba(9,9,11,0.8); position: sticky; top: 0; z-index: 10; }
.legal-nav-inner { max-width: 1200px; margin: 0 auto; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.legal-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--l-text); text-decoration: none; }
.legal-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--l-accent), #5a7a6e); }
.legal-nav-links { display: flex; align-items: center; gap: 24px; }
.legal-nav-links a { color: var(--l-text-dim); text-decoration: none; font-size: 14px; font-weight: 500; }
.legal-nav-links a:hover, .legal-nav-links a.active { color: var(--l-text); }
.legal-nav-links .nav-login { padding: 8px 16px; border: 1px solid var(--l-border); border-radius: 8px; color: var(--l-text); }

.pricing-content { max-width: 1200px; margin: 0 auto; padding: 60px 32px 80px; }
.pricing-header { text-align: center; margin-bottom: 56px; }
.pricing-header h1 { font-size: 48px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 12px; }
.pricing-header p { font-size: 17px; color: var(--l-text-dim); margin: 0; }

.tier-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 72px; }
@media (max-width: 1100px) { .tier-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .tier-grid { grid-template-columns: 1fr; } }
.tier { position: relative; padding: 28px 24px; border: 1px solid var(--l-border); border-radius: 14px; background: #0c0c10; display: flex; flex-direction: column; }
.tier-featured { border-color: var(--l-accent); background: linear-gradient(180deg, rgba(124,154,142,0.06), #0c0c10); }
.tier-badge { position: absolute; top: -11px; left: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; background: var(--l-accent); color: #09090b; border-radius: 999px; }
.tier h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.tier-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
.tier-price-main { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: var(--l-text); }
.tier-price-cadence { font-size: 13px; color: var(--l-text-muted); }
.tier-summary { font-size: 14px; color: var(--l-text-dim); margin: 0 0 20px; line-height: 1.5; }
.tier-features { list-style: none; margin: 0 0 24px; padding: 0; flex: 1; }
.tier-features li { font-size: 14px; color: var(--l-text-dim); padding: 6px 0 6px 22px; position: relative; line-height: 1.5; }
.tier-features li::before { content: ''; position: absolute; left: 0; top: 13px; width: 12px; height: 2px; background: var(--l-accent); border-radius: 1px; }
.tier-cta { display: block; text-align: center; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1px solid var(--l-border); color: var(--l-text); transition: background 0.15s, border-color 0.15s; }
.tier-cta:hover { background: #15151a; border-color: var(--l-accent); }
.tier-featured .tier-cta { background: var(--l-accent); color: #09090b; border-color: var(--l-accent); }
.tier-featured .tier-cta:hover { background: #8aab9e; }

.pricing-notes { max-width: 760px; margin: 0 auto; }
.pricing-notes h3 { font-size: 18px; font-weight: 700; margin: 32px 0 14px; color: var(--l-text); }
.pricing-notes ul { margin: 0 0 8px; padding-left: 24px; }
.pricing-notes li { font-size: 15px; line-height: 1.7; color: var(--l-text-dim); margin-bottom: 6px; }
.pricing-faq dt { font-size: 15px; font-weight: 600; color: var(--l-text); margin-top: 18px; }
.pricing-faq dd { font-size: 15px; color: var(--l-text-dim); margin: 6px 0 0; line-height: 1.7; }
.pricing-faq a { color: var(--l-accent); text-decoration: none; }
.pricing-faq a:hover { text-decoration: underline; }

.legal-footer { border-top: 1px solid var(--l-border); padding: 32px; text-align: center; }
.legal-footer p { font-size: 13px; color: var(--l-text-muted); }
`;
