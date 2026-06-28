import type { SearchSpec, BusinessCandidate } from "@/lib/types";
import { searchWeb } from "@/lib/crawl";
import { isMicrosite, pickName } from "@/lib/discovery/quality";

// Business discovery via DuckDuckGo web search — free, no API key needed.
// Multiple query angles per niche surface many unique business websites,
// deduped by domain with aggregators and microsites filtered out.

const AGGREGATORS = new Set([
  "yelp.com", "zocdoc.com", "yellowpages.com", "yellowpages.ca", "bbb.org",
  "tripadvisor.com", "healthgrades.com", "vitals.com", "angi.com", "angieslist.com",
  "thumbtack.com", "houzz.com", "clutch.co", "g2.com", "capterra.com", "trustpilot.com",
  "glassdoor.com", "indeed.com", "facebook.com", "instagram.com", "linkedin.com",
  "twitter.com", "x.com", "tiktok.com", "youtube.com", "pinterest.com", "reddit.com",
  "wikipedia.org", "amazon.com", "ebay.com", "google.com", "maps.google.com",
  "mapquest.com", "foursquare.com", "nextdoor.com", "crunchbase.com", "manta.com",
  "expertise.com", "birdeye.com", "cylex.us.com", "chamberofcommerce.com",
  "superpages.com", "local.com", "citysearch.com", "deltadental.com", "opencare.com",
  "porch.com", "buildzoom.com", "yellowbook.com", "merchantcircle.com", "brownbook.net",
  "forbes.com", "homeguide.com", "homeadvisor.com", "fixr.com", "networx.com",
  "bark.com", "threebestrated.com", "consumeraffairs.com", "nerdwallet.com",
  "businessinsider.com", "usatoday.com", "nytimes.com", "quora.com", "bestprosintown.com",
  "thumbtack.co", "trustedpros.com", "wikihow.com", "apple.com",
  "craigslist.org", "procore.com", "homestars.com", "checkatrade.com",
  "bing.com", "goodfirms.co", "themanifest.com", "sortlist.com", "semrush.com",
  "clutchco.com", "expertise.com", "designrush.com", "upcity.com",
]);

export function hostFromUrl(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}
export function isAggregator(host: string): boolean {
  return [...AGGREGATORS].some((d) => host === d || host.endsWith(`.${d}`) || host.startsWith(`${d}.`));
}

const GENERIC_TITLES = /^(home|homepage|welcome|index|loading|untitled|main)\b/i;

function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deriveName(title: string | undefined, host: string): string {
  if (title) {
    const head = title.split(/[|\-–—:·]/)[0].trim();
    if (head.length >= 2 && !GENERIC_TITLES.test(head)) return head;
  }
  return titleCase(host.split(".")[0]);
}

function queryVariants(spec: SearchSpec): string[] {
  const n = spec.niche.trim();
  const loc = spec.location?.trim();
  if (loc) {
    return [
      `${n} in ${loc}`,
      `best ${n} in ${loc}`,
      `top ${n} ${loc}`,
      `${n} near ${loc}`,
      `${n} company ${loc}`,
      `affordable ${n} ${loc}`,
      `${n} services ${loc}`,
      `local ${n} ${loc}`,
      `${n} ${loc} reviews`,
      `cheap ${n} ${loc}`,
      `24 hour ${n} ${loc}`,
      `emergency ${n} ${loc}`,
      `${n} contractors ${loc}`,
      `small ${n} ${loc}`,
      `${n} specialists ${loc}`,
    ];
  }
  return [
    n, `best ${n}`, `top ${n} companies`, `${n} services`, `${n} agency`,
    `affordable ${n}`, `${n} for small business`, `boutique ${n}`,
  ];
}

export async function discoverBusinesses(
  spec: SearchSpec,
  exclude: Set<string> = new Set(),
): Promise<BusinessCandidate[]> {
  const target = spec.limit ?? 10;
  const variants = queryVariants(spec);
  const angles = Math.min(variants.length, Math.max(5, Math.ceil(target / 2)));
  const perQuery = 20;

  const searches = await Promise.allSettled(
    variants.slice(0, angles).map((q) =>
      searchWeb(q, perQuery).then((web) => ({ q, web })),
    ),
  );

  const seen = new Set<string>();
  const candidates: BusinessCandidate[] = [];

  for (const s of searches) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value.web) {
      if (!r.url) continue;
      const host = hostFromUrl(r.url);
      if (!host || isAggregator(host) || isMicrosite(host) || seen.has(host) || exclude.has(host)) continue;
      seen.add(host);
      candidates.push({
        name: pickName(r.title, host),
        website: `https://${host}`,
        domain: host,
        description: r.description ?? null,
        query: s.value.q,
        channel: "web",
      });
    }
  }

  return candidates.slice(0, target);
}
