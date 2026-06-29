import { NextResponse } from "next/server";
import { setSearchActive, deleteSearch } from "@/lib/repo";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { active?: boolean };
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
  }
  await setSearchActive(Number(id), body.active);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteSearch(Number(id));
  return NextResponse.json({ ok: true });
}
