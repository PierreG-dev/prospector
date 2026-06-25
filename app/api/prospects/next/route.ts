import { NextResponse } from "next/server";
import { pickNext, countQueue } from "@/lib/queue/pick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exclude = (url.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const now = new Date();
  const [candidate, remaining] = await Promise.all([
    pickNext(now, exclude),
    countQueue(now),
  ]);

  return NextResponse.json({
    candidate,
    remaining,
  });
}
