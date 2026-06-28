"use client";

import { useEffect, useState } from "react";
import { ChannelPicker } from "@/components/ChannelPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { PageHeader } from "@/components/ui";

interface Search {
  id: number; niche: string; location: string | null; lim: number;
  channels: string[] | null; label: string | null; active: boolean; created_at: string;
}

export default function SearchesPage() {
  const [searches, setSearches] = useState<Search[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ niche: "", location: "", lim: "10", label: "" });
  const [channels, setChannels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locKey, setLocKey] = useState(0); // remount LocationPicker to reset after add

  async function load() {
    setLoading(true);
    setSearches((await (await fetch("/api/searches")).json()).searches);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.niche.trim()) { setError("Niche is required"); return; }
    setSaving(true);
    const res = await fetch("/api/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, lim: Number(form.lim), channels }) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setForm({ niche: "", location: "", lim: "10", label: "" }); setChannels([]); setLocKey((k) => k + 1); load();
  }
  async function toggle(s: Search) {
    await fetch(`/api/searches/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
    load();
  }
  async function remove(id: number) {
    await fetch(`/api/searches/${id}`, { method: "DELETE" }); load();
  }

  return (
    <main>
      <PageHeader title="Searches" subtitle="Define the businesses you want to find — a niche + location. Each run searches your selected channels, keeps real business sites, and audits their SEO + contacts." />

      <form onSubmit={add} className="card mb-6 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Niche / business type" w="w-56">
            <input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="dentist, plumber, law firm…" className="input w-full" />
          </Field>
          <Field label="Max leads" w="w-24">
            <input value={form.lim} onChange={(e) => setForm({ ...form, lim: e.target.value })} type="number" min={1} max={50} className="input w-full" />
          </Field>
          <button disabled={saving} className="btn-primary">{saving ? "Adding…" : "Add search"}</button>
        </div>
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <LocationPicker key={locKey} onChange={(loc) => setForm((f) => ({ ...f, location: loc }))} />
        </div>
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <ChannelPicker selected={channels} onChange={setChannels} />
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs font-medium uppercase tracking-wide text-stone-400">
              <th className="px-5 py-3.5">Niche</th>
              <th className="px-3 py-3.5">Location</th>
              <th className="px-3 py-3.5">Max</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="px-3 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-stone-400">Loading…</td></tr>
            ) : searches.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-stone-400">No searches yet — add one above.</td></tr>
            ) : (
              searches.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-stone-50/60">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-900">{s.label ?? s.niche}</div>
                    <div className="text-xs text-stone-400">{s.channels?.length ? s.channels.join(", ") : "all channels"}</div>
                  </td>
                  <td className="px-3 py-3.5 text-stone-500">{s.location ?? "—"}</td>
                  <td className="px-3 py-3.5 tabular-nums text-stone-600">{s.lim}</td>
                  <td className="px-3 py-3.5">
                    <button onClick={() => toggle(s)} className={`badge ring-1 ring-inset ${s.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-stone-100 text-stone-500 ring-stone-200"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.active ? "bg-emerald-500" : "bg-stone-400"}`} />
                      {s.active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <button onClick={() => remove(s.id)} className="rounded-lg px-2 py-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-500">Delete</button>
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

function Field({ label, w, children }: { label: string; w: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${w}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
