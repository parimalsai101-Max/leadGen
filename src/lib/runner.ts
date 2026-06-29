import type { Lead, SearchSpec } from "@/lib/types";
import { runSearch } from "@/lib/pipeline";
import { withDb, withDbRead } from "@/lib/db";
import { saveRunResults } from "@/lib/repo";
import type { Search } from "@/lib/repo";

export interface RunSummary {
  runId: number;
  searchCount: number;
  leadCount: number;
  errors: { search: string; error: string }[];
}

function toSpecs(searches: Search[]): SearchSpec[] {
  return searches.map((s) => ({
    niche: s.niche,
    location: s.location ?? undefined,
    limit: s.lim,
    channels: s.channels ?? undefined,
  }));
}

export async function runDiscovery(opts: { specs?: SearchSpec[]; enrich?: boolean } = {}): Promise<RunSummary> {
  const enrich = opts.enrich ?? true;

  const specs: SearchSpec[] = opts.specs ?? toSpecs(
    (await withDbRead((db) =>
      db.prepare("SELECT * FROM searches WHERE active = 1 ORDER BY created_at DESC").all() as {
        niche: string; location: string | null; lim: number; channels: string | null;
      }[],
    )).map((s) => ({
      ...s, id: 0, label: null, active: true, created_at: "",
      channels: s.channels ? JSON.parse(s.channels) : null,
    })),
  );

  const known = await withDbRead((db) => {
    const rows = db.prepare("SELECT domain FROM leads").all() as { domain: string }[];
    return new Set(rows.map((r) => r.domain));
  });

  const runId = await withDb((db) => {
    const row = db.prepare("INSERT INTO runs (search_count, enrich) VALUES (?, ?) RETURNING id")
      .get(specs.length, enrich ? 1 : 0) as { id: number };
    return row.id;
  });

  if (specs.length === 0) {
    await saveRunResults(runId, [], 0);
    return { runId, searchCount: 0, leadCount: 0, errors: [] };
  }

  try {
    const errors: { search: string; error: string }[] = [];
    const savedLeads: Lead[] = [];

    for (const spec of specs) {
      const label = spec.location ? `${spec.niche} / ${spec.location}` : spec.niche;
      try {
        const { leads } = await runSearch(spec, enrich, known);
        for (const lead of leads) {
          savedLeads.push(lead);
          known.add(lead.domain);
        }
      } catch (e) {
        errors.push({ search: label, error: (e as Error).message });
      }
    }

    await saveRunResults(runId, savedLeads, savedLeads.length);
    return { runId, searchCount: specs.length, leadCount: savedLeads.length, errors };
  } catch (e) {
    await saveRunResults(runId, [], 0, (e as Error).message);
    throw e;
  }
}
