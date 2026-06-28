import type { SearchSpec, Lead } from "@/lib/types";
import { discover, type MergedCandidate } from "@/lib/discovery";
import { enrichWithCrawl4ai } from "@/lib/enrich/crawl4ai";
import { scoreLead } from "@/lib/score";

// Orchestrates: multi-channel discovery → per-business enrichment (contacts + SEO
// audit via crawl4ai) → score. Enrichment runs with bounded concurrency.

const CONCURRENCY = 5;

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

async function buildLead(c: MergedCandidate, enrich: boolean): Promise<Lead> {
  const enrichment = enrich ? await enrichWithCrawl4ai(c.website) : null;
  const seo = enrichment?.seo ?? null;
  let outreach = enrichment?.outreach ?? null;

  // A phone known at discovery time (e.g. from Google Places) is a real contact
  // channel — fold it in so it counts toward reachability even if the crawl missed it.
  if (c.phone) {
    const base = outreach ?? { emails: [], phones: [], socials: [], contactUrl: null, people: [] };
    if (!base.phones.some((p) => digits(p) === digits(c.phone!))) {
      outreach = { ...base, phones: [...base.phones, c.phone] };
    } else {
      outreach = base;
    }
  }

  const { score, reasons } = scoreLead({ seo, outreach });
  return {
    name: enrichment?.name || c.name, website: c.website, domain: c.domain,
    description: c.description, query: c.query, channels: c.channels,
    outreach, seo, score, scoreReasons: reasons,
  };
}

export interface DiscoverResult {
  candidates: number;
  perChannel: Record<string, number>;
  leads: Lead[];
}

export async function runSearch(
  spec: SearchSpec,
  enrich: boolean,
  knownDomains: Set<string> = new Set(),
): Promise<DiscoverResult> {
  const { candidates, perChannel } = await discover(spec, knownDomains);
  const leads = await mapPool(candidates, CONCURRENCY, (c) => buildLead(c, enrich));
  leads.sort((a, b) => b.score - a.score);
  return { candidates: candidates.length, perChannel, leads };
}
