// @ts-nocheck
/* ─────────────────────────────────────────────────────────
   ARCHIVED — DO NOT MODIFY
   Qoves-style landing page, preserved 2026-04-20.
   Copy of ui/src/pages/Landing.tsx at commit 147d1499.
   Kept as a reference so future edits to Landing.tsx cannot
   overwrite this version. Not imported anywhere — this file
   is read-only history.
   ───────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COMPANY_INFO } from "@/lib/company-info";

/* ─────────────────────────────────────────────────────────
   Data — matched to the Qoves layout
   ───────────────────────────────────────────────────────── */

const HERO_BENEFITS = [
  "Reply to every lead in minutes",
  "Post content daily without lifting a finger",
  "Catch DLD transactions before competitors",
  "Follow up in Arabic, Russian and English",
  "Wake up to a brief, not an inbox",
];

const AGENTS = [
  { no: "01", letter: "S", name: "Sarah", role: "Lead & Sales", desc: "Qualifies leads, drafts replies in their language, chases every follow-up.", proof: "Replied to 14 leads in the last hour", sample: [
      { from: "lead", text: "Hi, is the JVC unit still available?" },
      { from: "sarah", text: "Hi Ahmed — yes. 1-bed at Binghatti Hills, starting AED 810K with a 60/40 plan. Want the floor plan?" },
      { from: "lead", text: "Yes please, and is parking included?" },
      { from: "sarah", text: "Parking included on all 1-beds. Sending the plan now. Shall I book a viewing this week?" },
    ] },
  { no: "02", letter: "A", name: "Aisha", role: "Content Strategy", desc: "Plans the week. Watches competitors, finds hooks, decides what to post and when.", proof: "Queued 5 posts for this week", sample: [
      { label: "Mon", text: "Carousel — Why JVC beat Downtown in Q1" },
      { label: "Tue", text: "Reel — Binghatti Hills payment plan" },
      { label: "Wed", text: "Update — DLD Q1 transactions up 18%" },
      { label: "Thu", text: "Story — viewing day at Sobha Hartland" },
    ] },
  { no: "03", letter: "Y", name: "Yousef", role: "Content Make", desc: "Carousels, reel covers, ad creative, captions — on-brand, every time.", proof: "Rendered 3 carousels overnight", sample: [
      { label: "Carousel", text: "10 slides · Why JVC · ready to review" },
      { label: "Reel", text: "Binghatti Hills launch · 4 variants" },
      { label: "Ad", text: "Meta Lead Ad · 3 headline options" },
      { label: "Caption", text: "Long-form · hashtags · RERA-compliant" },
    ] },
  { no: "04", letter: "T", name: "Tariq", role: "Market Intelligence", desc: "Monitors DLD, Bayut, Property Finder, Reddit, X. Flags what you would miss.", proof: "Flagged a price drop 6 minutes ago", sample: [
      { label: "DLD", text: "Dubai Hills · 3BR · AED 4.8M · 12% below comp" },
      { label: "Listing", text: "JVC · 1BR · Binghatti Orchid · cut 8%" },
      { label: "X", text: "Trending: JVC rental yield up 240%" },
      { label: "Reddit", text: "r/dubai — Damac Lagoons complaints" },
    ] },
  { no: "05", letter: "O", name: "Omar", role: "Senior Advisor", desc: "Reads the week's activity, spots patterns, files the morning brief, runs reviews.", proof: "Filed today's brief at 07:58", sample: [
      { label: "07:58", text: "Morning brief — 4 items, 1 urgent" },
      { label: "Hot", text: "Mira Al Shamsi score 9 — matched twice" },
      { label: "Pattern", text: "JVC leads respond 3× faster to Arabic openers" },
      { label: "Week", text: "Conversion 4.2% — up from 3.1%" },
    ] },
  { no: "06", letter: "L", name: "Layla", role: "Closer & Concierge", desc: "Handholds hot leads — viewings, paperwork, payment plans, RERA, DLD fees.", proof: "Booked 2 viewings for Thursday", sample: [
      { label: "Booked", text: "Thu 11:00 — Binghatti Hills · Ahmed" },
      { label: "Sent", text: "DLD fee breakdown · AED 84,200" },
      { label: "Drafted", text: "Reservation form · Sobha Hartland" },
      { label: "Reminder", text: "Viewing tomorrow — confirmed" },
    ] },
];

