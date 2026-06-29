import type { Lead, Outreach, SeoAudit, ChannelId } from "@/lib/types";
import { isMicrosite, looksLikeListicle, cleanNameFromDomain } from "@/lib/discovery/quality";
import {
  withStore, withStoreRead, nowUtc,
  type Search, type Run, type StoredLead, type LeadStatus, type Store,
  LEAD_STATUSES,
} from "@/lib/json-store";

export type { Search, Run, StoredLead, LeadStatus };
export { LEAD_STATUSES };

// ---- Searches ---------------------------------------------------------------

export async function listSearches(): Promise<Search[]> {
  return withStoreRead((s) => [...s.searches].sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function listActiveSearches(): Promise<Search[]> {
  return withStoreRead((s) => s.searches.filter((x) => x.active).sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function addSearch(input: {
  niche: string; location?: string | null; lim?: number;
  channels?: ChannelId[] | null; label?: string | null;
}): Promise<Search> {
  return withStore((s) => {
    const key = `${input.niche}\0${input.location ?? ""}`;
    const existing = s.searches.find((x) => `${x.niche}\0${x.location ?? ""}` === key);
    if (existing) {
      existing.lim = input.lim ?? 10;
      existing.channels = input.channels?.length ? input.channels : null;
      existing.label = input.label ?? null;
      existing.active = true;
      return existing;
    }
    const row: Search = {
      id: s.nextSearchId++,
      niche: input.niche,
      location: input.location ?? null,
      lim: input.lim ?? 10,
      channels: input.channels?.length ? input.channels : null,
      label: input.label ?? null,
      active: true,
      created_at: nowUtc(),
    };
    s.searches.push(row);
    return row;
  });
}

export async function setSearchActive(id: number, active: boolean): Promise<void> {
  await withStore((s) => {
    const row = s.searches.find((x) => x.id === id);
    if (row) row.active = active;
  });
}

export async function deleteSearch(id: number): Promise<void> {
  await withStore((s) => { s.searches = s.searches.filter((x) => x.id !== id); });
}

// ---- Runs -------------------------------------------------------------------

export async function createRun(searchCount: number, enrich: boolean): Promise<number> {
  return withStore((s) => {
    const id = s.nextRunId++;
    s.runs.unshift({
      id, started_at: nowUtc(), finished_at: null, status: "running",
      search_count: searchCount, lead_count: 0, enrich, error: null,
    });
    return id;
  });
}

export async function finishRun(id: number, leadCount: number, error?: string): Promise<void> {
  await withStore((s) => {
    const run = s.runs.find((r) => r.id === id);
    if (!run) return;
    run.finished_at = nowUtc();
    run.status = error ? "error" : "done";
    run.lead_count = leadCount;
    run.error = error ?? null;
  });
}

export async function listRuns(limit = 50): Promise<Run[]> {
  return withStoreRead((s) => s.runs.slice(0, limit));
}

// ---- Leads ------------------------------------------------------------------

function uniqStr(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b].map((x) => x.trim()).filter(Boolean))];
}

function mergeOutreach(prev: Outreach | null, next: Outreach | null): Outreach | null {
  if (!prev) return next;
  if (!next) return prev;
  const peopleByName = new Map<string, { name: string; role?: string }>();
  for (const p of [...prev.people, ...next.people]) if (p?.name) peopleByName.set(p.name, p);
  return {
    emails: uniqStr(prev.emails, next.emails),
    phones: uniqStr(prev.phones, next.phones),
    socials: uniqStr(prev.socials, next.socials),
    contactUrl: prev.contactUrl ?? next.contactUrl,
    people: [...peopleByName.values()],
  };
}

function upsertLeadInStore(s: Store, lead: Lead, runId: number): void {
  const existing = s.leads.find((l) => l.domain === lead.domain);
  const outreach = mergeOutreach(existing?.outreach ?? null, lead.outreach);
  const seo = lead.seo ?? existing?.seo ?? null;
  const score = Math.max(lead.score, existing?.score ?? 0);
  const reasons = score === lead.score ? lead.scoreReasons : (existing?.scoreReasons ?? lead.scoreReasons);
  const ts = nowUtc();

  if (existing) {
    existing.name = lead.name;
    existing.website = lead.website;
    existing.description = lead.description ?? existing.description;
    existing.query = lead.query;
    existing.channels = lead.channels ?? [];
    existing.outreach = outreach;
    existing.seo = seo;
    existing.score = score;
    existing.opportunityScore = seo?.opportunityScore ?? 0;
    existing.issuesCount = seo?.issues.length ?? 0;
    existing.hasEmail = !!outreach?.emails.length;
    existing.scoreReasons = reasons;
    existing.runId = runId;
    existing.updatedAt = ts;
    return;
  }

  s.leads.push({
    id: s.nextLeadId++,
    name: lead.name, domain: lead.domain, website: lead.website, description: lead.description,
    query: lead.query, channels: lead.channels ?? [], outreach, seo, score,
    opportunityScore: seo?.opportunityScore ?? 0,
    issuesCount: seo?.issues.length ?? 0,
    hasEmail: !!outreach?.emails.length,
    scoreReasons: reasons, status: "new", notes: null, runId,
    createdAt: ts, updatedAt: ts,
  });
}

export async function upsertLead(lead: Lead, runId: number): Promise<void> {
  await withStore((s) => upsertLeadInStore(s, lead, runId));
}

export async function saveRunResults(runId: number, leads: Lead[], leadCount: number, error?: string): Promise<void> {
  await withStore((s) => {
    for (const lead of leads) upsertLeadInStore(s, lead, runId);
    const run = s.runs.find((r) => r.id === runId);
    if (run) {
      run.finished_at = nowUtc();
      run.status = error ? "error" : "done";
      run.lead_count = leadCount;
      run.error = error ?? null;
    }
  });
}

export type DatePeriod = "today" | "yesterday" | "week" | "month" | "year";
export const DATE_PERIODS: DatePeriod[] = ["today", "yesterday", "week", "month", "year"];

export interface LeadFilter {
  status?: LeadStatus; minScore?: number; hasEmail?: boolean; q?: string;
  channel?: ChannelId; period?: DatePeriod;
  from?: string; to?: string;
  sort?: "score" | "opportunity" | "recent" | "name";
}

function inPeriod(iso: string, period: DatePeriod): boolean {
  const d = new Date(iso.replace(" ", "T") + "Z");
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  }
  if (period === "week") return now.getTime() - d.getTime() <= 7 * 864e5;
  if (period === "month") return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  return d.getUTCFullYear() === now.getUTCFullYear();
}

