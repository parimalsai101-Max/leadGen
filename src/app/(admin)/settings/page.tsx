import { getStats } from "@/lib/repo";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const stats = getStats();

  return (
    <main>
      <PageHeader title="Settings" subtitle="Configuration & system status." />

      <div className="space-y-5">
        <Card title="Crawl4AI">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm text-stone-700">
              Local scraping active — discovery, SEO audits, and contact enrichment run fully free with no API key.
            </span>
          </div>
          <p className="mt-3 text-sm text-stone-500">
            Business discovery uses DuckDuckGo search. Enrichment uses crawl4ai (headless Chromium).
            Requires Python 3 with <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">crawl4ai</code> and{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">ddgs</code> installed.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            To install: <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">pip3 install crawl4ai ddgs && crawl4ai-setup</code>
          </p>
        </Card>

        <Card title="Lead scoring">
          <ul className="space-y-1.5 text-sm text-stone-600">
            <li className="flex justify-between"><span>SEO opportunity (issues to pitch)</span><span className="font-medium text-stone-900">up to 60</span></li>
            <li className="flex justify-between"><span>Reachability (email / phone / socials / people)</span><span className="font-medium text-stone-900">up to 35</span></li>
            <li className="flex justify-between"><span>Live working site bonus</span><span className="font-medium text-stone-900">up to 5</span></li>
          </ul>
          <p className="mt-3 text-xs text-stone-400">Edit weights in <code className="rounded bg-stone-100 px-1 py-0.5">src/lib/score.ts</code>; SEO checks in <code className="rounded bg-stone-100 px-1 py-0.5">src/lib/seo.ts</code>.</p>
        </Card>

        <Card title="Data">
          <div className="grid grid-cols-3 gap-4">
            <Mini label="Leads" value={stats.totalLeads} />
            <Mini label="Runs" value={stats.totalRuns} />
            <Mini label="Active searches" value={stats.activeSearches} />
          </div>
          <p className="mt-3 text-xs text-stone-400">SQLite at <code className="rounded bg-stone-100 px-1 py-0.5">data/leadgen.db</code>. Swap for Postgres (Neon) in <code className="rounded bg-stone-100 px-1 py-0.5">src/lib/db.ts</code> before serverless deploy.</p>
        </Card>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-sm font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums text-stone-900">{value}</div>
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  );
}
