import type { Lead, SearchSpec } from "@/lib/types";
import { runSearch } from "@/lib/pipeline";
import { withDb } from "@/lib/db";
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

  const prep = await withDb((db) => {
    const searches = opts.specs
      ? null
      : (db.prepare("SELECT * FROM searches WHERE active = 1 ORDER BY created_at DESC").all() as {
          niche: string; location: string | null; lim: number; channels: string | null;
        }[]);
    const specs: SearchSpec[] = opts.specs ?? toSpecs(
      (searches ?? []).map((s) => ({
        ...s, id: 0, label: null, active: true, created_at: "",
        channels: s.channels ? JSON.parse(s.channels) : null,
      })),
    );

    const runRow = db.prepare("INSERT INTO runs (search_count, enrich) VALUES (?, ?) RETURNING id")
      .get(specs.length, enrich ? 1 : 0) as { id: number };

    const domainRows = db.prepare("SELECT domain FROM leads").all() as { domain: string }[];
    const known = new Set(domainRows.map((r) => r.domain));

    return { runId: runRow.id, specs, known };
  });

  if (prep.specs.length === 0) {
    await saveRunResults(prep.runId, [], 0);
    return { runId: prep.runId, searchCount: 0, leadCount: 0, errors: [] };
  }

  try {
    const errors: { search: string; error: string }[] = [];
    const savedLeads: Lead[] = [];

    for (const spec of prep.specs) {
      const label = spec.location ? `${spec.niche} / ${spec.location}` : spec.niche;
      try {
        const { leads } = await runSearch(spec, enrich, prep.known);
        for (const lead of leads) {
          savedLeads.push(lead);
          prep.known.add(lead.domain);
        }
      } catch (e) {
        errors.push({ search: label, error: (e as Error).message });
      }
    }

    await saveRunResults(prep.runId, savedLeads, savedLeads.length);
    return { runId: prep.runId, searchCount: prep.specs.length, leadCount: savedLeads.length, errors };
  } catch (e) {
    await saveRunResults(prep.runId, [], 0, (e as Error).message);
    throw e;
  }
}
