import { NextResponse } from "next/server";
import { updateLead, deleteLead, getLead, LEAD_STATUSES, type LeadStatus } from "@/lib/repo";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string; notes?: string };

  const patch: { status?: LeadStatus; notes?: string } = {};
  if (body.status !== undefined) {
    if (!LEAD_STATUSES.includes(body.status as LeadStatus)) {
      return NextResponse.json({ error: `status must be one of ${LEAD_STATUSES.join(", ")}` }, { status: 400 });
    }
    patch.status = body.status as LeadStatus;
  }
  if (body.notes !== undefined) patch.notes = body.notes;

  updateLead(Number(id), patch);
  return NextResponse.json({ lead: getLead(Number(id)) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteLead(Number(id));
  return NextResponse.json({ ok: true });
}
