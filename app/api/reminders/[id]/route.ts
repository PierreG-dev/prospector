import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Reminder } from "@/models/Reminder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PatchBody = {
  done?: boolean;
  due_at?: string; // ISO — pour reprogrammer (report sans consommer d'échelon)
  label?: string;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const body = (await req.json()) as PatchBody;

  const set: Record<string, unknown> = {};
  if (typeof body.done === "boolean") {
    set.done = body.done;
    set.done_at = body.done ? new Date() : null;
  }
  if (body.due_at) {
    const dt = new Date(body.due_at);
    if (Number.isNaN(dt.getTime())) {
      return NextResponse.json({ error: "due_at invalide" }, { status: 400 });
    }
    set.due_at = dt;
  }
  if (typeof body.label === "string") {
    set.label = body.label.trim() || null;
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "rien à mettre à jour" }, { status: 400 });
  }

  const res = await Reminder.updateOne({ _id: id }, { $set: set });
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const res = await Reminder.deleteOne({ _id: id });
  if (res.deletedCount === 0) {
    return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
