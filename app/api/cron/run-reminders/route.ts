import { NextResponse } from "next/server";
import { tickReminders } from "@/lib/reminders/engine";
import { pushDueReminders } from "@/lib/notify/processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Route appelée par le cron OS (Tâches planifiées Windows / crontab).
 * Protégée par `Authorization: Bearer <CRON_SECRET>`.
 *
 * Séquence :
 *   1. tickReminders → crée les Reminders dus pour les escalades
 *   2. pushDueReminders → envoie les pushs Pushover non encore notifiés
 *
 * Idempotent : ré-appelée sans avancer l'horloge, ne fait rien de nouveau.
 */
async function run(): Promise<unknown> {
  const now = new Date();
  const tick = await tickReminders(now);
  const push = await pushDueReminders(now);
  return { ok: true, tick, push };
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await run();
  return NextResponse.json(res);
}

// Pratique : on accepte aussi GET pour curl/cron OS.
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await run();
  return NextResponse.json(res);
}
