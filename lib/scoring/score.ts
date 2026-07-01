import type { ProspectCanonical } from "@/lib/import/map";
import type { TradeBucket } from "@/lib/trade/detect";

/**
 * Métiers prioritaires pour l'offre "vente de site web". À ajuster à l'usage.
 * Pas de classification figée : tu peux éditer cette liste sans toucher au reste.
 */
const PRIORITY_TRADES: ReadonlySet<TradeBucket> = new Set([
  "plombier",
  "chauffagiste",
  "electricien",
  "couvreur",
  "menuisier",
  "macon",
  "peintre",
  "garagiste",
  "boucherie",
  "boulangerie",
  "fleuriste",
  "coiffeur",
  "estheticienne",
  "auto_ecole",
]);

/** Input commun aux deux versions (ProspectCanonical + lean Mongoose doc). */
export interface ScoreInput {
  phone: string | null | undefined;
  has_website: boolean;
  website_url?: string | null;
  keys: { domain?: string | null };
  gmaps_reviews?: number | null;
  gmaps_rating?: number | null;
  trade?: TradeBucket | null;
}

/**
 * Score V1 — conservé pour la compatibilité des anciens documents importés.
 */
export function scoreV1(p: ProspectCanonical): number {
  if (!p.phone) return 0;

  let s: number;
  if (!p.has_website) {
    s = 60;
  } else if (!p.keys.domain && p.website_url) {
    s = 50;
  } else {
    s = 10;
  }

  const reviews = p.gmaps_reviews ?? 0;
  if (reviews >= 50) s += 15;
  else if (reviews >= 10) s += 8;
  else if (reviews >= 3) s += 3;
  else s -= 5;

  const rating = p.gmaps_rating ?? 0;
  if (rating >= 4.6) s -= 3;
  else if (rating >= 3.8) s += 3;
  else if (rating > 0 && rating < 3.5) s -= 5;

  if (p.trade && PRIORITY_TRADES.has(p.trade)) s += 8;

  const wellEquipped =
    p.has_website &&
    !!p.keys.domain &&
    reviews >= 50 &&
    (p.gmaps_rating ?? 0) >= 4.5;
  if (wellEquipped) s = Math.min(s, 10);

  return Math.max(0, Math.min(100, s));
}

/**
 * Score V2 — calculé à la volée au moment du tri (non persisté).
 *
 * Logique : "levier digital" — l'écart entre l'activité réelle du business
 * et sa présence en ligne. Plus l'écart est grand, plus tu as quelque chose
 * à vendre.
 *
 * Hard floor : pas de téléphone → 0.
 *
 * Base (gap de présence web) :
 *   65  aucun site                   → besoin maximal, levier évident
 *   45  page FB/IG/réseau social     → client conscient, pas encore équipé
 *   12  vrai site (domaine propre)   → déjà équipé, conversion difficile
 *
 * Activité (les avis Google prouvent que le business tourne et peut payer) :
 *   0 avis  → 0  (inconnu, neutre)
 *   1-5     → +8  (existe mais quasi invisible)
 *   6-19    → +14 (sweet spot : actif, pas encore "gros", a besoin de toi)
 *   20-49   → +10 (solide)
 *   50-99   → +6
 *   100+    → +2  (très établi, peut avoir une équipe marketing)
 *
 * Note Google (urgence ressentie) :
 *   < 3.5 sans site réel → +8  (problème d'image + pas de solution = urgence)
 *   < 3.5 avec site      → -8  (problème produit/service, pas web — dur à vendre)
 *   3.5-4.0              → +5  (marge d'amélioration, réceptif)
 *   4.0-4.6              → +2  (bon mais perfectible)
 *   4.6+                 → -4  (déjà au top, peu d'urgence)
 *
 * Combo "gros levier" :
 *   Pas de site + 1-10 avis → +8  (business réel, totalement invisible en ligne)
 *
 * Métier prioritaire (patron = décideur, cycle court) : +8
 *
 * Plafond : site réel + 50 avis+ + note 4.5+ → max 10.
 */
export function scoreV2(p: ScoreInput): number {
  if (!p.phone) return 0;

  const hasTrueSite = p.has_website && !!p.keys.domain;
  const hasSocialOnly = p.has_website && !p.keys.domain && !!p.website_url;

  let s: number;
  if (!p.has_website) {
    s = 65;
  } else if (hasSocialOnly) {
    s = 45;
  } else {
    s = 12;
  }

  const reviews = p.gmaps_reviews ?? 0;
  if (reviews >= 1 && reviews <= 5) s += 8;
  else if (reviews <= 19) s += 14;
  else if (reviews <= 49) s += 10;
  else if (reviews <= 99) s += 6;
  else if (reviews >= 100) s += 2;

  const rating = p.gmaps_rating ?? 0;
  if (rating > 0) {
    if (rating < 3.5) {
      s += hasTrueSite ? -8 : 8;
    } else if (rating < 4.0) {
      s += 5;
    } else if (rating < 4.6) {
      s += 2;
    } else {
      s -= 4;
    }
  }

  // Business réel mais totalement invisible en ligne
  if (!p.has_website && reviews >= 1 && reviews <= 10) s += 8;

  if (p.trade && PRIORITY_TRADES.has(p.trade)) s += 8;

  if (hasTrueSite && reviews >= 50 && rating >= 4.5) s = Math.min(s, 10);

  return Math.max(0, Math.min(100, s));
}

export { PRIORITY_TRADES };
