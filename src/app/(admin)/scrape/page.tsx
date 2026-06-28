"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";

interface ScrapeResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogImage?: string;
    favicon?: string;
  };
  internalLinks?: number;
  externalLinks?: number;
  links?: { internal: string[]; external: string[] };
}

const SOCIAL_DOMAINS = ["linkedin.com", "instagram.com", "facebook.com", "twitter.com", "x.com", "youtube.com", "tiktok.com"];
const EMAIL_RE = /[\w.+'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

function extractEmails(text: string) { return [...new Set(text.match(EMAIL_RE) ?? [])]; }
function extractPhones(text: string) {
  return [...new Set((text.match(PHONE_RE) ?? []).filter((p) => p.replace(/\D/g, "").length >= 10))];
}
function extractSocials(links: string[]) {
  return [...new Set(links.filter((l) => SOCIAL_DOMAINS.some((d) => l.includes(d))))];
}

export default function ScrapePage() {
  const [url, setUrl] = useState("https://news.ycombinator.com");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult(await res.json());
      setElapsed(Date.now() - t0);
    } catch {
      setResult({ success: false, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const emails = result?.success ? extractEmails(result.markdown ?? "") : [];
  const phones = result?.success ? extractPhones(result.markdown ?? "") : [];
  const socials = result?.success ? extractSocials(result.links?.external ?? []) : [];

  return (
    <main>
      <PageHeader
        title="Web Scraper"
        subtitle="Crawl4AI — free, local scraping with SEO audit and contact extraction. No API key needed."
      />

      <form onSubmit={handleScrape} className="card p-5">
        <label className="label mb-2 block">URL to scrape</label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 rounded-xl border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm text-ink shadow-sm outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button type="submit" disabled={loading} className="btn-primary min-w-[110px] disabled:opacity-60">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Scraping…
              </span>
            ) : "Scrape"}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-5 space-y-4">
          {result.success ? (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Status" value={`HTTP ${result.statusCode}`} accent="emerald" />
                <Stat label="Internal links" value={String(result.internalLinks ?? 0)} />
                <Stat label="External links" value={String(result.externalLinks ?? 0)} />
                <Stat label="Time" value={elapsed ? `${(elapsed / 1000).toFixed(1)}s` : "—"} />
              </div>

              {/* Contacts */}
              {(emails.length > 0 || phones.length > 0 || socials.length > 0) && (
                <div className="card p-5">
                  <h2 className="mb-3 text-[15px] font-semibold text-ink">Contacts found</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ContactGroup label="Emails" items={emails} />
                    <ContactGroup label="Phones" items={phones} />
                    <ContactGroup label="Socials" items={socials} link />
                  </div>
                </div>
              )}

              {/* SEO signals */}
              <div className="card p-5">
                <h2 className="mb-3 text-[15px] font-semibold text-ink">SEO signals</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Signal label="Title" value={result.metadata?.title} />
                  <Signal label="Description" value={result.metadata?.description} />
                  <Signal label="OG Title" value={result.metadata?.ogTitle} />
                  <Signal label="OG Image" value={result.metadata?.ogImage ? "Present" : undefined} />
                  <Signal label="Favicon" value={result.metadata?.favicon ? "Present" : undefined} />
                  <Signal
                    label="H1"
                    value={/(^|\n)#\s+\S/.test(result.markdown ?? "") ? "Present" : undefined}
                  />
                </div>
              </div>

              {/* Markdown */}
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="label">Extracted Markdown</span>
                  <span className="text-xs text-stone-400">{result.markdown?.length.toLocaleString()} chars</span>
                </div>
                <pre className="max-h-[400px] overflow-auto rounded-lg bg-stone-50 p-4 text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
                  {result.markdown}
                </pre>
              </div>
            </>
          ) : (
            <div className="card border-rose-200 bg-rose-50 p-5">
              <p className="text-sm font-medium text-rose-700">Scrape failed</p>
              <p className="mt-1 text-xs text-rose-500">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" }) {
  return (
    <div className="card p-4">
      <span className="label">{label}</span>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${accent === "emerald" ? "text-brand-600" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function ContactGroup({ label, items, link }: { label: string; items: string[]; link?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="label">{label}</span>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm text-ink">
            {link ? (
              <a href={item} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate block max-w-full">
                {item.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            ) : item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string | undefined }) {
  const ok = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-brand-500" : "bg-rose-400"}`} />
      <div>
        <span className="font-medium text-ink">{label}</span>
        {ok && <span className="ml-1.5 text-stone-500 line-clamp-1">{value}</span>}
        {!ok && <span className="ml-1.5 text-rose-500">Missing</span>}
      </div>
    </div>
  );
}
