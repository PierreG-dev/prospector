import { normalize } from "@/lib/text";

/**
 * Buckets métier détectables. Liste éditable à la main — pas de panneau UI en V1.
 * Les patterns sont testés sur `normalize(name + ' ' + categoryName + ' ' + categories.join(' '))`.
 * Ordre important : le premier bucket qui matche gagne (du plus spécifique au plus générique).
 */
export type TradeBucket =
  | "plombier"
  | "chauffagiste"
  | "electricien"
  | "garagiste"
  | "menuisier"
  | "macon"
  | "couvreur"
  | "peintre"
  | "restaurant"
  | "boulangerie"
  | "boucherie"
  | "coiffeur"
  | "estheticienne"
  | "fleuriste"
  | "opticien"
  | "kine"
  | "dentiste"
  | "veterinaire"
  | "auto_ecole"
  | "immobilier";

type Rule = { bucket: TradeBucket; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    bucket: "chauffagiste",
    patterns: [/\bchauffagiste\b/, /\bchauffage\b/],
  },
  {
    bucket: "plombier",
    patterns: [/\bplomb/, /\bsanitaire\b/, /\bplombier/],
  },
  {
    bucket: "electricien",
    patterns: [/\belectricien\b/, /\belectricite\b/, /\bartisan electric/],
  },
  {
    bucket: "couvreur",
    patterns: [/\bcouvreur\b/, /\bcouverture\b/, /\bzingueur\b/, /\btoiture\b/],
  },
  {
    bucket: "menuisier",
    patterns: [/\bmenuisier\b/, /\bmenuiserie\b/, /\bebeniste\b/],
  },
  {
    bucket: "macon",
    patterns: [/\bmacon\b/, /\bmaconnerie\b/],
  },
  {
    bucket: "peintre",
    patterns: [/\bpeintre\b/, /\bpeinture batiment\b/, /\bpeinture en bati/],
  },
  {
    bucket: "garagiste",
    patterns: [
      /\bgaragiste\b/,
      /\bgarage\b/,
      /\bmecanique auto\b/,
      /\bcarrosserie\b/,
      /\bcarrossier\b/,
    ],
  },
  {
    bucket: "auto_ecole",
    patterns: [/\bauto[- ]?ecole\b/, /\bcode de la route\b/],
  },
  {
    bucket: "boulangerie",
    patterns: [/\bboulangerie\b/, /\bboulanger\b/, /\bpatisserie\b/, /\bpatissier\b/, /\bviennoiserie\b/],
  },
  {
    bucket: "boucherie",
    patterns: [/\bboucherie\b/, /\bboucher\b/, /\bcharcuterie\b/, /\btraiteur\b/],
  },
  {
    bucket: "restaurant",
    patterns: [
      /\brestaurant\b/,
      /\bbrasserie\b/,
      /\bbistro\b/,
      /\bbistrot\b/,
      /\bpizzeria\b/,
      /\bpizz/,
      /\bcrep/,
      /\bcafe\b/,
      /\bbar\b/,
    ],
  },
  {
    bucket: "coiffeur",
    patterns: [/\bcoiffeur\b/, /\bcoiffure\b/, /\bbarbier\b/, /\bsalon de coiffure\b/],
  },
  {
    bucket: "estheticienne",
    patterns: [/\bestheti/, /\binstitut de beaute\b/, /\bonglerie\b/, /\bsoin du visage\b/, /\bsoin corps\b/],
  },
  {
    bucket: "fleuriste",
    patterns: [/\bfleuriste\b/, /\bfleurs\b/],
  },
  {
    bucket: "opticien",
    patterns: [/\bopticien\b/, /\bopticienne\b/, /\boptique\b/],
  },
  {
    bucket: "kine",
    patterns: [/\bkine\b/, /\bkinesi/, /\bmasseur\b/, /\bosteopath/],
  },
  {
    bucket: "dentiste",
    patterns: [/\bdentiste\b/, /\bchirurgien dentiste\b/, /\borthodonti/],
  },
  {
    bucket: "veterinaire",
    patterns: [/\bveterinaire\b/, /\bclinique veterinaire\b/],
  },
  {
    bucket: "immobilier",
    patterns: [/\bagence immobiliere\b/, /\bimmobilier\b/, /\bagent immobilier\b/],
  },
];

/** Détecte le bucket métier depuis name + categoryName + categories. Retourne null si rien. */
export function detectTrade(input: {
  name?: string | null;
  categoryName?: string | null;
  categories?: (string | null)[] | null;
}): TradeBucket | null {
  const joined = [
    input.name ?? "",
    input.categoryName ?? "",
    (input.categories ?? []).filter(Boolean).join(" "),
  ].join(" ");
  const haystack = normalize(joined);
  if (!haystack) return null;

  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(haystack)) return rule.bucket;
    }
  }
  return null;
}

export const TRADE_BUCKETS: TradeBucket[] = RULES.map((r) => r.bucket);
