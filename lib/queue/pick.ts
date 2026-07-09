import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { ImportRun } from "@/models/ImportRun";
import { weightAt } from "@/lib/trade/calltime";
import type { TradeBucket } from "@/lib/trade/detect";
import { scoreV2 } from "@/lib/scoring/score";

/**
 * Un prospect est masqué de la file de tri si TOUS ses runs sont issus de
 * campagnes suspendues. Un prospect sans runs (edge case) reste visible.
 */
async function pausedRunIds(): Promise<unknown[]> {
  const rows = await ImportRun.find({ paused: true }).select({ _id: 1 }).lean();
  return rows.map((r) => r._id);
}

function excludePausedClause(pausedIds: unknown[]): Record<string, unknown> | null {
  if (pausedIds.length === 0) return null;
  return {
    $or: [
      { runs: { $size: 0 } },
      { runs: { $elemMatch: { run_id: { $nin: pausedIds } } } },
    ],
  };
}

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
  gmaps_rank: number | null;
  latest_review_days: number | null;
  profile_gaps: number;
  is_mobile_phone: boolean;
};

/** Signaux extraits d'un doc Mongoose lean pour peser un candidat. */
export type PickSignals = {
  rank: number | null;
  latestReviewAt: Date | null;
  gaps: number;              // 0..3
  phoneE164: string | null;
};

/**
 * Boost "invisibilité Google" : plus la fiche est loin dans les résultats Maps,
 * plus elle a besoin d'un site → poids relevé. Signal doux qui ne renverse pas
 * un vrai gap de score (pas-de-site score 73 vs vrai-site score 20 reste dominé).
 *
 * rank=1  → 0.75  |  rank=5  → 1.0  |  rank=15 → 1.6  |  rank≥20 → 1.75 (plafond)
 * rank null/absent → 1.0 (neutre : ancien import ou actor sans champ rank)
 */
export function invisibilityBoost(rank: number | null): number {
  if (rank == null || rank < 1) return 1;
  const raw = 1 + (rank - 5) * 0.06;
  return Math.max(0.75, Math.min(1.75, raw));
}

/**
 * Business qui reçoit des avis récents = actif, budget, présence à laquelle il tient.
 * < 30j  → 1.35   < 90j → 1.20   < 180j → 1.10
 * > 365j → 0.90 (dormant)   null → 1.0
 */
export function freshnessBoost(latest: Date | null, now: Date): number {
  if (!latest || Number.isNaN(latest.getTime())) return 1;
  const days = (now.getTime() - latest.getTime()) / 86_400_000;
  if (days < 0) return 1;         // date future absurde → neutre
  if (days < 30) return 1.35;
  if (days < 90) return 1.20;
  if (days < 180) return 1.10;
  if (days > 365) return 0.90;
  return 1;
}

/**
 * Nombre de "trous" du profil Maps (0..3) → boost croissant.
 * Signaux : pas de site, imagesCount=0, openingHours vide/absent.
 * 0→1.0  1→1.10  2→1.25  3→1.40 (jackpot : profil totalement délaissé).
 */
export function profileGapBoost(gaps: number): number {
  const g = Math.max(0, Math.min(3, gaps | 0));
  return [1.0, 1.10, 1.25, 1.40][g]!;
}

/**
 * Mobile FR (+336…/+337…) = ligne directe = décideur. +15%.
 */
export function mobilePhoneBoost(phoneE164: string | null): number {
  if (!phoneE164) return 1;
  return /^\+33[67]/.test(phoneE164) ? 1.15 : 1;
}

/**
 * Combine score (P de conversion 0-100), fenêtre d'appel optimale et
 * les boosts "lead bouillant" → poids final.
 *
 * - score = 0 (ex. pas de tel) → poids 0 : exclu du tirage.
 * - weightAt rend 0 pour les zones `avoid` → ces prospects ne participent pas au tirage.
 * - trade null → POIDS_UNKNOWN (0.5), jamais 0 : pas de famine pour les métiers inconnus.
 * - Signaux combinés bornés (~0.67× à ~3.8×) : un signal seul ne renverse jamais
 *   un vrai gap de score, mais l'accumulation (rank haut + avis frais + Maps bâclé + mobile)
 *   peut légitimement remonter une fiche "chaude".
 * - Si tous les candidats ont un poids 0, on retombe sur score seul.
 */
