import type { ChannelId, SearchSpec, BusinessCandidate } from "@/lib/types";
import { hostFromUrl, isAggregator, deriveName } from "@/lib/discovery/businessSearch";
import { isMicrosite } from "@/lib/discovery/quality";
import { discoverFromGoogleMaps } from "@/lib/discovery/googleMaps";
import { searchWeb, crawlUrl } from "@/lib/crawl";

// Per-channel strategies — DuckDuckGo-based (no scraping of bot-protected pages),
// except googlemaps which uses the official Places API:
//
// yellowpages : DDG site: search → scrape category pages → external "Visit Website" links
// clutch/g2/crunchbase/linkedin: DDG site: search → extract name from profile title → resolve
//   website (with domain-name matching to reject mis-resolved websites). LinkedIn is read
//   only via DDG result titles — the site itself is never hit, so it dodges the bot-block.
// quora : intent query DDG search (no site: restriction) — surfaces recommended businesses
//   directly in results, which differ from the web channel's direct queries
// googlemaps : official Google Places API (Text Search) — name + website + phone + address

export type ChannelKind = "listing" | "profile" | "intent" | "places";

export interface ChannelDef {
  id: ChannelId;
  label: string;
  domains: string[];
  kind: ChannelKind;
  reliability: "high" | "medium" | "low";
  note: string;
}

export const CHANNELS: ChannelDef[] = [
  { id: "web",         label: "Web",         domains: [],                  kind: "listing",  reliability: "high", note: "DuckDuckGo open web search." },
  { id: "yellowpages", label: "Yellow Pages", domains: ["yellowpages.com"], kind: "listing",  reliability: "high", note: "Local business directory — great for service businesses." },
  { id: "quora",       label: "Quora",        domains: ["quora.com"],       kind: "intent",   reliability: "high", note: "Intent queries surface recommended businesses not in direct search." },
  { id: "clutch",      label: "Clutch",       domains: ["clutch.co"],       kind: "profile",  reliability: "high", note: "B2B agency directory with verified reviews." },
  { id: "g2",          label: "G2",           domains: ["g2.com"],          kind: "profile",  reliability: "high", note: "B2B software & services profiles." },
  { id: "crunchbase",  label: "Crunchbase",   domains: ["crunchbase.com"],  kind: "profile",  reliability: "high", note: "Company profiles — best for tech/startup niches." },
  { id: "googlemaps",  label: "Google Maps",  domains: ["google.com"],      kind: "places",   reliability: "high", note: "Official Places API — name, website, phone, address & rating. Needs GOOGLE_PLACES_API_KEY." },
  { id: "linkedin",    label: "LinkedIn",     domains: ["linkedin.com"],    kind: "profile",  reliability: "high", note: "Company pages via search titles (site never scraped); name-matched website resolution." },
];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id);
const BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

// ─── Name extraction from DDG profile-page titles ───────────────────────────

const TITLE_JUNK = [
  /\.?\s+Reviews?\s*\(?\d*\)?,?\s*(?:Pricing|Services?|Verified|Features|Details).*$/i,
  // LinkedIn: "Acme Corp - Overview | LinkedIn", "Acme Corp | LinkedIn"
  /\s*[-–|]\s*(?:LinkedIn|Overview|About\s*Us?|Jobs|People|Posts|Life|Company\s+Profile).*$/i,
  /\s*[-–|]\s*(?:Crunchbase Company Profile.*|Crunchbase).*$/i,
  /\s*[-–|]\s*(?:Services?\s*(?:&|and)\s*Company\s*Info\s*[-–|]?\s*)?(?:Clutch\.?co?\.?).*$/i,
  /\s*[-–|]\s*(?:Top\s+)?(?:Clutch|G2).*$/i,
  /\s+Reviews?\s*(?:\d{4}.*)?$/i,
  /\s*\|\s*.+$/,
  // Strip trailing description: " – Long description here"
  /\s*[-–]\s+.{15,}$/,
];

function extractCompanyName(title: string): string | null {
  let t = title;
  for (const re of TITLE_JUNK) t = t.replace(re, "");
  t = t.trim().replace(/\.$/, "").trim();
  if (GENERIC_NAME_WORDS.test(t)) return null;
  // Reject sentence-like strings (descriptions, not names)
  if (/\b(?:for|and|&)\b.{15,}/.test(t)) return null;
  return t.length >= 2 && t.length <= 70 ? t : null;
}

// ─── Domain validation: reject resolves where domain shares no words with name ─

const STOP_WORDS = new Set([
  "the", "and", "for", "inc", "llc", "ltd", "co", "of", "in", "at", "by", "with", "new",
  // Generic service/niche words that appear in many unrelated domains
  "plumber", "plumbing", "agency", "digital", "services", "solutions", "company",
  "group", "studio", "media", "marketing", "consulting", "online", "local",
]);

