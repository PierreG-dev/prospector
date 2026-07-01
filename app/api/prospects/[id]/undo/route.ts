import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import type { Lifecycle, PipelineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_LIFECYCLES: Lifecycle[] = ["inbox", "triaging", "snoozed", "rejected", "qualified"];
const VALID_PIPELINE: PipelineStatus[] = ["a_contacter", "contacte", "rdv_pris", "client", "perdu"];

type Snapshot = {
  lifecycle: string;
  pipeline_status: string | null;
  snooze_until: string | null;
};

/**
 * Restaure l'état précédent d'un prospect (envoyé par le client depuis sa pile undo).
 * Retire la dernière entrée `status_history` ajoutée par /decide.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const snapshot = (await req.json()) as Snapshot;

  if (!VALID_LIFECYCLES.includes(snapshot.lifecycle as Lifecycle)) {
    return NextResponse.json({ error: "lifecycle invalide" }, { status: 400 });
  }
  if (
    snapshot.pipeline_status !== null &&
    !VALID_PIPELINE.includes(snapshot.pipeline_status as PipelineStatus)
  ) {
    return NextResponse.json({ error: "pipeline_status invalide" }, { status: 400 });
  }

  const p = await Prospect.findById(id).select({ _id: 1 }).lean();
  if (!p) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  await Prospect.updateOne(
    { _id: id },
    {
      $set: {
        lifecycle: snapshot.lifecycle as Lifecycle,
        pipeline_status: snapshot.pipeline_status as PipelineStatus | null,
        snooze_until: snapshot.snooze_until
          ? new Date(snapshot.snooze_until)
          : null,
      },
      $pop: { status_history: 1 },
    }
  );

  return NextResponse.json({ ok: true });
}
