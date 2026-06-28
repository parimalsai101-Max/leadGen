"use client";

import { useState } from "react";
import { ChannelPicker } from "@/components/ChannelPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { PageHeader, ScoreRing } from "@/components/ui";

interface Outreach { emails: string[]; phones: string[]; socials: string[]; contactUrl: string | null; people: { name: string; role?: string }[] }
interface Seo { issues: string[]; opportunityScore: number }
interface Lead {
  name: string; website: string; domain: string; description: string | null;
  query: string; channels: string[]; outreach: Outreach | null; seo: Seo | null; score: number; scoreReasons: string[];
}

export default function DiscoverPage() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState("8");
  const [channels, setChannels] = useState<string[]>([]);
  const [enrich, setEnrich] = useState(true);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [perChannel, setPerChannel] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!niche.trim()) { setError("Enter a niche"); return; }
    setLoading(true); setError(null); setLeads(null); setPerChannel(null);
    try {
      const res = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche, location, limit: Number(limit), channels, enrich }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLeads(data.leads); setPerChannel(data.perChannel ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <main>
      <PageHeader title="Quick Discover" subtitle="Try a niche + city instantly — results aren't saved. To keep leads, add the search on Searches and run from Runs." />

      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Niche" w="w-44"><input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="dentist" className="input w-full" /></Field>
          <Field label="Count" w="w-20"><input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" min={1} max={25} className="input w-full" /></Field>
          <label className="flex h-[42px] items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-3 text-sm text-stone-600">
            <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} className="accent-brand-600" /> SEO audit + contacts
          </label>
          <button onClick={run} disabled={loading} className="btn-primary">{loading ? "Searching…" : "Discover"}</button>
        </div>
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <LocationPicker onChange={setLocation} />
        </div>
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <ChannelPicker selected={channels} onChange={setChannels} />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          ⚠ {error}
        </div>
      )}

      {perChannel && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(perChannel).map(([id, n]) => (
            <span key={id} className={`badge ring-1 ring-inset ${n > 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-stone-50 text-stone-400 ring-stone-200"}`}>{id}: {n}</span>
          ))}
        </div>
      )}

      {leads && (
        <section className="mt-5 space-y-3">
          {leads.length === 0 && <p className="text-sm text-stone-400">No businesses found. Try a broader niche or location.</p>}
          {leads.map((l) => (
            <div key={l.domain} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-stone-900">{l.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    <a href={l.website} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">{l.domain}</a>
                    {l.channels?.length > 0 && <span className="text-xs text-stone-400">via {l.channels.join(", ")}</span>}
                  </div>
                </div>
                <ScoreRing score={l.score} />
              </div>
              {l.seo?.issues?.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {l.seo.issues.map((i, idx) => <li key={idx} className="badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">{i}</li>)}
                </ul>
              ) : null}
              {l.outreach && (l.outreach.emails.length || l.outreach.phones.length) ? (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
                  {l.outreach.emails.length > 0 && <span className="font-medium text-emerald-700">✉ {l.outreach.emails.join(", ")}</span>}
                  {l.outreach.phones.length > 0 && <span>☎ {l.outreach.phones.join(", ")}</span>}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function Field({ label, w, children }: { label: string; w: string; children: React.ReactNode }) {
  return <label className={`flex flex-col gap-1.5 ${w}`}><span className="label">{label}</span>{children}</label>;
}