export async function listLeads(filter: LeadFilter = {}): Promise<StoredLead[]> {
  return withStoreRead((s) => {
    let rows = [...s.leads];
    if (filter.status) rows = rows.filter((l) => l.status === filter.status);
    if (filter.minScore != null) rows = rows.filter((l) => l.score >= filter.minScore!);
    if (filter.hasEmail) rows = rows.filter((l) => l.hasEmail);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter((l) => l.name.toLowerCase().includes(q) || l.domain.toLowerCase().includes(q));
    }
    if (filter.channel) rows = rows.filter((l) => l.channels.includes(filter.channel!));
    if (filter.period) rows = rows.filter((l) => inPeriod(l.createdAt, filter.period!));
    if (filter.from) rows = rows.filter((l) => l.createdAt.slice(0, 10) >= filter.from!);
    if (filter.to) rows = rows.filter((l) => l.createdAt.slice(0, 10) <= filter.to!);

    const sort = filter.sort ?? "score";
    rows.sort((a, b) => {
      if (sort === "opportunity") return b.opportunityScore - a.opportunityScore;
      if (sort === "recent") return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.score - a.score;
    });
    return rows;
  });
}

export async function listLeadDomains(): Promise<Set<string>> {
  return withStoreRead((s) => new Set(s.leads.map((l) => l.domain)));
}

export async function getLead(id: number): Promise<StoredLead | null> {
  return withStoreRead((s) => s.leads.find((l) => l.id === id) ?? null);
}

export async function updateLead(id: number, patch: { status?: LeadStatus; notes?: string }): Promise<void> {
  await withStore((s) => {
    const lead = s.leads.find((l) => l.id === id);
    if (!lead) return;
    if (patch.status) lead.status = patch.status;
    if (patch.notes !== undefined) lead.notes = patch.notes;
    lead.updatedAt = nowUtc();
  });
}

export async function deleteLead(id: number): Promise<void> {
  await withStore((s) => { s.leads = s.leads.filter((l) => l.id !== id); });
}

export async function deleteLeads(ids: number[]): Promise<number> {
  return withStore((s) => {
    const set = new Set(ids.map(Number).filter(Number.isInteger));
    const before = s.leads.length;
    s.leads = s.leads.filter((l) => !set.has(l.id));
    return before - s.leads.length;
  });
}

export async function cleanupLeads(): Promise<{ deleted: { name: string; domain: string }[]; renamed: { from: string; to: string }[] }> {
  return withStore((s) => {
    const deleted: { name: string; domain: string }[] = [];
    const renamed: { from: string; to: string }[] = [];
    const isGlued = (x: string) => !/\s/.test(x) && x.length > 9 && /^[a-z]+$/i.test(x);
    const keep: StoredLead[] = [];
    for (const r of s.leads) {
      if (isMicrosite(r.domain)) { deleted.push({ name: r.name, domain: r.domain }); continue; }
      let clean: string | null = null;
      if (looksLikeListicle(r.name)) clean = cleanNameFromDomain(r.domain);
      else if (isGlued(r.name)) clean = cleanNameFromDomain(r.name.toLowerCase());
      if (clean && clean.toLowerCase() !== r.name.toLowerCase() && (clean.includes(" ") || looksLikeListicle(r.name))) {
        renamed.push({ from: r.name, to: clean });
        r.name = clean;
        r.updatedAt = nowUtc();
      }
      keep.push(r);
    }
    s.leads = keep;
    return { deleted, renamed };
  });
}

export interface Stats {
  totalLeads: number; byStatus: Record<string, number>; avgScore: number;
  hotLeads: number; withEmail: number; activeSearches: number; totalRuns: number; lastRunAt: string | null;
}

export async function getStats(): Promise<Stats> {
  return withStoreRead((s) => {
    const byStatus: Record<string, number> = {};
    for (const l of s.leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    const totalLeads = s.leads.length;
    const avgScore = totalLeads ? Math.round(s.leads.reduce((n, l) => n + l.score, 0) / totalLeads) : 0;
    return {
      totalLeads, byStatus, avgScore,
      hotLeads: s.leads.filter((l) => l.score >= 70).length,
      withEmail: s.leads.filter((l) => l.hasEmail).length,
      activeSearches: s.searches.filter((x) => x.active).length,
      totalRuns: s.runs.length,
      lastRunAt: s.runs[0]?.started_at ?? null,
    };
  });
}
