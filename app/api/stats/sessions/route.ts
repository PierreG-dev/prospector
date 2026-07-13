import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionStats, type StatsRange } from "@/lib/stats/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseRange(v: string | null): StatsRange {
  if (v === "7d" || v === "30d" || v === "all") return v;
  return "all";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  await dbConnect();
  const stats = await getSessionStats(range);
  return NextResponse.json(stats);
}
