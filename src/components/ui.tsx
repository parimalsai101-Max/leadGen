import Link from "next/link";

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, sub, accent = "ink",
}: { label: string; value: React.ReactNode; sub?: string; accent?: "ink" | "emerald" | "amber" }) {
  const tone: Record<string, string> = {
    ink: "text-ink", emerald: "text-brand-600", amber: "text-amber-600",
  };
  return (
    <div className="card card-hover p-5">
      <span className="label">{label}</span>
      <div className={`mt-2.5 text-[34px] font-semibold leading-none tracking-tight tabular-nums ${tone[accent]}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

/** Score shown as a small donut ring — feels crafted, not a flat pill. */
export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const color = score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#e11d48";
  const track = score >= 70 ? "#d1fae5" : score >= 40 ? "#fef3c7" : "#ffe4e6";
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, score) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  contacted: "bg-amber-50 text-amber-700 ring-amber-200",
  won: "bg-brand-50 text-brand-700 ring-brand-200",
  lost: "bg-rose-50 text-rose-600 ring-rose-200",
  archived: "bg-stone-100 text-stone-500 ring-stone-200",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge capitalize ring-1 ring-inset ${STATUS_TONE[status] ?? STATUS_TONE.archived}`}>{status}</span>;
}
export const statusTone = (s: string) => STATUS_TONE[s] ?? STATUS_TONE.archived;

export function EmptyState({
  title, body, action,
}: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-stone-400">{body}</p>}
      {action && <Link href={action.href} className="btn-primary mt-5">{action.label}</Link>}
    </div>
  );
}
