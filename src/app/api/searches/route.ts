import { NextResponse } from "next/server";
import { listSearches, addSearch } from "@/lib/repo";
import { CHANNEL_IDS } from "@/lib/discovery/channels";
import type { ChannelId } from "@/lib/types";

export const runtime = "nodejs";

function parseChannels(raw: unknown): ChannelId[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter((c): c is ChannelId => typeof c === "string" && (CHANNEL_IDS as string[]).includes(c));
  return valid.length ? valid : null;
}

export async function GET() {
  return NextResponse.json({ searches: listSearches() });
}

export async function POST(req: Request) {
  let body: { niche?: string; location?: string; lim?: number; channels?: unknown; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.niche !== "string" || !body.niche.trim()) {
    return NextResponse.json({ error: "niche is required (e.g. \"dentist\")" }, { status: 400 });
  }
  const lim = Number(body.lim);
  const created = addSearch({
    niche: body.niche.trim(),
    location: body.location?.trim() || null,
    lim: Number.isFinite(lim) && lim > 0 ? Math.min(50, lim) : 10,
    channels: parseChannels(body.channels),
    label: body.label?.trim() || null,
  });
  return NextResponse.json({ search: created }, { status: 201 });
}
