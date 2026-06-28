import { NextResponse } from "next/server";
import { CHANNELS } from "@/lib/discovery/channels";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    channels: CHANNELS.map((c) => ({
      id: c.id, label: c.label, reliability: c.reliability, note: c.note,
    })),
  });
}
