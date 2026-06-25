import { NextResponse } from "next/server";
import { getSettings, updateSettings, type AppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSettings();
  const envStatus = {
    mongodb: Boolean(process.env.MONGODB_URI),
    pushover: Boolean(process.env.PUSHOVER_TOKEN && process.env.PUSHOVER_USER),
    cron_secret: Boolean(process.env.CRON_SECRET),
    internal_cron_disabled: process.env.DISABLE_INTERNAL_CRON === "1",
  };
  return NextResponse.json({ settings: s, env: envStatus });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<AppSettings>;
  try {
    const next = await updateSettings(body);
    return NextResponse.json({ settings: next });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
