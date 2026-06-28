"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

interface Run {
  id: number; started_at: string; finished_at: string | null;
  status: "running" | "done" | "error"; search_count: number; lead_count: number;
  enrich: boolean; error: string | null;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setRuns((await (await fetch("/api/runs")).json()).runs);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function trigger() {
    setRunning(true); setMsg(null);
    const res = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrich: true }) });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) { setMsg({ kind: "error", text: data.error }); load(); return; }
    setMsg({ kind: "ok", text: `Run #${data.runId}: ${data.leadCount} leads from ${data.searchCount} search(es)${data.errors?.length ? ` · ${data.errors.length} error(s)` : ""}` });
    load();
  }

  return (
    <main>
      <PageHeader title="Runs" subtitle="Run discovery across all active searches. Each business is found, its SEO audited, and contacts extracted. Leads dedupe by domain and only ever improve on re-runs." />

      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-100/50 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Run discovery</h2>
            <p className="mt-1 text-sm text-stone-500">Searches DuckDuckGo + scrapes each business with crawl4ai — fully free, no API key needed.</p>
          </div>
          <button onClick={trigger} disabled={running} className="btn-primary">
            {running ? (<><Spinner /> Running…</>) : "▶ Run discovery now"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msg.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {msg.kind === "error" ? "⚠ " : "✓ "}{msg.text}
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="px-5 py-3.5">Run</th>
              <th className="px-3 py-3.5">Started</th>
              <th className="px-3 py-3.5">Searches</th>
              <th className="px-3 py-3.5">Leads</th>
              <th className="px-3 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-stone-400">Loading…</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-stone-400">No runs yet.</td></tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-stone-50/60">
                  <td className="px-5 py-3.5 font-medium text-stone-900">#{r.id}</td>
                  <td className="px-3 py-3.5 text-stone-500">{r.started_at} UTC</td>
                  <td className="px-3 py-3.5 tabular-nums text-stone-600">{r.search_count}</td>
                  <td className="px-3 py-3.5 tabular-nums text-stone-600">{r.lead_count}</td>
                  <td className="px-3 py-3.5">
                    <span className={`badge ring-1 ring-inset ${
                      r.status === "done" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : r.status === "error" ? "bg-rose-50 text-rose-600 ring-rose-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"}`}>{r.status}</span>
                    {r.error && <span className="ml-2 text-xs text-rose-500">{r.error}</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Spinner() {
  return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}
