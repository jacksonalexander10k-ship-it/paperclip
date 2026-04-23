import { useEffect } from "react";

export default function TermsOfService() {
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
            <h1>Terms of Service</h1>
            <p className="legal-date">Last updated: April 13, 2026</p>
          </div>

          <section>
            <h2>1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") govern your access to and use of the Aygentis
              platform, website, and related services (collectively, the "Service") operated by
              Aygentis ("we," "our," or "us").
            </p>
            <p>
              By creating an account or using the Service, you agree to be bound by these Terms.
              If you do not agree, do not use the Service. If you are using the Service on behalf
              of a business entity, you represent that you have authority to bind that entity to
              these Terms.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              Aygentis is a multi-agent AI platform designed for Dubai real estate professionals.
              The Service provides:
            </p>
            <ul>
              <li>AI-powered agents that assist with lead management, content creation, market intelligence, viewing coordination, and business advisory</li>
              <li>Integration with third-party communication platforms (WhatsApp, Gmail, Instagram) to facilitate business communication</li>
              <li>A centralized dashboard ("Mission Control") for managing agent activity and approving outbound communications</li>
              <li>Automated lead qualification, follow-up, and pipeline management</li>
              <li>Content generation and social media management tools</li>
            </ul>
            <p>
              The Service uses artificial intelligence to draft communications, generate content,
              and make recommendations. All outbound communications (WhatsApp messages, emails,
              social media posts) require your explicit approval before being sent, unless you have
              configured auto-approval rules.
            </p>
          </section>

          <section>
            <h2>3. Account Registration</h2>
            <ul>
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must notify us immediately of any unauthorized use of your account</li>
              <li>You may not share your account with others or create multiple accounts</li>
              <li>You must be at least 18 years old to use the Service</li>
            </ul>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <p>You agree NOT to use the Service to:</p>
            <ul>
              <li>Send unsolicited bulk messages or spam through connected WhatsApp numbers or email accounts</li>
              <li>Violate Meta's WhatsApp Business Policy, Commerce Policy, or Business Messaging Guidelines</li>
              <li>Harass, threaten, or abuse any person</li>
              <li>Send deceptive, misleading, or fraudulent communications</li>
              <li>Violate UAE real estate advertising regulations (RERA) or make misleading property claims</li>
              <li>Guarantee rental yields or capital appreciation without official RERA data sources</li>
              <li>Collect or process personal data in violation of the UAE Personal Data Protection Act (PDPA)</li>
              <li>Attempt to access other agencies' data or circumvent data isolation controls</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Use the Service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2>5. WhatsApp Business API Usage</h2>
            <p>
              By connecting a WhatsApp Business number to the Service, you acknowledge and agree that:
            </p>
            <ul>
              <li>You are the authorized user of the WhatsApp Business number being connected</li>
              <li>You will comply with Meta's WhatsApp Business Policy and Commerce Policy at all times</li>
              <li>You will only send messages to individuals who have expressed interest in your services or have an existing business relationship with your agency</li>
              <li>You will honour all opt-out requests immediately — the system enforces this automatically</li>
              <li>You are responsible for the content of all messages sent through the Service, including AI-drafted messages that you approve</li>
              <li>Message templates submitted to Meta for approval are your responsibility to ensure compliance</li>
              <li>We may suspend your WhatsApp integration if Meta flags your number for quality issues</li>
            </ul>
          </section>

          <section>
            <h2>6. AI-Generated Content</h2>
            <p>
              The Service uses AI to draft messages, generate content, and provide recommendations.
              You acknowledge that:
            </p>
            <ul>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>You are responsible for reviewing and approving all AI-generated content before it is sent or published</li>
              <li>AI recommendations (lead scores, market analysis, investment insights) are informational and do not constitute professional advice</li>
              <li>We do not guarantee the accuracy, completeness, or suitability of any AI-generated content</li>
              <li>You should not rely solely on AI-generated content for critical business decisions</li>
            </ul>
          </section>

          <section>
            <h2>7. Third-Party Integrations</h2>
            <p>
              The Service integrates with third-party platforms including Meta (WhatsApp, Instagram,
              Facebook), Google (Gmail, Calendar), and others. You acknowledge that:
            </p>
            <ul>
              <li>Your use of these integrations is also subject to the respective third-party terms of service</li>
              <li>We are not responsible for changes to third-party APIs, policies, or availability</li>
              <li>Third-party service outages may affect Service functionality</li>
              <li>You grant us permission to access and use your connected accounts as necessary to provide the Service</li>
              <li>You may disconnect any integration at any time through your Settings</li>
            </ul>
          </section>

          <section>
            <h2>8. Subscription and Payment</h2>
            <ul>
              <li>The Service is offered on a subscription basis with different tiers</li>
              <li>Subscription fees are billed monthly or annually via Stripe</li>
              <li>Prices may change with 30 days' notice</li>
              <li>Third-party costs (WhatsApp message fees, AI model usage) are passed through at cost and billed separately</li>
              <li>Failed payments result in a 3-day grace period, after which AI agents are paused</li>
              <li>Refunds are handled on a case-by-case basis</li>
            </ul>
          </section>

          <section>
            <h2>9. Data Ownership</h2>
            <ul>
              <li><strong>Your Data:</strong> You retain all ownership rights to your agency data, lead information, content, and communications. We do not claim ownership of your data.</li>
              <li><strong>License to Us:</strong> You grant us a limited license to process your data solely to provide the Service.</li>
              <li><strong>Our Platform:</strong> We retain all rights to the Aygentis platform, AI models, agent configurations, and proprietary technology.</li>
              <li><strong>Learned Behaviours:</strong> Instincts (learned preferences from your corrections) are your data and are scoped exclusively to your agency. They are deleted upon account deletion.</li>
            </ul>
          </section>

          <section>
            <h2>10. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access.
              We may temporarily suspend the Service for maintenance, updates, or security reasons.
              We are not liable for any losses resulting from Service downtime.
            </p>
          </section>

          <section>
            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law:
            </p>
            <ul>
              <li>The Service is provided "as is" without warranties of any kind</li>
              <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages</li>
              <li>We are not liable for lost deals, missed leads, or business losses resulting from AI agent errors or Service downtime</li>
              <li>We are not liable for actions taken by third-party platforms (Meta suspending your WhatsApp number, Google revoking OAuth access, etc.)</li>
              <li>Our total liability is limited to the fees you paid in the 12 months preceding the claim</li>
            </ul>
          </section>

          <section>
            <h2>12. RERA and UAE Compliance</h2>
            <p>
              You are solely responsible for ensuring that your use of the Service complies with
              all applicable UAE laws and regulations, including but not limited to:
            </p>
            <ul>
              <li>RERA (Real Estate Regulatory Agency) advertising and marketing rules</li>
              <li>UAE Personal Data Protection Act (Federal Decree-Law No. 45 of 2021)</li>
              <li>Anti-spam regulations and telecommunications laws</li>
              <li>Commercial transaction and consumer protection laws</li>
            </ul>
            <p>
              The Service includes compliance guardrails (e.g., prohibiting guaranteed yield claims),
              but these are assistive and do not replace your obligation to ensure compliance.
            </p>
          </section>

          <section>
            <h2>13. Termination</h2>
            <ul>
              <li><strong>By you:</strong> You may cancel your subscription at any time through Settings or by contacting us. Your data will be retained for 90 days after cancellation, then permanently deleted.</li>
              <li><strong>By us:</strong> We may suspend or terminate your account if you violate these Terms, engage in abusive behaviour, or fail to pay fees after the grace period.</li>
              <li><strong>Effect:</strong> Upon termination, AI agents stop immediately, pending approvals are cancelled, and scheduled actions are halted.</li>
            </ul>
          </section>

          <section>
            <h2>14. Modifications to Terms</h2>
            <p>
              We may modify these Terms at any time. Material changes will be communicated via
              email and in-app notification at least 30 days before taking effect. Your continued
              use of the Service after the effective date constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2>15. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United Arab Emirates. Any disputes arising
              from these Terms will be resolved through arbitration in Dubai, UAE, in accordance
              with the rules of the Dubai International Arbitration Centre (DIAC).
            </p>
          </section>

          <section>
            <h2>16. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <ul>
              <li><strong>Email:</strong> legal@aygentis.com</li>
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
