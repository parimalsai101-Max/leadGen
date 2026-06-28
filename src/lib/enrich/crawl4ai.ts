import type { Outreach } from "@/lib/types";
import { auditSeo } from "@/lib/seo";
import { crawlUrl } from "@/lib/crawl";

const SOCIAL_DOMAINS = [
  "linkedin.com", "instagram.com", "facebook.com",
  "twitter.com", "x.com", "youtube.com", "tiktok.com",
];

const EMAIL_RE = /[\w.+'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function extractEmails(text: string): string[] {
  return dedupe(text.match(EMAIL_RE) ?? []);
}

function extractPhones(text: string): string[] {
  const raw = text.match(PHONE_RE) ?? [];
  return dedupe(raw.filter((p) => p.replace(/\D/g, "").length >= 10));
}

function extractSocials(links: string[]): string[] {
  return dedupe(links.filter((l) => SOCIAL_DOMAINS.some((d) => l.includes(d))));
}

function brandName(meta: Record<string, unknown>): string | null {
  const site = typeof meta.ogTitle === "string" ? meta.ogTitle.trim() : "";
  if (site && site.length >= 2 && site.length <= 60) return site;
  const title = typeof meta.title === "string" ? meta.title : "";
  const head = title.split(/[|\-–—:·]/)[0].trim();
  if (head.length >= 2 && head.length <= 60 && !/\b(top \d+|best|near me|reviews?)\b/i.test(head)) return head;
  return null;
}

function emptyOutreach(): Outreach {
  return { emails: [], phones: [], socials: [], contactUrl: null, people: [] };
}

function contactUrl(website: string): string | null {
  try { return new URL("/contact", website).toString(); } catch { return null; }
}

export interface Enrichment {
  outreach: Outreach;
  seo: ReturnType<typeof auditSeo>;
  name: string | null;
}

/** Enrich a business website using crawl4ai — fully free, no API key needed. */
export async function enrichWithCrawl4ai(website: string): Promise<Enrichment | null> {
  const home = await crawlUrl(website);
  if (!home.success) {
    console.error(`crawl4ai failed for ${website}:`, home.error);
    return null;
  }

  const seo = auditSeo(
    { markdown: home.markdown, metadata: home.metadata },
    website,
  );

  const outreach = emptyOutreach();
  const text = home.markdown ?? "";
  const extLinks = home.links?.external ?? [];

  outreach.emails = extractEmails(text);
  outreach.phones = extractPhones(text);
  outreach.socials = extractSocials(extLinks);

  if (outreach.emails.length === 0) {
    const cu = contactUrl(website);
    if (cu) {
      const contact = await crawlUrl(cu);
      if (contact.success) {
        const ct = contact.markdown ?? "";
        outreach.emails = extractEmails(ct);
        outreach.phones = dedupe([...outreach.phones, ...extractPhones(ct)]);
        outreach.socials = dedupe([...outreach.socials, ...extractSocials(contact.links?.external ?? [])]);
        if (outreach.emails.length || outreach.phones.length) outreach.contactUrl = cu;
      }
    }
  }

  return { outreach, seo, name: brandName(home.metadata ?? {}) };
}
