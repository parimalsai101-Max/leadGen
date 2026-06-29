import { search, SafeSearchType } from "duck-duck-scrape";

// Web search + page fetch for Vercel/serverless (no Python subprocess).
// DuckDuckGo scrape is blocked from datacenter IPs (Vercel) — set SERPER_API_KEY or
// FIRECRAWL_API_KEY so all non-Maps channels work in production.

export interface CrawlResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  markdown?: string;
  metadata?: Record<string, unknown>;
  links?: { internal: string[]; external: string[] };
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

const UA = "Mozilla/5.0 (compatible; LeadGenBot/1.0; +https://leadgen-drab-six.vercel.app)";

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']|` +
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim() || null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];
  const base = new URL(baseUrl);
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const href = u.toString();
      if (u.hostname === base.hostname) internal.push(href);
      else external.push(href);
    } catch { /* skip bad URLs */ }
  }
  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const html = await res.text();
    const finalUrl = res.url || url;
    const title = extractTitle(html);
    const metadata: Record<string, unknown> = {
      url: finalUrl,
      statusCode: res.status,
      title,
      description: metaContent(html, "description"),
      ogTitle: metaContent(html, "og:title"),
      ogDescription: metaContent(html, "og:description"),
      ogImage: metaContent(html, "og:image"),
      favicon: metaContent(html, "icon") ?? metaContent(html, "shortcut icon"),
    };
    return {
      success: res.ok,
      statusCode: res.status,
      markdown: htmlToText(html),
      metadata,
      links: extractLinks(html, finalUrl),
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function searchWithFirecrawl(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: Math.min(limit, 100) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    success?: boolean;
    data?: { web?: { url: string; title?: string; description?: string }[] };
  };
  return (payload.data?.web ?? []).slice(0, limit).map((r) => ({
    url: r.url,
    title: r.title ?? "",
    description: r.description ?? "",
  }));
}

async function searchWithSerper(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: Math.min(limit, 100) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { organic?: { link: string; title: string; snippet?: string }[] };
  return (data.organic ?? []).slice(0, limit).map((r) => ({
    url: r.link,
    title: r.title,
    description: r.snippet ?? "",
  }));
}

async function searchWithDdg(query: string, limit: number): Promise<SearchResult[]> {
  const { results, noResults } = await search(query, { safeSearch: SafeSearchType.OFF });
  if (noResults || !results?.length) return [];
  return results.slice(0, limit).map((r) => ({
    url: r.url,
    title: r.title,
    description: r.description ?? r.rawDescription ?? "",
  }));
}

let warnedMissingSearchApi = false;

export async function searchWeb(query: string, limit = 20): Promise<SearchResult[]> {
  if (process.env.SERPER_API_KEY) {
    try {
      const results = await searchWithSerper(query, limit);
      if (results.length) return results;
      console.warn("[searchWeb] Serper returned no results:", query);
    } catch (e) {
      console.error("[searchWeb] Serper failed:", query, (e as Error).message);
    }
  }

  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const results = await searchWithFirecrawl(query, limit);
      if (results.length) return results;
      console.warn("[searchWeb] Firecrawl returned no results:", query);
    } catch (e) {
      console.error("[searchWeb] Firecrawl failed:", query, (e as Error).message);
    }
  } else if (process.env.VERCEL && !warnedMissingSearchApi) {
    warnedMissingSearchApi = true;
    console.warn(
      "[searchWeb] No SERPER_API_KEY or FIRECRAWL_API_KEY on Vercel — DuckDuckGo is usually blocked; only Google Maps will return leads.",
    );
  }

  try {
    return await searchWithDdg(query, limit);
  } catch (e) {
    console.error("[searchWeb] DDG failed:", query, (e as Error).message);
    return [];
  }
}
