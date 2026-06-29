import type { Lead, SearchSpec } from "@/lib/types";
import { runSearch } from "@/lib/pipeline";
import { listActiveSearches, saveRunResults, listLeadDomains } from "@/lib/repo";
import { withStore, nowUtc } from "@/lib/json-store";

export interface RunSummary {
  runId: number;
  searchCount: number;
  leadCount: number;
  errors: { search: string; error: string }[];
}

export async function runDiscovery(opts: { specs?: SearchSpec[]; enrich?: boolean } = {}): Promise<RunSummary> {
  const enrich = opts.enrich ?? true;
  const specs: SearchSpec[] = opts.specs ?? (await listActiveSearches()).map((s) => ({
    niche: s.niche,
    location: s.location ?? undefined,
    limit: s.lim,
    channels: s.channels ?? undefined,
  }));

  const runId = await withStore((s) => {
    const id = s.nextRunId++;
    s.runs.unshift({
      id, started_at: nowUtc(), finished_at: null, status: "running",
      search_count: specs.length, lead_count: 0, enrich, error: null,
    });
    return id;
  });

  if (specs.length === 0) {
    await saveRunResults(runId, [], 0);
    return { runId, searchCount: 0, leadCount: 0, errors: [] };
  }

  try {
    const errors: { search: string; error: string }[] = [];
    const savedLeads: Lead[] = [];
    const known = await listLeadDomains();

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
