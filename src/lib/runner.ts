import type { SearchSpec } from "@/lib/types";
import { runSearch } from "@/lib/pipeline";
import { listActiveSearches, createRun, finishRun, upsertLead, listLeadDomains } from "@/lib/repo";

export interface RunSummary {
  runId: number;
  searchCount: number;
  leadCount: number;
  errors: { search: string; error: string }[];
}

export async function runDiscovery(opts: { specs?: SearchSpec[]; enrich?: boolean } = {}): Promise<RunSummary> {
  const specs: SearchSpec[] =
    opts.specs ??
    listActiveSearches().map((s) => ({
      niche: s.niche,
      location: s.location ?? undefined,
      limit: s.lim,
      channels: s.channels ?? undefined,
    }));

  const enrich = opts.enrich ?? true;
  const runId = createRun(specs.length, enrich);

  if (specs.length === 0) {
    finishRun(runId, 0);
    return { runId, searchCount: 0, leadCount: 0, errors: [] };
  }

  try {
    const errors: { search: string; error: string }[] = [];
    let leadCount = 0;
    const known = listLeadDomains();

    for (const spec of specs) {
      const label = spec.location ? `${spec.niche} / ${spec.location}` : spec.niche;
      try {
        const { leads } = await runSearch(spec, enrich, known);
        for (const lead of leads) {
          upsertLead(lead, runId);
          known.add(lead.domain);
          leadCount++;
        }
      } catch (e) {
        errors.push({ search: label, error: (e as Error).message });
      }
    }

    finishRun(runId, leadCount);
    return { runId, searchCount: specs.length, leadCount, errors };
  } catch (e) {
    finishRun(runId, 0, (e as Error).message);
    throw e;
  }
}
