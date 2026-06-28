import { NextResponse } from "next/server";
import { deleteLeads } from "@/lib/repo";

export const runtime = "nodejs";

// Bulk delete leads by id: POST { ids: number[] }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) {
    return NextResponse.json({ error: "ids must be a non-empty array of numbers" }, { status: 400 });
  }
  const deleted = deleteLeads(ids);
  return NextResponse.json({ ok: true, deleted });
}
