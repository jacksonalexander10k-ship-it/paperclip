import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { COMPANY_INFO } from "@/lib/company-info";

/* ─────────────────────────────────────────────────────────
   Data — Dubai real-estate agency, ClickUp-style structure
   ───────────────────────────────────────────────────────── */

type MaskTone = "hot" | "sky" | "mint" | "violet" | "rose" | "amber";
type AgentDef = {
  no: string;
  name: string;
  role: string;
  card: string;        // category pill label
  accent: string;      // cardBg tint
  hair: string;
  skin: string;
  garment: string;
  mask: MaskTone;
  prop?: "sphere" | "cube" | "orb" | "cards";
  byline: string;
  proof: string;
};

const AGENTS: AgentDef[] = [
  { no: "01", name: "Sarah",  role: "Sales Agent",          card: "Sales Agents",      accent: "#FBECE7", hair: "#3a2518", skin: "#f0c9a7", garment: "#E06A3A", mask: "hot",    prop: "orb",    byline: "Qualifies leads, drafts replies in their language, chases every follow-up.", proof: "14 leads replied in the last hour" },
  { no: "02", name: "Aisha",  role: "Content Strategy",     card: "Content Agents",    accent: "#E6EEFB", hair: "#4c7dc9", skin: "#f5d7b7", garment: "#6AA1E0", mask: "sky",    prop: "sphere", byline: "Plans the week. Watches competitors, finds hooks, picks what to post.",     proof: "Queued 5 posts for this week" },
  { no: "03", name: "Yousef", role: "Creative Director",    card: "Design Agents",     accent: "#ECE6FB", hair: "#5a2ea8", skin: "#d8a888", garment: "#8467C8", mask: "violet", prop: "cube",   byline: "Carousels, reel covers, ad creative, captions — on-brand, every time.",    proof: "Rendered 3 carousels overnight" },
  { no: "04", name: "Tariq",  role: "Market Intel",         card: "Intel Agents",      accent: "#E2F2E9", hair: "#1b3a2a", skin: "#e0b995", garment: "#3F8A5C", mask: "mint",   prop: "cards",  byline: "Monitors DLD, Bayut, Property Finder, Reddit, X. Flags what you miss.",     proof: "Flagged a price drop 6 min ago" },
  { no: "05", name: "Omar",   role: "Chief of Staff",       card: "Advisor Agents",    accent: "#FDE8E4", hair: "#2a1a12", skin: "#ddb590", garment: "#C24A35", mask: "rose",   prop: "orb",    byline: "Reads the week's activity, spots patterns, files the morning brief.",      proof: "Filed today's brief at 07:58" },
  { no: "06", name: "Layla",  role: "Closer & Concierge",   card: "Closer Agents",     accent: "#FFF2DA", hair: "#c1812b", skin: "#efc5a3", garment: "#E09E3A", mask: "amber",  prop: "sphere", byline: "Handholds hot leads — viewings, paperwork, payment plans, RERA, DLD fees.", proof: "Booked 2 viewings for Thursday" },
];

const INTEGRATIONS = [
  { key: "WhatsApp",       glyph: "whatsapp",       ring: 1, angle:   0 },
  { key: "Gmail",          glyph: "gmail",          ring: 1, angle:  45 },
  { key: "Instagram",      glyph: "instagram",      ring: 1, angle:  90 },
  { key: "Google Calendar",glyph: "calendar",       ring: 1, angle: 135 },
  { key: "Property Finder",glyph: "property-finder",ring: 1, angle: 180 },
  { key: "Bayut",          glyph: "bayut",          ring: 1, angle: 225 },
  { key: "Dubizzle",       glyph: "dubizzle",       ring: 1, angle: 270 },
  { key: "Meta Ads",       glyph: "meta",           ring: 1, angle: 315 },
];

const SKILLS = [
  { key: "send-whatsapp", label: "Send WhatsApp",   icon: "whatsapp-send", copy: "Super Agents draft, queue and send accurate WhatsApp messages in Arabic, English and Russian — context pulled live from your leads." },
  { key: "post-ig",        label: "Post to Instagram", icon: "ig",          copy: "Aisha plans the calendar. Yousef renders the carousel. The post lands in your approval queue before it ever goes live." },
  { key: "book-viewing",   label: "Book a viewing",   icon: "calendar",     copy: "Layla checks your calendar, the lead's availability and the property's status — then confirms the viewing in one message." },
  { key: "watch-dld",      label: "Monitor DLD",      icon: "chart",        copy: "Tariq watches DLD, Bayut, Property Finder and Reddit in real time. The moment a comparable sells below market, you're the first to know." },
  { key: "send-brief",     label: "Morning brief",    icon: "mail",         copy: "Omar reads every message, viewing, listing and post from the last 12 hours and files a 5-bullet brief before 8am." },
];

const MARQUEE_ROWS: string[][] = [
  ["REPLY IN ARABIC","ANSWER PORTAL LEADS","WRITE PROPOSAL","DRAFT WHATSAPP","TRACK VIEWINGS","MATCH PROJECTS","SCORE LEADS","FOLLOW UP","PULL DLD COMPS","BOOK APPOINTMENTS","QUALIFY BUDGET"],
  ["WATCH BAYUT","WATCH PROPERTY FINDER","MONITOR REDDIT","FLAG PRICE DROPS","CLIP LISTINGS","BUILD SHORTLIST","EMAIL DEVELOPER","SEND FLOORPLAN","CALCULATE DLD FEES","TRANSLATE ARABIC","LOG CALL"],
  ["DRAFT CAROUSEL","WRITE CAPTION","RENDER REEL COVER","PLAN CALENDAR","SCHEDULE POST","DESIGN AD","WRITE HOOK","PICK HASHTAGS","EDIT VIDEO","REPORT ENGAGEMENT","REPLY TO DM"],
  ["PREPARE BRIEF","SPOT PATTERN","REVIEW WEEK","AUDIT PIPELINE","UPDATE CRM","SYNC CALENDAR","RESOLVE CONFLICT","ESCALATE URGENT","REWARD TEAM","ARCHIVE CHAT","TAG CONTACT"],
  ["CHECK RERA","DRAFT RESERVATION","SEND PAYMENT PLAN","COMPARE LAUNCH","SIGNAL DEVELOPER","TRACK REFUND","COMPUTE ROI","WRITE NDA","FOLLOW UP OVERDUE","WELCOME NEW CLIENT","REMIND MEETING"],
  ["READ PDF","PARSE EMAIL","SUMMARIZE THREAD","TRANSLATE PITCH","REBUILD SHORTLIST","GENERATE COMPS","REPORT DAILY","BRIEF PARTNER","CALL VENDOR","SIGN DOCUMENT","CHASE KYC"],
];

const CAPABILITIES = [
  { id: "memory",     name: "Memory",        copy: "Agents remember every lead, every viewing, every preference. Short-term, long-term and episodic memory — scoped per agency, encrypted at rest." },
  { id: "knowledge",  name: "Knowledge",     copy: "Every project, every DLD transaction, every RERA rule is indexed. When Sarah answers a buyer, she's drawing from your agency's full archive." },
  { id: "collab",     name: "Collaboration", copy: "Agents delegate to each other. Tariq spots a launch, Aisha writes the post, Yousef designs it, Sarah pitches the leads it fits — all unattended." },
  { id: "skills",     name: "Skills",        copy: "500+ skills scoped by role. A Closer will book viewings. A Content Agent will never send WhatsApp. Boundaries enforced server-side." },
  { id: "autonomous", name: "Autonomous",    copy: "Heartbeats every 15 minutes. No polling, no babysitting. Agents decide when to act — you decide what ships." },
  { id: "ambient",    name: "Ambient",       copy: "Runs quietly in the background — no dashboard to refresh. New lead hits WhatsApp, an agent is already drafting the reply." },
  { id: "feedback",   name: "Feedback",      copy: "Every correction you make becomes an instinct. Six weeks in, the agent sounds like you, not the model." },
];

const BRAINGPT = [
  { name: "Optimized Orchestration",  body: "Router chooses the cheapest model that clears the task — Haiku for triage, Sonnet for drafts, Opus only when it matters." },
  { name: "Self-Learning",            body: "Instincts learned per agency. Never shared with any other tenant, never sent to a third party." },
  { name: "Human-level Memory",       body: "Short-term in context, long-term in your Postgres, episodic compressed per lead." },
  { name: "Sub-Agent Architecture",   body: "A CEO agent delegates to specialists and escalates to you. The org chart is enforced in code." },
  { name: "Deep Research & Compression", body: "Listings, comps, news and social compressed into a 5-bullet brief the night before." },
];

const ORG_TREE = {
  root: { name: "You",           role: "Agency Owner", tint: "hot" as const, monogram: "Y" },
  kids: [
    { name: "Sarah",  role: "Sales Agent",     tint: "hot" as const,    monogram: "S" },
    { name: "Aisha",  role: "Content Agent",   tint: "sky" as const,    monogram: "A" },
    { name: "Tariq",  role: "Market Agent",    tint: "mint" as const,   monogram: "T" },
  ],
};

const FINAL_ROW = [
  { hair: "#3a2518", garment: "#0c4d2c", mask: "mint"   as MaskTone },
  { hair: "#6aa8d8", garment: "#2f66c8", mask: "sky"    as MaskTone },
  { hair: "#c45521", garment: "#E06A3A", mask: "hot"    as MaskTone },
  { hair: "#5a2ea8", garment: "#6A46A8", mask: "violet" as MaskTone },
  { hair: "#d8709e", garment: "#C24A70", mask: "rose"   as MaskTone },
];

/* ─────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────── */

