import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { Reminder } from "@/models/Reminder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reset complet d'un prospect : retour en `inbox`, purge des notes, historique,
 * pipeline, rappels et état de relance. Comme s'il n'avait jamais été traité.
 * Conserve identité, clés de dédup, score, trade, runs, times_seen.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const prev = await Prospect.findById(id).select({ _id: 1 }).lean();
  if (!prev) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  await Reminder.deleteMany({ prospect_id: id });

  await Prospect.updateOne(
    { _id: id },
    {
      $set: {
        lifecycle: "inbox",
        pipeline_status: null,
        snooze_until: null,
        relance_count: 0,
        relance_next_at: null,
        relance_paused: false,
        last_status_at: null,
        notes: [],
        status_history: [],
      },
    }
  );
  return NextResponse.json({ ok: true });
}
