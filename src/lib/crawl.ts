import { search, SafeSearchType } from "duck-duck-scrape";

// Web search + page fetch for Vercel/serverless (no Python subprocess).

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

export async function searchWeb(query: string, limit = 20): Promise<SearchResult[]> {
  try {
    const { results, noResults } = await search(query, { safeSearch: SafeSearchType.OFF });
    if (noResults || !results?.length) return [];
    return results.slice(0, limit).map((r) => ({
      url: r.url,
      title: r.title,
      description: r.description ?? r.rawDescription ?? "",
    }));
  } catch (e) {
    console.error("[searchWeb]", query, (e as Error).message);
    return [];
  }
}
