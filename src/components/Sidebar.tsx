"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string };
const I = {
  dashboard: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  leads: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5"/><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9"/></svg>,
  searches: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>,
  runs: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/></svg>,
  discover: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4.5 13H11l-1 9 8.5-11H12z"/></svg>,
  settings: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8"/></svg>,
  scrape: (p: IconProps) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
};

const NAV = [
  { href: "/", label: "Dashboard", icon: I.dashboard },
  { href: "/leads", label: "Leads", icon: I.leads },
  { href: "/searches", label: "Searches", icon: I.searches },
  { href: "/runs", label: "Runs", icon: I.runs },
  { href: "/discover", label: "Quick Discover", icon: I.discover },
  { href: "/scrape", label: "Scraper", icon: I.scrape },
  { href: "/settings", label: "Settings", icon: I.settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-white/60 px-4 py-6 backdrop-blur-xl md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white shadow-sm">L</span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">LeadGen</span>
      </Link>

      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active ? "bg-white text-ink shadow-[0_1px_2px_rgba(28,27,25,0.05)] ring-1 ring-[var(--color-line)]" : "text-stone-500 hover:bg-white/60 hover:text-ink"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />}
              <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-600" : "text-stone-400 group-hover:text-stone-600"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> SEO lead engine</p>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-500">Find · audit · reach businesses that need SEO.</p>
      </div>
    </aside>
  );
}
