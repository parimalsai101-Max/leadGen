import { withDb, withDbRead } from "@/lib/db";
import type Database from "better-sqlite3";
import type { Lead, Outreach, SeoAudit, ChannelId } from "@/lib/types";
import { isMicrosite, looksLikeListicle, cleanNameFromDomain } from "@/lib/discovery/quality";

export type LeadStatus = "new" | "qualified" | "contacted" | "won" | "lost" | "archived";
export const LEAD_STATUSES: LeadStatus[] = ["new", "qualified", "contacted", "won", "lost", "archived"];

// ---- Searches ---------------------------------------------------------------

export interface Search {
  id: number; niche: string; location: string | null; lim: number;
  channels: ChannelId[] | null; label: string | null; active: boolean; created_at: string;
}
interface SearchRow extends Omit<Search, "active" | "channels"> { active: number; channels: string | null }
const toSearch = (r: SearchRow): Search => ({
  ...r, active: !!r.active, channels: r.channels ? JSON.parse(r.channels) : null,
});

export async function listSearches(): Promise<Search[]> {
  return withDbRead((db) => (db.prepare("SELECT * FROM searches ORDER BY created_at DESC").all() as SearchRow[]).map(toSearch));
}
export async function listActiveSearches(): Promise<Search[]> {
  return withDbRead((db) => (db.prepare("SELECT * FROM searches WHERE active = 1 ORDER BY created_at DESC").all() as SearchRow[]).map(toSearch));
}
export async function addSearch(input: { niche: string; location?: string | null; lim?: number; channels?: ChannelId[] | null; label?: string | null }): Promise<Search> {
  return withDb((db) => {
  const row = db.prepare(
    `INSERT INTO searches (niche, location, lim, channels, label)
     VALUES (@niche, @location, @lim, @channels, @label)
     ON CONFLICT(niche, location) DO UPDATE SET
       lim = excluded.lim, channels = excluded.channels, label = excluded.label, active = 1
     RETURNING *`,
  ).get({
    niche: input.niche,
    location: input.location ?? null,
    lim: input.lim ?? 10,
    channels: input.channels?.length ? JSON.stringify(input.channels) : null,
    label: input.label ?? null,
  }) as SearchRow;
  return toSearch(row);
  });
}
export async function setSearchActive(id: number, active: boolean): Promise<void> {
  return withDb((db) => { db.prepare("UPDATE searches SET active = ? WHERE id = ?").run(active ? 1 : 0, id); });
}
export async function deleteSearch(id: number): Promise<void> {
  return withDb((db) => { db.prepare("DELETE FROM searches WHERE id = ?").run(id); });
}

// ---- Runs -------------------------------------------------------------------

export interface Run {
  id: number; started_at: string; finished_at: string | null;
  status: "running" | "done" | "error"; search_count: number; lead_count: number;
  enrich: boolean; error: string | null;
}
interface RunRow extends Omit<Run, "enrich"> { enrich: number }

export async function createRun(searchCount: number, enrich: boolean): Promise<number> {
  return withDb((db) => {
    const r = db.prepare("INSERT INTO runs (search_count, enrich) VALUES (?, ?) RETURNING id")
      .get(searchCount, enrich ? 1 : 0) as { id: number };
    return r.id;
  });
}
export async function finishRun(id: number, leadCount: number, error?: string): Promise<void> {
  return withDb((db) => {
    db.prepare(
      `UPDATE runs SET finished_at = datetime('now'), status = ?, lead_count = ?, error = ? WHERE id = ?`,
    ).run(error ? "error" : "done", leadCount, error ?? null, id);
  });
}
export async function listRuns(limit = 50): Promise<Run[]> {
  return withDbRead((db) => (db.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?").all(limit) as RunRow[])
    .map((r) => ({ ...r, enrich: !!r.enrich })));
}

// ---- Leads ------------------------------------------------------------------

export interface StoredLead {
  id: number; name: string; domain: string; website: string; description: string | null;
  query: string | null; channels: ChannelId[]; outreach: Outreach | null; seo: SeoAudit | null;
  score: number; opportunityScore: number; issuesCount: number; hasEmail: boolean;
  scoreReasons: string[]; status: LeadStatus; notes: string | null; runId: number | null;
  createdAt: string; updatedAt: string;
}
interface LeadRow {
  id: number; name: string; domain: string; website: string; description: string | null;
  query: string | null; channels: string; outreach: string | null; seo: string | null;
  score: number; opportunity_score: number; issues_count: number; has_email: number;
  score_reasons: string; status: LeadStatus; notes: string | null; run_id: number | null;
  created_at: string; updated_at: string;
}
function toLead(r: LeadRow): StoredLead {
  return {
    id: r.id, name: r.name, domain: r.domain, website: r.website, description: r.description,
    query: r.query,
    channels: r.channels ? JSON.parse(r.channels) : [],
    outreach: r.outreach ? JSON.parse(r.outreach) : null,
    seo: r.seo ? JSON.parse(r.seo) : null,
    score: r.score, opportunityScore: r.opportunity_score, issuesCount: r.issues_count,
    hasEmail: !!r.has_email,
    scoreReasons: JSON.parse(r.score_reasons),
    status: r.status, notes: r.notes, runId: r.run_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function uniqStr(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b].map((s) => s.trim()).filter(Boolean))];
}

