import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { weightAt } from "@/lib/trade/calltime";
import type { TradeBucket } from "@/lib/trade/detect";
import { scoreV2 } from "@/lib/scoring/score";

/**
 * Forme allégée retournée au client — pas de raw, pas d'historique.
 */
export type TriCandidate = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  gmaps_url: string | null;
  gmaps_rating: number | null;
  gmaps_reviews: number | null;
  has_website: boolean;
  score: number;
  trade: TradeBucket | null;
  times_seen: number;
  og: { title: string | null; description: string | null; image: string | null } | null;
  lifecycle: "inbox" | "snoozed";
  snooze_until: string | null;
};

/**
 * Combine score (P de conversion 0-100) et fenêtre d'appel optimale → poids final.
 * - score = 0 (ex. pas de tel) → poids 0 : exclu du tirage.
 * - weightAt rend 0 pour les zones `avoid` → ces prospects ne participent pas au tirage.
 * - trade null → POIDS_UNKNOWN (0.5), jamais 0 : pas de famine pour les métiers inconnus.
 * - Si tous les candidats ont un poids 0, rouletteIndex fait un tirage aléatoire uniforme.
 */
function combinedWeight(
  score: number,
  trade: TradeBucket | null,
  now: Date
): number {
  const base = Math.max(score, 0);
  const w = weightAt(trade, now);
  return base * w;
}

/**
 * Sélectionne un prochain prospect via roulette pondérée.
 * @param excludeIds  ids déjà vus dans la session courante (évite les répétitions immédiates).
 */
export async function pickNext(
  now: Date = new Date(),
  excludeIds: string[] = []
): Promise<TriCandidate | null> {
  await dbConnect();

  const query: Record<string, unknown> = {
    $or: [
      { lifecycle: "inbox" },
      { lifecycle: "snoozed", snooze_until: { $lte: now } },
    ],
  };
  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }

  // Charge toute la file éligible (champs légers, pas de raw/historique).
  const candidates = await Prospect.find(query)
    .select({
      name: 1, category: 1, city: 1, address: 1, phone: 1,
      website_url: 1, gmaps_url: 1, gmaps_rating: 1, gmaps_reviews: 1,
      has_website: 1, keys: 1, trade: 1, times_seen: 1, og: 1,
      lifecycle: 1, snooze_until: 1,
    })
    .lean();

  if (candidates.length === 0) return null;

  // Score calculé à la volée (scoreV2) — non persisté, reflète la logique actuelle.
  const scores = candidates.map((c) => liveScore(c));
  let weights = candidates.map((c, i) =>
    combinedWeight(scores[i]!, (c.trade ?? null) as TradeBucket | null, now)
  );
  // Si tous les poids sont à 0 (ex. tous en zone avoid), on retombe sur score seul.
  if (weights.every((w) => w <= 0)) {
    weights = scores;
  }
  // Sélection déterministe : le poids le plus élevé gagne toujours.
  // Un mauvais score ne peut jamais passer devant un bon, même hors créneau.
  const idx = argmax(weights);
  const pick = candidates[idx]!;

  return toCandidate(pick);
}

function liveScore(p: Record<string, unknown>): number {
  const keys = (p.keys ?? {}) as { domain?: string | null };
  return scoreV2({
    phone: (p.phone as string | null) ?? null,
    has_website: Boolean(p.has_website),
    website_url: (p.website_url as string | null) ?? null,
    keys,
    gmaps_reviews: (p.gmaps_reviews as number | null) ?? null,
    gmaps_rating: (p.gmaps_rating as number | null) ?? null,
    trade: (p.trade as TradeBucket | null) ?? null,
  });
}

function toCandidate(p: Record<string, unknown>): TriCandidate {
  const og =
    p.og && typeof p.og === "object"
      ? {
          title: (p.og as { title?: string | null }).title ?? null,
          description:
            (p.og as { description?: string | null }).description ?? null,
          image: (p.og as { image?: string | null }).image ?? null,
        }
      : null;
  return {
    id: String(p._id),
    name: String(p.name ?? ""),
    category: (p.category as string | null) ?? null,
    city: (p.city as string | null) ?? null,
    address: (p.address as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    website_url: (p.website_url as string | null) ?? null,
    gmaps_url: (p.gmaps_url as string | null) ?? null,
    gmaps_rating: (p.gmaps_rating as number | null) ?? null,
    gmaps_reviews: (p.gmaps_reviews as number | null) ?? null,
    has_website: Boolean(p.has_website),
    score: liveScore(p),
    trade: (p.trade as TradeBucket | null) ?? null,
    times_seen: Number(p.times_seen ?? 1),
    og: og && (og.title || og.description || og.image) ? og : null,
    lifecycle: (p.lifecycle as "inbox" | "snoozed") ?? "inbox",
    snooze_until: p.snooze_until
      ? new Date(p.snooze_until as string).toISOString()
      : null,
  };
}

/**
 * Renvoie le nombre de candidats éligibles à `now`. Pour le compteur "X restantes".
 * (compte exact via Mongo, pas via le panel.)
 */
export async function countQueue(now: Date = new Date()): Promise<number> {
  await dbConnect();
  return Prospect.countDocuments({
    $or: [
      { lifecycle: "inbox" },
      { lifecycle: "snoozed", snooze_until: { $lte: now } },
    ],
  });
}

/** Retourne l'index du poids maximal. En cas d'égalité, prend le premier. */
export function argmax(weights: number[]): number {
  let best = 0;
  for (let i = 1; i < weights.length; i++) {
    if (weights[i]! > weights[best]!) best = i;
  }
  return best;
}

export { combinedWeight };
