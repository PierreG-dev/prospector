import { NextResponse } from "next/server";
import { tickReminders } from "@/lib/reminders/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Déclenche un tick manuellement (pratique pour debug / tests E2E).
 * En prod, c'est `app/api/cron/run-reminders` (protégé par CRON_SECRET) qui appelle
 * le tick + le push Pushover — Lot 7.
 */
export async function POST() {
  const res = await tickReminders(new Date());
  return NextResponse.json(res);
}
