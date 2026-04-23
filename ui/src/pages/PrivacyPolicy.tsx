import { useEffect } from "react";

export default function PrivacyPolicy() {
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
              <span>Aygentis</span>
            </a>
          </div>
        </nav>

        <main className="legal-content">
          <div className="legal-header">
            <h1>Privacy Policy</h1>
            <p className="legal-date">Last updated: April 13, 2026</p>
          </div>

          <section>
            <h2>1. Introduction</h2>
            <p>
              Aygentis ("we," "our," or "us") operates a multi-agent AI platform that helps
              Dubai real estate professionals manage their business operations. This Privacy Policy
              describes how we collect, use, store, and protect your personal information when you
              use our platform, website, and related services (collectively, the "Service").
            </p>
            <p>
              By using the Service, you agree to the collection and use of information in accordance
              with this policy. If you do not agree with this policy, please do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul>
              <li>Full name and email address</li>
              <li>Agency name and RERA licence number</li>
              <li>Phone number</li>
              <li>Password (stored in hashed form only)</li>
            </ul>

            <h3>2.2 Integration Data</h3>
            <p>
              When you connect third-party services to Aygentis, we store OAuth access tokens
              and refresh tokens required to operate on your behalf. This includes:
            </p>
            <ul>
              <li><strong>WhatsApp Business API:</strong> Access tokens, phone number IDs, message content sent and received through the platform, message delivery status, and conversation metadata.</li>
              <li><strong>Gmail:</strong> OAuth tokens for reading inbound lead notifications (Property Finder, Bayut, Dubizzle) and sending emails on your behalf. We do not read emails unrelated to real estate leads.</li>
              <li><strong>Google Calendar:</strong> OAuth tokens for reading and creating viewing appointments.</li>
              <li><strong>Instagram:</strong> OAuth tokens for content publishing and DM management.</li>
              <li><strong>Facebook/Meta Ads:</strong> OAuth tokens for campaign management, ad performance data, and lead form submissions.</li>
            </ul>
            <p>
              All OAuth tokens are encrypted at rest using AES-256-GCM encryption before storage in our database.
            </p>

            <h3>2.3 Lead and Contact Data</h3>
            <p>
              When leads contact your agency through connected channels, we collect and process:
            </p>
            <ul>
              <li>Name, phone number, and email address</li>
              <li>Message content and conversation history</li>
              <li>Property preferences (area, budget, property type, timeline)</li>
              <li>Lead source and referral information</li>
              <li>Language preference (auto-detected from messages)</li>
            </ul>

            <h3>2.4 Usage Data</h3>
            <p>We automatically collect information about how you use the Service:</p>
            <ul>
              <li>Agent activity logs (which AI agents ran, what actions they took)</li>
              <li>Approval decisions (approved, edited, rejected)</li>
              <li>Token consumption and cost metrics</li>
              <li>Feature usage patterns</li>
              <li>Browser type, IP address, and device information</li>
            </ul>

            <h3>2.5 WhatsApp Message Data</h3>
            <p>
              As a Meta Technology Partner using the WhatsApp Business API, we process WhatsApp
              messages strictly for the purpose of facilitating business communication between your
              agency and your leads/clients. We:
            </p>
            <ul>
              <li>Store message content to maintain conversation history and provide context to AI agents</li>
              <li>Process message content to detect language, qualify leads, and generate appropriate responses</li>
              <li>Never use WhatsApp message data for advertising purposes</li>
              <li>Never share WhatsApp message data with third parties except as required to provide the Service</li>
              <li>Retain message data only for as long as the agency account is active, plus 90 days</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Operate and maintain the Service, including AI agent execution</li>
              <li>Process and respond to leads on your behalf (with your approval)</li>
              <li>Generate content, market analysis, and business intelligence</li>
              <li>Send you notifications about agent activity, approvals, and escalations</li>
              <li>Track costs and usage for billing purposes</li>
              <li>Improve the Service through aggregated, anonymized analytics</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Isolation and Multi-Tenancy</h2>
            <p>
              Aygentis is a multi-tenant platform. Every data record in our database is scoped
              to a specific agency via a unique company identifier. This means:
            </p>
            <ul>
              <li>Agency A's data is completely invisible to Agency B</li>
              <li>AI agents can only access data belonging to their own agency</li>
              <li>API keys are scoped to (agent_id, company_id) pairs — cross-agency access is architecturally impossible</li>
              <li>OAuth credentials are stored per-agency and per-agent, never shared</li>
            </ul>
          </section>

          <section>
            <h2>5. AI Processing and Data Handling</h2>
            <p>
              Our AI agents process your data using large language models (LLMs) provided by
              Anthropic (Claude) and Google (Gemini). When your data is sent to these providers:
            </p>
            <ul>
              <li>Data is transmitted over encrypted connections (TLS 1.3)</li>
              <li>Neither Anthropic nor Google retains your data for training purposes under our enterprise agreements</li>
              <li>Prompts and responses are logged internally for debugging and cost tracking, scoped to your agency</li>
              <li>Inbound messages are sanitized to prevent prompt injection before AI processing</li>
            </ul>

            <h3>5.1 Learning System</h3>
            <p>
              When you edit an AI-drafted message before approving it, the correction is stored as
              an "instinct" — a learned behaviour pattern scoped exclusively to your agency. Instincts
              are never shared across agencies and are processed locally. You can view, edit, or
              delete all learned behaviours in your Settings.
            </p>
          </section>

          <section>
            <h2>6. Data Storage and Security</h2>
            <ul>
              <li><strong>Encryption at rest:</strong> All OAuth tokens and sensitive credentials are encrypted using AES-256-GCM</li>
              <li><strong>Encryption in transit:</strong> All data transmitted between your browser and our servers uses TLS 1.3</li>
              <li><strong>Database:</strong> PostgreSQL with row-level security enforced via company_id scoping</li>
              <li><strong>Infrastructure:</strong> Hosted on dedicated servers with restricted access</li>
              <li><strong>Access controls:</strong> Role-based access (Owner, Manager, Broker, Viewer) with principle of least privilege</li>
              <li><strong>Audit trail:</strong> Immutable activity log for every agent action and data access</li>
            </ul>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <ul>
              <li><strong>Active accounts:</strong> Data is retained for the duration of your subscription</li>
              <li><strong>Cancelled accounts:</strong> Data is retained for 90 days after cancellation, then permanently deleted</li>
              <li><strong>Agent activity logs:</strong> Retained for 12 months for auditing purposes</li>
              <li><strong>WhatsApp messages:</strong> Retained while account is active plus 90 days after cancellation</li>
              <li><strong>Billing records:</strong> Retained for 7 years as required by UAE commercial law</li>
            </ul>
          </section>

          <section>
            <h2>8. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul>
              <li><strong>AI providers</strong> (Anthropic, Google) — to execute agent tasks, under enterprise data processing agreements</li>
              <li><strong>Meta/WhatsApp</strong> — to send and receive messages via the WhatsApp Business API</li>
              <li><strong>Payment processor</strong> (Stripe) — to process subscription payments</li>
              <li><strong>Law enforcement</strong> — only when legally compelled by valid legal process</li>
            </ul>
          </section>

          <section>
            <h2>9. Your Rights</h2>
            <p>Under the UAE Personal Data Protection Act (PDPA) and applicable law, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> your personal data and request a copy</li>
              <li><strong>Correct</strong> inaccurate or incomplete data</li>
              <li><strong>Delete</strong> your data (request full account and data deletion)</li>
              <li><strong>Export</strong> your data in a machine-readable format</li>
              <li><strong>Withdraw consent</strong> for specific processing activities</li>
              <li><strong>Object</strong> to processing of your data</li>
              <li><strong>Opt out</strong> of WhatsApp communications (leads can reply "STOP" to any message)</li>
            </ul>
            <p>To exercise any of these rights, contact us at <strong>privacy@aygentis.com</strong>.</p>
          </section>

          <section>
            <h2>10. WhatsApp Opt-Out and Lead Privacy</h2>
            <p>
              Leads and clients who receive messages through your agency's WhatsApp numbers can
              opt out at any time by replying "STOP" or "unsubscribe." When a lead opts out:
            </p>
            <ul>
              <li>The lead is immediately tagged as opted-out</li>
              <li>No further WhatsApp messages will be sent to that number</li>
              <li>This is enforced at the system level — individual agents cannot override it</li>
              <li>Opt-out status is permanent unless the lead explicitly re-initiates contact</li>
            </ul>
          </section>

          <section>
            <h2>11. Cookies and Tracking</h2>
            <p>We use essential cookies for:</p>
            <ul>
              <li>Session authentication</li>
              <li>Theme preference (light/dark mode)</li>
              <li>Onboarding state</li>
            </ul>
            <p>
              We do not use third-party advertising cookies or cross-site tracking.
            </p>
          </section>

          <section>
            <h2>12. Children's Privacy</h2>
            <p>
              The Service is designed for business professionals and is not intended for use by
              anyone under the age of 18. We do not knowingly collect personal information from
              children.
            </p>
          </section>

          <section>
            <h2>13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on our website and updating the "Last updated"
              date. Your continued use of the Service after changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2>14. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:</p>
            <ul>
              <li><strong>Email:</strong> privacy@aygentis.com</li>
              <li><strong>Website:</strong> aygentis.com</li>
            </ul>
          </section>
        </main>

        <footer className="legal-footer">
          <p>&copy; 2026 Aygentis. All rights reserved.</p>
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

.legal-nav {
  border-bottom: 1px solid var(--l-border);
  backdrop-filter: blur(20px);
  background: rgba(9, 9, 11, 0.8);
  position: sticky;
  top: 0;
  z-index: 10;
}
.legal-nav-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 32px;
}
.legal-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  color: var(--l-text);
  text-decoration: none;
}
.legal-logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--l-accent), #5a7a6e);
}

.legal-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 60px 32px 80px;
}
.legal-header {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--l-border);
}
.legal-header h1 {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0 0 8px;
}
.legal-date {
  color: var(--l-text-muted);
  font-size: 14px;
}

.legal-content section {
  margin-bottom: 40px;
}
.legal-content h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 16px;
  color: var(--l-text);
  letter-spacing: -0.02em;
}
.legal-content h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: var(--l-accent);
}
.legal-content p {
  font-size: 15px;
  line-height: 1.75;
  color: var(--l-text-dim);
  margin: 0 0 12px;
}
.legal-content ul {
  margin: 0 0 16px;
  padding-left: 24px;
}
.legal-content li {
  font-size: 15px;
  line-height: 1.75;
  color: var(--l-text-dim);
  margin-bottom: 6px;
}
.legal-content li strong {
  color: var(--l-text);
}

.legal-footer {
  border-top: 1px solid var(--l-border);
  padding: 32px;
  text-align: center;
}
.legal-footer p {
  font-size: 13px;
  color: var(--l-text-muted);
}
`;
