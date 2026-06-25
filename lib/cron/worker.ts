import type cronType from "node-cron";
import { tickReminders } from "@/lib/reminders/engine";
import { pushDueReminders } from "@/lib/notify/processor";

// `__non_webpack_require__` est un identifiant magique : webpack le remplace
// par le `require` natif de Node sans analyser/bundler la cible.
// Évite que webpack tente de bundler `node-cron` (qui embarque
// `child_process.fork` et casse le build de l'instrumentation).
declare const __non_webpack_require__: NodeRequire;
const cron: typeof cronType = __non_webpack_require__("node-cron");

/**
 * Worker interne `node-cron`. Singleton via `globalThis` (HMR-safe).
 * Toutes les 15 minutes + une fois 10s après le démarrage.
 *
 * Désactivable via `DISABLE_INTERNAL_CRON=1` (utile en CI ou si tu pilotes
 * tout depuis le cron OS).
 *
 * Démarré depuis `instrumentation.ts` (hook serveur de Next).
 */

type CronState = {
  task: ReturnType<typeof cron.schedule> | null;
  started: boolean;
};

const g = globalThis as unknown as { _prospectorCron?: CronState };
g._prospectorCron ??= { task: null, started: false };

const SCHEDULE = "*/15 * * * *"; // toutes les 15 min

async function runOnce(): Promise<void> {
  const now = new Date();
  try {
    const tick = await tickReminders(now);
    const push = await pushDueReminders(now);
    // eslint-disable-next-line no-console
    console.log(
      `[cron] tick: ${tick.created} créées (${tick.candidates} candidats) · push: ${push.sent}/${push.scanned} envoyés${push.skipped_no_creds ? " (Pushover non configuré)" : ""}`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cron] erreur tick/push :", (e as Error).message);
  }
}

export function startWorker(): void {
  if (g._prospectorCron!.started) return;
  if (process.env.DISABLE_INTERNAL_CRON === "1") {
    // eslint-disable-next-line no-console
    console.log("[cron] désactivé (DISABLE_INTERNAL_CRON=1)");
    g._prospectorCron!.started = true;
    return;
  }
  if (!cron.validate(SCHEDULE)) return;

  g._prospectorCron!.task = cron.schedule(SCHEDULE, () => {
    void runOnce();
  });
  g._prospectorCron!.started = true;
  // eslint-disable-next-line no-console
  console.log(`[cron] worker démarré (${SCHEDULE})`);

  // Premier tick rapide 10s après le boot pour rattraper si redémarrage.
  setTimeout(() => void runOnce(), 10_000);
}
