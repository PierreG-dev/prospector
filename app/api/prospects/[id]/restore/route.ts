import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Restaure un prospect rejeté/snoozé vers `inbox` : il ressort dans la file de tri.
 * Pose une trace dans status_history.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const prev = await Prospect.findById(id)
    .select({ lifecycle: 1 })
    .lean();
  if (!prev) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }
  if (prev.lifecycle === "qualified") {
    return NextResponse.json(
      { error: "Le prospect est déjà qualifié, pas besoin de restaurer." },
      { status: 400 }
    );
  }

  const now = new Date();
  await Prospect.updateOne(
    { _id: id },
    {
      $set: {
        lifecycle: "inbox",
        snooze_until: null,
        last_status_at: now,
      },
      $push: {
        status_history: {
          from: prev.lifecycle,
          to: "inbox",
          note: "Restauré dans la file de tri",
          created_at: now,
        },
      },
    }
  );
  return NextResponse.json({ ok: true });
}
