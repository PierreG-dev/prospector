import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMIT_MAX = 200;

export async function GET(req: Request) {
  await dbConnect();
  const url = new URL(req.url);

  const lifecycle = url.searchParams.get("lifecycle") ?? "qualified";
  const includeInbox = url.searchParams.get("includeInbox") === "1";
  const trade = url.searchParams.get("trade");
  const city = url.searchParams.get("city");
  const pipeline = url.searchParams.get("pipeline");
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 50) || 50,
    LIMIT_MAX
  );
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

  const filter: Record<string, unknown> =
    includeInbox && lifecycle === "qualified"
      ? { lifecycle: { $in: ["qualified", "inbox", "snoozed"] } }
      : { lifecycle };
  if (trade) filter.trade = trade;
  if (city) filter.city = city;
  if (pipeline) filter.pipeline_status = pipeline;
  if (q) {
    // recherche simple insensible casse sur name (escape regex meta)
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safe, $options: "i" };
  }

  const [items, total, facetTrades, facetCities] = await Promise.all([
    Prospect.find(filter)
      .select({
        name: 1,
        category: 1,
        city: 1,
        trade: 1,
        lifecycle: 1,
        has_website: 1,
        phone: 1,
        website_url: 1,
        gmaps_url: 1,
        gmaps_rating: 1,
        gmaps_reviews: 1,
        score: 1,
        pipeline_status: 1,
        relance_count: 1,
        relance_paused: 1,
        last_status_at: 1,
        updatedAt: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean(),
    Prospect.countDocuments(filter),
    Prospect.distinct("trade", {
      ...(includeInbox && lifecycle === "qualified"
        ? { lifecycle: { $in: ["qualified", "inbox", "snoozed"] } }
        : { lifecycle }),
      trade: { $ne: null },
    }),
    Prospect.distinct("city", {
      ...(includeInbox && lifecycle === "qualified"
        ? { lifecycle: { $in: ["qualified", "inbox", "snoozed"] } }
        : { lifecycle }),
      city: { $ne: null },
    }),
  ]);

  return NextResponse.json({
    items: items.map((p) => ({ ...p, _id: String(p._id) })),
    total,
    facets: {
      trades: (facetTrades as (string | null)[]).filter(Boolean).sort(),
      cities: (facetCities as (string | null)[]).filter(Boolean).sort(),
    },
  });
}
