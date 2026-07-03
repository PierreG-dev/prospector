import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { computeKeys } from "@/lib/dedup/keys";
import { findDuplicate, type MatchResult } from "@/lib/dedup/cascade";
import { detectTrade } from "@/lib/trade/detect";
import { scoreV2 } from "@/lib/scoring/score";
import { refreshOgForProspect } from "@/lib/og/fetch";
import type { ProspectCanonical } from "@/lib/import/map";

export type ManualInput = {
  name: string;
  phone?: string | null;
  website_url?: string | null;
  city?: string | null;
  gmaps_url?: string | null;
  category?: string | null;
};

export type ManualResult =
  | { status: "created"; prospect_id: string; tier: null | "T3"; match?: MatchResult }
  | { status: "duplicate"; tier: "T1" | "T2"; match: NonNullable<MatchResult> };

function clean(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function createManualProspect(input: ManualInput): Promise<ManualResult> {
  await dbConnect();

  const name = clean(input.name);
  if (!name) throw new Error("Le nom est obligatoire.");

  const phone = clean(input.phone);
  const website = clean(input.website_url);
  const gmapsUrl = clean(input.gmaps_url);
  const city = clean(input.city);
  const category = clean(input.category);

  const keys = computeKeys({ name, city, phone, website, gmapsUrl });
  const trade = detectTrade({
    name,
    categoryName: category,
    categories: category ? [category] : [],
  });

  const match = await findDuplicate(keys);
  if (match && (match.tier === "T1" || match.tier === "T2")) {
    return { status: "duplicate", tier: match.tier, match };
  }

  const canonical: ProspectCanonical = {
    name,
    owner_name: null,
    category,
    categories: category ? [category] : [],
    address: null,
    city,
    postal_code: null,
    country_code: null,
    state: null,
    phone,
    email: null,
    website_url: website,
    gmaps_url: gmapsUrl,
    gmaps_rating: null,
    gmaps_reviews: null,
    has_website: Boolean(website),
    trade,
    keys,
    raw: { source: "manual", entered_at: new Date().toISOString() } as unknown as ProspectCanonical["raw"],
  };

  const score = scoreV2(canonical);
  const isT3 = match?.tier === "T3";

  const created = await Prospect.create({
    ...canonical,
    score,
    lifecycle: "inbox",
    times_seen: 1,
    last_seen_at: new Date(),
    runs: [],
    status_history: [
      {
        from: null,
        to: "inbox",
        note: isT3
          ? `Ajout manuel (doublon possible T3 namegeo, match ${match?.prospectId})`
          : "Ajout manuel",
        created_at: new Date(),
      },
    ],
  });

  if (website) {
    refreshOgForProspect(String(created._id)).catch(() => {
      /* best-effort */
    });
  }

  return {
    status: "created",
    prospect_id: String(created._id),
    tier: isT3 ? "T3" : null,
    match: match ?? undefined,
  };
}
