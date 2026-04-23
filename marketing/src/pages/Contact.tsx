import { useEffect, useState } from "react";
import { COMPANY_INFO } from "@/lib/company-info";
import QovesShell from "./_QovesShell";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = "Contact — Aygentis";
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.message.trim()) return;
    setSubmitted(true);
  };

  return (
    <QovesShell>
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-20 md:py-24">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Contact</p>
          <h1 className="mt-5 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.4rem,5vw,4.5rem)] font-[600] leading-[1.04] tracking-[-0.028em]">
            Get in touch.
            <br />
            <span className="text-[var(--ink-20)]">We reply within a business day.</span>
          </h1>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1240px] gap-16 px-8 py-16 md:grid-cols-[1fr_1.2fr] md:py-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Office</p>
            <p className="mt-5 text-[16px] font-[500] leading-[1.6] text-[var(--ink)]">{COMPANY_INFO.name}</p>
            <p className="mt-1 max-w-[30ch] text-[15px] font-[400] leading-[1.6] text-[var(--muted)]">
              {COMPANY_INFO.address}
            </p>

            <p className="mt-10 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Email</p>
            <a
              href={`mailto:${COMPANY_INFO.email}`}
              className="mt-3 inline-block border-b border-[var(--ink)]/40 pb-[2px] text-[15.5px] font-[500] text-[var(--ink)] hover:border-[var(--ink)]"
            >
              {COMPANY_INFO.email}
            </a>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {submitted ? (
              <div className="rounded-md border border-[var(--hairline)] bg-[var(--surface)] p-10">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Received</p>
                <h3 className="mt-3 text-[24px] font-[600] leading-[1.2] tracking-[-0.02em]">
                  Thanks — we&apos;ll reply to {form.email} shortly.
                </h3>
              </div>
            ) : (
              <>
                <Field label="Name">
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="qv-input" />
                </Field>
                <Field label="Email">
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="qv-input" />
                </Field>
                <Field label="How can we help?">
                  <textarea rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="qv-input resize-y" />
                </Field>
                <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-[var(--ink)] px-5 py-3 text-[14px] font-[500] text-white transition hover:bg-black">
                  Send message →
                </button>
              </>
            )}
          </form>
        </div>
      </section>

      <style>{`
        .qv-input {
          width: 100%;
          padding: 12px 14px;
          font-family: inherit;
          font-size: 15px;
          color: var(--ink);
          background: #fff;
          border: 1px solid var(--hairline);
          border-radius: 6px;
          outline: none;
          transition: border-color 150ms;
        }
        .qv-input:focus { border-color: var(--ink); }
      `}</style>
    </QovesShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
