import type { ApifyRoot } from "./parse";
import { computeKeys, type DedupKeys } from "@/lib/dedup/keys";
import { detectTrade, type TradeBucket } from "@/lib/trade/detect";

/** Forme canonique avant insertion en base (sans champs cycle de vie). */
export type ProspectCanonical = {
  name: string;
  owner_name: string | null;
  category: string | null;
  categories: string[];
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  gmaps_url: string | null;
  gmaps_rating: number | null;
  gmaps_reviews: number | null;
  has_website: boolean;
  trade: TradeBucket | null;
  keys: DedupKeys;
  raw: ApifyRoot;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  return v;
}

/** Table de mapping figée (voir spec §3). Champs absents → null, jamais throw. */
export function mapApifyItem(item: ApifyRoot): ProspectCanonical {
  const name = item.title.trim();
  const phone = asString(item.phone);
  const website = asString(item.website);
  const gmapsUrl = asString(item.url);
  const city = asString(item.city);
  const categoryName = asString(item.categoryName);
  const categories = Array.isArray(item.categories)
    ? item.categories.filter((c): c is string => typeof c === "string" && !!c.trim())
    : [];

  const keys = computeKeys({
    name,
    city,
    phone,
    website,
    gmapsUrl,
  });

  const trade = detectTrade({
    name,
    categoryName,
    categories,
  });

  return {
    name,
    owner_name: null, // ABSENT de cet actor
    category: categoryName,
    categories,
    address: asString(item.street),
    city,
    postal_code: null, // ABSENT de cet actor
    country_code: asString(item.countryCode),
    state: asString(item.state),
    phone,
    email: null, // ABSENT de cet actor
    website_url: website,
    gmaps_url: gmapsUrl,
    gmaps_rating: asNumber(item.totalScore),
    gmaps_reviews: asNumber(item.reviewsCount),
    has_website: Boolean(website),
    trade,
    keys,
    raw: item,
  };
}
