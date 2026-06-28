"use client";

import { useEffect, useState } from "react";

interface Opt { name: string; isoCode: string }

// Cascading Country → State → City picker. Emits a single location string
// (e.g. "Austin, Texas") suitable for search queries — "United States" is
// dropped to keep US queries concise.
export function LocationPicker({ onChange }: { onChange: (location: string) => void }) {
  const [countries, setCountries] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [country, setCountry] = useState(""); // isoCode
  const [state, setState] = useState("");     // isoCode
  const [city, setCity] = useState("");

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((d) => setCountries(d.countries ?? []));
  }, []);

  function compose(countryIso: string, stateIso: string, cityName: string): string {
    const cn = countries.find((c) => c.isoCode === countryIso)?.name ?? "";
    const sn = states.find((s) => s.isoCode === stateIso)?.name ?? "";
    const parts = [cityName.trim(), sn].filter(Boolean);
    if (cn && cn !== "United States") parts.push(cn);
    if (parts.length === 0) return cn; // country-only selection
    return parts.join(", ");
  }

  async function pickCountry(iso: string) {
    setCountry(iso); setState(""); setCity(""); setStates([]); setCities([]);
    onChange(iso ? compose(iso, "", "") : "");
    if (iso) {
      const d = await (await fetch(`/api/locations?country=${iso}`)).json();
      setStates(d.states ?? []);
    }
  }
  async function pickState(iso: string) {
    setState(iso); setCity(""); setCities([]);
    onChange(compose(country, iso, ""));
    if (iso) {
      const d = await (await fetch(`/api/locations?country=${country}&state=${iso}`)).json();
      setCities(d.cities ?? []);
    }
  }
  function pickCity(name: string) {
    setCity(name);
    onChange(compose(country, state, name));
  }

  return (
    <div>
      <span className="label mb-1.5 block">Location (optional)</span>
      <div className="flex flex-wrap gap-2">
        <select value={country} onChange={(e) => pickCountry(e.target.value)} className="input w-44">
          <option value="">Country…</option>
          {countries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
        </select>
        <select value={state} onChange={(e) => pickState(e.target.value)} disabled={!states.length} className="input w-44 disabled:opacity-50">
          <option value="">{states.length ? "State / region…" : "—"}</option>
          {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
        </select>
        <input
          list="loc-cities"
          value={city}
          onChange={(e) => pickCity(e.target.value)}
          disabled={!country}
          placeholder={country ? "City…" : "—"}
          className="input w-44 disabled:opacity-50"
        />
        <datalist id="loc-cities">
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </div>
  );
}
