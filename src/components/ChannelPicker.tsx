"use client";

import { useEffect, useState } from "react";

export interface ChannelMeta {
  id: string; label: string; reliability: "high" | "medium" | "low"; note: string;
}

const DOT: Record<string, string> = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-rose-400" };

/** Multi-select channel chooser. Empty selection = all channels. */
export function ChannelPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [channels, setChannels] = useState<ChannelMeta[]>([]);

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => setChannels(d.channels));
  }, []);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  const allOn = selected.length === 0;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-3">
        <span className="label">Channels</span>
        <button type="button" onClick={() => onChange([])} className={`text-xs font-medium ${allOn ? "text-brand-600" : "text-stone-400 hover:text-brand-600"}`}>All</button>
        <span className="text-stone-300">·</span>
        <button type="button" onClick={() => onChange(channels.map((c) => c.id))} className="text-xs font-medium text-stone-400 hover:text-brand-600">Select all</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => {
          const on = allOn || selected.includes(c.id);
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => toggle(c.id)}
              title={`${c.note} (reliability: ${c.reliability})`}
              className={`badge ring-1 ring-inset transition ${on ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-stone-500 ring-[var(--color-line)] hover:bg-stone-50"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${DOT[c.reliability]}`} />
              {c.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        <span className="text-emerald-500">●</span> reliable&nbsp;
        <span className="text-amber-500">●</span> medium&nbsp;
        <span className="text-rose-400">●</span> often blocked · empty = all
      </p>
    </div>
  );
}
