import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { ImportRun } from "@/models/ImportRun";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  label?: string;
  imported_at?: string;
  paused?: boolean;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  await dbConnect();
  const body = (await req.json()) as Body;
  const $set: Record<string, unknown> = {};

  if (typeof body.label === "string") {
    const trimmed = body.label.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "label vide" }, { status: 400 });
    }
    $set.label = trimmed;
  }
  if (typeof body.imported_at === "string") {
    const d = new Date(body.imported_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "date invalide" }, { status: 400 });
    }
    $set.imported_at = d;
  }
  if (typeof body.paused === "boolean") {
    $set.paused = body.paused;
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ error: "aucun champ" }, { status: 400 });
  }

  const updated = await ImportRun.findByIdAndUpdate(id, { $set }, { new: true }).lean();
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