/** Union two outreach objects so a re-run never LOSES a previously-found contact. */
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

/**
 * Upsert a lead by domain. Preserves status/notes; MERGES outreach (union of
 * contacts) and keeps the higher score so re-runs only ever improve a lead,
 * never downgrade it when a re-scrape happens to find less.
 */
function upsertLeadDb(db: Database.Database, lead: Lead, runId: number): void {
  const existingRow = db.prepare("SELECT * FROM leads WHERE domain = ?").get(lead.domain) as LeadRow | undefined;
  const existing = existingRow ? toLead(existingRow) : null;

  // Merge contacts; refresh SEO to current state; keep best score.
  const outreach = mergeOutreach(existing?.outreach ?? null, lead.outreach);
  const seo = lead.seo ?? existing?.seo ?? null;
  const score = Math.max(lead.score, existing?.score ?? 0);
  const reasons = score === lead.score ? lead.scoreReasons : (existing?.scoreReasons ?? lead.scoreReasons);

  db.prepare(
    `INSERT INTO leads
       (name, domain, website, description, query, channels, outreach, seo, score,
        opportunity_score, issues_count, has_email, score_reasons, run_id)
     VALUES
       (@name, @domain, @website, @description, @query, @channels, @outreach, @seo, @score,
        @opportunity_score, @issues_count, @has_email, @score_reasons, @run_id)
     ON CONFLICT(domain) DO UPDATE SET
       name = excluded.name,
       website = excluded.website,
       description = COALESCE(excluded.description, leads.description),
       query = excluded.query,
       channels = excluded.channels,
       outreach = excluded.outreach,
       seo = excluded.seo,
       score = excluded.score,
       opportunity_score = excluded.opportunity_score,
       issues_count = excluded.issues_count,
       has_email = excluded.has_email,
       score_reasons = excluded.score_reasons,
       run_id = excluded.run_id,
       updated_at = datetime('now')`,
  ).run({
    name: lead.name, domain: lead.domain, website: lead.website, description: lead.description,
    query: lead.query,
    channels: JSON.stringify(lead.channels ?? []),
    outreach: outreach ? JSON.stringify(outreach) : null,
    seo: seo ? JSON.stringify(seo) : null,
    score,
    opportunity_score: seo?.opportunityScore ?? 0,
    issues_count: seo?.issues.length ?? 0,
    has_email: outreach?.emails.length ? 1 : 0,
    score_reasons: JSON.stringify(reasons),
    run_id: runId,
  });
}

export async function upsertLead(lead: Lead, runId: number): Promise<void> {
  return withDb((db) => upsertLeadDb(db, lead, runId));
}

/** Batch-save leads and finish a run in one blob sync. */
export async function saveRunResults(runId: number, leads: Lead[], leadCount: number, error?: string): Promise<void> {
  return withDb((db) => {
    for (const lead of leads) upsertLeadDb(db, lead, runId);
    db.prepare(
      `UPDATE runs SET finished_at = datetime('now'), status = ?, lead_count = ?, error = ? WHERE id = ?`,
    ).run(error ? "error" : "done", leadCount, error ?? null, runId);
  });
}

export type DatePeriod = "today" | "yesterday" | "week" | "month" | "year";
export const DATE_PERIODS: DatePeriod[] = ["today", "yesterday", "week", "month", "year"];

export interface LeadFilter {
  status?: LeadStatus; minScore?: number; hasEmail?: boolean; q?: string;
  channel?: ChannelId;
  period?: DatePeriod;
  from?: string; to?: string; // YYYY-MM-DD custom range (inclusive)
  sort?: "score" | "opportunity" | "recent" | "name";
}

// SQLite date predicates over created_at (stored UTC, compared to UTC 'now').
const PERIOD_SQL: Record<DatePeriod, string> = {
  today:     "date(created_at) = date('now')",
  yesterday: "date(created_at) = date('now','-1 day')",
  week:      "created_at >= datetime('now','-7 days')",
  month:     "strftime('%Y-%m', created_at) = strftime('%Y-%m','now')",
  year:      "strftime('%Y', created_at) = strftime('%Y','now')",
};

