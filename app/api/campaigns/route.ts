import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ImportRun } from "@/models/ImportRun";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await dbConnect();
  const runs = await ImportRun.find({})
    .sort({ imported_at: -1 })
    .select({
      label: 1,
      source_type: 1,
      apify_actor: 1,
      source_file: 1,
      imported_at: 1,
      raw_count: 1,
      new_count: 1,
      dup_count: 1,
      filtered_count: 1,
      paused: 1,
    })
    .lean();

  const ids = runs.map((r) => r._id);
  const counts = await Prospect.aggregate<{ _id: unknown; count: number }>([
    { $match: { "runs.run_id": { $in: ids } } },
    { $unwind: "$runs" },
    { $match: { "runs.run_id": { $in: ids } } },
    { $group: { _id: "$runs.run_id", count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));

  return NextResponse.json({
    campaigns: runs.map((r) => ({
      id: String(r._id),
      label: r.label,
      source_type: r.source_type,
      apify_actor: r.apify_actor,
      source_file: r.source_file,
      imported_at: r.imported_at,
      raw_count: r.raw_count,
      new_count: r.new_count,
      dup_count: r.dup_count,
      filtered_count: r.filtered_count,
      paused: Boolean(r.paused),
      current_prospects: byId.get(String(r._id)) ?? 0,
    })),
  });
}
