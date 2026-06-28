import type { SearchSpec, BusinessCandidate, ChannelId } from "@/lib/types";
import { discoverBusinesses } from "@/lib/discovery/businessSearch";
import { discoverFromChannel, CHANNEL_IDS } from "@/lib/discovery/channels";

// Runs discovery across all selected channels concurrently, merges results, and
// dedupes by domain while recording every channel that surfaced each business.

export interface MergedCandidate extends BusinessCandidate {
  channels: ChannelId[];
}

export interface DiscoveryOutcome {
  candidates: MergedCandidate[];
  perChannel: Record<string, number>;
}

export async function discover(
  spec: SearchSpec,
  knownDomains: Set<string> = new Set(),
): Promise<DiscoveryOutcome> {
  const channels = (spec.channels?.length ? spec.channels : CHANNEL_IDS) as ChannelId[];

  const tasks = channels.map(async (id) => {
    try {
      const got = id === "web"
        ? await discoverBusinesses(spec, knownDomains)
        : await discoverFromChannel(id, spec);
      return { id, got };
    } catch (err) {
      console.error(`[discover] channel ${id} failed:`, (err as Error).message);
      return { id, got: [] as BusinessCandidate[] };
    }
  });

  const results = await Promise.all(tasks);

  const perChannel: Record<string, number> = {};
  const byDomain = new Map<string, MergedCandidate>();

  for (const { id, got } of results) {
    let kept = 0;
    for (const c of got) {
      if (knownDomains.has(c.domain)) continue;
      kept++;
      const existing = byDomain.get(c.domain);
      if (existing) {
        if (!existing.channels.includes(c.channel)) existing.channels.push(c.channel);
        if (existing.name.length < 3 && c.name.length >= 3) existing.name = c.name;
        if (!existing.phone && c.phone) existing.phone = c.phone;
        if (!existing.description && c.description) existing.description = c.description;
      } else {
        byDomain.set(c.domain, { ...c, channels: [c.channel] });
      }
    }
    perChannel[id] = kept;
  }

  const target = spec.limit ?? 10;
  const finalCap = Math.max(target * 3, 40);
  const candidates = [...byDomain.values()]
    .sort((a, b) => b.channels.length - a.channels.length)
    .slice(0, finalCap);

  return { candidates, perChannel };
}
