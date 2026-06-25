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

/**
 * Score V1 — probabilité estimée de conversion (0-100).
 * Chaque facteur reflète "à quel point ce prospect a des chances de signer".
 *
 * Hard floor : pas de téléphone → 0 (injoignable, P=0).
 *
 * Base (présence web) :
 *   60  aucune présence web                (besoin maximal)
 *   50  page FB/IG/Linktree only           (besoin conscient, pas équipé)
 *   10  site pro (vrai domaine)            (déjà équipé, switch peu probable)
 *
 * Modulateurs :
 *   +15 avis >= 50            (business actif, solvable)
 *   +8  avis 10-49            (activité confirmée)
 *   +3  avis 3-9              (activité faible)
 *   -5  avis 0-2              (fantôme ou tout récent)
 *   -3  note >= 4.6           (déjà au top, peu d'urgence ressentie)
 *   +3  note 3.8-4.5          (sweet spot : satisfaits mais améliorables)
 *   -5  note < 3.5            (problèmes business avant problèmes web)
 *   +8  métier prioritaire    (décideur = patron, cycle court)
 *
 * Plafond : concurrent bien installé (site pro + 50 avis + note >= 4.5) → max 10.
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

export { PRIORITY_TRADES };
