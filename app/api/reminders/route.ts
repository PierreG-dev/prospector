import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Reminder } from "@/models/Reminder";
import { Prospect } from "@/models/Prospect";
import { getBuckets } from "@/lib/reminders/buckets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prospect_id = url.searchParams.get("prospect_id");
  await dbConnect();

  if (prospect_id) {
    const items = await Reminder.find({ prospect_id, done: false })
      .sort({ due_at: 1 })
      .lean();
    return NextResponse.json({
      items: items.map((r) => ({
        ...r,
        _id: String(r._id),
        prospect_id: String(r.prospect_id),
      })),
    });
  }

  const buckets = await getBuckets(new Date());
  return NextResponse.json(buckets);
}

type CreateBody = {
  prospect_id: string;
  due_at: string;
  label?: string;
  kind?: "simple" | "relance" | "sequence_step";
  priority?: number;
};

export async function POST(req: Request) {
  await dbConnect();
  const body = (await req.json()) as CreateBody;

  if (!body.prospect_id || !body.due_at) {
    return NextResponse.json(
      { error: "prospect_id et due_at requis" },
      { status: 400 }
    );
  }
  const due = new Date(body.due_at);
  if (Number.isNaN(due.getTime())) {
    return NextResponse.json({ error: "due_at invalide" }, { status: 400 });
  }

  const exists = await Prospect.exists({ _id: body.prospect_id });
  if (!exists) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  const r = await Reminder.create({
    prospect_id: body.prospect_id,
    due_at: due,
    label: body.label?.trim() || null,
    kind: body.kind ?? "simple",
    priority: body.priority ?? 0,
  });

  return NextResponse.json({
    ...r.toObject(),
    _id: String(r._id),
    prospect_id: String(r.prospect_id),
  });
}
