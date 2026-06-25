import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { PIPELINE_ORDER, isPipelineAdvance } from "@/lib/pipeline";
import { getSettings } from "@/lib/settings";
import type { PipelineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { to: PipelineStatus; note?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  if (!PIPELINE_ORDER.includes(body.to)) {
    return NextResponse.json({ error: "statut pipeline invalide" }, { status: 400 });
  }

  const prev = await Prospect.findById(id)
    .select({ pipeline_status: 1, lifecycle: 1, relance_count: 1 })
    .lean();
  if (!prev) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }
  if (prev.lifecycle !== "qualified") {
    return NextResponse.json(
      { error: "Le prospect doit être qualifié pour avoir un pipeline_status." },
      { status: 400 }
    );
  }

  const now = new Date();
  const from = (prev.pipeline_status ?? null) as PipelineStatus | null;
  const to = body.to;

  const set: Record<string, unknown> = {
    pipeline_status: to,
    last_status_at: now,
  };

  // Démarrage moteur de relance au passage à `contacte`
  if (to === "contacte" && from !== "contacte") {
    const settings = await getSettings();
    set.relance_count = 0;
    set.relance_paused = false;
    const next = new Date(now);
    next.setDate(next.getDate() + settings.relance_delays[0]);
    set.relance_next_at = next;
  }

  // Toute avancée du pipeline coupe l'escalade
  if (isPipelineAdvance(from, to)) {
    set.relance_paused = true;
  }

  await Prospect.updateOne(
    { _id: id },
    {
      $set: set,
      $push: {
        status_history: {
          from,
          to,
          note: body.note ?? null,
          created_at: now,
        },
      },
    }
  );

  return NextResponse.json({ ok: true });
}
