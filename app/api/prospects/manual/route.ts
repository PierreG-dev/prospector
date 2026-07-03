import { NextResponse } from "next/server";
import { createManualProspect, type ManualInput } from "@/lib/import/manual";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<ManualInput>;
  try {
    body = (await req.json()) as Partial<ManualInput>;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
  }

  try {
    const result = await createManualProspect(body as ManualInput);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
