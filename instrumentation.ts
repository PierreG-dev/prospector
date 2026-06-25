/**
 * Hook serveur Next.js — appelé une fois au boot.
 * Démarre le worker `node-cron` interne (singleton, HMR-safe).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWorker } = await import("./lib/cron/worker");
  startWorker();
}
