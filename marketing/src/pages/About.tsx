import { useEffect } from "react";
import { COMPANY_INFO } from "@/lib/company-info";
import QovesShell from "./_QovesShell";

export default function About() {
  useEffect(() => {
    document.title = "About — Aygentis";
  }, []);

  return (
    <QovesShell>
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-20 md:py-24">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">About</p>
          <h1 className="mt-5 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.4rem,5vw,4.5rem)] font-[600] leading-[1.04] tracking-[-0.028em]">
            A team of AI specialists
            <br />
            <span className="text-[var(--ink-20)]">for Dubai real estate.</span>
          </h1>
          <p className="mt-8 max-w-[60ch] text-[17px] font-[400] leading-[1.6] text-[var(--muted)]">
            Aygentis gives agencies six AI specialists that run the back office around the clock —
            leads, content, market intelligence, viewings, and closings. You approve. They execute.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[0.4fr_1fr] md:py-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">What we do</p>
          <div className="space-y-5 text-[16px] font-[400] leading-[1.7] text-[var(--muted)]">
            <p>
              {COMPANY_INFO.name} is a multi-agent AI platform purpose-built for Dubai real
              estate agencies. Our customers — licensed brokerages in the UAE — use our software
              to handle lead enquiries, produce content, monitor the market, schedule viewings,
              and manage their portfolios.
            </p>
            <p>
              Every outbound message our agents prepare requires explicit approval from the
              agency owner before it is sent. We are a software provider, not a licensed real
              estate broker.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[0.4fr_1fr] md:py-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">How we work</p>
          <div className="space-y-5 text-[16px] font-[400] leading-[1.7] text-[var(--muted)]">
            <p>
              Registered in England &amp; Wales, serving agencies operating in the UAE. Our
              customers hold their own RERA licences and are responsible for all brokerage
              activity performed through our platform.
            </p>
            <p>
              Aygentis is multi-tenant by design. Every record is scoped to a single agency and
              cannot be accessed by another. We comply with the UK GDPR and Data Protection Act 2018.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[0.4fr_1fr] md:py-20">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Registered office</p>
          <div className="space-y-2 text-[16px] font-[400] leading-[1.7] text-[var(--muted)]">
            <p className="text-[var(--ink)]"><strong className="font-[500]">{COMPANY_INFO.name}</strong></p>
            <p>{COMPANY_INFO.address}</p>
            <p className="pt-2">
              <a href={`mailto:${COMPANY_INFO.email}`} className="border-b border-[var(--ink)]/40 pb-[2px] text-[var(--ink)] hover:border-[var(--ink)]">
                {COMPANY_INFO.email}
              </a>
            </p>
          </div>
        </div>
      </section>
    </QovesShell>
  );
}
