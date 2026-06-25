import { dbConnect } from "@/lib/db";
import { Settings } from "@/models/Settings";

export type AppSettings = {
  relance_delays: [number, number, number];
  auto_perdu: boolean;
};

const DEFAULTS: AppSettings = {
  relance_delays: [3, 7, 14],
  auto_perdu: false,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    await dbConnect();
    const doc = await Settings.findById("singleton").lean();
    if (!doc) return DEFAULTS;
    const d = doc as { relance_delays?: number[]; auto_perdu?: boolean };
    const delays = d.relance_delays;
    const norm: [number, number, number] =
      Array.isArray(delays) && delays.length === 3
        ? [delays[0]!, delays[1]!, delays[2]!]
        : DEFAULTS.relance_delays;
    return {
      relance_delays: norm,
      auto_perdu: Boolean(d.auto_perdu ?? DEFAULTS.auto_perdu),
    };
  } catch {
    return DEFAULTS;
  }
}

export async function updateSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  await dbConnect();
  const set: Record<string, unknown> = {};
  if (patch.relance_delays) {
    if (
      patch.relance_delays.length !== 3 ||
      patch.relance_delays.some((n) => !Number.isFinite(n) || n < 0)
    ) {
      throw new Error("relance_delays doit être 3 entiers ≥ 0");
    }
    set.relance_delays = patch.relance_delays;
  }
  if (typeof patch.auto_perdu === "boolean") {
    set.auto_perdu = patch.auto_perdu;
  }
  await Settings.updateOne(
    { _id: "singleton" },
    { $set: set, $setOnInsert: { _id: "singleton" } },
    { upsert: true }
  );
  return getSettings();
}

export { DEFAULTS as DEFAULT_SETTINGS };
