"use client";

import { useState } from "react";

// Business avatar: a colored-initial tile (always present) with the real favicon
// layered on top when available — so it feels alive but never renders empty.

const TONES = [
  "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700", "bg-fuchsia-100 text-fuchsia-700",
];

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ domain, name, size = 38 }: { domain: string; name: string; size?: number }) {
  const [showFavicon, setShowFavicon] = useState(true);
  const initial = (name || domain).trim().charAt(0).toUpperCase() || "•";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold ${toneFor(domain)}`}
      style={{ width: size, height: size }}
    >
      <span aria-hidden>{initial}</span>
      {showFavicon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          alt=""
          onError={() => setShowFavicon(false)}
          className="absolute inset-0 m-auto h-1/2 w-1/2 object-contain"
        />
      )}
    </span>
  );
}
