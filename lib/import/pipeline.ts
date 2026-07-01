import { dbConnect } from "@/lib/db";
import { ImportRun } from "@/models/ImportRun";
import { Prospect } from "@/models/Prospect";
import { parseApifyJson, type ApifyRoot } from "./parse";
import { mapApifyItem } from "./map";
import { findDuplicate } from "@/lib/dedup/cascade";
import { scoreV2 } from "@/lib/scoring/score";
import { refreshOgForProspect } from "@/lib/og/fetch";
import type { SourceType } from "@/lib/types";

export type ImportResult = {
  run_id: string;
  raw_count: number;
  new_count: number;
  dup_count: number;
  filtered_count: number;
  duplicates_by_tier: { T1: number; T2: number; T3: number };
};

export type ImportOptions = {
  label: string;
  source_type?: SourceType;
  apify_actor?: string | null;
  source_file?: string | null;
  /** Si true (défaut), on pousse une trace {run_id, seen_at} dans `runs[]` des doublons T1/T2. */
  trace_runs?: boolean;
};

/**
 * Pipeline d'import :
 *   parse → map → dédup (TOUTE la base) → score → write.
 *
 * Invariants :
 *  - Doublon T1/T2 → AUCUN restock, AUCUNE écriture du document existant.
 *    Le seul side-effect autorisé est l'ajout d'une trace `runs[]` (configurable).
 *  - T3 (faible) → on crée quand même (badge T3 conservé pour arbitrage humain).
 */
export async function runImport(
  rawJson: string,
  opts: ImportOptions
): Promise<ImportResult> {
  await dbConnect();

  const items = parseApifyJson(rawJson);
  const run = await ImportRun.create({
    label: opts.label,
    source_type: opts.source_type ?? "google_maps",
    apify_actor: opts.apify_actor ?? null,
    source_file: opts.source_file ?? null,
    raw_count: items.length,
  });

  const traceRuns = opts.trace_runs ?? true;
  let new_count = 0;
  let filtered_count = 0;
  const dups = { T1: 0, T2: 0, T3: 0 };

  for (const item of items) {
    const canonical = mapApifyItem(item as ApifyRoot);
    const match = await findDuplicate(canonical.keys);

    if (match && (match.tier === "T1" || match.tier === "T2")) {
      // Doublon sûr → ON NE RESTOCKE RIEN
      dups[match.tier] += 1;
      if (traceRuns) {
        await Prospect.updateOne(
          { _id: match.prospectId },
          {
            $push: { runs: { run_id: run._id, seen_at: new Date() } },
            $inc: { times_seen: 1 },
            $set: { last_seen_at: new Date() },
          }
        );
      }
      continue;
    }

    // T3 (faible) ou nouveau : on crée.
    // Le badge T3 sera matérialisé par un champ `dup_possible` dans status_history ou un flag.
    // Pour V1 on stocke une note discrète dans status_history.
    const score = scoreV2(canonical);
    const isT3 = match?.tier === "T3";
    if (isT3) dups.T3 += 1;

    const created = await Prospect.create({
      ...canonical,
      score,
      lifecycle: "inbox",
      times_seen: 1,
      last_seen_at: new Date(),
      runs: [{ run_id: run._id, seen_at: new Date() }],
      status_history: isT3
        ? [
            {
              from: null,
              to: "inbox",
              note: `Doublon possible (T3 namegeo, match ${match?.prospectId})`,
              created_at: new Date(),
            },
          ]
        : [],
    });

    // OG fetch fire-and-forget : ne bloque pas l'import, ne propage pas l'erreur.
    if (canonical.website_url) {
      refreshOgForProspect(String(created._id)).catch(() => {
        /* best-effort */
      });
    }

    new_count += 1;
  }

  await ImportRun.updateOne(
    { _id: run._id },
    {
      $set: {
        new_count,
        dup_count: dups.T1 + dups.T2,
        filtered_count,
      },
    }
  );

  return {
    run_id: String(run._id),
    raw_count: items.length,
    new_count,
    dup_count: dups.T1 + dups.T2,
    filtered_count,
    duplicates_by_tier: dups,
  };
}
