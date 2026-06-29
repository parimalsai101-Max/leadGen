import { NextResponse } from "next/server";
import { listRuns } from "@/lib/repo";
import { runDiscovery } from "@/lib/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { enrich?: boolean };
  const enrich = body.enrich ?? true;
  try {
    const summary = await runDiscovery({ enrich });
    return NextResponse.json({ ...summary, enrich });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
