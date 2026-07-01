import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";
import { Reminder } from "@/models/Reminder";

export type ReminderRow = {
  _id: string;
  prospect_id: string;
  prospect_name: string;
  due_at: string;
  label: string | null;
  kind: "simple" | "relance" | "sequence_step";
  relance_index: number | null;
  priority: number;
};

export type ProspectRow = {
  _id: string;
  name: string;
  city: string | null;
  trade: string | null;
  pipeline_status: string | null;
  relance_count: number;
  relance_paused: boolean;
  last_status_at: string | null;
};

export type Buckets = {
  en_retard: ReminderRow[];
  aujourd_hui: ReminderRow[];
  cette_semaine: ReminderRow[];
  relances_epuisees: ProspectRow[];
  sans_prochaine_action: ProspectRow[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function fetchReminders(
  filter: Record<string, unknown>
): Promise<ReminderRow[]> {
  // On joint manuellement le nom du prospect — moins de complexité qu'une $lookup ici.
  const reminders = await Reminder.find(filter)
    .sort({ due_at: 1 })
    .lean();
  if (reminders.length === 0) return [];
  const ids = Array.from(new Set(reminders.map((r) => String(r.prospect_id))));
  const prospects = await Prospect.find({ _id: { $in: ids } })
    .select({ name: 1 })
    .lean();
  const byId = new Map(prospects.map((p) => [String(p._id), p.name as string]));
  return reminders.map((r) => ({
    _id: String(r._id),
    prospect_id: String(r.prospect_id),
    prospect_name: byId.get(String(r.prospect_id)) ?? "(prospect supprimé)",
    due_at: new Date(r.due_at).toISOString(),
    label: (r.label as string | null) ?? null,
    kind: (r.kind as ReminderRow["kind"]) ?? "simple",
    relance_index: (r.relance_index as number | null) ?? null,
    priority: Number(r.priority ?? 0),
  }));
}

export async function getBuckets(now: Date = new Date()): Promise<Buckets> {
  await dbConnect();

  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const endOfWeek = addDays(today, 7);

  const [
    enRetard,
    aujourdHui,
    cetteSemaine,
    epuiseesRaw,
    qualifiedActive,
    openReminderPids,
  ] = await Promise.all([
    fetchReminders({ done: false, due_at: { $lt: today } }),
    fetchReminders({ done: false, due_at: { $gte: today, $lt: tomorrow } }),
    fetchReminders({
      done: false,
      due_at: { $gte: tomorrow, $lt: endOfWeek },
    }),
    Prospect.find({
      lifecycle: "qualified",
      pipeline_status: "contacte",
      relance_paused: false,
      relance_count: { $gte: 3 },
    })
      .select({
        name: 1,
        city: 1,
        trade: 1,
        pipeline_status: 1,
        relance_count: 1,
        relance_paused: 1,
        last_status_at: 1,
      })
      .lean(),
    Prospect.find({
      lifecycle: "qualified",
      pipeline_status: { $nin: [null, "perdu", "client"] },
      relance_paused: { $ne: true },
    })
      .select({
        name: 1,
        city: 1,
        trade: 1,
        pipeline_status: 1,
        relance_count: 1,
        relance_paused: 1,
        last_status_at: 1,
      })
      .lean(),
    Reminder.distinct("prospect_id", { done: false }),
  ]);

  const openPidSet = new Set(
    (openReminderPids as unknown[]).map((x) => String(x))
  );
  const sansProchaine = (qualifiedActive ?? []).filter(
    (p) => !openPidSet.has(String(p._id))
  );

  const toRow = (p: Record<string, unknown>): ProspectRow => ({
    _id: String(p._id),
    name: String(p.name ?? ""),
    city: (p.city as string | null) ?? null,
    trade: (p.trade as string | null) ?? null,
    pipeline_status: (p.pipeline_status as string | null) ?? null,
    relance_count: Number(p.relance_count ?? 0),
    relance_paused: Boolean(p.relance_paused),
    last_status_at: p.last_status_at
      ? new Date(p.last_status_at as string).toISOString()
      : null,
  });

  return {
    en_retard: enRetard,
    aujourd_hui: aujourdHui,
    cette_semaine: cetteSemaine,
    relances_epuisees: epuiseesRaw.map(toRow),
    sans_prochaine_action: sansProchaine.map(toRow),
  };
}
