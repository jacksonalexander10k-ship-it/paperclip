import { useEffect } from "react";
import { COMPANY_INFO } from "@/lib/company-info";

export default function About() {
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
              <a href="/about" className="active">About</a>
              <a href="/pricing">Pricing</a>
              <a href="/contact">Contact</a>
              <a href="/auth" className="nav-login">Log in</a>
            </div>
          </div>
        </nav>

        <main className="legal-content">
          <div className="legal-header">
            <h1>About {COMPANY_INFO.name}</h1>
          </div>

          <section>
            <p>
              {COMPANY_INFO.name} is a multi-agent AI platform for Dubai real estate agencies.
              Our customers use our software to handle lead enquiries, create content, monitor
              the market, schedule viewings, and manage their portfolios.
            </p>
            <p>
              Every outbound message our agents prepare requires explicit approval from the
              agency owner before it is sent. We are a software provider, not a licensed real
              estate broker.
            </p>
            <p>
              Contact: <a href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>
              <br />
              Address: {COMPANY_INFO.address}
            </p>
          </section>
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
.legal-nav-inner { max-width: 960px; margin: 0 auto; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.legal-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--l-text); text-decoration: none; }
.legal-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--l-accent), #5a7a6e); }
.legal-nav-links { display: flex; align-items: center; gap: 24px; }
.legal-nav-links a { color: var(--l-text-dim); text-decoration: none; font-size: 14px; font-weight: 500; }
.legal-nav-links a:hover, .legal-nav-links a.active { color: var(--l-text); }
.legal-nav-links .nav-login { padding: 8px 16px; border: 1px solid var(--l-border); border-radius: 8px; color: var(--l-text); }

.legal-content { max-width: 720px; margin: 0 auto; padding: 60px 32px 80px; }
.legal-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--l-border); }
.legal-header h1 { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.legal-content p { font-size: 16px; line-height: 1.75; color: var(--l-text-dim); margin: 0 0 16px; }
.legal-content a { color: var(--l-accent); text-decoration: none; }
.legal-content a:hover { text-decoration: underline; }

.legal-footer { border-top: 1px solid var(--l-border); padding: 32px; text-align: center; }
.legal-footer p { font-size: 13px; color: var(--l-text-muted); }
`;