const PRESS = ["Property Finder", "Bayut", "Dubizzle", "DLD", "RERA", "Meta", "WhatsApp", "Google"];

const TABS = [
  { key: "Response", stat: "< 5 min", title: "Every lead answered in minutes, in the right language.", body: "Sarah replies, qualifies, and queues nurture sequences — automatically." },
  { key: "Content", stat: "5×", title: "The weekly content calendar, already full.", body: "Aisha plans; Yousef ships. Carousels, reels, captions, all on-brand." },
  { key: "Market", stat: "6 min", title: "Price drops and new launches, the instant they happen.", body: "Tariq monitors DLD, portals, social — surfaces what matters to you." },
  { key: "Viewings", stat: "0", title: "No-shows handled. Reminders sent. Paperwork drafted.", body: "Layla runs the logistics from first viewing to signed reservation." },
  { key: "Mornings", stat: "07:58", title: "Five things worth knowing, before your first coffee.", body: "Omar reads the full night of activity and sends a clean brief." },
];

const FACTS = [
  { num: "80%", fact: "of buyers go with the agent who replies first." },
  { num: "48h", fact: "is the average Dubai agency's reply time." },
  { num: "4.2×", fact: "higher conversion when leads are contacted in 5 minutes." },
  { num: "24/7", fact: "operation — the agency runs while you rest." },
];

const TESTIMONIALS = [
  { name: "Mohammed Al Awadhi", place: "Dubai Marina · 14 brokers", body: "Leads stay warm overnight. Posts go out. Mornings feel controllable." },
  { name: "Priya Narayan", place: "JVC · solo broker", body: "I used to miss hot leads on viewings. Now every enquiry gets a 5-minute reply." },
  { name: "Rawan Al Hashimi", place: "Downtown · 6 brokers", body: "Our Property Finder ranking moved from page 3 to page 1 in a month." },
  { name: "Dima Khoury", place: "Palm Jumeirah · 9 brokers", body: "The morning brief alone saved me two hours a day." },
];

const FAQS = [
  { q: "How is this different from a CRM?", a: "A CRM stores data. Aygentis does the work. Six specialist agents reply, write, monitor and book — under your approval — all day." },
  { q: "Do my leads know they are talking to AI?", a: "You decide the tone and the disclosures. Every outbound message can be reviewed and edited before it ships." },
  { q: "What does approval look like?", a: "Messages and posts land in one CEO chat. Approve in a tap, edit inline, or reject. Nothing ships without your nod." },
  { q: "Can it integrate with Property Finder / Bayut / WhatsApp?", a: "Yes. WhatsApp Business, portal emails (PF, Bayut, Dubizzle), Gmail, Google Calendar, Instagram and Meta Lead Ads all connect in the onboarding." },
  { q: "Pricing?", a: "First hundred Dubai agencies get founder pricing. Pricing scales with the agents you hire — starter starts well below the cost of one junior broker." },
];

/* ─────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────── */

