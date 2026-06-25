import { Prospect } from "@/models/Prospect";
import type { DedupKeys } from "./keys";

export type MatchTier = "T1" | "T2" | "T3";

export type MatchResult = {
  tier: MatchTier;
  prospectId: string;
  matchedOn: keyof DedupKeys;
} | null;

/**
 * Cherche un doublon dans TOUTE la collection (lifecycle agnostique).
 *
 * - T1 (certitude) : `place_id` identique.
 * - T2 (forte)     : `gmaps_url_norm` OU `domain` OU `phone_e164` identique.
 * - T3 (faible)    : `namegeo` seul.
 *
 * Renvoie le premier doublon trouvé, par ordre de confiance décroissante.
 */
export async function findDuplicate(keys: DedupKeys): Promise<MatchResult> {
  // T1
  if (keys.place_id) {
    const hit = await Prospect.findOne({ "keys.place_id": keys.place_id })
      .select({ _id: 1 })
      .lean();
    if (hit) return { tier: "T1", prospectId: String(hit._id), matchedOn: "place_id" };
  }

  // T2 — une seule requête $or pour économiser un round-trip
  const t2Clauses: Record<string, string>[] = [];
  if (keys.gmaps_url_norm) t2Clauses.push({ "keys.gmaps_url_norm": keys.gmaps_url_norm });
  if (keys.domain) t2Clauses.push({ "keys.domain": keys.domain });
  if (keys.phone_e164) t2Clauses.push({ "keys.phone_e164": keys.phone_e164 });

  if (t2Clauses.length > 0) {
    const hit = await Prospect.findOne({ $or: t2Clauses })
      .select({ _id: 1, "keys.gmaps_url_norm": 1, "keys.domain": 1, "keys.phone_e164": 1 })
      .lean();
    if (hit) {
      let matchedOn: keyof DedupKeys = "gmaps_url_norm";
      const k = (hit as { keys?: Partial<DedupKeys> }).keys ?? {};
      if (keys.gmaps_url_norm && k.gmaps_url_norm === keys.gmaps_url_norm) matchedOn = "gmaps_url_norm";
      else if (keys.domain && k.domain === keys.domain) matchedOn = "domain";
      else if (keys.phone_e164 && k.phone_e164 === keys.phone_e164) matchedOn = "phone_e164";
      return { tier: "T2", prospectId: String(hit._id), matchedOn };
    }
  }

  // T3
  if (keys.namegeo) {
    const hit = await Prospect.findOne({ "keys.namegeo": keys.namegeo })
      .select({ _id: 1 })
      .lean();
    if (hit) return { tier: "T3", prospectId: String(hit._id), matchedOn: "namegeo" };
  }

  return null;
}

/**
 * Pour les tests : prend une liste de prospects en mémoire et applique la même cascade.
 * Sert à tester sans DB.
 */
export function findDuplicateInMemory(
  keys: DedupKeys,
  base: { id: string; keys: Partial<DedupKeys> }[]
): MatchResult {
  if (keys.place_id) {
    const hit = base.find((b) => b.keys.place_id && b.keys.place_id === keys.place_id);
    if (hit) return { tier: "T1", prospectId: hit.id, matchedOn: "place_id" };
  }
  if (keys.gmaps_url_norm) {
    const hit = base.find(
      (b) => b.keys.gmaps_url_norm && b.keys.gmaps_url_norm === keys.gmaps_url_norm
    );
    if (hit) return { tier: "T2", prospectId: hit.id, matchedOn: "gmaps_url_norm" };
  }
  if (keys.domain) {
    const hit = base.find((b) => b.keys.domain && b.keys.domain === keys.domain);
    if (hit) return { tier: "T2", prospectId: hit.id, matchedOn: "domain" };
  }
  if (keys.phone_e164) {
    const hit = base.find(
      (b) => b.keys.phone_e164 && b.keys.phone_e164 === keys.phone_e164
    );
    if (hit) return { tier: "T2", prospectId: hit.id, matchedOn: "phone_e164" };
  }
  if (keys.namegeo) {
    const hit = base.find((b) => b.keys.namegeo && b.keys.namegeo === keys.namegeo);
    if (hit) return { tier: "T3", prospectId: hit.id, matchedOn: "namegeo" };
  }
  return null;
}
