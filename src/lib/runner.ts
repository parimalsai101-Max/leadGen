import type { Lead, SearchSpec } from "@/lib/types";
import { runSearch } from "@/lib/pipeline";
import { listActiveSearches, createRun, saveRunResults, listLeadDomains } from "@/lib/repo";

export interface RunSummary {
  runId: number;
  searchCount: number;
  leadCount: number;
  errors: { search: string; error: string }[];
}

export async function runDiscovery(opts: { specs?: SearchSpec[]; enrich?: boolean } = {}): Promise<RunSummary> {
  const enrich = opts.enrich ?? true;
  const active = opts.specs
    ? null
    : await listActiveSearches();
  const specs: SearchSpec[] =
    opts.specs ??
    active!.map((s) => ({
      niche: s.niche,
      location: s.location ?? undefined,
      limit: s.lim,
      channels: s.channels ?? undefined,
    }));

  const runId = await createRun(specs.length, enrich);

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