export default function Landing() {
  const navigate = useNavigate();
  const [skillIdx, setSkillIdx] = useState(0);
  const [capIdx, setCapIdx] = useState(0);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.colorScheme = "light";
    return () => {
      if (wasDark) { html.classList.add("dark"); html.style.colorScheme = "dark"; }
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSkillIdx((i) => (i + 1) % SKILLS.length), 4200);
    return () => clearInterval(id);
  }, []);

  const onJoin = (e: React.FormEvent) => { e.preventDefault(); if (email.trim()) setJoined(true); };

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[var(--warm-white)] text-[var(--ink)] [font-family:'Hanken_Grotesk',system-ui,sans-serif]">
      <Tokens />
      <MaskDefs />

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--warm-white)]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-7 py-4">
          <Wordmark />
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink label="Super Agents" badge="New" href="#agents" />
            <NavLink label="Capabilities" href="#capabilities" />
            <NavLink label="Pricing" href="/pricing" />
            <NavLink label="About" href="/about" />
            <NavLink label="Contact" href="/contact" />
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/auth")} className="hidden md:inline-flex items-center rounded-full bg-white/0 px-4 py-2 text-[13.5px] font-[500] text-[var(--ink)]">
              Login
            </button>
            <a href="#start" className="inline-flex items-center rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-[500] text-white hover:bg-black">
              Try Super Agents
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative mx-auto max-w-[1320px] px-7 pb-24 pt-14 md:pt-20">
          <div className="relative flex flex-col items-center">
            <GhostWatermark>SUPER AGENTS</GhostWatermark>
            <MaskedPortrait
              size="hero"
              hair="#c45521"
              skin="#f0c9a7"
              garment="#E06A3A"
              mask="hot"
              label="Super Agent"
            />
            <p className="relative z-10 mt-7 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ink-60)]">
              A new era of humans, with AI Super Agents™
            </p>
            <h1 className="relative z-10 mt-4 text-center [font-family:'Hanken_Grotesk'] text-[clamp(2.8rem,6vw,6rem)] font-[600] leading-[1.02] tracking-[-0.03em] text-[var(--ink)]">
              They're just like your team.
            </h1>
            <p className="relative z-10 mx-auto mt-5 max-w-[56ch] text-center text-[17px] font-[400] leading-[1.5] text-[var(--muted)]">
              Six AI specialists run the back office of your Dubai real-estate agency around the clock — leads, content, market intel, viewings and closings. @mention them, assign them, message them. They improve from every approval you give.
            </p>
            <div className="relative z-10 mt-8 flex items-center gap-3">
              <a href="#start" className="btn-black">Try Super Agents</a>
              <a href="#demo" className="btn-outline">Watch Intro</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Agents carousel ─────────────────────────────── */}
      <section id="agents" className="relative py-24 md:py-28">
        <div className="mx-auto max-w-[1320px] px-7">
          <SectionHeader
            tag="[CAPABILITIES]"
            title={<>Agents for<br />everything</>}
            aside={<>The only infinite <a href="#agents" className="underline underline-offset-[3px] decoration-[var(--ink-30)] hover:decoration-[var(--ink)]">agent catalog</a> built for Dubai real estate. One roster, six specialists. Hire them in minutes.</>}
          />
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {AGENTS.map((a) => <AgentCard key={a.name} agent={a} />)}
          </div>
        </div>
      </section>

      {/* ── Gradient promo strip ────────────────────────── */}
      <section className="pb-24">
        <div className="mx-auto max-w-[1320px] px-7">
          <div className="relative overflow-hidden rounded-[28px] text-white" style={{ background: "linear-gradient(108deg,#6C2CD9 0%,#D944B3 42%,#F15A2B 100%)" }}>
            <div className="grid items-center gap-6 p-8 md:grid-cols-[1.1fr_1fr] md:gap-10 md:p-12">
              <div className="relative z-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/80">[ BUILD YOUR OWN ]</p>
                <h3 className="mt-3 [font-family:'Hanken_Grotesk'] text-[clamp(1.75rem,3.6vw,3rem)] font-[600] leading-[1.05] tracking-[-0.022em]">
                  Build the exact agent<br />your agency needs.
                </h3>
                <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-white/85">
                  Start from a template — Sales, Content, Market — or describe what you need in one sentence and we'll spin the agent up.
                </p>
                <a href="#start" className="btn-black mt-6 inline-flex bg-black hover:bg-black/90">Build my agent</a>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="relative h-[240px] w-[240px] md:h-[280px] md:w-[280px]">
                  <MaskedPortrait size="md" hair="#f2b8d4" skin="#f2c8a7" garment="#d542a0" mask="rose" />
                </div>
              </div>
              <GradientGrain />
            </div>
          </div>
        </div>
      </section>

      {/* ── One prompt spins up an entire team ─────────── */}
      <section className="pb-24">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-7 md:grid-cols-[1.15fr_1fr] md:gap-16">
          <TeamDiagram />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--violet-700)]">AGENTS IN MINUTES</p>
            <h3 className="mt-3 [font-family:'Hanken_Grotesk'] text-[clamp(1.75rem,3.4vw,2.75rem)] font-[600] leading-[1.05] tracking-[-0.022em]">
              One prompt spins up<br />an entire team.
            </h3>
            <p className="mt-5 max-w-[52ch] text-[15.5px] leading-[1.55] text-[var(--muted)]">
              Your goals, workflows and frustrations — automatically delegated to a team of agents who already know Dubai real estate.
            </p>
            <a href="#agents" className="btn-black mt-7 inline-flex">Explore all agents</a>
          </div>
        </div>
      </section>

      {/* ── Human skills ─────────────────────────────────── */}
      <section id="capabilities" className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[1320px] px-7">
          <SectionHeader
            tag="[HUMAN SKILLS]"
            title={<>Do more than<br />humanly possible</>}
            aside={<em className="not-italic"><span className="text-[var(--ink)]">"The first time I saw my pipeline move overnight, I cried."</span><br /><span className="mt-2 block text-[13px] uppercase tracking-[0.18em] text-[var(--muted)]">— MOHAMMED AL AWADHI · DUBAI MARINA · 14 BROKERS</span></em>}
          />

          <div className="mt-10 overflow-hidden rounded-[28px] bg-[var(--soft-grey)] p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] md:gap-10">
              {/* Skills list */}
              <div>
                <h4 className="[font-family:'Hanken_Grotesk'] text-[1.4rem] font-[600] leading-[1.2] tracking-[-0.018em] text-[var(--ink)]">
                  The only agents that work like humans — with infinite skills.
                </h4>
                <div className="mt-6 space-y-3">
                  {SKILLS.map((s, i) => (
                    <SkillPill key={s.key} active={i === skillIdx} skill={s} onFocus={() => setSkillIdx(i)} />
                  ))}
                </div>
              </div>
              {/* Demo panel */}
              <div className="relative min-h-[460px]">
                <AgentDemoPanel skillKey={SKILLS[skillIdx].key} />
              </div>
            </div>
          </div>

          {/* Collab + Managed-by-humans */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <CollabCard />
            <OrgChartCard />
          </div>
        </div>
      </section>

      {/* ── Superhuman marquee ──────────────────────────── */}
      <section className="relative overflow-hidden pb-24 md:pb-28">
        <div className="mx-auto max-w-[1320px] px-7 text-center">
          <h2 className="[font-family:'Hanken_Grotesk'] text-[clamp(2.4rem,5.6vw,5rem)] font-[600] leading-[1.02] tracking-[-0.03em] text-[var(--ink)]">
            Become superhuman,<br />with Super Agents.
          </h2>
        </div>
        <div className="relative mt-12 h-[640px]">
          <MarqueeStack />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
            <MaskedPortrait size="marquee" hair="#c45521" skin="#f0c9a7" garment="#E06A3A" mask="hot" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--warm-white)] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--warm-white)] to-transparent" />
        </div>
      </section>

      {/* ── Dark: But works like superheroes ────────────── */}
      <section id="capabilities-dark" className="bg-black text-white">
        <div className="mx-auto max-w-[1320px] px-7 py-28">
          <SectionHeader
            tag="[CAPABILITIES]"
            dark
            title={<>But works like<br />superheroes.</>}
            aside="They leverage artificial intelligence to make informed decisions and execute actions to achieve specific goals — with constraints you set."
          />

          <div className="mt-12 grid gap-0 rounded-[18px] border border-white/10 md:grid-cols-[0.8fr_1fr_0.9fr] md:divide-x md:divide-white/10">
            {/* Left: numbered list */}
            <div className="p-6 md:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/55">[CAPABILITIES]</p>
              <ol className="mt-6 divide-y divide-white/10">
                {CAPABILITIES.map((c, i) => (
                  <li key={c.id}>
                    <button onClick={() => setCapIdx(i)} className="flex w-full items-center justify-between py-4 text-left">
                      <span className={`font-mono text-[11px] [font-variant-numeric:tabular-nums] ${i === capIdx ? "text-[#FF6A3D]" : "text-white/45"}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`flex-1 pl-5 text-[15px] font-[500] ${i === capIdx ? "text-white" : "text-white/55"}`}>
                        {c.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {/* Middle: wireframe mannequin */}
            <div className="relative flex items-end justify-center p-6 md:p-10">
              <WireframeMannequin highlight={CAPABILITIES[capIdx].id} />
            </div>
            {/* Right: copy */}
            <div className="flex flex-col p-6 md:p-10">
              <div className="font-mono text-[56px] font-[500] leading-none tracking-[-0.02em] text-white/12 [font-variant-numeric:tabular-nums]">
                {String(capIdx + 1).padStart(2, "0")}
              </div>
              <h4 className="mt-8 [font-family:'Hanken_Grotesk'] text-[1.6rem] font-[600] leading-[1.15] tracking-tight">
                {CAPABILITIES[capIdx].name}
              </h4>
              <p className="mt-4 max-w-[42ch] text-[14.5px] leading-[1.6] text-white/70">
                {CAPABILITIES[capIdx].copy}
              </p>
              <div className="mt-auto pt-8">
                <a href="#start" className="btn-white">Get started</a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Proprietary tech ──────────────────────── */}
        <div id="technology" className="mx-auto max-w-[1320px] px-7 pb-28">
          <SectionHeader
            tag="[ TECHNOLOGY ]"
            dark
            title={<>Proprietary<br />Agentic Technology.</>}
            aside={<em className="not-italic"><span className="text-white">"Contextual orchestration, fine-tuning, and a privacy model no other stack has."</span><br /><span className="mt-2 block text-[13px] uppercase tracking-[0.18em] text-white/55">— ALEXANDER JACKSON · FOUNDER</span></em>}
          />

          {/* Agent Analytics */}
          <TechRow
            number="01"
            title="Agent Analytics"
            body="Measure productivity across agents and users. Monitor trends, spot your top performers, and watch your agency's AI adoption percentile climb."
            ctaHref="#start"
            panel={<AnalyticsPanel />}
          />

          {/* Ambient Awareness */}
          <TechRow
            number="02"
            title="Ambient Awareness"
            body="Instantly respond to your leads' questions — giving them accurate, context-aware answers without you lifting a finger."
            ctaHref="#start"
            panel={<AmbientPanel />}
          />

          {/* Live Intelligence */}
          <TechRow
            number="03"
            title="Live Intelligence"
            body="Actively monitors DLD, Bayut, Property Finder and social to capture new knowledge about projects, leads, comparables and competitors."
            ctaHref="#start"
            panel={<RadarPanel />}
          />

          {/* Infinite Knowledge */}
          <TechRow
            number="04"
            title="Infinite Knowledge"
            body="Proprietary real-time syncing engine. World-class retrieval from fine-tuned embeddings. Search across every Dubai portal you connect."
            ctaHref="#start"
            panel={<KnowledgePanel />}
          />

          {/* BrainGPT grid */}
          <div className="mt-20 grid gap-0 border-t border-white/10 md:grid-cols-[1fr_2fr]">
            <div className="py-10 pr-6">
              <h4 className="[font-family:'Hanken_Grotesk'] text-[2rem] font-[600] leading-[1] tracking-[-0.02em]">BrainGPT</h4>
              <p className="mt-3 max-w-[32ch] text-[14px] leading-[1.55] text-white/60">
                Proprietary models, architecture and evals — tuned for Dubai real estate.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-white/10 border-l border-white/10 md:grid-cols-3">
              {BRAINGPT.slice(0, 3).map((f) => <FeatureCell key={f.name} f={f} />)}
            </div>
            <div className="hidden md:block" />
            <div className="grid grid-cols-2 gap-0 divide-x divide-white/10 border-l border-t border-white/10 md:grid-cols-3">
              {BRAINGPT.slice(3).map((f) => <FeatureCell key={f.name} f={f} />)}
              <div />
            </div>
          </div>
        </div>

        {/* ── Security ──────────────────────────────── */}
        <div id="security" className="mx-auto max-w-[1320px] px-7 pb-28">
          <SectionHeader
            tag="[ SECURITY ]"
            dark
            title={<>Agentic User Security.</>}
            aside="A proprietary AI-user data model compatible with every enterprise security system — and familiar to every human on your team."
          />

          <div className="mt-10 grid gap-0 rounded-[18px] border border-white/10">
            <div className="grid gap-8 p-8 md:grid-cols-[1fr_1fr] md:p-10 md:gap-10">
              <div>
                <h4 className="[font-family:'Hanken_Grotesk'] text-[1.7rem] font-[600] leading-[1.1] tracking-[-0.02em]">
                  Implicit &amp; Explicit Access, with Custom Permissions
                </h4>
                <p className="mt-4 max-w-[42ch] text-[14.5px] leading-[1.6] text-white/65">
                  Built on the same battle-tested user-data model your team already uses. Super Agents inherit access implicitly, have explicit permissions, and can be granted access manually — just like a human hire.
                </p>
                <a href="#start" className="btn-white mt-8 inline-flex">Learn more</a>
              </div>
              <FaceSplit />
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <SecCard title="Audit everything" body="Every tool call, every approval, every message — an immutable trail, queryable by user, agent, lead, day.">
              <AuditList />
            </SecCard>
            <SecCard title="Zero data retention. Zero training." body="More secure than using OpenAI or Gemini directly. Your data never trains a shared model.">
              <ZeroRetention />
            </SecCard>
            <SecCard title="Reflection" body="Advanced execution loops that force agents to reflect on the work they're doing, catch their own mistakes, and ask before acting.">
              <ReflectionCard />
            </SecCard>
          </div>
        </div>

        {/* ── Cost strip ────────────────────────────── */}
        <div className="mx-auto max-w-[1320px] px-7 pb-28">
          <div className="grid gap-8 rounded-[18px] border border-white/10 p-8 md:grid-cols-[1.1fr_1fr] md:p-10">
            <div>
              <h4 className="[font-family:'Hanken_Grotesk'] text-[1.7rem] font-[600] leading-[1.1] tracking-[-0.02em]">
                When we optimize, you save AED.
              </h4>
              <p className="mt-4 max-w-[46ch] text-[14.5px] leading-[1.6] text-white/65">
                When our model costs drop, we pass it to you the same day. When a new frontier model launches and costs spike, we subsidize it — so your monthly bill never lurches.
              </p>
            </div>
            <CostTerminal />
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section id="start" className="pb-24 pt-20 md:pt-24">
        <div className="mx-auto max-w-[1320px] px-7">
          <div className="relative overflow-hidden rounded-[32px]" style={{ background: "linear-gradient(108deg,#9A2FD9 0%,#D944B3 38%,#F15A2B 72%,#F7B54A 100%)" }}>
            <GradientGrain />
            <div className="relative z-10 px-8 pb-0 pt-14 text-center md:pt-20">
              <h2 className="[font-family:'Hanken_Grotesk'] text-[clamp(2.5rem,6vw,5.5rem)] font-[600] leading-[1] tracking-[-0.03em] text-white">
                Try Super<br />Agents today.
              </h2>
              <p className="mx-auto mt-5 max-w-[52ch] text-[15.5px] leading-[1.55] text-white/85">
                Early access is limited to the first 100 Dubai agencies. Drop your email, we'll open a seat when the first cohort ships.
              </p>
              <form onSubmit={onJoin} className="mx-auto mt-8 flex max-w-lg items-stretch rounded-full bg-white/95 p-1.5 shadow-[0_18px_40px_-20px_rgba(20,20,20,0.35)]">
                <input
                  type="email"
                  required
                  placeholder="you@youragency.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={joined}
                  className="flex-1 bg-transparent px-5 py-2 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-30)] focus:outline-none disabled:opacity-60"
                />
                <button type="submit" disabled={joined} className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-[13px] font-[500] text-white disabled:opacity-60">
                  {joined ? "✓ You're in" : "Get started"}
                </button>
              </form>
              <div className="mt-12 flex justify-center">
                <div className="flex items-end gap-2 md:gap-3">
                  {FINAL_ROW.map((f, i) => (
                    <MaskedPortrait key={i} size="sm" hair={f.hair} skin="#f0c9a7" garment={f.garment} mask={f.mask} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--warm-white)] px-7 py-10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 md:flex-row md:items-end md:justify-between">
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
   Layout primitives
   ───────────────────────────────────────────────────────── */

function NavLink({ label, href, badge }: { label: string; href: string; badge?: string }) {
  return (
    <a href={href} className="group inline-flex items-center gap-2 text-[13.5px] font-[500] text-[var(--ink)]/85 hover:text-[var(--ink)]">
      {label}
      {badge && (
        <span className="rounded-full bg-[var(--violet-600)] px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-white">
          {badge}
        </span>
      )}
    </a>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-6 w-6">
        <defs>
          <linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6C2CD9" />
            <stop offset="0.5" stopColor="#D944B3" />
            <stop offset="1" stopColor="#F15A2B" />
          </linearGradient>
        </defs>
        <path d="M5 26 L16 5 L27 26 Z" fill="url(#wm)" />
      </svg>
      <span className="[font-family:'Hanken_Grotesk'] text-[1.2rem] font-[600] tracking-tight text-[var(--ink)]">
        Aygentis
      </span>
    </div>
  );
}

function SectionHeader({
  tag, title, aside, dark,
}: { tag: string; title: React.ReactNode; aside?: React.ReactNode; dark?: boolean }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[1.25fr_1fr] md:gap-10">
      <div>
        <p className={`font-mono text-[11px] uppercase tracking-[0.28em] ${dark ? "text-white/60" : "text-[var(--ink-60)]"}`}>{tag}</p>
        <div className={`mt-4 h-px ${dark ? "bg-white/15" : "bg-[var(--hairline)]"}`} />
        <h2 className={`mt-6 [font-family:'Hanken_Grotesk'] text-[clamp(2.25rem,5vw,4.4rem)] font-[600] leading-[1.02] tracking-[-0.028em] ${dark ? "text-white" : "text-[var(--ink)]"}`}>
          {title}
        </h2>
      </div>
      {aside && (
        <div className="pt-0 md:pt-12">
          <div className={`text-[15px] leading-[1.5] ${dark ? "text-white/75" : "text-[var(--muted)]"}`}>
            {aside}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Hero bits
   ───────────────────────────────────────────────────────── */

function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
      <div className="absolute inset-0" style={{ background: "radial-gradient(1200px 560px at 50% 32%, #FCE4D5 0%, rgba(252,228,213,0) 68%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(900px 500px at 50% 68%, #FFF2DD 0%, rgba(255,242,221,0) 60%)" }} />
    </div>
  );
}

function GhostWatermark({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 select-none [font-family:'Hanken_Grotesk'] font-[700] text-white"
      style={{
        fontSize: "clamp(7rem,17vw,19rem)",
        lineHeight: 0.82,
        letterSpacing: "-0.05em",
        WebkitTextStroke: "0px transparent",
        color: "rgba(255,255,255,0.82)",
        mixBlendMode: "screen",
        textShadow: "0 2px 0 rgba(255,255,255,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Masked portraits — SVG illustrated avatars
   ───────────────────────────────────────────────────────── */

const MASK_GRADIENTS: Record<MaskTone, [string, string, string]> = {
  hot:    ["#F15A2B", "#D944B3", "#6C2CD9"],
  sky:    ["#6AA1E0", "#D944B3", "#F15A2B"],
  mint:   ["#27C27A", "#6AA1E0", "#D944B3"],
  violet: ["#6C2CD9", "#D944B3", "#F15A2B"],
  rose:   ["#D944B3", "#F15A2B", "#FBAC4A"],
  amber:  ["#F7B54A", "#F15A2B", "#D944B3"],
};

function MaskDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute -z-10 h-0 w-0">
      <defs>
        {(Object.keys(MASK_GRADIENTS) as MaskTone[]).map((tone) => {
          const [a, b, c] = MASK_GRADIENTS[tone];
          return (
            <linearGradient key={tone} id={`mask-${tone}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={a} />
              <stop offset="0.55" stopColor={b} />
              <stop offset="1" stopColor={c} />
            </linearGradient>
          );
        })}
        <radialGradient id="orb-violet" cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#ECD0FF" />
          <stop offset="1" stopColor="#6C2CD9" />
        </radialGradient>
        <radialGradient id="orb-rose" cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#FBD0E2" />
          <stop offset="1" stopColor="#D944B3" />
        </radialGradient>
      </defs>
    </svg>
  );
}

