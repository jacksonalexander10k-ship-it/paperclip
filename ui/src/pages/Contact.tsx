import { useEffect, useState } from "react";
import { COMPANY_INFO } from "@/lib/company-info";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.message.trim()) return;
    setSubmitted(true);
  };

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
          </div>
        </nav>

        <main className="legal-content">
          <div className="legal-header">
            <h1>Contact</h1>
            <p className="legal-date">We reply within one business day.</p>
          </div>

          <section className="contact-grid">
            <div className="contact-details">
              <p className="contact-line">{COMPANY_INFO.address}</p>
              <p className="contact-line">
                <a href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>
              </p>
            </div>

            <form className="contact-form" onSubmit={onSubmit}>
              {submitted ? (
                <div className="contact-success">
                  <h3>Thanks — message received.</h3>
                  <p>We'll reply to {form.email} within one business day.</p>
                </div>
              ) : (
                <>
                  <label>
                    <span>Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>How can we help?</span>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      required
                    />
                  </label>
                  <button type="submit">Send message</button>
                </>
              )}
            </form>
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
  background: var(--l-bg);
  color: var(--l-text);
  font-family: var(--l-font);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
.legal-nav { border-bottom: 1px solid var(--l-border); backdrop-filter: blur(20px); background: rgba(9,9,11,0.8); position: sticky; top: 0; z-index: 10; }
.legal-nav-inner { max-width: 1040px; margin: 0 auto; padding: 16px 32px; }
.legal-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--l-text); text-decoration: none; }
.legal-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--l-accent), #5a7a6e); }
.legal-content { max-width: 1040px; margin: 0 auto; padding: 60px 32px 80px; }
.legal-header { margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid var(--l-border); }
.legal-header h1 { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 8px; }
.legal-date { color: var(--l-text-muted); font-size: 14px; }
.legal-content p { font-size: 15px; line-height: 1.75; color: var(--l-text-dim); margin: 0 0 12px; }
.legal-content a { color: var(--l-accent); text-decoration: none; }
.legal-content a:hover { text-decoration: underline; }

.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; }
@media (max-width: 820px) { .contact-grid { grid-template-columns: 1fr; } }
.contact-details .contact-line { font-size: 15px; line-height: 1.75; color: var(--l-text); margin: 0 0 10px; }

.contact-form { display: flex; flex-direction: column; gap: 14px; }
.contact-form label { display: flex; flex-direction: column; gap: 6px; }
.contact-form label span { font-size: 13px; color: var(--l-text-dim); }
.contact-form input, .contact-form textarea {
  background: #111116; border: 1px solid var(--l-border); border-radius: 8px;
  padding: 12px 14px; color: var(--l-text); font: inherit; font-size: 15px;
  outline: none; transition: border-color 0.15s;
}
.contact-form input:focus, .contact-form textarea:focus { border-color: var(--l-accent); }
.contact-form textarea { resize: vertical; min-height: 120px; }
.contact-form button {
  margin-top: 8px; padding: 13px 20px; border-radius: 8px; border: none;
  background: var(--l-accent); color: #09090b; font: inherit; font-weight: 600;
  font-size: 15px; cursor: pointer; transition: background 0.15s;
}
.contact-form button:hover { background: #8aab9e; }
.contact-success { padding: 32px; border: 1px solid var(--l-accent); border-radius: 12px; background: rgba(124,154,142,0.05); }
.contact-success h3 { color: var(--l-accent); margin: 0 0 8px; font-size: 18px; }
.contact-success p { color: var(--l-text-dim); font-size: 15px; margin: 0; }

.legal-footer { border-top: 1px solid var(--l-border); padding: 32px; text-align: center; }
.legal-footer p { font-size: 13px; color: var(--l-text-muted); }
`;
