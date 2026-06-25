import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { Reminder } from "@/models/Reminder";
import { sendPushover, type Priority, getCredentials } from "./pushover";

export type PushResult = {
  scanned: number;
  sent: number;
  failed: number;
  skipped_no_creds: boolean;
};

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.BASE_URL ??
    "http://localhost:3000"
  );
}

function buildTitle(args: {
  kind: string;
  relance_index: number | null;
  prospectName: string;
}): string {
  if (args.kind === "relance" && args.relance_index) {
    return `Relance ${args.relance_index}/3 — ${args.prospectName}`;
  }
  return `Rappel — ${args.prospectName}`;
}

function buildMessage(args: {
  label: string | null;
  city: string | null;
  trade: string | null;
  due_at: Date;
}): string {
  const parts: string[] = [];
  if (args.label) parts.push(args.label);
  const ctx: string[] = [];
  if (args.trade) ctx.push(args.trade);
  if (args.city) ctx.push(args.city);
  if (ctx.length) parts.push(ctx.join(" · "));
  parts.push(
    `Échéance : ${new Date(args.due_at).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}`
  );
  return parts.join("\n");
}

/**
 * Envoie un push Pushover pour chaque Reminder dû non encore notifié.
 * - `notified_at=null` filtre = anti-doublon.
 * - sur succès : `notified_at=now` + `push_receipt` si priority 2.
 * - sur échec : on laisse `notified_at=null` → réessaie au prochain tick.
 *
 * À appeler après `tickReminders` dans la route cron.
 */
export async function pushDueReminders(
  now: Date = new Date()
): Promise<PushResult> {
  await dbConnect();

  const creds = getCredentials();
  if (!creds) {
    return { scanned: 0, sent: 0, failed: 0, skipped_no_creds: true };
  }

  const reminders = await Reminder.find({
    done: false,
    notified_at: null,
    due_at: { $lte: now },
  }).lean();

  if (reminders.length === 0) {
    return { scanned: 0, sent: 0, failed: 0, skipped_no_creds: false };
  }

  const pids = Array.from(new Set(reminders.map((r) => String(r.prospect_id))));
  const prospects = await Prospect.find({ _id: { $in: pids } })
    .select({ name: 1, city: 1, trade: 1 })
    .lean();
  const byId = new Map(prospects.map((p) => [String(p._id), p]));

  let sent = 0;
  let failed = 0;

  for (const r of reminders) {
    const p = byId.get(String(r.prospect_id));
    if (!p) {
      failed += 1;
      continue;
    }
    const priority = clampPriority(Number(r.priority ?? 0));
    const result = await sendPushover(
      {
        title: buildTitle({
          kind: String(r.kind ?? "simple"),
          relance_index: (r.relance_index as number | null) ?? null,
          prospectName: String(p.name ?? "prospect"),
        }),
        message: buildMessage({
          label: (r.label as string | null) ?? null,
          city: (p.city as string | null) ?? null,
          trade: (p.trade as string | null) ?? null,
          due_at: new Date(r.due_at),
        }),
        url: `${baseUrl()}/crm/${String(r.prospect_id)}`,
        url_title: "Ouvrir la fiche",
        priority,
      },
      creds
    );

    if (result.ok) {
      await Reminder.updateOne(
        { _id: r._id },
        {
          $set: {
            notified_at: now,
            push_receipt: result.receipt ?? null,
          },
        }
      );
      sent += 1;
    } else {
      failed += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[pushover] échec rappel ${String(r._id)} : ${result.error}`
      );
    }
  }

  return {
    scanned: reminders.length,
    sent,
    failed,
    skipped_no_creds: false,
  };
}

function clampPriority(p: number): Priority {
  if (p <= -2) return -2;
  if (p === -1) return -1;
  if (p === 1) return 1;
  if (p >= 2) return 2;
  return 0;
}

export { buildTitle, buildMessage };
