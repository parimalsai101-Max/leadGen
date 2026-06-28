import { NextResponse } from "next/server";
import { listLeads, DATE_PERIODS, type LeadFilter, type LeadStatus, type DatePeriod } from "@/lib/repo";
import { CHANNEL_IDS } from "@/lib/discovery/channels";
import type { ChannelId } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filter: LeadFilter = {};
  const status = sp.get("status");
  if (status) filter.status = status as LeadStatus;
  const minScore = sp.get("minScore");
  if (minScore) filter.minScore = Number(minScore);
  if (sp.get("hasEmail") === "1") filter.hasEmail = true;
  const q = sp.get("q");
  if (q) filter.q = q;
  const channel = sp.get("channel");
  if (channel && (CHANNEL_IDS as string[]).includes(channel)) filter.channel = channel as ChannelId;
  const period = sp.get("period");
  if (period && (DATE_PERIODS as string[]).includes(period)) filter.period = period as DatePeriod;
  const from = sp.get("from");
  if (from) filter.from = from;
  const to = sp.get("to");
  if (to) filter.to = to;
  const sort = sp.get("sort");
  if (sort === "score" || sort === "opportunity" || sort === "recent" || sort === "name") filter.sort = sort;

  return NextResponse.json({ leads: listLeads(filter) });
}
