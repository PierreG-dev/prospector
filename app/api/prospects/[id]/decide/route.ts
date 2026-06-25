import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Action = "qualify" | "reject" | "snooze";

type Body = {
  action: Action;
  snooze_until?: string; // ISO date
  note?: string;
};

/**
 * Applique une décision sur un prospect et retourne le snapshot d'avant
 * (pour l'undo client-side).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const prev = await Prospect.findById(id)
    .select({ lifecycle: 1, pipeline_status: 1, snooze_until: 1 })
    .lean();
  if (!prev) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  const snapshot = {
    lifecycle: prev.lifecycle,
    pipeline_status: prev.pipeline_status ?? null,
    snooze_until: prev.snooze_until
      ? new Date(prev.snooze_until).toISOString()
      : null,
  };

  const now = new Date();
  const update: Record<string, unknown> = {
    $push: {
      status_history: {
        from: prev.lifecycle,
        to: body.action,
        note: body.note ?? null,
        created_at: now,
      },
    },
    $set: {} as Record<string, unknown>,
  };
  const setBlock = update.$set as Record<string, unknown>;

  if (body.action === "qualify") {
    setBlock.lifecycle = "qualified";
    setBlock.pipeline_status = "a_contacter";
    setBlock.snooze_until = null;
    setBlock.last_status_at = now;
  } else if (body.action === "reject") {
    setBlock.lifecycle = "rejected";
    setBlock.snooze_until = null;
    setBlock.last_status_at = now;
  } else if (body.action === "snooze") {
    if (!body.snooze_until) {
      return NextResponse.json(
        { error: "snooze_until requis pour action=snooze" },
        { status: 400 }
      );
    }
    const dt = new Date(body.snooze_until);
    if (Number.isNaN(dt.getTime()) || dt <= now) {
      return NextResponse.json(
        { error: "snooze_until doit être une date future valide" },
        { status: 400 }
      );
    }
    setBlock.lifecycle = "snoozed";
    setBlock.snooze_until = dt;
    setBlock.last_status_at = now;
  } else {
    return NextResponse.json({ error: "action invalide" }, { status: 400 });
  }

  await Prospect.updateOne({ _id: id }, update);

  return NextResponse.json({ ok: true, snapshot });
}