type PortraitSize = "hero" | "card" | "marquee" | "md" | "sm" | "tiny";

function MaskedPortrait({
  size, hair, skin, garment, mask, label,
}: { size: PortraitSize; hair: string; skin: string; garment: string; mask: MaskTone; label?: string }) {
  const dims = {
    hero:    { w: 460, h: 560 },
    card:    { w: 220, h: 260 },
    marquee: { w: 320, h: 420 },
    md:      { w: 260, h: 320 },
    sm:      { w: 96,  h: 116 },
    tiny:    { w: 54,  h: 68  },
  }[size];

  return (
    <div className="relative" style={{ width: dims.w, maxWidth: "100%" }}>
      <svg viewBox="0 0 460 560" width="100%" className="block h-auto">
        {/* Shoulders / garment */}
        <path
          d="M40 560 C60 460 150 420 230 420 C310 420 400 460 420 560 Z"
          fill={garment}
        />
        <path
          d="M170 420 Q230 452 290 420 L290 460 Q230 478 170 460 Z"
          fill={garment}
          opacity="0.9"
        />
        {/* Neck */}
        <rect x="206" y="380" width="48" height="48" fill={skin} />
        {/* Head */}
        <ellipse cx="230" cy="260" rx="130" ry="152" fill={skin} />
        {/* Hair back */}
        <path
          d="M95 210 C95 120 160 80 230 80 C300 80 365 120 365 210 L365 250 Q300 195 230 205 Q160 215 95 260 Z"
          fill={hair}
        />
        {/* Hair front wisp */}
        <path
          d="M150 180 Q210 100 310 140 Q330 170 300 205 Q240 180 200 210 Q175 205 150 180 Z"
          fill={hair}
          opacity="0.85"
        />
        {/* Subtle cheek shading */}
        <ellipse cx="165" cy="330" rx="22" ry="14" fill="#000" opacity="0.05" />
        <ellipse cx="295" cy="330" rx="22" ry="14" fill="#000" opacity="0.05" />
        {/* Mouth */}
        <path d="M212 370 Q230 382 248 370" stroke="#7a4a38" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Domino mask */}
        <g>
          <path
            d="M105 246
               C105 212 155 204 205 220
               Q230 230 255 220
               C305 204 355 212 355 246
               C355 298 310 320 270 310
               Q245 302 230 302 Q215 302 190 310
               C150 320 105 298 105 246 Z"
            fill={`url(#mask-${mask})`}
          />
          {/* Eye cutouts */}
          <ellipse cx="183" cy="262" rx="22" ry="15" fill={skin} />
          <ellipse cx="277" cy="262" rx="22" ry="15" fill={skin} />
          {/* Eyes */}
          <ellipse cx="183" cy="262" rx="6" ry="7" fill="#1a1a1a" />
          <ellipse cx="277" cy="262" rx="6" ry="7" fill="#1a1a1a" />
          <ellipse cx="185" cy="260" rx="1.8" ry="2" fill="#fff" />
          <ellipse cx="279" cy="260" rx="1.8" ry="2" fill="#fff" />
          {/* Super Agent label */}
          {size !== "sm" && size !== "tiny" && (
            <g>
              <rect x="322" y="223" width="30" height="10" rx="2" fill="rgba(255,255,255,0.2)" />
              <text x="337" y="231" fontFamily="Source Code Pro, monospace" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="0.5">SUPER</text>
            </g>
          )}
        </g>
      </svg>
      {label && size === "hero" && (
        <div className="absolute right-[6%] top-[27%] rounded-full bg-white/88 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--ink)] shadow-sm">
          {label}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Agents carousel card
   ───────────────────────────────────────────────────────── */

function AgentCard({ agent }: { agent: AgentDef }) {
  return (
    <div
      className="group relative flex aspect-[5/6] flex-col overflow-hidden rounded-[18px] p-4"
      style={{ background: agent.accent }}
    >
      <div className="relative z-10 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white text-[12px] font-[700]" style={{ color: MASK_GRADIENTS[agent.mask][1] }}>
          <DotGlyph tone={agent.mask} />
        </span>
        <span className="font-mono text-[11.5px] font-[600] uppercase tracking-[0.14em] text-[var(--ink)]">
          {agent.card}
        </span>
      </div>
      <div className="relative mt-auto flex-1">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
          <MaskedPortrait size="card" hair={agent.hair} skin={agent.skin} garment={agent.garment} mask={agent.mask} />
        </div>
        {agent.prop === "orb" && (
          <div className="absolute bottom-8 right-2 h-10 w-10 rounded-full" style={{ background: `url(#orb-rose) radial-gradient(circle at 30% 30%, ${MASK_GRADIENTS[agent.mask][0]}, ${MASK_GRADIENTS[agent.mask][2]})` }} />
        )}
        {agent.prop === "cube" && (
          <div
            className="absolute bottom-10 left-3 h-10 w-10 rotate-12"
            style={{
              background: `linear-gradient(135deg, ${MASK_GRADIENTS[agent.mask][0]} 0%, ${MASK_GRADIENTS[agent.mask][2]} 100%)`,
              clipPath: "polygon(50% 0, 100% 26%, 100% 74%, 50% 100%, 0 74%, 0 26%)",
            }}
          />
        )}
      </div>
      <button className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-transform group-hover:scale-110" aria-label={`Hire ${agent.name}`}>
        <span className="text-[18px] leading-none">＋</span>
      </button>
    </div>
  );
}

function DotGlyph({ tone }: { tone: MaskTone }) {
  const [a, , c] = MASK_GRADIENTS[tone];
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3">
      <circle cx="6" cy="6" r="5" fill={`url(#mask-${tone})`} />
      <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeOpacity="0.2" />
      <circle cx="6" cy="6" r="2.4" fill="#fff" />
      <circle cx="6" cy="6" r="2.4" fill={a} opacity="0.6" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   Team diamond diagram
   ───────────────────────────────────────────────────────── */

function TeamDiagram() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[620px]">
      <svg viewBox="0 0 620 460" className="h-full w-full">
        <defs>
          <linearGradient id="team-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ddd" />
            <stop offset="1" stopColor="#aaa" />
          </linearGradient>
        </defs>
        {/* Diamond curves */}
        <path d="M310 40 C150 60 120 230 220 280" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        <path d="M310 40 Q310 160 310 240" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        <path d="M310 40 C470 60 500 230 400 280" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        <path d="M220 280 C180 340 260 400 310 420" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        <path d="M310 240 Q310 340 310 420" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        <path d="M400 280 C440 340 360 400 310 420" stroke="url(#team-line)" fill="none" strokeWidth="1.2" />
        {/* End-caps */}
        <circle cx="310" cy="40" r="10" fill="url(#mask-hot)" />
        <circle cx="310" cy="420" r="10" fill="url(#mask-mint)" />
      </svg>
      <AgentChip className="absolute left-[18%] top-[42%]" name="Copywriting" tone="sky" />
      <AgentChip className="absolute left-1/2 top-[38%] -translate-x-1/2" name="Email Design" tone="amber" big />
      <AgentChip className="absolute right-[18%] top-[42%]" name="Campaign Lifecycle" tone="violet" />
    </div>
  );
}

function AgentChip({ name, tone, className, big }: { name: string; tone: MaskTone; className?: string; big?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className={`${big ? "h-12 w-12" : "h-10 w-10"} overflow-hidden rounded-full bg-[var(--soft-grey)]`}>
        <MaskedPortrait size="tiny" hair="#333" skin="#e8c69a" garment={MASK_GRADIENTS[tone][1]} mask={tone} />
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[12px] font-[500] text-[var(--ink)] shadow-sm">
        <DotGlyph tone={tone} />
        {name}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Human skills demo
   ───────────────────────────────────────────────────────── */

function SkillPill({
  skill, active, onFocus,
}: { skill: typeof SKILLS[number]; active: boolean; onFocus: () => void }) {
  return (
    <button
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onFocus}
      className={`block w-full rounded-[14px] border px-4 py-3 text-left transition-all ${
        active
          ? "border-[var(--hairline)] bg-white shadow-[0_12px_24px_-20px_rgba(0,0,0,0.4)]"
          : "border-transparent bg-transparent hover:bg-white/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <SkillIcon icon={skill.icon} active={active} />
        <span className={`text-[14.5px] font-[600] ${active ? "text-[var(--ink)]" : "text-[var(--ink-60)]"}`}>
          {skill.label}
        </span>
      </div>
      {active && (
        <p className="mt-2 pl-11 text-[13px] leading-[1.5] text-[var(--muted)]">
          {skill.copy}
        </p>
      )}
    </button>
  );
}

function SkillIcon({ icon, active }: { icon: string; active: boolean }) {
  const common = { width: 18, height: 18, fill: "none", stroke: active ? "#6C2CD9" : "#8a8a8a", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--soft-grey)]">
      <svg viewBox="0 0 24 24" {...common}>
        {icon === "whatsapp-send" && <><path d="M21 3 L3 11 L11 13 L13 21 Z" /><path d="M11 13 L21 3" /></>}
        {icon === "ig"            && <><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="0.8" fill={active ? "#6C2CD9" : "#8a8a8a"} stroke="none" /></>}
        {icon === "calendar"      && <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>}
        {icon === "chart"         && <><path d="M4 20V4M4 20h16M8 16v-6M12 16V7M16 16v-9" /></>}
        {icon === "mail"          && <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M3.5 7 L12 13 L20.5 7" /></>}
      </svg>
    </span>
  );
}

function AgentDemoPanel({ skillKey }: { skillKey: string }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[22px] bg-white shadow-[0_30px_60px_-40px_rgba(20,20,20,0.35)]">
      {skillKey === "send-whatsapp" && <DemoWhatsApp />}
      {skillKey === "post-ig"       && <DemoInstagram />}
      {skillKey === "book-viewing"  && <DemoViewing />}
      {skillKey === "watch-dld"     && <DemoDLD />}
      {skillKey === "send-brief"    && <DemoBrief />}

      {/* Floating speech bubble + agent character */}
      <div className="absolute bottom-6 right-6 flex items-end gap-3">
        <div className="max-w-[240px] rounded-[18px] px-4 py-2.5 text-[13px] font-[500] text-white shadow-lg" style={{ background: "linear-gradient(108deg,#6C2CD9,#D944B3)" }}>
          ✓ I'll send this WhatsApp once you approve it.
        </div>
        <div className="h-28 w-20 overflow-hidden">
          <MaskedPortrait size="sm" hair="#5a2ea8" skin="#d4a486" garment="#6A46A8" mask="violet" />
        </div>
      </div>
    </div>
  );
}

function DemoHeader({ logo, subject, to }: { logo: React.ReactNode; subject: string; to: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--hairline)] px-6 py-5">
      {logo}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-[600] text-[var(--ink)]">{subject}</p>
        <p className="text-[12.5px] text-[var(--muted)]"><span className="font-mono uppercase tracking-[0.12em]">To:</span> {to}</p>
      </div>
    </div>
  );
}

function GmailLogo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <rect x="2" y="6" width="28" height="20" rx="2.5" fill="#fff" stroke="#e4e4e4" />
      <path d="M2 8 L16 19 L30 8" fill="none" stroke="#ea4335" strokeWidth="2.2" />
      <path d="M2 8 V26" stroke="#4285f4" strokeWidth="2.2" />
      <path d="M30 8 V26" stroke="#fbbc04" strokeWidth="2.2" />
      <path d="M16 19 L30 8" stroke="#34a853" strokeWidth="2.2" />
    </svg>
  );
}

function WhatsAppLogo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <circle cx="16" cy="16" r="14" fill="#25D366" />
      <path d="M9 23 L11 18 A7 7 0 1 1 14 21 Z" fill="#fff" />
      <path d="M12 14 Q13 16 15 17 Q16 17.5 17 17 L19 16 L21 18 Q20 20 18 20 Q13 20 11 14 Q11 12 13 11 L15 13 Q14.5 14 13 14 Z" fill="#25D366" />
    </svg>
  );
}

function DemoWhatsApp() {
  return (
    <div className="flex h-full flex-col">
      <DemoHeader logo={<WhatsAppLogo />} subject="Ahmed Al Hashimi" to="+971 50 ●●● ●●●●" />
      <div className="flex-1 space-y-3 p-6">
        <AgentTask icon="loader">Reviewing lead history</AgentTask>
        <AgentTask icon="loader">Pulling Binghatti Hills payment plan</AgentTask>
        <AgentTask icon="loader">Drafting reply in English</AgentTask>
        <div className="mt-4 rounded-[12px] border border-[var(--hairline)] bg-[var(--soft-grey)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--muted)]">Draft · 12 seconds ago</p>
          <p className="mt-2 text-[14px] leading-[1.5] text-[var(--ink)]">
            Hi Ahmed — yes the JVC 1-bed is still available. Starting from AED 810K with a 60/40 payment plan. Want me to send the floor plan and book a viewing this week?
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[11px] font-[500] text-[var(--muted)]">English</span>
            <span className="rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[11px] font-[500] text-[var(--muted)]">RERA · DLD fees ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoInstagram() {
  return (
    <div className="flex h-full flex-col">
      <DemoHeader logo={<InstagramLogo />} subject="JVC · Why it outperformed Downtown Q1" to="@your.agency" />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="aspect-square rounded-[12px] border border-[var(--hairline)]" style={{
              background: `linear-gradient(135deg, ${["#FCE4D5","#E6EEFB","#ECE6FB","#E2F2E9","#FDE8E4","#FFF2DA"][i]}, #fff)`
            }} />
          ))}
        </div>
        <div className="mt-5 rounded-[12px] border border-[var(--hairline)] bg-[var(--soft-grey)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--muted)]">Caption · 1,240 chars · RERA-compliant</p>
          <p className="mt-2 text-[13.5px] leading-[1.5] text-[var(--ink)]">
            JVC moved 18% in Q1 while Downtown stalled. Here's why the yield shift happened — and the three projects we think own the next leg…
          </p>
        </div>
      </div>
    </div>
  );
}

