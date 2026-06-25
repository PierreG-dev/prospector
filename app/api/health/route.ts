import { NextResponse } from "next/server";
import { dbPing } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const mongo = await dbPing();
  return NextResponse.json({ mongo, ts: Date.now() });
}
