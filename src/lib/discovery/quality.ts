// Lead-quality helpers: keep leads REAL (the business's own site + a clean brand
// name), drop fluff (booking microsites, directory-hosted pages, listicle titles).

// Third-party booking / microsite / page-builder hosts that are NOT a business's
// own website (so we can't audit/pitch their SEO). Page-builders where the site
// IS the business (wix, squarespace custom domains) are intentionally NOT here.
const MICROSITE_HOSTS = [
  "localsearch.com", "squareup.com", "square.site", "booksy.com", "vagaro.com",
  "schedulicity.com", "setmore.com", "simplybook.me", "fresha.com", "styleseat.com",
  "getsweepow.com", "site123.me", "godaddysites.com", "business.site", "linktr.ee",
  "beacons.ai", "carrd.co", "framer.website", "webflow.io", "myshopify.com",
  "tinyblogging.com", "blogspot.com", "wordpress.com", "wixsite.com", "weebly.com",
  "tumblr.com", "medium.com", "substack.com", "notion.site", "sites.google.com",
];

export function isMicrosite(host: string): boolean {
  return MICROSITE_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

// Titles that are SEO/listicle pages, not a clean brand name.
const LISTICLE = /\b(top\s*\d+|best|cheap|affordable|near me|reviews?|services?\s+in|companies?\s+in|\d+\s+best)\b/i;
const HAS_CITY_STATE = /,\s*[A-Z]{2}\b/; // "…, TX"

export function looksLikeListicle(title: string): boolean {
  return LISTICLE.test(title) || HAS_CITY_STATE.test(title);
}

const KNOWN_WORDS = [
  "air", "conditioning", "heating", "cooling", "plumbing", "plumber", "roofing", "roofer",
  "electric", "electrical", "dental", "dentist", "medical", "med", "spa", "salon", "law",
  "legal", "home", "services", "service", "repair", "solar", "landscaping", "landscape",
  "cleaning", "pest", "control", "auto", "care", "health", "wellness", "beauty", "aesthetics",
  "group", "clinic", "center", "studio", "company", "co", "and", "the", "pro", "experts",
  // beauty / med-spa / general business vocabulary
  "natural", "radiance", "skin", "treatment", "treatments", "laser", "cosmetic", "aesthetic",
  "family", "smile", "body", "new", "look", "lab", "glow", "youth", "rejuvenation", "skincare",
  "premier", "elite", "advanced", "modern", "luxe", "luxury", "vibe", "vitality", "renew",
  "comfort", "quality", "reliable", "trusted", "first", "best", "top", "metro", "city",
  "north", "south", "east", "west", "valley", "bay", "coast", "park", "ridge", "creek",
  "hvac", "ac", "tech", "solutions", "supply", "works", "shop", "store", "boutique", "med spa",
];

/** Turn a bare domain into a readable brand name, splitting glued words when possible. */
export function cleanNameFromDomain(host: string): string {
  let base = host.split(".")[0].replace(/[-_]/g, " ");
  // Greedily split glued lowercase words using a small known-word dictionary.
  if (!base.includes(" ") && base.length > 6) {
    const sorted = [...KNOWN_WORDS].sort((a, b) => b.length - a.length);
    let s = base.toLowerCase(), out = "", guard = 0;
    while (s.length && guard++ < 12) {
      const w = sorted.find((k) => s.startsWith(k) && k.length >= 3);
      if (w) { out += (out ? " " : "") + w; s = s.slice(w.length); }
      else { out += (out ? "" : "") + s[0]; s = s.slice(1); }
    }
    if (out.split(" ").filter((p) => p.length >= 3).length >= 2) base = out;
  }
  return base.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

const GENERIC = /^(home|homepage|welcome|index|loading|untitled|main|menu)\b/i;

/** Best business name: a clean title brand segment, else a cleaned domain. */
export function pickName(title: string | undefined, host: string): string {
  if (title) {
    const head = title.split(/[|\-–—:·]/)[0].trim();
    if (head.length >= 2 && !GENERIC.test(head) && !looksLikeListicle(head)) return head;
  }
  return cleanNameFromDomain(host);
}