function InstagramLogo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <defs>
        <linearGradient id="ig-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="26" height="26" rx="7" fill="url(#ig-g)" />
      <circle cx="16" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="23" cy="9" r="1.4" fill="#fff" />
    </svg>
  );
}

function DemoViewing() {
  return (
    <div className="flex h-full flex-col">
      <DemoHeader logo={<CalIcon />} subject="Viewing · Binghatti Hills JVC" to="Ahmed Al Hashimi · Thu 11:00" />
      <div className="flex-1 space-y-3 p-6">
        <AgentTask icon="check">Checked lead availability · Thu preferred</AgentTask>
        <AgentTask icon="check">Confirmed your calendar · 11:00–12:00 free</AgentTask>
        <AgentTask icon="loader">Booking the unit viewing slot</AgentTask>
        <AgentTask icon="loader">Drafting confirmation WhatsApp + email</AgentTask>
      </div>
    </div>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <rect x="4" y="7" width="24" height="21" rx="3" fill="#fff" stroke="#e4e4e4" />
      <path d="M10 4v6M22 4v6M4 13h24" stroke="#6C2CD9" strokeWidth="2" />
      <rect x="9" y="17" width="6" height="6" rx="1" fill="#FDE8E4" />
    </svg>
  );
}

function DemoDLD() {
  return (
    <div className="flex h-full flex-col">
      <DemoHeader logo={<GlobeIcon />} subject="Market intel · DLD · Bayut · Property Finder" to="Live · last updated 6 seconds ago" />
      <div className="flex-1 space-y-2.5 p-6">
        <IntelRow src="DLD"    label="Dubai Hills · 3BR · AED 4.8M · 12% below comps" tone="hot" />
        <IntelRow src="BAYUT"  label="JVC · 1BR · Binghatti Orchid · cut 8%"          tone="violet" />
        <IntelRow src="PF"     label="Damac Hills 2 · 4BR · new listing · AED 3.2M"   tone="sky" />
        <IntelRow src="X"      label="Trending · JVC rental yield up 240%"           tone="mint" />
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <circle cx="16" cy="16" r="13" fill="#fff" stroke="#e4e4e4" />
      <path d="M3 16h26M16 3c5 4 5 22 0 26M16 3c-5 4-5 22 0 26" stroke="#27C27A" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function IntelRow({ src, label, tone }: { src: string; label: string; tone: MaskTone }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[var(--hairline)] bg-[var(--soft-grey)] px-3 py-2">
      <span className="flex h-6 w-12 items-center justify-center rounded-[5px] font-mono text-[10px] font-[700] tracking-[0.08em] text-white" style={{ background: MASK_GRADIENTS[tone][1] }}>
        {src}
      </span>
      <span className="flex-1 text-[13px] text-[var(--ink)]">{label}</span>
    </div>
  );
}

function DemoBrief() {
  return (
    <div className="flex h-full flex-col">
      <DemoHeader logo={<GmailLogo />} subject="Morning brief · 21 Apr · 4 items · 1 urgent" to="you@youragency.ae" />
      <div className="flex-1 space-y-3 p-6">
        <BriefLine n="1" label="HOT"      body="Mira Al Shamsi · score 9 · matched Binghatti Hills + Sobha Hartland" />
        <BriefLine n="2" label="PATTERN"  body="JVC leads respond 3× faster to Arabic openers" />
        <BriefLine n="3" label="PIPELINE" body="Conversion 4.2% this week · up from 3.1%" />
        <BriefLine n="4" label="TODAY"    body="3 viewings confirmed · 1 needs a car at 3pm" />
      </div>
    </div>
  );
}

function BriefLine({ n, label, body }: { n: string; label: string; body: string }) {
  return (
    <div className="grid grid-cols-[28px_80px_1fr] items-start gap-3 border-b border-[var(--hairline)] pb-3 last:border-0">
      <span className="font-mono text-[12px] font-[600] text-[var(--ink-50)] [font-variant-numeric:tabular-nums]">{n}</span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</span>
      <span className="text-[13.5px] leading-[1.5] text-[var(--ink)]">{body}</span>
    </div>
  );
}

function AgentTask({ children, icon }: { children: React.ReactNode; icon: "loader" | "check" }) {
  return (
    <div className="flex items-center gap-3 text-[13.5px] text-[var(--ink)]">
      {icon === "loader" ? (
        <span className="relative block h-4 w-4">
          <span className="absolute inset-0 rounded-full border-2 border-[var(--hairline)]" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--violet-600)] animate-spin" />
        </span>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="#27C27A" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 8.5 L7 12 L13 4" />
        </svg>
      )}
      <span>{children}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Collab + org-chart cards
   ───────────────────────────────────────────────────────── */

function CollabCard() {
  return (
    <div className="rounded-[22px] bg-[var(--soft-grey)] p-8">
      <div className="rounded-[14px] border border-[var(--hairline)] bg-white p-5">
        <p className="text-[13px] font-[600] text-[var(--ink)]">Overview</p>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--muted)]">
          Central hub guiding every new user through your tone, your projects, your RERA stance. Mentions work the same for humans and agents.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Mention tone="sky"    name="Aisha" />
          <span className="text-[13px] text-[var(--muted)]">briefed</span>
          <Mention tone="hot"    name="Sarah" />
          <span className="text-[13px] text-[var(--muted)]">about</span>
          <span className="rounded-[5px] bg-[#FFF3C2] px-1 text-[13px] text-[var(--ink)]">Samuel H. · new hire</span>
        </div>
        <div className="mt-4 flex items-center gap-3 text-[13px] text-[var(--muted)]">
          <span>✉︎ Letter from the CEO</span>
          <span>·</span>
          <span>💬 Company Story</span>
        </div>
      </div>
      <div className="mt-6">
        <p className="[font-family:'Hanken_Grotesk'] text-[1.35rem] font-[600] leading-[1.2] tracking-[-0.02em]">Collaborate alongside humans</p>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--muted)]">Just like a highly skilled teammate.</p>
      </div>
    </div>
  );
}