function combinedWeight(
  score: number,
  trade: TradeBucket | null,
  now: Date,
  signals: PickSignals = { rank: null, latestReviewAt: null, gaps: 0, phoneE164: null }
): number {
  const base = Math.max(score, 0);
  const w = weightAt(trade, now);
  return (
    base *
    w *
    invisibilityBoost(signals.rank) *
    freshnessBoost(signals.latestReviewAt, now) *
    profileGapBoost(signals.gaps) *
    mobilePhoneBoost(signals.phoneE164)
  );
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

  const pausedIds = await pausedRunIds();
  const pausedClause = excludePausedClause(pausedIds);
  const query: Record<string, unknown> = {
    $or: [
      { lifecycle: "inbox" },
      { lifecycle: "snoozed", snooze_until: { $lte: now } },
    ],
  };
  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }
  if (pausedClause) {
    query.$and = [pausedClause];
  }

  // Charge toute la file éligible (champs légers, pas d'historique).
  const candidates = await Prospect.find(query)
    .select({
      name: 1, category: 1, city: 1, address: 1, phone: 1,
      website_url: 1, gmaps_url: 1, gmaps_rating: 1, gmaps_reviews: 1,
      has_website: 1, keys: 1, trade: 1, times_seen: 1, og: 1,
      lifecycle: 1, snooze_until: 1,
      "raw.rank": 1, "raw.reviews": 1, "raw.updatedAt": 1,
      "raw.imagesCount": 1, "raw.openingHours": 1,
    })
    .lean();

  if (candidates.length === 0) return null;

  // Score calculé à la volée (scoreV2) — non persisté, reflète la logique actuelle.
  const scores = candidates.map((c) => liveScore(c));
  let weights = candidates.map((c, i) =>
    combinedWeight(
      scores[i]!,
      (c.trade ?? null) as TradeBucket | null,
      now,
      extractSignals(c)
    )
  );
  // Si tous les poids sont à 0 (ex. tous en zone avoid), on retombe sur score seul.
  if (weights.every((w) => w <= 0)) {
    weights = scores;
  }
  // Sélection déterministe : le poids le plus élevé gagne toujours.
  const idx = argmax(weights);
  const pick = candidates[idx]!;

  return toCandidate(pick, now);
}

function extractRank(p: Record<string, unknown>): number | null {
  const raw = p.raw as { rank?: unknown } | null | undefined;
  const r = raw?.rank;
  return typeof r === "number" && Number.isFinite(r) ? r : null;
}

function extractLatestReviewAt(p: Record<string, unknown>): Date | null {
  const raw = p.raw as
    | { reviews?: Array<{ publishedAtDate?: unknown }>; updatedAt?: unknown }
    | null
    | undefined;
  if (!raw) return null;
  // Le tableau reviews d'Apify google-maps-extractor est ordonné plus récent → plus ancien.
  const first = Array.isArray(raw.reviews) ? raw.reviews[0] : null;
  const cand = first?.publishedAtDate ?? raw.updatedAt;
  if (typeof cand !== "string" && !(cand instanceof Date)) return null;
  const d = cand instanceof Date ? cand : new Date(cand);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractGaps(p: Record<string, unknown>): number {
  const raw = p.raw as
    | { imagesCount?: unknown; openingHours?: unknown }
    | null
    | undefined;
  let gaps = 0;
  if (!p.has_website) gaps++;
  const imgs = raw?.imagesCount;
  if (typeof imgs === "number" && imgs === 0) gaps++;
  const hours = raw?.openingHours;
  const hoursEmpty = !hours || (Array.isArray(hours) && hours.length === 0);
  if (hoursEmpty) gaps++;
  return gaps;
}

function extractSignals(p: Record<string, unknown>): PickSignals {
  const keys = (p.keys ?? {}) as { phone_e164?: string | null };
  return {
    rank: extractRank(p),
    latestReviewAt: extractLatestReviewAt(p),
    gaps: extractGaps(p),
    phoneE164: keys.phone_e164 ?? null,
  };
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

function toCandidate(p: Record<string, unknown>, now: Date): TriCandidate {
  const og =
    p.og && typeof p.og === "object"
      ? {
          title: (p.og as { title?: string | null }).title ?? null,
          description:
            (p.og as { description?: string | null }).description ?? null,
          image: (p.og as { image?: string | null }).image ?? null,
        }
      : null;
  const signals = extractSignals(p);
  const latestReviewDays = signals.latestReviewAt
    ? Math.floor((now.getTime() - signals.latestReviewAt.getTime()) / 86_400_000)
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
    gmaps_rank: signals.rank,
    latest_review_days: latestReviewDays,
    profile_gaps: signals.gaps,
    is_mobile_phone: mobilePhoneBoost(signals.phoneE164) > 1,
  };
}

/**
 * Renvoie le nombre de candidats éligibles à `now`. Pour le compteur "X restantes".
 * (compte exact via Mongo, pas via le panel.)
 */
export async function countQueue(now: Date = new Date()): Promise<number> {
  await dbConnect();
  const pausedIds = await pausedRunIds();
  const pausedClause = excludePausedClause(pausedIds);
  const query: Record<string, unknown> = {
    $or: [
      { lifecycle: "inbox" },
      { lifecycle: "snoozed", snooze_until: { $lte: now } },
    ],
  };
  if (pausedClause) {
    query.$and = [pausedClause];
  }
  return Prospect.countDocuments(query);
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
