import { useEffect } from "react";
import { COMPANY_INFO } from "@/lib/company-info";

export default function QovesShell({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-white text-[var(--ink)] [font-family:'Hanken_Grotesk',system-ui,sans-serif]">
      <Tokens />

      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8 py-5">
          <a href="/" className="flex items-center gap-2.5">
            <span className="inline-block h-5 w-5 rounded-full border border-[var(--ink)]" />
            <span className="[font-family:'Hanken_Grotesk',system-ui] text-[18px] font-[600] tracking-[-0.01em]">
              Aygentis
            </span>
          </a>
          <nav className="hidden items-center gap-9 md:flex">
            <a href="/" className="qv-nav">Home</a>
            <a href="/about" className="qv-nav">About</a>
            <a href="/pricing" className="qv-nav">Pricing</a>
            <a href="/contact" className="qv-nav">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/contact" className="hidden text-[14px] font-[500] text-[var(--ink)] hover:underline md:inline">
              Login
            </a>
            <a href="/contact" className="qv-btn">Join Now</a>
          </div>
        </div>
      </header>

      {children}

      <footer className="px-8 py-10">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-4 w-4 rounded-full border border-[var(--ink)]" />
            <span className="text-[14px] font-[600]">Aygentis</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[12.5px] text-[var(--muted)]">
            <span>{COMPANY_INFO.address}</span>
            <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-[var(--ink)]">{COMPANY_INFO.email}</a>
            <a href="/privacy" className="hover:text-[var(--ink)]">Privacy</a>
            <a href="/terms" className="hover:text-[var(--ink)]">Terms</a>
            <span>© {new Date().getFullYear()} {COMPANY_INFO.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
    `}</style>
  );
}
