import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { Reminder } from "@/models/Reminder";
import { getSettings } from "@/lib/settings";

/**
 * Cadence d'escalade (jours entre échelons consécutifs).
 * - L'init au passage à `contacte` met `relance_next_at = now + DELAYS[0]` (J+3).
 * - Après la relance N, `relance_next_at = now + DELAYS[N]`.
 * - Quand N atteint 3, plus de prochaine échéance (bucket "épuisées").
 *
 * À muter ici pour ajuster les défauts. Les réglages utilisateur (Lot 8)
 * passeront par une override depuis la base.
 */
export const RELANCE_DELAYS_DAYS: [number, number, number] = [3, 7, 14];

export type TickResult = {
  ticked_at: string;
  candidates: number;
  created: number;
  errors: number;
};

/**
 * Calcule l'évolution d'un prospect prêt à recevoir une relance.
 * Sortie pure pour tests (pas de DB).
 */
export function nextRelanceState(args: {
  current_count: number; // 0..2 (3 = épuisé, ne devrait pas entrer ici)
  now: Date;
  delays?: [number, number, number];
}): { new_count: 1 | 2 | 3; new_next_at: Date | null; relance_index: 1 | 2 | 3 } {
  const delays = args.delays ?? RELANCE_DELAYS_DAYS;
  const c = args.current_count;
  if (c < 0 || c > 2) {
    throw new Error("current_count doit être dans [0,2]");
  }
  const relance_index = (c + 1) as 1 | 2 | 3;
  const new_count = relance_index;
  if (relance_index === 3) {
    return { new_count, new_next_at: null, relance_index };
  }
  const next = new Date(args.now);
  next.setDate(next.getDate() + delays[relance_index]);
  return { new_count, new_next_at: next, relance_index };
}

/** Priorité Pushover pour une relance d'index N (1, 2, 3 → 0, 1, 2). */
export function priorityFor(relance_index: 1 | 2 | 3): 0 | 1 | 2 {
  return (relance_index - 1) as 0 | 1 | 2;
}

/**
 * Un tick = on traite tous les prospects en `contacte` dont l'échéance est passée.
 * Crée un `Reminder` `kind='relance'` par prospect, met à jour les compteurs.
 *
 * Le push Pushover est délégué (Lot 7) : `notified_at` reste `null` ici, c'est
 * `lib/notify` qui le remplira après envoi réussi. Idempotent : si on tick 2 fois
 * sans avancer l'horloge, on ne re-crée pas (relance_next_at est avancé).
 */
export async function tickReminders(now: Date = new Date()): Promise<TickResult> {
  await dbConnect();
  const settings = await getSettings();
  const delays = settings.relance_delays as [number, number, number];

  const candidates = await Prospect.find({
    pipeline_status: "contacte",
    relance_paused: false,
    relance_count: { $lt: 3 },
    relance_next_at: { $lte: now },
  })
    .select({ name: 1, relance_count: 1 })
    .lean();

  let created = 0;
  let errors = 0;

  for (const p of candidates) {
    try {
      const current_count = Math.max(
        0,
        Math.min(2, Number(p.relance_count ?? 0))
      );
      const next = nextRelanceState({
        current_count: current_count as 0 | 1 | 2,
        now,
        delays,
      });

      await Reminder.create({
        prospect_id: p._id,
        due_at: now,
        label: `Relance ${next.relance_index}/3 — ${p.name ?? "prospect"}`,
        kind: "relance",
        relance_index: next.relance_index,
        priority: priorityFor(next.relance_index),
      });

      await Prospect.updateOne(
        { _id: p._id },
        {
          $set: {
            relance_count: next.new_count,
            relance_next_at: next.new_next_at,
            last_status_at: now,
          },
        }
      );
      created += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    ticked_at: now.toISOString(),
    candidates: candidates.length,
    created,
    errors,
  };
}
