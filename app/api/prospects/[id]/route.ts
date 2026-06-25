import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const p = await Prospect.findById(id).select({ raw: 0 }).lean();
  if (!p) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ...p, _id: String((p as { _id: unknown })._id) });
}
