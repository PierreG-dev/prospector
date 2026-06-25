/** Type figé pour l'actor Apify Google Maps utilisé. Champs absents acceptés. */
export type ApifyRoot = {
  title: string;
  totalScore?: number | null;
  reviewsCount?: number | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  countryCode?: string | null;
  website?: string | null;
  phone?: string | null;
  categories?: string[] | null;
  url?: string | null;
  categoryName?: string | null;
};

/**
 * Parse + valide qu'on a bien un tableau d'items utilisables.
 * On est laxiste : seul `title` est requis (clé d'identification minimale).
 */
export function parseApifyJson(raw: string): ApifyRoot[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON invalide : ${(e as Error).message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Le JSON doit être un tableau au niveau racine (dataset Apify).");
  }
  const out: ApifyRoot[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const t = (item as Record<string, unknown>).title;
    if (typeof t !== "string" || !t.trim()) continue;
    out.push(item as ApifyRoot);
  }
  return out;
}
