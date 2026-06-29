import { getStats } from "@/lib/repo";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const stats = await getStats();

  return (
    <main>
      <PageHeader title="Settings" subtitle="Configuration & system status." />

      <div className="space-y-5">
        <Card title="Search & enrichment">
          <ul className="space-y-2 text-sm text-stone-600">
            <EnvRow set={!!process.env.SERPER_API_KEY} name="SERPER_API_KEY" note="Web, LinkedIn, YP, Quora, Clutch, G2, Crunchbase (required on Vercel)" />
            <EnvRow set={!!process.env.GOOGLE_PLACES_API_KEY} name="GOOGLE_PLACES_API_KEY" note="Google Maps channel" />
          </ul>
          <p className="mt-3 text-sm text-stone-500">
            On Vercel, DuckDuckGo blocks datacenter IPs — without <code className="rounded bg-stone-100 px-1 py-0.5">SERPER_API_KEY</code> only Google Maps returns leads.
            Site enrichment uses direct HTTP fetch (no API key).
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

function EnvRow({ set, name, note }: { set: boolean; name: string; note: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${set ? "bg-emerald-500" : "bg-rose-400"}`} />
      <span>
        <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{name}</code>
        {" — "}
        {set ? "configured" : "missing"}
        <span className="text-stone-400"> · {note}</span>
      </span>
    </li>
  );
}