function Mention({ tone, name }: { tone: MaskTone; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[5px] px-1.5 text-[13px]" style={{ background: `${MASK_GRADIENTS[tone][0]}22`, color: MASK_GRADIENTS[tone][2] }}>
      <DotGlyph tone={tone} />
      {name}
    </span>
  );
}

function OrgChartCard() {
  const k = ORG_TREE.kids;
  return (
    <div className="rounded-[22px] bg-[var(--soft-grey)] p-8">
      <div className="rounded-[14px] border border-[var(--hairline)] bg-white p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--muted)]">ORG CHART</p>
        <div className="mt-5 flex flex-col items-center">
          <OrgNode node={ORG_TREE.root} />
          <svg viewBox="0 0 320 50" className="mt-3 h-10 w-[320px]">
            <path d="M160 0 V18 H40 V50 M160 18 H160 V50 M160 18 H280 V50" stroke="#d7d7d7" strokeWidth="1" fill="none" />
          </svg>
          <div className="grid w-full grid-cols-3 gap-2">
            {k.map((kid) => <OrgNode key={kid.name} node={kid} small />)}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="[font-family:'Hanken_Grotesk'] text-[1.35rem] font-[600] leading-[1.2] tracking-[-0.02em]">Managed by humans</p>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--muted)]">Agents have managers. You remain the boss.</p>
      </div>
    </div>
  );
}

