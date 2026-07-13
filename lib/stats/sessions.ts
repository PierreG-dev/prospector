import { Prospect } from "@/models/Prospect";

export type StatsRange = "7d" | "30d" | "all";

export type TriAction = "qualify" | "reject" | "snooze";

export type StatsBucket = {
  dow: number; // 1 (Lun) → 7 (Dim), local Europe/Paris
  hour: number; // 0-23, local Europe/Paris
  total: number;
  qualify: number;
  reject: number;
  snooze: number;
};

export type StatsMarginal = {
  key: number;
  total: number;
  qualify: number;
  qualify_rate: number;
};

export type StatsResult = {
  range: StatsRange;
  from: string | null;
  to: string;
  total: number;
  qualify: number;
  qualify_rate: number;
  buckets: StatsBucket[];
  by_dow: StatsMarginal[]; // clé 1-7 (Lun-Dim)
  by_hour: StatsMarginal[]; // clé 0-23
  best_slot: { dow: number; hour: number; total: number } | null;
};

const TZ = "Europe/Paris";

const PARTS_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour12: false,
  weekday: "short",
  hour: "2-digit",
});

// Intl weekday short → dow (1=Lun … 7=Dim)
const WEEKDAY_TO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function toParisParts(date: Date): { dow: number; hour: number } {
  const parts = PARTS_FMT.formatToParts(date);
  let weekday = "";
  let hourStr = "0";
  for (const p of parts) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "hour") hourStr = p.value;
  }
  const dow = WEEKDAY_TO_DOW[weekday] ?? 1;
  const hour = Number(hourStr) % 24; // "24" en fin de journée dans certaines locales
  return { dow, hour };
}

export type TriEvent = { to: TriAction; created_at: Date };

/**
 * Regroupe des événements de tri en heatmap dow×hour (Europe/Paris).
 * Fonction pure — testable sans DB.
 */
export function bucketize(events: TriEvent[]): {
  buckets: StatsBucket[];
  by_dow: StatsMarginal[];
  by_hour: StatsMarginal[];
  total: number;
  qualify: number;
  best_slot: { dow: number; hour: number; total: number } | null;
} {
  const map = new Map<string, StatsBucket>();
  const dowTotals = new Map<number, { total: number; qualify: number }>();
  const hourTotals = new Map<number, { total: number; qualify: number }>();
  let total = 0;
  let qualify = 0;

  for (const e of events) {
    const { dow, hour } = toParisParts(e.created_at);
    const key = `${dow}-${hour}`;
    let b = map.get(key);
    if (!b) {
      b = { dow, hour, total: 0, qualify: 0, reject: 0, snooze: 0 };
      map.set(key, b);
    }
    b.total++;
    if (e.to === "qualify") b.qualify++;
    else if (e.to === "reject") b.reject++;
    else if (e.to === "snooze") b.snooze++;
    total++;
    if (e.to === "qualify") qualify++;

    const d = dowTotals.get(dow) ?? { total: 0, qualify: 0 };
    d.total++;
    if (e.to === "qualify") d.qualify++;
    dowTotals.set(dow, d);

    const h = hourTotals.get(hour) ?? { total: 0, qualify: 0 };
    h.total++;
    if (e.to === "qualify") h.qualify++;
    hourTotals.set(hour, h);
  }

  const buckets = Array.from(map.values()).sort(
    (a, b) => a.dow - b.dow || a.hour - b.hour
  );

  const by_dow: StatsMarginal[] = [];
  for (let d = 1; d <= 7; d++) {
    const v = dowTotals.get(d) ?? { total: 0, qualify: 0 };
    by_dow.push({
      key: d,
      total: v.total,
      qualify: v.qualify,
      qualify_rate: v.total > 0 ? v.qualify / v.total : 0,
    });
  }
  const by_hour: StatsMarginal[] = [];
  for (let h = 0; h < 24; h++) {
    const v = hourTotals.get(h) ?? { total: 0, qualify: 0 };
    by_hour.push({
      key: h,
      total: v.total,
      qualify: v.qualify,
      qualify_rate: v.total > 0 ? v.qualify / v.total : 0,
    });
  }

  let best_slot: { dow: number; hour: number; total: number } | null = null;
  for (const b of buckets) {
    if (!best_slot || b.total > best_slot.total) {
      best_slot = { dow: b.dow, hour: b.hour, total: b.total };
    }
  }

  return { buckets, by_dow, by_hour, total, qualify, best_slot };
}

function rangeStart(range: StatsRange, now: Date): Date | null {
  if (range === "all") return null;
  const d = new Date(now);
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  return d;
}

export async function getSessionStats(
  range: StatsRange,
  now: Date = new Date()
): Promise<StatsResult> {
  const from = rangeStart(range, now);

  const match: Record<string, unknown> = {
    "status_history.to": { $in: ["qualify", "reject", "snooze"] },
  };
  if (from) {
    match["status_history.created_at"] = { $gte: from };
  }

  const rows = await Prospect.aggregate<{ to: TriAction; created_at: Date }>([
    { $unwind: "$status_history" },
    { $match: match },
    {
      $project: {
        _id: 0,
        to: "$status_history.to",
        created_at: "$status_history.created_at",
      },
    },
  ]);

  const events: TriEvent[] = rows.map((r) => ({
    to: r.to,
    created_at: new Date(r.created_at),
  }));

  const agg = bucketize(events);

  return {
    range,
    from: from ? from.toISOString() : null,
    to: now.toISOString(),
    total: agg.total,
    qualify: agg.qualify,
    qualify_rate: agg.total > 0 ? agg.qualify / agg.total : 0,
    buckets: agg.buckets,
    by_dow: agg.by_dow,
    by_hour: agg.by_hour,
    best_slot: agg.best_slot,
  };
}