function domainMatchesName(host: string, name: string): boolean {
  const slug = host.replace(/^www\./, "").split(".")[0].toLowerCase();
  const words = name.toLowerCase().split(/[\s&+.,-]+/).filter((w) => w.length >= 5 && !STOP_WORDS.has(w));
  if (words.length > 0) return words.some((w) => slug.includes(w) || w.includes(slug));
  // No long distinctive words: require the slug to equal or START WITH one of the short name words.
  // Using startsWith (not includes) prevents "clay" from matching "leviclay".
  const shortWords = name.toLowerCase().split(/[\s&+.,-]+/).filter((w) => w.length >= 3);
  return shortWords.some((w) => slug === w || slug.startsWith(w));
}

// ─── Website resolution for profile channels ────────────────────────────────

async function resolveWebsite(name: string, excludeDomains: string[], location?: string): Promise<string | null> {
  // Fold location into the SEARCH for local relevance, but match the resolved
  // domain against the COMPANY NAME ONLY — otherwise a city name in the query
  // ("Austin") spuriously matches city-named domains (austinpetsalive.org).
  const loc = location ? ` ${location}` : "";
  for (const q of [`"${name}"${loc} official website`, `${name}${loc} website`]) {
    const results = await searchWeb(q, 5);
    for (const r of results) {
      const host = hostFromUrl(r.url);
      if (!host || isAggregator(host) || isMicrosite(host)) continue;
      if (excludeDomains.some((d) => host === d || host.endsWith(`.${d}`))) continue;
      // Only accept if the domain looks like it belongs to this company
      if (!domainMatchesName(host, name)) continue;
      return host;
    }
  }
  return null;
}

// ─── Profile channels (clutch, g2, crunchbase, linkedin) ────────────────────

// LinkedIn surfaces few company pages per query, so fan out across qualifier
// angles. All restricted to /company so titles are clean brand names.
function linkedinQueries(spec: SearchSpec): string[] {
  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  const site = "site:linkedin.com/company";
  if (loc) {
    return [
      `best ${n} ${loc} ${site}`,
      `top ${n} ${loc} ${site}`,
      `${n} agency ${loc} ${site}`,
      `${n} company ${loc} ${site}`,
      `${n} services ${loc} ${site}`,
      `${n} firm ${loc} ${site}`,
      `local ${n} ${loc} ${site}`,
      `${n} near ${loc} ${site}`,
    ];
  }
  return [
    `best ${n} ${site}`,
    `top ${n} companies ${site}`,
    `${n} agency ${site}`,
    `${n} company ${site}`,
    `${n} services ${site}`,
    `${n} firm ${site}`,
    `leading ${n} ${site}`,
  ];
}