export default function Landing() {
  const navigate = useNavigate();
  const [tabIdx, setTabIdx] = useState(0);
  const [activeAgent, setActiveAgent] = useState(0);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Force light mode — Qoves is light
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.colorScheme = "light";
    return () => {
      if (wasDark) {
        html.classList.add("dark");
        html.style.colorScheme = "dark";
      }
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
  };

  const tab = TABS[tabIdx];
  const agent = AGENTS[activeAgent];

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-white text-[var(--ink)] [font-family:'Hanken_Grotesk',system-ui,sans-serif]">
      <Tokens />

      {/* ── Nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8 py-5">
          <Wordmark />
          <nav className="hidden items-center gap-10 md:flex">
            <a href="#why" className="qv-nav">Why Aygentis</a>
            <a href="#how" className="qv-nav">How it works</a>
            <a href="#team" className="qv-nav">The team</a>
            <a href="#faq" className="qv-nav">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/auth")} className="qv-nav">Login</button>
            <a href="#start" className="qv-btn">Join Now</a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1240px] px-8 pb-16 pt-20 text-center md:pt-28">
          <span className="qv-pill">AI · AGENCY · DUBAI</span>
          <h1 className="mt-7 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(3rem,6.4vw,6rem)] font-[600] leading-[1.02] tracking-[-0.028em] text-[var(--ink)]">
            Run your agency{" "}
            <span className="text-[var(--ink-20)]">while you sleep</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[54ch] text-[17px] font-[400] leading-[1.55] text-[var(--muted)]">
            Six AI specialists run the back office of your Dubai real estate agency
            around the clock — leads, content, market intel, viewings and closings.
            You approve. They execute.
          </p>
          <div className="mt-10 flex justify-center">
            <a href="#start" className="qv-cta">
              <span>Start Now</span>
              <span className="qv-cta__sep" />
              <span className="qv-cta__arrow">→</span>
            </a>
          </div>
        </div>

        {/* Silver-framed showcase card */}
        <div className="relative mx-auto max-w-[1240px] px-8 pb-24">
          <div className="qv-chrome">
            <div className="grid gap-0 bg-white md:grid-cols-[1fr_1.05fr]">
              {/* Numbered benefit list */}
              <div className="flex flex-col justify-center p-8 md:p-10">
                {HERO_BENEFITS.map((b, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[54px_1fr] items-baseline gap-4 border-b border-[var(--hairline)] py-5 last:border-0"
                  >
                    <span className="[font-family:'Hanken_Grotesk',system-ui] text-[13px] font-[500] text-[var(--ink-50)] [font-variant-numeric:tabular-nums]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15.5px] font-[500] leading-[1.35] text-[var(--ink)]">
                      {b}
                    </span>
                  </div>
                ))}
              </div>

              {/* Before / After — two "screens" side by side */}
              <div className="relative grid grid-cols-2 border-l border-[var(--hairline)] bg-[var(--surface)] p-4 md:p-5">
                <PhoneFrame tone="before" />
                <PhoneFrame tone="after" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Press strip ─────────────────────────────────── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1240px] px-8 py-8">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
            Built for agencies working with
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {PRESS.map((p) => (
              <span
                key={p}
                className="text-[15px] font-[600] tracking-tight text-[var(--ink-30)]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why / Categories ─────────────────────────────── */}
      <section id="why" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="qv-pill">WHAT IT DOES</span>
            <h2 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.25rem,4.6vw,4rem)] font-[600] leading-[1.05] tracking-[-0.025em]">
              A specialist <span className="text-[var(--ink-20)]">for every moving part.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] font-[400] leading-[1.55] text-[var(--muted)]">
              Click a category. See the old way, see the Aygentis way, see the stat
              that changes once the team is hired.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {TABS.map((c, i) => (
              <button
                key={c.key}
                onClick={() => setTabIdx(i)}
                className={`rounded-full px-4 py-2 text-[13px] font-[500] transition-all ${
                  i === tabIdx
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--hairline)] bg-white text-[var(--muted)] hover:border-[var(--ink)]/30 hover:text-[var(--ink)]"
                }`}
              >
                {c.key}
              </button>
            ))}
          </div>

          <div key={tab.key} className="mt-14 grid animate-[fadeSlide_450ms_ease-out] gap-14 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Category {String(tabIdx + 1).padStart(2, "0")} / {String(TABS.length).padStart(2, "0")}
              </p>
              <h3 className="mt-4 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(1.75rem,3.2vw,2.75rem)] font-[600] leading-[1.1] tracking-[-0.022em]">
                {tab.title}
              </h3>
              <p className="mt-5 max-w-[52ch] text-[15.5px] font-[400] leading-[1.6] text-[var(--muted)]">
                {tab.body}
              </p>
            </div>
            <div className="qv-chrome qv-chrome--sm">
              <div className="flex items-center justify-center bg-white p-10">
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                    {tab.key}
                  </p>
                  <p className="mt-3 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(4.5rem,10vw,9rem)] font-[500] leading-[0.9] tracking-[-0.04em] text-[var(--ink)] [font-variant-numeric:tabular-nums]">
                    {tab.stat}
                  </p>
                  <p className="mt-4 text-[12px] font-[500] uppercase tracking-[0.22em] text-[var(--ink-50)]">
                    In the first Dubai cohort
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ────────────────────────────────────────── */}
      <section id="team" className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1240px] px-8 py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="qv-pill">THE TEAM</span>
            <h2 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.25rem,4.6vw,4rem)] font-[600] leading-[1.05] tracking-[-0.025em]">
              Six specialists. <span className="text-[var(--ink-20)]">Each with a name.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] font-[400] leading-[1.55] text-[var(--muted)]">
              Every agent has a discipline and a voice. They learn your market, your tone,
              and your exceptions. They brief each other. They don&apos;t go quiet on Friday.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3 lg:grid-cols-6">
            {AGENTS.map((a, i) => (
              <button
                key={a.name}
                onClick={() => setActiveAgent(i)}
                onMouseEnter={() => setActiveAgent(i)}
                className={`group flex flex-col items-center rounded-[10px] border bg-white p-6 text-center transition-all ${
                  i === activeAgent
                    ? "border-[var(--ink)] shadow-[0_8px_24px_-10px_rgba(20,20,20,0.22)]"
                    : "border-[var(--hairline)] hover:-translate-y-0.5 hover:border-[var(--ink)]/40 hover:shadow-[0_4px_16px_-6px_rgba(20,20,20,0.12)]"
                }`}
              >
                <Monogram letter={a.letter} active={i === activeAgent} />
                <p className="mt-5 text-[11.5px] font-[500] uppercase tracking-[0.18em] text-[var(--ink-50)] [font-variant-numeric:tabular-nums]">
                  {a.no}
                </p>
                <h3 className="mt-1 [font-family:'Hanken_Grotesk',system-ui] text-[1.4rem] font-[600] leading-[1] tracking-tight text-[var(--ink)]">
                  {a.name}
                </h3>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                  {a.role}
                </p>
              </button>
            ))}
          </div>

          {/* Detail */}
          <article
            key={agent.name}
            className="qv-chrome mt-10 animate-[fadeSlide_450ms_ease-out] md:grid md:grid-cols-[1fr_1.2fr]"
          >
            <div className="bg-white p-10">
              <div className="flex items-start gap-5">
                <Monogram letter={agent.letter} active large />
                <div>
                  <p className="text-[11.5px] font-[500] uppercase tracking-[0.2em] text-[var(--muted)]">
                    {agent.no} · {agent.role}
                  </p>
                  <h3 className="mt-2 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.5rem,4.6vw,4rem)] font-[600] leading-[0.95] tracking-[-0.025em]">
                    {agent.name}
                  </h3>
                </div>
              </div>
              <p className="mt-6 max-w-[42ch] text-[15.5px] font-[400] leading-[1.6] text-[var(--muted)]">
                {agent.desc}
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1 text-[11.5px] font-[500] text-[var(--ink)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a7850]" />
                Live · {agent.proof}
              </div>
            </div>
            <div className="border-t border-[var(--hairline)] bg-[var(--surface)] p-8 md:border-l md:border-t-0 md:p-10">
              <div className="mb-4 flex items-center justify-between text-[11px] font-[500] uppercase tracking-[0.22em] text-[var(--muted)]">
                <span>{activeAgent === 0 ? "WhatsApp · Ahmed Al Hashimi" : "Activity feed"}</span>
                <span>Today</span>
              </div>
              {activeAgent === 0 ? (
                <WhatsAppMock messages={agent.sample as { from: string; text: string }[]} />
              ) : (
                <LogMock items={agent.sample as { label: string; text: string }[]} />
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="qv-pill">HOW IT WORKS</span>
            <h2 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.25rem,4.6vw,4rem)] font-[600] leading-[1.05] tracking-[-0.025em]">
              Three steps. <span className="text-[var(--ink-20)]">That&apos;s it.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Step n="01" title="You talk to your CEO" body="Tell your CEO agent what you need. One chat. It understands your business, your style, your market." />
            <Step n="02" title="Your team gets to work" body="Sarah handles leads. Aisha plans content. Tariq watches the market. All in parallel, around the clock." />
            <Step n="03" title="You approve what matters" body="Every WhatsApp, every post, every email — nothing ships without your approval. You stay in control." />
          </div>
        </div>
      </section>

      {/* ── Evidence ─────────────────────────────────────── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1240px] px-8 py-24">
          <div className="grid gap-0 divide-y divide-[var(--hairline)] rounded-[12px] border border-[var(--hairline)] bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {FACTS.map((f, i) => (
              <div key={i} className="p-8">
                <p className="[font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.5rem,5vw,3.75rem)] font-[600] leading-[1] tracking-[-0.03em] text-[var(--ink)] [font-variant-numeric:tabular-nums]">
                  {f.num}
                </p>
                <p className="mt-4 text-[14px] font-[400] leading-[1.55] text-[var(--muted)]">
                  {f.fact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1240px] px-8 py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="qv-pill">WHAT BROKERS SAY</span>
            <h2 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.25rem,4.6vw,4rem)] font-[600] leading-[1.05] tracking-[-0.025em]">
              From the first <span className="text-[var(--ink-20)]">Dubai cohort.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t, i) => (
              <figure
                key={i}
                className="flex h-full flex-col justify-between rounded-[10px] border border-[var(--hairline)] bg-white p-6"
              >
                <blockquote className="text-[15px] font-[400] leading-[1.5] text-[var(--ink)]">
                  &ldquo;{t.body}&rdquo;
                </blockquote>
                <figcaption className="mt-6 border-t border-[var(--hairline)] pt-4">
                  <p className="text-[13.5px] font-[600] text-[var(--ink)]">{t.name}</p>
                  <p className="mt-1 text-[11.5px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t.place}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-8 py-28 md:grid-cols-[1fr_1.3fr] md:gap-20">
          <div>
            <span className="qv-pill">FAQ</span>
            <h2 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2rem,4.4vw,3.5rem)] font-[600] leading-[1.05] tracking-[-0.025em]">
              Questions, <span className="text-[var(--ink-20)]">answered.</span>
            </h2>
            <p className="mt-6 max-w-[38ch] text-[15.5px] font-[400] leading-[1.6] text-[var(--muted)]">
              If you have a question that isn&apos;t here, write to{" "}
              <span className="text-[var(--ink)]">hello@aygentis.ae</span> and we&apos;ll add it.
            </p>
          </div>
          <div className="divide-y divide-[var(--hairline)] rounded-[12px] border border-[var(--hairline)] bg-white">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <button
                  key={i}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 p-6 text-left"
                >
                  <div>
                    <p className="text-[15.5px] font-[600] text-[var(--ink)]">{item.q}</p>
                    <p
                      className={`mt-3 text-[14.5px] font-[400] leading-[1.6] text-[var(--muted)] transition-all ${
                        open ? "max-h-60 opacity-100" : "max-h-0 overflow-hidden opacity-0"
                      }`}
                    >
                      {item.a}
                    </p>
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--muted)] transition-transform ${
                      open ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section id="start" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[960px] px-8 py-28 text-center md:py-32">
          <span className="qv-pill">COHORT Nº 01</span>
          <h2 className="mx-auto mt-8 max-w-[18ch] [font-family:'Hanken_Grotesk',system-ui] text-[clamp(2.75rem,6vw,5.5rem)] font-[600] leading-[1.02] tracking-[-0.028em]">
            Start your agency&apos;s{" "}
            <span className="text-[var(--ink-20)]">glow up.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[52ch] text-[16px] font-[400] leading-[1.6] text-[var(--muted)]">
            Early access is limited to the first hundred Dubai agencies. Drop your email
            and we&apos;ll open a seat when the first cohort goes live.
          </p>
          <form onSubmit={handleJoin} className="mx-auto mt-10 flex max-w-lg items-stretch rounded-full border border-[var(--hairline)] bg-white p-1.5">
            <input
              type="email"
              required
              placeholder="you@youragency.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={joined}
              className="flex-1 bg-transparent px-5 py-2 text-[15px] placeholder:text-[var(--ink-30)] focus:outline-none disabled:opacity-60"
            />
            <button type="submit" disabled={joined} className="rounded-full bg-[var(--ink)] px-6 py-2.5 text-[13px] font-[500] text-white transition-colors hover:bg-black disabled:opacity-60">
              {joined ? "✓ You're in" : "Join Now"}
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[var(--hairline)] px-8 py-10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1 text-[12.5px] leading-[1.6] text-[var(--muted)]">
            <p className="font-[500] text-[var(--ink)]">{COMPANY_INFO.name}</p>
            <p>{COMPANY_INFO.address}</p>
            <p>
              <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-[var(--ink)]">
                {COMPANY_INFO.email}
              </a>
            </p>
          </div>
          <div className="flex items-center gap-6 text-[12.5px] text-[var(--muted)]">
            <a href="/about" className="hover:text-[var(--ink)]">About</a>
            <a href="/pricing" className="hover:text-[var(--ink)]">Pricing</a>
            <a href="/contact" className="hover:text-[var(--ink)]">Contact</a>
            <a href="/privacy" className="hover:text-[var(--ink)]">Privacy</a>
            <a href="/terms" className="hover:text-[var(--ink)]">Terms</a>
            <span>© {new Date().getFullYear()} {COMPANY_INFO.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Subcomponents
   ───────────────────────────────────────────────────────── */

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-7 w-7 rounded-full"
        style={{
          background:
            "conic-gradient(from 120deg, #1a1a1a 0%, #3a3a3a 25%, #1a1a1a 50%, #3a3a3a 75%, #1a1a1a 100%)",
        }}
      >
        <div className="absolute inset-[5px] rounded-full bg-white" />
      </div>
      <span className="[font-family:'Hanken_Grotesk',system-ui] text-[1.25rem] font-[600] tracking-tight text-[var(--ink)]">
        Aygentis
      </span>
    </div>
  );
}

