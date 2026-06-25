import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const body = (await req.json()) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "body vide" }, { status: 400 });
  }
  const res = await Prospect.updateOne(
    { _id: id },
    {
      $push: {
        notes: { body: text, created_at: new Date() },
      },
    }
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
