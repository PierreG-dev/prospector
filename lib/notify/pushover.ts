/**
 * Client Pushover minimal (https://pushover.net/api).
 * - `fetch` natif, pas de SDK.
 * - Priorité 2 → REQUIERT `retry` ∈ [30, …] et `expire` ∈ [0, 10800].
 *   La réponse contient un `receipt` qu'on stocke pour le suivi d'accusé de réception.
 */

const ENDPOINT = "https://api.pushover.net/1/messages.json";
const TIMEOUT_MS = 8000;

export type Priority = -2 | -1 | 0 | 1 | 2;

export type PushoverInput = {
  title: string;
  message: string;
  url?: string | null;
  url_title?: string | null;
  priority?: Priority;
  /** requis si priority=2 ; cap à 30s minimum côté Pushover. */
  retry?: number;
  /** requis si priority=2 ; cap à 10800s (3h) max côté Pushover. */
  expire?: number;
};

export type PushoverResult =
  | { ok: true; receipt: string | null; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

export type PushoverCreds = { token: string; user: string };

/** Lit token+user depuis l'environnement. Erreur explicite si absent. */
export function getCredentials(): PushoverCreds | null {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) return null;
  return { token, user };
}

/**
 * Construit le body x-www-form-urlencoded à envoyer à Pushover.
 * Exposé pour les tests : pas d'I/O ici.
 */
export function buildBody(
  input: PushoverInput,
  creds: PushoverCreds
): URLSearchParams {
  const body = new URLSearchParams();
  body.set("token", creds.token);
  body.set("user", creds.user);
  body.set("title", truncate(input.title, 250));
  body.set("message", truncate(input.message, 1024));
  if (input.url) body.set("url", input.url);
  if (input.url_title) body.set("url_title", truncate(input.url_title, 100));
  const priority = input.priority ?? 0;
  body.set("priority", String(priority));

  if (priority === 2) {
    const retry = Math.max(30, Math.floor(input.retry ?? 60));
    const expire = Math.min(10800, Math.max(60, Math.floor(input.expire ?? 3600)));
    body.set("retry", String(retry));
    body.set("expire", String(expire));
  }
  return body;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Envoie un push. Best-effort : timeout, jamais d'exception ne sort —
 * on rend un résultat structuré que l'appelant log/stocke.
 */
export async function sendPushover(
  input: PushoverInput,
  credsOverride?: PushoverCreds
): Promise<PushoverResult> {
  const creds = credsOverride ?? getCredentials();
  if (!creds) {
    return {
      ok: false,
      error: "PUSHOVER_TOKEN ou PUSHOVER_USER absent de l'environnement",
    };
  }
  const body = buildBody(input, creds);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* corps non-JSON, on garde la status */
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `Pushover HTTP ${res.status}`,
        raw: data,
      };
    }
    const status = (data as { status?: number })?.status;
    if (status !== 1) {
      const errors = (data as { errors?: string[] })?.errors;
      return {
        ok: false,
        error: errors?.join(", ") ?? "Pushover status != 1",
        raw: data,
      };
    }
    const receipt = (data as { receipt?: string })?.receipt ?? null;
    return { ok: true, receipt, raw: data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