function OrgNode({ node, small }: { node: { name: string; role: string; tint: MaskTone; monogram: string }; small?: boolean }) {
  const size = small ? 44 : 56;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="overflow-hidden rounded-full ring-2 ring-white" style={{ width: size, height: size, background: `conic-gradient(${MASK_GRADIENTS[node.tint].join(", ")})` }}>
        <div className="m-[3px] flex h-[calc(100%-6px)] w-[calc(100%-6px)] items-center justify-center rounded-full bg-white text-[12px] font-[700] text-[var(--ink)]">
          {node.monogram}
        </div>
      </div>
      <p className={`font-[600] text-[var(--ink)] ${small ? "text-[11px]" : "text-[12px]"}`}>{node.name}</p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{node.role}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Marquee stack
   ───────────────────────────────────────────────────────── */

function MarqueeStack() {
  return (
    <div className="absolute inset-0 flex flex-col gap-4 py-6">
      {MARQUEE_ROWS.map((row, i) => (
        <div key={i} className={`marquee-row ${i % 2 === 0 ? "marquee-row--ltr" : "marquee-row--rtl"}`}>
          <div className="marquee-track">
            {[...row, ...row].map((chip, j) => (
              <span key={`${i}-${j}`} className="marquee-chip">{chip}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Dark — wireframe mannequin
   ───────────────────────────────────────────────────────── */

function WireframeMannequin({ highlight }: { highlight: string }) {
  const zones: Record<string, { cx: number; cy: number; r: number; color: string }> = {
    memory:     { cx: 200, cy: 100, r: 56, color: "#FF6A3D" },
    knowledge:  { cx: 200, cy: 132, r: 40, color: "#6AA1E0" },
    collab:     { cx: 200, cy: 250, r: 70, color: "#27C27A" },
    skills:     { cx: 120, cy: 250, r: 50, color: "#D944B3" },
    autonomous: { cx: 280, cy: 250, r: 50, color: "#F7B54A" },
    ambient:    { cx: 200, cy: 360, r: 80, color: "#A87FFF" },
    feedback:   { cx: 200, cy: 420, r: 50, color: "#FF4F98" },
  };
  const h = zones[highlight];
  return (
    <svg viewBox="0 0 400 500" className="h-[420px] w-auto">
      <defs>
        <radialGradient id="halo" cx="0.5" cy="0.5">
          <stop offset="0" stopColor={h.color} stopOpacity="0.9" />
          <stop offset="1" stopColor={h.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Halo */}
      <circle cx={h.cx} cy={h.cy} r={h.r * 1.8} fill="url(#halo)" />
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7">
        {/* Head (icosphere feel) */}
        <circle cx="200" cy="110" r="60" />
        <path d="M140 110 Q200 60 260 110 Q200 160 140 110" />
        <path d="M170 80 L230 80 M170 140 L230 140" />
        <path d="M160 110 L240 110" />
        <path d="M200 55 L200 165" />
        {/* Neck */}
        <path d="M180 170 L180 210 L220 210 L220 170" />
        {/* Shoulders */}
        <path d="M100 250 L180 210 L220 210 L300 250 L300 300 L100 300 Z" />
        <path d="M100 250 L180 210 M300 250 L220 210 M180 210 L220 210" />
        <path d="M100 300 Q200 320 300 300" />
        {/* Chest wireframe */}
        <path d="M140 300 Q200 340 260 300" />
        <path d="M170 300 Q200 330 230 300" />
        {/* Torso */}
        <path d="M110 300 L110 430 L290 430 L290 300" />
        <path d="M110 360 L290 360" />
        <path d="M150 300 L150 430 M200 300 L200 430 M250 300 L250 430" />
      </g>
      {/* Accent dot */}
      <circle cx={h.cx} cy={h.cy} r={Math.min(h.r / 3, 14)} fill={h.color} opacity="0.9" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   Tech panels
   ───────────────────────────────────────────────────────── */

function TechRow({
  number, title, body, panel, ctaHref,
}: { number: string; title: string; body: string; panel: React.ReactNode; ctaHref: string }) {
  return (
    <div className="grid gap-10 border-t border-white/10 py-14 md:grid-cols-[0.9fr_1.5fr] md:gap-14 md:py-20">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/55">{number}</p>
        <h4 className="mt-4 [font-family:'Hanken_Grotesk'] text-[2rem] font-[600] leading-[1.05] tracking-[-0.02em]">{title}</h4>
        <p className="mt-4 max-w-[38ch] text-[14.5px] leading-[1.6] text-white/70">{body}</p>
        <a href={ctaHref} className="btn-white mt-7 inline-flex">Get started</a>
      </div>
      <div className="relative">{panel}</div>
    </div>
  );
}

function AnalyticsPanel() {
  const leaders = [
    { name: "Sarah",  role: "Sales Agent",    score: 142, tint: "hot"    as MaskTone },
    { name: "Aisha",  role: "Content Agent",  score: 108, tint: "sky"    as MaskTone },
    { name: "Tariq",  role: "Market Agent",   score:  94, tint: "mint"   as MaskTone },
    { name: "Yousef", role: "Design Agent",   score:  81, tint: "violet" as MaskTone },
    { name: "Layla",  role: "Closer Agent",   score:  70, tint: "amber"  as MaskTone },
    { name: "Omar",   role: "Chief of Staff", score:  64, tint: "rose"   as MaskTone },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[14px] border border-white/10 p-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50">AGENCY AI PERCENTILE</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="[font-family:'Hanken_Grotesk'] text-[5.5rem] font-[500] leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">82</span>
          <span className="text-[2rem] font-[500] text-white">%</span>
          <span className="ml-1 text-[14px] text-[#27C27A]">▲ 12</span>
        </div>
        <div className="mt-5 flex gap-[3px]">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="h-4 w-[6px] rounded-[1px]" style={{ background: i < 23 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)" }} />
          ))}
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#27C27A]">YOU CRUSHED IT!</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">Your agency leads 82% of Dubai peers.</p>
      </div>
      <div className="rounded-[14px] border border-white/10 p-6">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50">TOP PERFORMERS</p>
        <ul className="mt-4 space-y-3">
          {leaders.map((l, i) => (
            <li key={l.name} className="flex items-center gap-3">
              <span className="w-4 font-mono text-[12px] text-white/45 [font-variant-numeric:tabular-nums]">{i + 1}.</span>
              <span className="relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-white/20" style={{ background: `conic-gradient(${MASK_GRADIENTS[l.tint].join(", ")})` }}>
                <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-black text-[11px] font-[700] text-white">{l.name[0]}</span>
              </span>
              <span className="flex-1 text-[13.5px] text-white">{l.name}</span>
              <span className="font-mono text-[12.5px] text-white/55 [font-variant-numeric:tabular-nums]">{l.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AmbientPanel() {
  const cols = 48, rows = 6;
  return (
    <div className="rounded-[14px] border border-white/10 p-6">
      {/* Dot matrix */}
      <div className="relative h-[150px] w-full">
        <svg viewBox={`0 0 ${cols * 8} ${rows * 8}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const t = c / cols;
              const wave = Math.sin(t * Math.PI * 2.2) * 1.2 + Math.sin(t * Math.PI * 5) * 0.6;
              const y = (rows - 1) / 2 + wave;
              const active = r >= Math.floor(y) - 1 && r <= Math.floor(y) + 1;
              return <circle key={`${r}-${c}`} cx={c * 8 + 3} cy={r * 8 + 3} r="1.2" fill={active ? "#fff" : "rgba(255,255,255,0.18)"} />;
            })
          )}
          {/* Green line */}
          <polyline
            points={Array.from({ length: cols }).map((_, c) => {
              const t = c / cols;
              const wave = Math.sin(t * Math.PI * 2.2) * 1.2 + Math.sin(t * Math.PI * 5) * 0.6;
              const y = ((rows - 1) / 2 + wave) * 8 + 3;
              return `${c * 8 + 3},${y}`;
            }).join(" ")}
            fill="none" stroke="#27C27A" strokeWidth="1.4"
          />
        </svg>
      </div>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
        <span className="[font-family:'Hanken_Grotesk'] text-[2.8rem] font-[500] leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">21.8K</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">MESSAGES ANSWERED</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#27C27A]/30 bg-[#27C27A]/10 px-3 py-1 text-[12px] text-[#27C27A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#27C27A]" />
          22 AGENTS ONLINE
        </span>
      </div>
      <ul className="mt-5 divide-y divide-white/10 text-[13.5px]">
        <li className="flex items-center justify-between py-2.5"><span className="text-white">Next milestone</span><span className="font-mono text-white [font-variant-numeric:tabular-nums]">25,000</span></li>
        <li className="flex items-center justify-between py-2.5"><span className="text-white/50 line-through">Milestone complete</span><span className="font-mono text-white/45 line-through [font-variant-numeric:tabular-nums]">20,000</span></li>
        <li className="flex items-center justify-between py-2.5"><span className="text-white/50 line-through">Milestone complete</span><span className="font-mono text-white/45 line-through [font-variant-numeric:tabular-nums]">10,000</span></li>
      </ul>
    </div>
  );
}

function RadarPanel() {
  return (
    <div className="relative h-[360px] overflow-hidden rounded-[14px] border border-white/10 p-6">
      <div className="absolute left-6 top-5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#27C27A]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#27C27A]">LIVE INTELLIGENCE</span>
      </div>
      <div className="absolute inset-0 top-10 flex items-start justify-center">
        <svg viewBox="0 0 400 260" className="h-full w-full">
          <defs>
            <radialGradient id="sweep" cx="0.5" cy="1" r="1">
              <stop offset="0" stopColor="#27C27A" stopOpacity="0.8" />
              <stop offset="0.6" stopColor="#27C27A" stopOpacity="0.05" />
              <stop offset="1" stopColor="#27C27A" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[40, 80, 120, 160, 200].map((r) => (
            <circle key={r} cx="200" cy="260" r={r} fill="none" stroke="rgba(39,194,122,0.22)" strokeWidth="1" />
          ))}
          <path d="M200 260 L200 60 A200 200 0 0 1 380 260 Z" fill="url(#sweep)" />
          {/* Dots */}
          <circle cx="156" cy="150" r="3.2" fill="#fff" /><text x="162" y="152" fill="#fff" fontSize="10" fontFamily="Source Code Pro, monospace">Decision</text>
          <circle cx="240" cy="80" r="3.2" fill="#fff" /><text x="246" y="82" fill="#fff" fontSize="10" fontFamily="Source Code Pro, monospace">Insight</text>
          <circle cx="320" cy="170" r="3.2" fill="#fff" /><text x="276" y="200" fill="#fff" fontSize="10" fontFamily="Source Code Pro, monospace">Book viewing</text>
          <circle cx="110" cy="210" r="3.2" fill="#fff" /><text x="80" y="230" fill="#fff" fontSize="10" fontFamily="Source Code Pro, monospace">Comparable</text>
        </svg>
      </div>
    </div>
  );
}

function KnowledgePanel() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div className="rounded-[14px] border border-white/10 p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50">FIG 1</p>
        <IntegrationOrb />
        <p className="mt-5 text-[13px] leading-[1.5] text-white">Enterprise Connected Search<br />from 50+ Dubai RE apps</p>
      </div>
      <div className="rounded-[14px] border border-white/10 p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50">FIG 2</p>
        <PrivateTerminal />
        <p className="mt-5 text-[13px] leading-[1.5] text-white">Permissions &amp; Privacy Preserved</p>
      </div>
      <div className="rounded-[14px] border border-white/10 p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50">FIG 3</p>
        <SyncGauge />
        <p className="mt-5 text-[13px] leading-[1.5] text-white">Real-time 2-way syncing engine</p>
      </div>
    </div>
  );
}

function IntegrationOrb() {
  const R = 92;
  const CX = 110, CY = 110;
  return (
    <svg viewBox="0 0 220 220" className="mx-auto mt-3 h-[200px] w-full">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeDasharray="2 4" />
      {INTEGRATIONS.map((app, i) => {
        const a = (app.angle * Math.PI) / 180;
        const x = CX + R * Math.cos(a);
        const y = CY + R * Math.sin(a);
        return (
          <g key={app.key}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />
            <g transform={`translate(${x - 18} ${y - 18})`}>
              <rect width="36" height="36" rx="10" fill="#111" stroke="rgba(255,255,255,0.12)" />
              <IntegrationGlyph name={app.glyph} />
            </g>
          </g>
        );
      })}
      <g transform={`translate(${CX - 26} ${CY - 26})`}>
        <rect width="52" height="52" rx="16" fill="#fff" />
        <text x="26" y="32" textAnchor="middle" fontFamily="Hanken Grotesk, sans-serif" fontWeight="700" fontSize="16" fill="#111">AW</text>
      </g>
    </svg>
  );
}

function IntegrationGlyph({ name }: { name: string }) {
  return (
    <g transform="translate(8 8)">
      {name === "whatsapp" && <><circle cx="10" cy="10" r="9" fill="#25D366" /><path d="M5 15 L6 12 A4.5 4.5 0 1 1 8 14 Z" fill="#fff" /></>}
      {name === "gmail"    && <><rect x="1" y="4" width="18" height="12" rx="1.5" fill="#fff" /><path d="M1 5 L10 12 L19 5" stroke="#ea4335" strokeWidth="1.6" fill="none" /></>}
      {name === "instagram" && <><rect x="1" y="1" width="18" height="18" rx="5" fill="url(#mask-violet)" /><circle cx="10" cy="10" r="4.5" fill="none" stroke="#fff" strokeWidth="1.4" /><circle cx="15" cy="5" r="1" fill="#fff" /></>}
      {name === "calendar" && <><rect x="1" y="3" width="18" height="16" rx="2" fill="#fff" /><path d="M5 1v4M15 1v4M1 8h18" stroke="#6C2CD9" strokeWidth="1.6" /></>}
      {name === "property-finder" && <><rect width="20" height="20" rx="4" fill="#EF4330" /><path d="M7 13 V8 A3 3 0 1 1 11 8 V13" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>}
      {name === "bayut"            && <><rect width="20" height="20" rx="4" fill="#75CC38" /><path d="M5 14 V9 L10 5 L15 9 V14 Z" fill="#fff" /></>}
      {name === "dubizzle"         && <><rect width="20" height="20" rx="4" fill="#FDB52A" /><text x="10" y="14" textAnchor="middle" fontFamily="Hanken Grotesk" fontWeight="700" fontSize="12" fill="#1a1a1a">d</text></>}
      {name === "meta"             && <><rect width="20" height="20" rx="4" fill="#0668E1" /><path d="M4 14 Q8 4 12 10 Q16 16 18 8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>}
    </g>
  );
}

function PrivateTerminal() {
  const lines = [
    "tfuXK6c==",
    "z6Hd2jZ7+",
    "b9YmD/NS+Ub",
    "PRIVATE",
    "c?PBiLdrTm",
    "3f/DwgnKP==",
  ];
  return (
    <div className="mt-3 h-[200px] overflow-hidden rounded-[10px] bg-black font-mono text-[11px] leading-[18px]">
      <div className="p-3 text-white/40">
        {lines.map((l, i) => (
          <div key={i} className={l === "PRIVATE" ? "rounded bg-[#0c3d25] px-1 text-[#27C27A]" : ""}>
            {l}
          </div>
        ))}
        {lines.map((l, i) => (
          <div key={`d-${i}`} className={l === "PRIVATE" ? "rounded bg-[#0c3d25] px-1 text-[#27C27A]" : ""}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncGauge() {
  const count = 56;
  return (
    <div className="relative mx-auto mt-3 h-[200px] w-[200px]">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {Array.from({ length: count }).map((_, i) => {
          const a = (i / count) * 2 * Math.PI;
          const x1 = 100 + 86 * Math.cos(a);
          const y1 = 100 + 86 * Math.sin(a);
          const x2 = 100 + 76 * Math.cos(a);
          const y2 = 100 + 76 * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i < count * 0.72 ? "#27C27A" : "rgba(255,255,255,0.14)"} strokeWidth="1.4" />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="[font-family:'Hanken_Grotesk'] text-[2.4rem] font-[500] leading-none text-[#27C27A] [font-variant-numeric:tabular-nums]">2,716</span>
        <span className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.24em] text-white/55">EVENTS</span>
      </div>
    </div>
  );
}

function FeatureCell({ f }: { f: typeof BRAINGPT[number] }) {
  return (
    <div className="flex flex-col items-start gap-3 border-b border-white/10 p-6 md:border-b-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#27C27A" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4 V12 L16 14" strokeLinecap="round" />
      </svg>
      <h5 className="text-[1.05rem] font-[600] text-white">{f.name}</h5>
      <p className="text-[13px] leading-[1.55] text-white/60">{f.body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Security
   ───────────────────────────────────────────────────────── */

function FaceSplit() {
  return (
    <div className="relative aspect-[5/6] overflow-hidden rounded-[14px] border border-white/10">
      {/* Background split */}
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="bg-black" />
        <div className="bg-[#1a1a1a]" />
      </div>
      {/* Left (digital) dot face */}
      <div className="absolute left-0 top-0 h-full w-1/2">
        <DottedFaceHalf side="left" />
        <FaceLabels side="left" labels={["INTEGRATIONS","SHARING","PERMISSIONS"]} />
      </div>
      {/* Right (human) portrait half */}
      <div className="absolute right-0 top-0 h-full w-1/2 overflow-hidden">
        <div className="absolute inset-0 flex items-end justify-start [clip-path:inset(0_0_0_0)]">
          <div className="mb-[-2%] ml-[-40%]">
            <MaskedPortrait size="md" hair="#c45521" skin="#f0c9a7" garment="#6A46A8" mask="rose" />
          </div>
        </div>
        <FaceLabels side="right" labels={["SUPER KNOWLEDGE","CAPABILITIES","ENGAGEMENT"]} />
      </div>
      {/* Divider beam */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[#D944B3] to-transparent blur-[1px]" />
    </div>
  );
}

function DottedFaceHalf({ side }: { side: "left" | "right" }) {
  const cols = 34, rows = 42;
  return (
    <svg viewBox={`0 0 ${cols * 5} ${rows * 5}`} preserveAspectRatio="none" className="h-full w-full">
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          // Define silhouette: circle for head, taper for shoulders
          const cx = c - cols / 2 + 0.5;
          const cy = r - rows * 0.35;
          const headR = cols * 0.32;
          const inHead = cx * cx + cy * cy < headR * headR;
          const torsoY = r > rows * 0.62;
          const torsoX = Math.abs(cx) < cols * (0.25 + (r - rows * 0.62) / rows * 0.4);
          const inSilhouette = inHead || (torsoY && torsoX);
          if (!inSilhouette) return null;
          return <circle key={`${r}-${c}`} cx={c * 5 + 2.5} cy={r * 5 + 2.5} r="1.2" fill="rgba(255,255,255,0.75)" />;
        })
      )}
    </svg>
  );
}

function FaceLabels({ side, labels }: { side: "left" | "right"; labels: string[] }) {
  return (
    <div className={`absolute inset-y-0 ${side === "left" ? "left-5" : "right-5"} flex flex-col justify-center gap-8`}>
      {labels.map((l) => (
        <div key={l} className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
          <span className="h-px w-8 bg-white/30" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/80">{l}</span>
        </div>
      ))}
    </div>
  );
}

function SecCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-white/10 p-6">
      <h4 className="[font-family:'Hanken_Grotesk'] text-[1.25rem] font-[600] leading-[1.2] tracking-[-0.015em] text-white">{title}</h4>
      <p className="mt-3 text-[13.5px] leading-[1.55] text-white/65">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function AuditList() {
  const items = [
    { icon: "check",  label: "Sarah · sent WhatsApp", time: "07:42" },
    { icon: "check",  label: "Aisha · queued post",    time: "08:15" },
    { icon: "warn",   label: "Tariq · flagged listing", time: "08:31" },
    { icon: "cancel", label: "Yousef · post rejected",  time: "09:02" },
    { icon: "check",  label: "Layla · booked viewing",  time: "09:14" },
  ];
  return (
    <div className="divide-y divide-white/10 rounded-[10px] border border-white/10 bg-black/40">
      {items.map((i, k) => (
        <div key={k} className="flex items-center justify-between px-3.5 py-2 text-[12.5px] text-white/80">
          <span className="flex items-center gap-2">
            <AuditDot kind={i.icon as "check" | "warn" | "cancel"} />
            {i.label}
          </span>
          <span className="font-mono text-white/45 [font-variant-numeric:tabular-nums]">{i.time}</span>
        </div>
      ))}
    </div>
  );
}

function AuditDot({ kind }: { kind: "check" | "warn" | "cancel" }) {
  const color = kind === "check" ? "#27C27A" : kind === "warn" ? "#F7B54A" : "#E06A3A";
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5">
      <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1.2" />
      {kind === "check"  && <path d="M4 7.5 L6.2 9.5 L10 5.5" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />}
      {kind === "warn"   && <><circle cx="7" cy="9" r="0.9" fill={color} /><path d="M7 4 V7.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" /></>}
      {kind === "cancel" && <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />}
    </svg>
  );
}

function ZeroRetention() {
  return (
    <div className="flex flex-col gap-2">
      {[
        { k: "OpenAI (direct)", v: "stores your prompts 30d" },
        { k: "Gemini (direct)", v: "logs inputs to Google" },
        { k: "Aygentis",        v: "zero retention · zero training", ok: true },
      ].map((r) => (
        <div key={r.k} className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[13px] ${r.ok ? "border-[#27C27A]/40 bg-[#27C27A]/10 text-white" : "border-white/10 text-white/55"}`}>
          <span>{r.k}</span>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.18em]">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function ReflectionCard() {
  return (
    <div className="relative rounded-[10px] border border-white/10 bg-black/40 p-4 font-mono text-[11.5px] leading-[1.55] text-white/75">
      <p className="text-[#27C27A]">// reflection loop</p>
      <p>plan → act → observe → <span className="text-white">reflect</span> → repeat</p>
      <p className="mt-2 text-white/55">"Ahmed hasn't replied in 47 min.</p>
      <p className="text-white/55">Was my opener too formal?</p>
      <p className="text-white/55">Try Arabic with a voice note next."</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Cost terminal
   ───────────────────────────────────────────────────────── */

function CostTerminal() {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-black p-6">
      <div className="absolute inset-0 opacity-[0.08] font-mono text-[10px] leading-[14px] text-[#27C27A]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>0x{Math.random().toString(16).slice(2, 10)} · AED {(Math.random() * 0.01).toFixed(5)} · model:sonnet · tenant:dxb-{i}</div>
        ))}
      </div>
      <div className="relative z-10 flex items-center gap-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">AVG COST / REPLY</p>
          <p className="mt-2 [font-family:'Hanken_Grotesk'] text-[4rem] font-[500] leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">
            $0.001
          </p>
        </div>
        <div className="h-20 w-px bg-white/15" />
        <div className="text-[12.5px] text-white/65">
          <p>Router saves <span className="text-white">74%</span> vs. direct GPT-4o.</p>
          <p className="mt-1">Subsidized during model-price shocks.</p>
          <p className="mt-1">No per-seat pricing tax.</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Gradient grain overlay
   ───────────────────────────────────────────────────────── */

function GradientGrain() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   Tokens
   ───────────────────────────────────────────────────────── */

function Tokens() {
  return (
    <style>{`
      :where(.fixed.inset-0) {
        --warm-white: #FBF8F4;
        --soft-grey: #F1EEE9;
        --ink: #141414;
        --ink-60: #6a6a6a;
        --ink-50: #808080;
        --ink-30: #a5a5a5;
        --muted: #6b6b6b;
        --hairline: rgba(20,20,20,0.08);
        --violet-600: #6C2CD9;
        --violet-700: #5521B3;
      }
      .btn-black {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0.7rem 1.3rem; border-radius: 999px;
        background: var(--ink); color: #fff;
        font-size: 13.5px; font-weight: 500;
        transition: background 150ms, transform 150ms;
      }
      .btn-black:hover { background: #000; transform: translateY(-1px); }
      .btn-outline {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0.7rem 1.3rem; border-radius: 999px;
        background: #fff; color: var(--ink);
        font-size: 13.5px; font-weight: 500;
        border: 1px solid var(--hairline);
        transition: border-color 150ms, transform 150ms;
      }
      .btn-outline:hover { border-color: rgba(20,20,20,0.25); transform: translateY(-1px); }
      .btn-white {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0.6rem 1.1rem; border-radius: 999px;
        background: #fff; color: #141414;
        font-size: 12.5px; font-weight: 500;
      }
      .marquee-row {
        display: flex;
        overflow: hidden;
        white-space: nowrap;
        mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
      }
      .marquee-track {
        display: flex;
        gap: 0.75rem;
        padding-right: 0.75rem;
        will-change: transform;
      }
      .marquee-row--ltr .marquee-track { animation: marqueeLtr 60s linear infinite; }
      .marquee-row--rtl .marquee-track { animation: marqueeRtl 60s linear infinite; }
      .marquee-chip {
        flex-shrink: 0;
        display: inline-flex; align-items: center;
        padding: 0.55rem 1rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.6);
        border: 1px solid var(--hairline);
        font-family: 'Source Code Pro', ui-monospace, monospace;
        font-size: 11.5px;
        font-weight: 500;
        letter-spacing: 0.12em;
        color: var(--ink);
      }
      @keyframes marqueeLtr {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      @keyframes marqueeRtl {
        from { transform: translateX(-50%); }
        to   { transform: translateX(0); }
      }
      @keyframes fadeSlide {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
