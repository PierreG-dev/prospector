import { NextResponse } from "next/server";
import { runImport } from "@/lib/import/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";

  let label = "Import";
  let rawJson: string | null = null;
  let source_file: string | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    label = String(form.get("label") ?? "Import");
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier reçu (champ `file`)." },
        { status: 400 }
      );
    }
    rawJson = await f.text();
    source_file = f.name;
  } else if (ct.includes("application/json")) {
    const body = (await req.json()) as { label?: string; items?: unknown };
    label = String(body.label ?? "Import");
    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "Body JSON doit contenir `items` (tableau)." },
        { status: 400 }
      );
    }
    rawJson = JSON.stringify(body.items);
  } else {
    return NextResponse.json(
      { error: "Content-Type non supporté (multipart/form-data ou application/json)." },
      { status: 415 }
    );
  }

  try {
    const result = await runImport(rawJson, { label, source_file });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
