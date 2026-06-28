import { NextResponse } from "next/server";
import { runSearch } from "@/lib/pipeline";
import { CHANNEL_IDS } from "@/lib/discovery/channels";
import type { SearchSpec, ChannelId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { niche?: string; location?: string; limit?: number; channels?: unknown; enrich?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.niche !== "string" || !body.niche.trim()) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  const channels = Array.isArray(body.channels)
    ? (body.channels.filter((c): c is ChannelId => typeof c === "string" && (CHANNEL_IDS as string[]).includes(c)))
    : undefined;

  const spec: SearchSpec = {
    niche: body.niche.trim(),
    location: body.location?.trim() || undefined,
    limit: Math.min(25, Math.max(1, Number(body.limit) || 10)),
    channels: channels?.length ? channels : undefined,
  };
  const enrich = body.enrich ?? true;

  try {
    const result = await runSearch(spec, enrich);
    return NextResponse.json({ ...result, enrich });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