async function discoverFromProfileChannel(
  channel: ChannelDef,
  spec: SearchSpec,
): Promise<BusinessCandidate[]> {
  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  // Channel-specific sub-path targeting gets more relevant result types
  const sitePart = channel.id === "crunchbase"
    ? `site:${channel.domains[0]}/organization`
    : channel.id === "g2"
    ? `site:${channel.domains[0]}/products`
    : channel.id === "clutch"
    ? `site:${channel.domains[0]}/profile`
    : channel.id === "linkedin"
    ? `site:${channel.domains[0]}/company`
    : `site:${channel.domains[0]}`;
  const query = loc ? `${n} ${loc} ${sitePart}` : `${n} ${sitePart}`;
  const label = loc ? `${n} in ${loc}` : n;

  // G2: run three queries in parallel — products, categories (bullet lists), and reviews (product name in title)
  const extraQuery = channel.id === "g2"
    ? Promise.all([
        searchWeb(`site:${channel.domains[0]}/categories ${n}`, 10),
        searchWeb(`site:${channel.domains[0]} ${n} reviews`, 10),
      ]).then(([a, b]) => [...a, ...b])
    : Promise.resolve([]);
  // Crunchbase: also search without sub-path for broader coverage
  const crunchFallback = channel.id === "crunchbase" ? searchWeb(`${n} site:${channel.domains[0]}`, 10) : Promise.resolve([]);
  // LinkedIn: a single query yields few company pages, so fan out across many
  // intent/qualifier angles to surface a much larger pool of company names.
  const linkedinExtra = channel.id === "linkedin"
    ? Promise.all(linkedinQueries(spec).map((q) => searchWeb(q, 15))).then((rs) => rs.flat())
    : Promise.resolve([]);
  const [searchResults, extraResults, crunchResults, linkedinResults] = await Promise.all([
    searchWeb(query, 15), extraQuery, crunchFallback, linkedinExtra,
  ]);
  const allResults = [...searchResults, ...extraResults, ...crunchResults, ...linkedinResults];

  // Extract names from profile-page titles; also extract from G2 category snippets
  const namesFromTitles: string[] = [];
  for (const r of allResults) {
    // Filter out subdomains (ai.g2.com, learn.g2.com) and non-content URLs
    const rHost = hostFromUrl(r.url);
    if (!rHost || (rHost !== channel.domains[0] && rHost !== `www.${channel.domains[0]}`)) continue;
    if (/\/(?:best-|compare|event_tracking|hub\/|lists?\/|discover\/)/i.test(r.url)) continue;
    const name = extractCompanyName(r.title);
    // Skip if the extracted name IS the platform/channel itself (e.g. "Crunchbase" from crunchbase.com)
    if (name && name.toLowerCase() !== channel.id && name.toLowerCase() !== channel.label.toLowerCase()) {
      namesFromTitles.push(name);
    }
  }

  // For G2 snippet extraction, restrict to main domain results (exclude subdomains like ai.g2.com)
  const mainDomainResults = allResults.filter((r) => {
    const h = hostFromUrl(r.url);
    return h && (h === channel.domains[0] || h === `www.${channel.domains[0]}`);
  });
  const namesFromSnippets = channel.id === "g2" ? extractNamesFromG2Snippets(mainDomainResults) : [];
  const allNames = [...new Set([...namesFromTitles, ...namesFromSnippets])];
  const toResolve: { name: string }[] = allNames.map((name) => ({ name }));

  // Resolve websites with bounded concurrency. Stop once we've hit the requested
  // count so a large name pool (LinkedIn) doesn't fire hundreds of resolutions.
  const target = spec.limit ?? 10;
  const out: BusinessCandidate[] = [];
  const domainsSeen = new Set<string>();
  const N = channel.id === "linkedin" ? 6 : 3;
  let i = 0;
  async function worker() {
    while (i < toResolve.length && out.length < target) {
      const { name } = toResolve[i++];
      const host = await resolveWebsite(name, channel.domains, loc);
      if (host && !domainsSeen.has(host)) {
        domainsSeen.add(host);
        out.push({
          name,
          website: `https://${host}`,
          domain: host,
          description: null,
          query: label,
          channel: channel.id,
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(N, toResolve.length) }, worker));
  return out;
}

// ─── Name extraction from DDG snippets (for YP + G2) ────────────────────────

const GENERIC_NAME_WORDS = /^(?:best|top|leading|most|the|a |an |my |our |your |this |that |which|what|how|who|when|where|why|search|tools?|platform|software|services?|solutions?|reviews?|seo tools|list |listed|page \d|\d)/i;

// YP descriptions: "City, ST ZIP. Business Name - Plumbers.Address."
// IMPORTANT: no "i" flag so [A-Z] only matches real uppercase → prevents "closed now." from leaking in.
function extractNamesFromYPSnippets(results: { description: string }[], niche: string): string[] {
  const names: string[] = [];
  for (const r of results) {
    const cleaned = r.description
      .replace(/\b[A-Z][\w\s]+,\s*[A-Z]{2}\s+\d{5}\b\.?\s*/g, "")  // "City, ST ZIP."
      .replace(/\b\d{3,5}\s+[A-Z][^.]*\.\s*/g, "")                   // "12345 Street."
      .replace(/\b(?:closed now|open now|open \d|temporarily closed)[.,]\s*/gi, ""); // status text

    // Use "gi" but validate first char is uppercase after extraction (prevents "closed now." etc.)
    const nicheKw = `(?:${niche}|plumb|hvac|electr|contrac|repair|service|lawn|clean|roofing|paint|heating|cooling)`;
    const nicheRe = new RegExp(`([A-Za-z][\\w\\s&'.]{2,50})\\s*[-–]\\s*${nicheKw}[\\w\\s]*[,.]`, "gi");
    const fromRe = /From Business:\s*([A-Za-z][\w\s&'.]{2,60}?)\s+(?:is |was |has |provides |offers )/gi;

    const isUpperStart = (s: string) => /^[A-Z]/.test(s);
    for (const m of cleaned.matchAll(nicheRe)) {
      const n = m[1].trim();
      if (isUpperStart(n) && !GENERIC_NAME_WORDS.test(n)) names.push(n);
    }
    for (const m of r.description.matchAll(fromRe)) {
      const n = m[1].trim();
      if (isUpperStart(n) && !GENERIC_NAME_WORDS.test(n)) names.push(n);
    }
  }
  return [...new Set(names.filter((n) => n.length >= 4 && n.length <= 60))];
}

// Generic G2 feature/category words that appear in bullets but are not product names
const G2_FEATURE_WORDS = /^(?:competitive|analytics?|tracking|reporting|management|analysis|tools?|platform|automation|monitoring|audit|research|intelligence|optimization|benchmarking|insights?|plagiarism|crawl(?:ing|er)?|checker|keyword|ranking|backlink|domain|content|traffic|enterprise|local|technical|link\s?build)\b/i;

// G2 descriptions: bullet lists "A · B · C" or "like A, B, and C"
function extractNamesFromG2Snippets(results: { description: string }[]): string[] {
  const names: string[] = [];
  for (const r of results) {
    const bullets = r.description.split(/\s*·\s*/).map((s) => s.replace(/\s*\([\d,]+\).*/, "").trim());
    for (const b of bullets) {
      if (b.length >= 3 && b.length <= 40 && /^[A-Z]/.test(b) && !GENERIC_NAME_WORDS.test(b) && !G2_FEATURE_WORDS.test(b)) names.push(b);
    }
    const likeRe = /(?:like|including|such as)\s+([A-Z][\w]+(?:,\s*(?:and\s+)?[A-Z][\w]+)*)/g;
    for (const m of r.description.matchAll(likeRe)) {
      for (const part of m[1].split(/,\s*(?:and\s+)?/)) {
        const clean = part.trim();
        if (clean.length >= 3 && clean.length <= 40 && /^[A-Z]/.test(clean) && !GENERIC_NAME_WORDS.test(clean)) names.push(clean);
      }
    }
  }
  return [...new Set(names)];
}

// ─── Listing channel (yellowpages) ──────────────────────────────────────────
// YP renders listings via JS so direct scraping yields no business links.
// Instead: extract business names from DDG snippet text, then resolve websites.

async function discoverFromListingChannel(
  channel: ChannelDef,
  spec: SearchSpec,
): Promise<BusinessCandidate[]> {
  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  const query = loc ? `${n} in ${loc} site:${channel.domains[0]}` : `${n} site:${channel.domains[0]}`;
  const label = loc ? `${n} in ${loc}` : n;

  const searchResults = await searchWeb(query, 8);
  if (searchResults.length === 0) return [];

  const names = extractNamesFromYPSnippets(searchResults, n);
  if (names.length === 0) return [];

  const toResolve = names.map((name) => ({ name }));
  const out: BusinessCandidate[] = [];
  const domainsSeen = new Set<string>();
  const N = 3;
  let i = 0;
  async function worker() {
    while (i < toResolve.length) {
      const { name } = toResolve[i++];
      const host = await resolveWebsite(name, channel.domains, loc);
      if (host && !domainsSeen.has(host)) {
        domainsSeen.add(host);
        out.push({ name, website: `https://${host}`, domain: host, description: null, query: label, channel: channel.id });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(N, toResolve.length) }, worker));
  return out;
}

// ─── Intent channel (quora) ─────────────────────────────────────────────────
// Uses recommendation-style queries without site: restriction. DDG surfaces
// businesses that appear in "best X" / "recommended X" contexts — a different
// cohort from the web channel's direct queries.

function buildIntentQueries(spec: SearchSpec): string[] {
  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  const where = loc ? ` in ${loc}` : "";
  return [
    `best ${n}${where} recommendation`,
    `who is the best ${n}${where}`,
    `recommended ${n}${where}`,
    `top rated ${n}${where}`,
  ];
}

async function discoverFromIntentChannel(
  _channel: ChannelDef,
  spec: SearchSpec,
): Promise<BusinessCandidate[]> {
  const queries = buildIntentQueries(spec);
  const label = spec.location ? `${spec.niche} in ${spec.location}` : spec.niche;

  const searches = await Promise.allSettled(queries.map((q) => searchWeb(q, 10)));
  const seen = new Set<string>();
  const candidates: BusinessCandidate[] = [];

  for (const s of searches) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      const host = hostFromUrl(r.url);
      if (!host || isAggregator(host) || isMicrosite(host) || seen.has(host)) continue;
      seen.add(host);
      candidates.push({
        name: deriveName(undefined, host), // article titles are unreliable; enrichment fixes the name
        website: `https://${host}`,
        domain: host,
        description: r.description ?? null,
        query: label,
        channel: "quora",
      });
    }
  }
  return candidates;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function discoverFromChannel(
  channelId: ChannelId,
  spec: SearchSpec,
): Promise<BusinessCandidate[]> {
  const channel = BY_ID.get(channelId);
  if (!channel || channel.id === "web") return [];

  switch (channel.kind) {
    case "profile": return discoverFromProfileChannel(channel, spec);
    case "listing": return discoverFromListingChannel(channel, spec);
    case "intent":  return discoverFromIntentChannel(channel, spec);
    case "places":  return discoverFromGoogleMaps(spec);
    default:        return [];
  }
}
