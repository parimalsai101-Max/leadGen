"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, ScoreRing, statusTone } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

// ── Channel metadata ──────────────────────────────────────────────────────────
const CHANNEL_META: Record<string, { label: string; color: string; bg: string; ring: string; icon: string; url: string }> = {
  web:         { label: "Web Search",  color: "text-blue-700",    bg: "bg-blue-50",    ring: "ring-blue-200",    icon: "🌐", url: "https://duckduckgo.com/?q=" },
  yellowpages: { label: "Yellow Pages",color: "text-amber-700",   bg: "bg-amber-50",   ring: "ring-amber-200",   icon: "📒", url: "https://www.yellowpages.com/search?terms=" },
  quora:       { label: "Quora",       color: "text-rose-700",    bg: "bg-rose-50",    ring: "ring-rose-200",    icon: "💬", url: "https://duckduckgo.com/?q=" },
  clutch:      { label: "Clutch",      color: "text-orange-700",  bg: "bg-orange-50",  ring: "ring-orange-200",  icon: "⭐", url: "https://clutch.co/search?q=" },
  g2:          { label: "G2",          color: "text-violet-700",  bg: "bg-violet-50",  ring: "ring-violet-200",  icon: "🔷", url: "https://www.g2.com/search?query=" },
  crunchbase:  { label: "Crunchbase",  color: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", icon: "🚀", url: "https://www.crunchbase.com/discover/organizations?q=" },
  googlemaps:  { label: "Google Maps", color: "text-red-700",     bg: "bg-red-50",     ring: "ring-red-200",     icon: "📍", url: "https://www.google.com/maps/search/" },
  linkedin:    { label: "LinkedIn",    color: "text-sky-700",     bg: "bg-sky-50",     ring: "ring-sky-200",     icon: "💼", url: "https://www.linkedin.com/search/results/companies/?keywords=" },
};
const CHANNEL_ORDER = ["web", "googlemaps", "linkedin", "yellowpages", "quora", "clutch", "g2", "crunchbase"];

function ChannelBadge({ id, size = "sm" }: { id: string; size?: "sm" | "xs" }) {
  const m = CHANNEL_META[id] ?? { label: id, color: "text-stone-600", bg: "bg-stone-100", ring: "ring-stone-200", icon: "•", url: "https://duckduckgo.com/?q=" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 ${size === "xs" ? "py-0.5 text-[10px]" : "py-1 text-[11px]"} font-medium ring-1 ring-inset ${m.bg} ${m.color} ${m.ring}`}>
      <span className="text-[10px] leading-none">{m.icon}</span>
      {m.label}
    </span>
  );
}

const STATUSES = ["new", "qualified", "contacted", "won", "lost", "archived"] as const;
type Status = (typeof STATUSES)[number];

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range…" },
];

interface Outreach { emails: string[]; phones: string[]; socials: string[]; contactUrl: string | null; people: { name: string; role?: string }[] }
interface Seo {
  finalUrl?: string; httpsOk?: boolean; statusCode?: number | null;
  title: string | null; titleLength?: number; description: string | null; descriptionLength?: number;
  hasH1: boolean; hasOgTitle?: boolean; hasOgImage?: boolean; hasFavicon?: boolean;
  wordCount: number; issues: string[]; opportunityScore: number;
}
interface Lead {
  id: number; name: string; domain: string; website: string; description: string | null;
  query: string | null; channels: string[]; outreach: Outreach | null; seo: Seo | null;
  score: number; opportunityScore: number; issuesCount: number; hasEmail: boolean;
  scoreReasons: string[]; status: Status; notes: string | null;
  runId?: number | null; createdAt?: string; updatedAt: string;
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function parseUtc(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(s?: string): string {
  const d = parseUtc(s);
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function fmtAgo(s?: string): string {
  const d = parseUtc(s);
  if (!d) return "";
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  const u: [number, string][] = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];
  for (const [s2, label] of u) if (sec >= s2) return `${Math.floor(sec / s2)}${label} ago`;
  return "just now";
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [minScore, setMinScore] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("score");
  const [period, setPeriod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (channel) p.set("channel", channel);
    if (minScore) p.set("minScore", minScore);
    if (hasEmail) p.set("hasEmail", "1");
    if (q) p.set("q", q);
    if (sort) p.set("sort", sort);
    if (period && period !== "custom") p.set("period", period);
    if (period === "custom") { if (from) p.set("from", from); if (to) p.set("to", to); }
    const res = await fetch(`/api/leads?${p}`);
    setLeads((await res.json()).leads);
    setSelected(new Set());
    setLoading(false);
  }, [status, channel, minScore, hasEmail, q, sort, period, from, to]);
  useEffect(() => { load(); }, [load]);

  async function setLeadStatus(id: number, s: Status) {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: s } : l)));
  }
  async function saveNotes(id: number, notes: string) {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, notes } : l)));
  }
  async function remove(id: number) {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  // ── Selection / bulk ops ──
  function toggleSel(id: number) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const allSelected = leads.length > 0 && selected.size === leads.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }
  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length || !confirm(`Delete ${ids.length} selected lead${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBusy(true);
    await fetch("/api/leads/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    setLeads((ls) => ls.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
    setBusy(false);
  }
  async function bulkStatus(s: Status) {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    await Promise.all(ids.map((id) => fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) })));
    setLeads((ls) => ls.map((l) => (selected.has(l.id) ? { ...l, status: s } : l)));
    setSelected(new Set());
    setBusy(false);
  }

  const exportUrl = () => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (channel) p.set("channel", channel);
    if (minScore) p.set("minScore", minScore);
    if (hasEmail) p.set("hasEmail", "1");
    if (period && period !== "custom") p.set("period", period);
    if (period === "custom") { if (from) p.set("from", from); if (to) p.set("to", to); }
    return `/api/leads/export?${p}`;
  };

  function clearFilters() {
    setStatus(""); setChannel(""); setMinScore(""); setHasEmail(false); setQ(""); setPeriod(""); setFrom(""); setTo("");
  }
  const filtersActive = !!(status || channel || minScore || hasEmail || q || period);

  // ── Summary over loaded set ──
  const summary = useMemo(() => {
    const withEmail = leads.filter((l) => l.hasEmail).length;
    const hot = leads.filter((l) => l.score >= 70).length;
    const avg = leads.length ? Math.round(leads.reduce((a, l) => a + l.score, 0) / leads.length) : 0;
    return { total: leads.length, withEmail, hot, avg };
  }, [leads]);

  return (
    <main>
      <PageHeader
        title="Leads"
        subtitle="Businesses that need SEO — with a pitch and a way to reach them. Filter, select, and dig into every detail."
        actions={<a href={exportUrl()} className="btn-ghost">↓ Export CSV</a>}
      />

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Leads" value={summary.total} />
        <MiniStat label="Reachable" value={summary.withEmail} tone="emerald" sub={summary.total ? `${Math.round((summary.withEmail / summary.total) * 100)}% have email` : undefined} />
        <MiniStat label="Hot (70+)" value={summary.hot} tone="emerald" />
        <MiniStat label="Avg score" value={summary.avg} tone="amber" />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business or domain…" className="input w-60 pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input capitalize">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input">
          <option value="">All sources</option>
          {CHANNEL_ORDER.map((c) => <option key={c} value={c}>{CHANNEL_META[c]?.label ?? c}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input">
          {DATE_PRESETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Min score" type="number" className="input w-28" />
        <button onClick={() => setHasEmail((v) => !v)} className={`badge h-[42px] gap-1.5 px-3.5 ring-1 ring-inset transition ${hasEmail ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-stone-500 ring-[var(--color-line)] hover:bg-stone-50"}`}>✉ Has email</button>
        {filtersActive && <button onClick={clearFilters} className="text-xs font-medium text-stone-400 hover:text-rose-500">Clear</button>}
        <div className="ml-auto">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input">
            <option value="score">Sort: Lead score</option>
            <option value="opportunity">Sort: SEO opportunity</option>
            <option value="recent">Sort: Recently updated</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl bg-stone-50 px-3.5 py-2.5 ring-1 ring-inset ring-[var(--color-line)]">
          <span className="label">Found between</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          <span className="text-stone-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-white shadow-sm">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={toggleAll} className="text-xs text-white/70 hover:text-white">{allSelected ? "Deselect all" : "Select all"}</button>
          <div className="ml-auto flex items-center gap-2">
            <select disabled={busy} onChange={(e) => { if (e.target.value) bulkStatus(e.target.value as Status); e.target.value = ""; }} defaultValue="" className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white outline-none ring-1 ring-inset ring-white/20 [&>option]:text-ink">
              <option value="" disabled>Set status…</option>
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <button disabled={busy} onClick={bulkDelete} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50">Delete selected</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-white/70 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      {/* Select-all header */}
      {leads.length > 0 && (
        <label className="mb-2 ml-1 flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-stone-400 hover:text-stone-600">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500" />
          Select all {leads.length}
        </label>
      )}

      {/* List */}
      <div className="card divide-y divide-[var(--color-line)] overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-stone-400">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="px-6 py-16 text-center text-stone-400">No leads match. {filtersActive ? "Try clearing filters, or" : ""} run discovery from the Runs page.</div>
        ) : (
          leads.map((l) => {
            const open = expanded === l.id;
            const email = l.outreach?.emails[0];
            const phone = l.outreach?.phones[0];
            const sel = selected.has(l.id);
            return (
              <Fragment key={l.id}>
                <div className={`group flex items-center gap-3 px-3 py-3 transition-colors sm:px-4 ${open ? "bg-stone-50/80" : sel ? "bg-brand-50/40" : "hover:bg-stone-50/60"}`}>
                  <input type="checkbox" checked={sel} onChange={() => toggleSel(l.id)} className="h-4 w-4 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500" onClick={(e) => e.stopPropagation()} />
                  <button onClick={() => setExpanded(open ? null : l.id)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                    <Avatar domain={l.domain} name={l.name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{l.name}</span>
                        {l.issuesCount > 0 && <span className="hidden shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 sm:inline">{l.issuesCount} to fix</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[13px] text-stone-400">{l.domain}</span>
                        {l.channels?.map((ch) => <ChannelBadge key={ch} id={ch} size="xs" />)}
                        {l.createdAt && <span className="text-[11px] text-stone-300">· {fmtAgo(l.createdAt)}</span>}
                      </span>
                    </span>
                  </button>

                  <div className="hidden items-center gap-1 md:flex">
                    {email
                      ? <a href={`mailto:${email}`} title={email} className="icon-btn hover:bg-brand-50 hover:text-brand-600" onClick={(e) => e.stopPropagation()}>✉</a>
                      : <span className="inline-flex h-8 w-8 items-center justify-center text-stone-200">✉</span>}
                    {phone
                      ? <a href={`tel:${phone}`} title={phone} className="icon-btn" onClick={(e) => e.stopPropagation()}>☎</a>
                      : <span className="inline-flex h-8 w-8 items-center justify-center text-stone-200">☎</span>}
                    <a href={l.website} target="_blank" rel="noreferrer" title="Visit site" className="icon-btn" onClick={(e) => e.stopPropagation()}>↗</a>
                  </div>

                  <ScoreRing score={l.score} />

                  <select value={l.status} onChange={(e) => setLeadStatus(l.id, e.target.value as Status)} onClick={(e) => e.stopPropagation()} className={`hidden cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-medium capitalize ring-1 ring-inset outline-none sm:block ${statusTone(l.status)}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <button onClick={() => remove(l.id)} className="icon-btn opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500">✕</button>
                </div>

                {open && <LeadDetail lead={l} onSaveNotes={(n) => saveNotes(l.id, n)} />}
              </Fragment>
            );
          })
        )}
      </div>
    </main>
  );
}

function MiniStat({ label, value, sub, tone = "ink" }: { label: string; value: React.ReactNode; sub?: string; tone?: "ink" | "emerald" | "amber" }) {
  const t: Record<string, string> = { ink: "text-ink", emerald: "text-brand-600", amber: "text-amber-600" };
  return (
    <div className="card p-4">
      <span className="label">{label}</span>
      <div className={`mt-1.5 text-[26px] font-semibold leading-none tabular-nums ${t[tone]}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

// ── Deep lead detail ────────────────────────────────────────────────────────────
function LeadDetail({ lead, onSaveNotes }: { lead: Lead; onSaveNotes: (n: string) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const o = lead.outreach;
  const seo = lead.seo;

  return (
    <div className="grid gap-4 bg-stone-50/80 px-4 pb-5 pt-3 sm:px-5 lg:grid-cols-3">

      {/* Provenance — full width */}
      <div className="card p-4 lg:col-span-3">
        <h4 className="label mb-3">Where this lead came from</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Found via">
            <div className="flex flex-wrap gap-1.5">
              {lead.channels?.length ? lead.channels.map((ch) => <ChannelBadge key={ch} id={ch} />) : <span className="text-stone-400">unknown</span>}
            </div>
          </Meta>
          <Meta label="Search query">
            {lead.query ? <p className="rounded bg-stone-100 px-2.5 py-1.5 font-mono text-[12px] text-stone-700">{lead.query}</p> : <span className="text-stone-400">—</span>}
          </Meta>
          <Meta label="First found">
            <p className="text-[13px] text-stone-700">{fmtDate(lead.createdAt)}</p>
            <p className="text-[11px] text-stone-400">{fmtAgo(lead.createdAt)}</p>
          </Meta>
          <Meta label="Last updated">
            <p className="text-[13px] text-stone-700">{fmtDate(lead.updatedAt)}</p>
            <p className="text-[11px] text-stone-400">{fmtAgo(lead.updatedAt)}</p>
          </Meta>
        </div>

        {lead.description && (
          <div className="mt-4 border-t border-[var(--color-line)] pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Listing details</p>
            <p className="mt-1 text-[13px] text-stone-700">{lead.description}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-line)] pt-3 text-[11px] text-stone-400">
          <span>Lead #{lead.id}</span>
          {lead.runId != null && <span>· From run #{lead.runId}</span>}
          <span>· <a href={lead.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{lead.website} ↗</a></span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {lead.channels?.map((ch) => {
            const m = CHANNEL_META[ch];
            if (!m || !lead.query) return null;
            return (
              <a key={ch} href={m.url + encodeURIComponent(lead.query)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-brand-600 ring-1 ring-inset ring-brand-200 hover:bg-brand-50">
                {m.icon} Re-search {m.label} ↗
              </a>
            );
          })}
          <a href={`https://duckduckgo.com/?q=${encodeURIComponent(lead.name + " " + lead.domain)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-100">
            🔍 Look up business ↗
          </a>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="card p-4">
        <h4 className="label mb-3">Why this score</h4>
        <div className="mb-3 flex items-center gap-3">
          <ScoreRing score={lead.score} size={52} />
          <div className="text-[13px] text-stone-500">
            <p><span className="font-semibold text-ink">{lead.score}</span>/100 lead quality</p>
            <p className="text-[12px]">SEO opportunity {lead.opportunityScore}/100</p>
          </div>
        </div>
        {lead.scoreReasons?.length ? (
          <ul className="space-y-1.5">
            {lead.scoreReasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-stone-600"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{r}</li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-stone-400">No score breakdown.</p>}
      </div>

      {/* Full SEO audit */}
      <div className="card p-4">
        <h4 className="label mb-3">SEO audit</h4>
        {seo ? (
          <>
            <div className="space-y-1">
              <Check ok={!!seo.httpsOk} label="HTTPS" />
              <Check ok={!!seo.title} label={`Title${seo.titleLength ? ` (${seo.titleLength} chars)` : ""}`} />
              <Check ok={!!seo.description} label={`Meta description${seo.descriptionLength ? ` (${seo.descriptionLength})` : ""}`} />
              <Check ok={seo.hasH1} label="H1 heading" />
              <Check ok={!!seo.hasOgTitle} label="Open Graph title" />
              <Check ok={!!seo.hasOgImage} label="Open Graph image" />
              <Check ok={!!seo.hasFavicon} label="Favicon" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-line)] pt-2.5 text-[11px] text-stone-400">
              <span>{seo.wordCount} words</span>
              {seo.statusCode != null && <span>· HTTP {seo.statusCode}</span>}
            </div>
            {seo.issues.length > 0 && (
              <div className="mt-3 border-t border-[var(--color-line)] pt-2.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">Issues to pitch</p>
                <ul className="space-y-1.5">
                  {seo.issues.map((r, i) => <li key={i} className="flex gap-2 text-[12px] text-stone-700"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />{r}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : <p className="text-[13px] text-stone-400">Not audited yet — run discovery with enrichment on.</p>}
      </div>

      {/* Reach out */}
      <div className="card p-4">
        <h4 className="label mb-3">Reach out</h4>
        {o && (o.emails.length || o.phones.length || o.socials.length || o.people.length) ? (
          <div className="space-y-2 text-[13px]">
            {o.emails.map((e, i) => <a key={`e${i}`} href={`mailto:${e}`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">✉ {e}</a>)}
            {o.phones.map((p, i) => <a key={`p${i}`} href={`tel:${p}`} className="flex items-center gap-2 text-stone-700 hover:underline">☎ {p}</a>)}
            {o.people.length > 0 && <p className="pt-1 text-stone-500"><span className="text-stone-400">People · </span>{o.people.map((p) => p.role ? `${p.name} (${p.role})` : p.name).join(", ")}</p>}
            {o.socials.length > 0 && (
              <p className="flex flex-wrap gap-1.5 pt-1">
                {o.socials.map((s, i) => { let h = s; try { h = new URL(s).hostname.replace(/^www\.|\.com$/g, ""); } catch {} return <a key={`s${i}`} href={s} target="_blank" rel="noreferrer" className="badge bg-stone-100 text-stone-600 hover:bg-stone-200">{h}</a>; })}
              </p>
            )}
            {o.contactUrl && <a href={o.contactUrl} target="_blank" rel="noreferrer" className="inline-block pt-1 text-xs font-medium text-brand-600 hover:text-brand-700">Contact page ↗</a>}
          </div>
        ) : <p className="text-[13px] text-stone-400">No contact channel found yet.</p>}
      </div>

      {/* Notes — full width */}
      <div className="card p-4 lg:col-span-3">
        <h4 className="label mb-2.5">Notes</h4>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onSaveNotes(notes)} rows={3} placeholder="Add a note (saves on blur)…" className="input w-full resize-none text-[13px]" />
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
      {children}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>{ok ? "✓" : "✕"}</span>
      <span className={ok ? "text-stone-600" : "text-stone-700"}>{label}</span>
    </div>
  );
}
