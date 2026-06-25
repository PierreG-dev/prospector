import type { TradeBucket } from "./detect";

/**
 * Fenêtre d'appel optimale par métier (heure locale Europe/Paris).
 * - `window` : [début, fin] — poids 1.0 dedans.
 * - `avoid`  : zones à éviter (rush hours) — poids 0.
 * - hors window et hors avoid : poids 0.3 (faible mais non nul, anti-famine).
 *
 * Valeurs raisonnables par défaut, à affiner à l'usage.
 */
export type CallWindow = {
  window: [number, number]; // heures (peuvent être décimales : 11.5 = 11h30)
  avoid?: [number, number][];
};

const WINDOWS: Record<TradeBucket, CallWindow> = {
  // Artisans BTP — entre 2 chantiers, fin de journée
  plombier: { window: [16, 19], avoid: [[8, 12]] },
  chauffagiste: { window: [16, 19], avoid: [[8, 12]] },
  electricien: { window: [16, 19], avoid: [[8, 12]] },
  couvreur: { window: [16, 19], avoid: [[8, 12]] },
  menuisier: { window: [16, 19], avoid: [[8, 12]] },
  macon: { window: [16, 19], avoid: [[8, 12]] },
  peintre: { window: [16, 19], avoid: [[8, 12]] },
  garagiste: { window: [10, 12], avoid: [[8, 9.5], [12, 14]] },
  auto_ecole: { window: [13.5, 16], avoid: [[18, 20]] },

  // Commerces de bouche : éviter le rush
  boulangerie: { window: [14, 17], avoid: [[6, 13], [17, 19.5]] },
  boucherie: { window: [14, 17], avoid: [[8, 12.5], [17, 19.5]] },
  restaurant: { window: [15, 17], avoid: [[11.5, 14.5], [19, 22.5]] },

  // Services à la personne
  coiffeur: { window: [10, 12], avoid: [[14, 19]] },
  estheticienne: { window: [10, 12], avoid: [[14, 19]] },
  fleuriste: { window: [14, 17], avoid: [[10, 13], [17, 19]] },

  // Santé / professions libérales
  opticien: { window: [12, 14], avoid: [[10, 12], [15, 19]] },
  kine: { window: [12, 14], avoid: [[8, 12], [14, 19]] },
  dentiste: { window: [12, 14], avoid: [[8, 12], [14, 19]] },
  veterinaire: { window: [12, 14], avoid: [[8, 12], [14, 19]] },

  // Pros bureau
  immobilier: { window: [10, 12], avoid: [[12, 14]] },
};

const POIDS_IN = 1.0;
const POIDS_OUT = 0.3;
const POIDS_AVOID = 0.0;
const POIDS_UNKNOWN = 0.5; // bucket null → neutre, pas favorisé ni ignoré

function hourInParis(now: Date): number {
  // Approche compacte : on extrait l'heure d'Europe/Paris via Intl, en ignorant DST côté util.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h + m / 60;
}

function isIn([a, b]: [number, number], h: number): boolean {
  return h >= a && h < b;
}

export function weightAt(bucket: TradeBucket | null, now: Date = new Date()): number {
  if (!bucket) return POIDS_UNKNOWN;
  const cfg = WINDOWS[bucket];
  if (!cfg) return POIDS_UNKNOWN;
  const h = hourInParis(now);
  for (const a of cfg.avoid ?? []) {
    if (isIn(a, h)) return POIDS_AVOID;
  }
  if (isIn(cfg.window, h)) return POIDS_IN;
  return POIDS_OUT;
}

/** Pour l'UI : sait-on si on est dans le bon créneau ? */
export function isOptimalNow(bucket: TradeBucket | null, now: Date = new Date()): boolean {
  return weightAt(bucket, now) >= POIDS_IN;
}

export function isAvoidNow(bucket: TradeBucket | null, now: Date = new Date()): boolean {
  return weightAt(bucket, now) <= POIDS_AVOID;
}

export { WINDOWS };