export async function listLeads(filter: LeadFilter = {}): Promise<StoredLead[]> {
  return withDbRead((db) => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.status) { where.push("status = @status"); params.status = filter.status; }
  if (filter.minScore != null) { where.push("score >= @minScore"); params.minScore = filter.minScore; }
  if (filter.hasEmail) { where.push("has_email = 1"); }
  if (filter.q) { where.push("(name LIKE @q OR domain LIKE @q)"); params.q = `%${filter.q}%`; }
  if (filter.channel) { where.push("channels LIKE @channel"); params.channel = `%"${filter.channel}"%`; }
  if (filter.period) { where.push(PERIOD_SQL[filter.period]); }
  if (filter.from) { where.push("date(created_at) >= date(@from)"); params.from = filter.from; }
  if (filter.to) { where.push("date(created_at) <= date(@to)"); params.to = filter.to; }

  const order =
    filter.sort === "opportunity" ? "opportunity_score DESC"
    : filter.sort === "recent" ? "updated_at DESC"
    : filter.sort === "name" ? "name COLLATE NOCASE ASC"
    : "score DESC";

  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order}`;
  return (db.prepare(sql).all(params) as LeadRow[]).map(toLead);
  });
}
/** All lead domains currently stored — used to dedupe new discovery runs. */
export async function listLeadDomains(): Promise<Set<string>> {
  return withDbRead((db) => {
    const rows = db.prepare("SELECT domain FROM leads").all() as { domain: string }[];
    return new Set(rows.map((r) => r.domain));
  });
}
export async function getLead(id: number): Promise<StoredLead | null> {
  return withDbRead((db) => {
    const r = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as LeadRow | undefined;
    return r ? toLead(r) : null;
  });
}
export async function updateLead(id: number, patch: { status?: LeadStatus; notes?: string }): Promise<void> {
  return withDb((db) => {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.status) { sets.push("status = @status"); params.status = patch.status; }
  if (patch.notes !== undefined) { sets.push("notes = @notes"); params.notes = patch.notes; }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = @id`).run(params);
  });
}
export async function deleteLead(id: number): Promise<void> {
  return withDb((db) => { db.prepare("DELETE FROM leads WHERE id = ?").run(id); });
}
/** Bulk-delete leads by id. Returns the number actually removed. */
export async function deleteLeads(ids: number[]): Promise<number> {
  return withDb((db) => {
    const clean = ids.map(Number).filter((n) => Number.isInteger(n));
    if (!clean.length) return 0;
    const placeholders = clean.map(() => "?").join(",");
    return db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...clean).changes;
  });
}

/** One-time hygiene pass over stored leads: remove fluff, clean junky names. */
export async function cleanupLeads(): Promise<{ deleted: { name: string; domain: string }[]; renamed: { from: string; to: string }[] }> {
  return withDb((db) => {
  const rows = db.prepare("SELECT id, name, domain FROM leads").all() as { id: number; name: string; domain: string }[];
  const deleted: { name: string; domain: string }[] = [];
  const renamed: { from: string; to: string }[] = [];
  const del = db.prepare("DELETE FROM leads WHERE id = ?");
  const ren = db.prepare("UPDATE leads SET name = ?, updated_at = datetime('now') WHERE id = ?");

  const isGlued = (s: string) => !/\s/.test(s) && s.length > 9 && /^[a-z]+$/i.test(s);
  for (const r of rows) {
    if (isMicrosite(r.domain)) { del.run(r.id); deleted.push({ name: r.name, domain: r.domain }); continue; }
    let clean: string | null = null;
    if (looksLikeListicle(r.name)) clean = cleanNameFromDomain(r.domain);
    else if (isGlued(r.name)) clean = cleanNameFromDomain(r.name.toLowerCase());
    // Only apply when it actually improved into multiple words (or a clean change).
    if (clean && clean.toLowerCase() !== r.name.toLowerCase() && (clean.includes(" ") || looksLikeListicle(r.name))) {
      ren.run(clean, r.id); renamed.push({ from: r.name, to: clean });
    }
  }
  return { deleted, renamed };
  });
}

// ---- Stats ------------------------------------------------------------------

export interface Stats {
  totalLeads: number; byStatus: Record<string, number>; avgScore: number;
  hotLeads: number; withEmail: number; activeSearches: number; totalRuns: number; lastRunAt: string | null;
}
export async function getStats(): Promise<Stats> {
  return withDbRead((db) => {
  const totalLeads = (db.prepare("SELECT COUNT(*) c FROM leads").get() as { c: number }).c;
  const statusRows = db.prepare("SELECT status, COUNT(*) c FROM leads GROUP BY status").all() as { status: string; c: number }[];
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.c;
  const avgScore = Math.round((db.prepare("SELECT COALESCE(AVG(score),0) a FROM leads").get() as { a: number }).a);
  const hotLeads = (db.prepare("SELECT COUNT(*) c FROM leads WHERE score >= 70").get() as { c: number }).c;
  const withEmail = (db.prepare("SELECT COUNT(*) c FROM leads WHERE has_email = 1").get() as { c: number }).c;
  const activeSearches = (db.prepare("SELECT COUNT(*) c FROM searches WHERE active = 1").get() as { c: number }).c;
  const totalRuns = (db.prepare("SELECT COUNT(*) c FROM runs").get() as { c: number }).c;
  const lastRunAt = (db.prepare("SELECT MAX(started_at) m FROM runs").get() as { m: string | null }).m;
  return { totalLeads, byStatus, avgScore, hotLeads, withEmail, activeSearches, totalRuns, lastRunAt };
  });
}
