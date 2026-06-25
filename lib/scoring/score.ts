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
 * Score V1, lisible.
 *
 * +40  si !has_website                     (cœur de cible)
 * +20  si website = plateforme partagée    (FB only — détectable via keys.domain=null + website présent)
 * +15  si phone présent                    (joignable)
 * +15  si gmaps_reviews >= 10              (activité réelle)
 * +10  si trade ∈ secteurs prioritaires
 * -30  si has_website ET domaine propre ET >= 50 avis ET note >= 4.3 (proxy "déjà bien équipé")
 */
export function scoreV1(p: ProspectCanonical): number {
  let s = 0;

  if (!p.has_website) {
    s += 40;
  } else if (!p.keys.domain && p.website_url) {
    // Le site existe mais le domaine n'a pas été retenu = plateforme partagée
    s += 20;
  }

  if (p.phone) s += 15;

  if ((p.gmaps_reviews ?? 0) >= 10) s += 15;

  if (p.trade && PRIORITY_TRADES.has(p.trade)) s += 10;

  const wellEquipped =
    p.has_website &&
    !!p.keys.domain &&
    (p.gmaps_reviews ?? 0) >= 50 &&
    (p.gmaps_rating ?? 0) >= 4.3;
  if (wellEquipped) s -= 30;

  return s;
}

export { PRIORITY_TRADES };
