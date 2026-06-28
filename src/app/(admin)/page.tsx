import Link from "next/link";
import { getStats, listLeads } from "@/lib/repo";
import { PageHeader, StatCard, ScoreRing, StatusBadge, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

const STATUS_BAR: Record<string, string> = {
  new: "bg-sky-500", qualified: "bg-violet-500", contacted: "bg-amber-500",
  won: "bg-brand-500", lost: "bg-rose-500", archived: "bg-stone-300",
};

export default function Dashboard() {
  const stats = getStats();
  const topLeads = listLeads({ sort: "score" }).slice(0, 6);
  const hasData = stats.totalLeads > 0;

  return (
    <main>
      <PageHeader
        title="Dashboard"
        subtitle="Your SEO lead pipeline at a glance — who you've found, who's reachable, and where they sit in your funnel."
        actions={<Link href="/runs" className="btn-primary">Run discovery</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats.totalLeads} accent="ink" />
        <StatCard label="Hot leads" value={stats.hotLeads} sub="score ≥ 70" accent="emerald" />
        <StatCard label="With email" value={stats.withEmail} sub="ready to reach" accent="emerald" />
        <StatCard label="Avg score" value={stats.avgScore} accent="ink" />
      </div>

      {!hasData ? (
        <div className="mt-8">
          <EmptyState title="No leads yet" body="Add a search (a niche + city), then run discovery to pull real businesses with contacts and an SEO audit." action={{ href: "/searches", label: "Add your first search" }} />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <section className="card p-6 lg:col-span-2">
            <h2 className="text-[15px] font-semibold text-ink">Pipeline by status</h2>
            <ul className="mt-5 space-y-4">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <li key={status} className="flex items-center gap-3">
                  <span className="w-20 text-sm capitalize text-stone-600">{status}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${STATUS_BAR[status] ?? "bg-stone-300"}`} style={{ width: `${(count / stats.totalLeads) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-medium tabular-nums text-ink">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Top leads</h2>
              <Link href="/leads" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
            </div>
            <ul className="mt-3 divide-y divide-[var(--color-line)]">
              {topLeads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <Avatar domain={l.domain} name={l.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                    <p className="truncate text-xs text-stone-400">{l.domain}</p>
                  </div>
                  {l.hasEmail && <span className="badge bg-brand-50 text-brand-700">✉</span>}
                  <StatusBadge status={l.status} />
                  <ScoreRing score={l.score} size={34} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
