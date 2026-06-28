import { listLeads, DATE_PERIODS, type LeadFilter, type LeadStatus, type DatePeriod } from "@/lib/repo";
import { CHANNEL_IDS } from "@/lib/discovery/channels";
import type { ChannelId } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/leads/export → CSV of leads (respects filters). One row per business,
// with outreach channels and the top SEO issues to pitch.

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filter: LeadFilter = {};
  const status = sp.get("status");
  if (status) filter.status = status as LeadStatus;
  const minScore = sp.get("minScore");
  if (minScore) filter.minScore = Number(minScore);
  if (sp.get("hasEmail") === "1") filter.hasEmail = true;
  const channel = sp.get("channel");
  if (channel && (CHANNEL_IDS as string[]).includes(channel)) filter.channel = channel as ChannelId;
  const period = sp.get("period");
  if (period && (DATE_PERIODS as string[]).includes(period)) filter.period = period as DatePeriod;
  const from = sp.get("from");
  if (from) filter.from = from;
  const to = sp.get("to");
  if (to) filter.to = to;

  const leads = listLeads(filter);
  const headers = [
    "business", "website", "score", "seo_opportunity", "status", "channels",
    "emails", "phones", "socials", "contact_page", "people",
    "seo_issues", "search", "notes", "updated_at",
  ];

  const rows = leads.map((l) =>
    [
      l.name, l.website, l.score, l.opportunityScore, l.status, l.channels.join("; "),
      l.outreach?.emails.join("; ") ?? "",
      l.outreach?.phones.join("; ") ?? "",
      l.outreach?.socials.join("; ") ?? "",
      l.outreach?.contactUrl ?? "",
      l.outreach?.people.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join("; ") ?? "",
      l.seo?.issues.join("; ") ?? "",
      l.query ?? "", l.notes ?? "", l.updatedAt,
    ].map(csvCell).join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="seo-leads-${Date.now()}.csv"`,
    },
  });
}