function Monogram({
  letter,
  active,
  large,
}: {
  letter: string;
  active?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[10px] [font-family:'Hanken_Grotesk',system-ui] font-[600] ${
        large ? "h-20 w-20 text-4xl" : "h-16 w-16 text-2xl"
      } ${active ? "text-white" : "text-[var(--ink)]"}`}
      style={{
        background: active
          ? "linear-gradient(135deg, #1f1f1f 0%, #444 50%, #1f1f1f 100%)"
          : "linear-gradient(135deg, #f5f5f5 0%, #e6e6e6 50%, #f5f5f5 100%)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.15), 0 6px 14px -8px rgba(0,0,0,0.35)"
          : "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.08)",
      }}
    >
      {letter}
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--hairline)] bg-white p-8 transition-shadow hover:shadow-[0_6px_18px_-10px_rgba(20,20,20,0.15)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-[600] text-white [font-variant-numeric:tabular-nums]">
        {n}
      </div>
      <h3 className="mt-6 [font-family:'Hanken_Grotesk',system-ui] text-[1.5rem] font-[600] leading-[1.2] tracking-tight">
        {title}
      </h3>
      <p className="mt-4 text-[14.5px] font-[400] leading-[1.6] text-[var(--muted)]">{body}</p>
    </div>
  );
}

function WhatsAppMock({ messages }: { messages: { from: string; text: string }[] }) {
  return (
    <div className="space-y-2.5">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.from === "sarah" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[82%] rounded-[12px] px-3.5 py-2.5 text-[13.5px] leading-snug ${
              m.from === "sarah"
                ? "rounded-br-[3px] bg-[var(--ink)] text-white"
                : "rounded-bl-[3px] border border-[var(--hairline)] bg-white text-[var(--ink)]"
            }`}
          >
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogMock({ items }: { items: { label: string; text: string }[] }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--hairline)] bg-white">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[92px_1fr] items-center gap-4 border-b border-[var(--hairline)] px-4 py-3 text-[13.5px] last:border-0">
          <span className="text-[11px] font-[600] uppercase tracking-widest text-[var(--muted)]">
            {it.label}
          </span>
          <span className="text-[var(--ink)]">{it.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Phone frame for hero before/after
   ───────────────────────────────────────────────────────── */

function PhoneFrame({ tone }: { tone: "before" | "after" }) {
  const isBefore = tone === "before";
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 z-10 text-[10px] font-[600] uppercase tracking-[0.24em] text-white mix-blend-difference">
        {isBefore ? "Before" : "After"}
      </div>
      <div
        className="relative mx-auto aspect-[9/16] max-h-[480px] w-full overflow-hidden rounded-[20px] border border-[var(--hairline)]"
        style={{
          background: isBefore
            ? "linear-gradient(170deg, #d7dee4 0%, #c0c7cf 100%)"
            : "linear-gradient(170deg, #1a1a1a 0%, #2b2b2b 100%)",
        }}
      >
        {/* Device status bar */}
        <div className="flex items-center justify-between px-4 pt-3 text-[9.5px] font-[600] [font-variant-numeric:tabular-nums]" style={{ color: isBefore ? "#1a1a1a" : "#e6e6e6" }}>
          <span>09:41</span>
          <span>●●●●</span>
        </div>

        {/* Screen content */}
        {isBefore ? (
          <div className="px-4 pt-6">
            <p className="text-[11px] font-[600] uppercase tracking-widest text-[#3b3b3b]">
              WhatsApp · 48 unread
            </p>
            <div className="mt-4 space-y-2">
              {[
                { n: "Ahmed Al Hashimi", t: "Is the JVC unit still available?", ago: "19h ago" },
                { n: "Mira Al Shamsi", t: "Any update on Binghatti?", ago: "1d ago" },
                { n: "Bayut lead", t: "Budget 2M, Palm Jumeirah", ago: "2d ago" },
                { n: "Priya Narayan", t: "Price list please", ago: "3d ago" },
                { n: "Rawan", t: "Viewing tomorrow?", ago: "4d ago" },
              ].map((m, i) => (
                <div key={i} className="rounded-[8px] bg-white/85 p-2 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-[600] text-[#1a1a1a]">{m.n}</span>
                    <span className="text-[#888]">{m.ago}</span>
                  </div>
                  <div className="mt-1 text-[#444]">{m.t}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[6px] bg-[#b03a2e] px-2 py-1 text-center text-[10px] font-[600] uppercase tracking-widest text-white">
              12 leads cooling
            </div>
          </div>
        ) : (
          <div className="px-4 pt-6 text-[#e8e8e8]">
            <p className="text-[11px] font-[600] uppercase tracking-widest text-white/70">
              Sarah · Live
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[10px] rounded-bl-[2px] bg-white/15 px-2.5 py-1.5 text-[10.5px] leading-snug">
                  Is the JVC unit still available?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-[10px] rounded-br-[2px] bg-white px-2.5 py-1.5 text-[10.5px] leading-snug text-[#1a1a1a]">
                  Hi Ahmed — yes. 1-bed at Binghatti Hills, AED 810K, 60/40 plan. Floor plan?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[10px] rounded-bl-[2px] bg-white/15 px-2.5 py-1.5 text-[10.5px] leading-snug">
                  Yes please, is parking included?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-[10px] rounded-br-[2px] bg-white px-2.5 py-1.5 text-[10.5px] leading-snug text-[#1a1a1a]">
                  Included on all 1-beds. Book a viewing this week?
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[6px] border border-white/25 bg-white/5 px-2 py-1 text-center text-[10px] font-[600] uppercase tracking-widest">
              Replied in 3m 14s
            </div>
            <div className="mt-3 flex gap-1.5">
              {["S", "A", "Y", "T", "O", "L"].map((c, i) => (
                <div
                  key={c}
                  className={`flex h-5 w-5 items-center justify-center rounded-[4px] text-[9px] font-[600] ${
                    i === 0 ? "bg-white text-[#1a1a1a]" : "bg-white/10 text-white/70"
                  }`}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Tokens
   ───────────────────────────────────────────────────────── */

function Tokens() {
  return (
    <style>{`
      :where(.fixed.inset-0) {
        --ink: #141414;
        --ink-20: #c6c6c6;
        --ink-30: #9a9a9a;
        --ink-50: #808080;
        --muted: #6b6b6b;
        --surface: #f6f6f6;
        --hairline: rgba(20, 20, 20, 0.08);
      }
      .qv-nav {
        font-size: 14px;
        font-weight: 500;
        color: var(--ink);
        transition: color 150ms;
      }
      .qv-nav:hover { color: #000; }
      .qv-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.55rem 1rem;
        border-radius: 6px;
        background: var(--ink);
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        transition: background 150ms;
      }
      .qv-btn:hover { background: #000; }
      .qv-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.85rem;
        border-radius: 6px;
        border: 1px solid var(--hairline);
        background: #fff;
        font-family: 'Source Code Pro', ui-monospace, monospace;
        font-size: 10.5px;
        font-weight: 500;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--ink);
      }
      .qv-cta {
        display: inline-flex;
        align-items: center;
        gap: 1rem;
        padding: 0.95rem 1.6rem 0.95rem 1.85rem;
        border-radius: 10px;
        background: var(--ink);
        color: #fff;
        font-size: 15px;
        font-weight: 500;
        letter-spacing: -0.005em;
        transition: transform 150ms, box-shadow 150ms, background 150ms;
        box-shadow: 0 8px 20px -10px rgba(20, 20, 20, 0.35);
      }
      .qv-cta:hover { background: #000; transform: translateY(-1px); box-shadow: 0 12px 24px -10px rgba(20, 20, 20, 0.45); }
      .qv-cta__sep { width: 1px; height: 22px; background: rgba(255,255,255,0.22); }
      .qv-cta__arrow { font-size: 18px; }

      /* Chrome / silver frame card */
      .qv-chrome {
        position: relative;
        border-radius: 18px;
        padding: 12px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.0), rgba(255,255,255,0.0)) padding-box,
          linear-gradient(180deg, #b7c2ca 0%, #dae1e6 22%, #eef2f4 48%, #cfd6db 72%, #98a4ad 100%) border-box;
        border: 1px solid transparent;
        box-shadow:
          0 40px 60px -40px rgba(20, 20, 20, 0.22),
          0 18px 30px -18px rgba(20, 20, 20, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }
      .qv-chrome > div { border-radius: 10px; overflow: hidden; }
      .qv-chrome--sm { padding: 8px; border-radius: 14px; }

      @keyframes fadeSlide {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
