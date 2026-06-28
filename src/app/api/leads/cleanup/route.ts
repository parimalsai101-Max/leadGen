import { NextResponse } from "next/server";
import { cleanupLeads } from "@/lib/repo";

export const runtime = "nodejs";

// POST /api/leads/cleanup → remove fluff (booking microsites) + clean junky names.
export async function POST() {
  const result = cleanupLeads();
  return NextResponse.json(result);
}
