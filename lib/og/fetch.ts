import { dbConnect } from "@/lib/db";
import { Prospect } from "@/models/Prospect";

export type OgData = {
  title: string | null;
  description: string | null;
  image: string | null;
  fetched_at: Date;
};

const TIMEOUT_MS = 3500;
const MAX_BYTES = 200_000; // 200 ko = largement assez pour le <head>
const STALE_DAYS = 30;
const USER_AGENT =
  "Mozilla/5.0 (compatible; Prospector/0.1; +https://github.com/godino)";

const META_RE =
  /<meta\s+[^>]*?(?:property|name)=["']\s*(og:[a-z:]+|twitter:[a-z:]+|description)\s*["'][^>]*?content=["']([^"']*)["'][^>]*>/gi;
const META_RE_REV =
  /<meta\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']\s*(og:[a-z:]+|twitter:[a-z:]+|description)\s*["'][^>]*>/gi;
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;

/**
 * Lit le <head> et extrait les meta OG/Twitter + <title>.
 * - timeout dur de 3.5s
 * - lecture cap à 200 ko (on streame, on coupe au premier </head>)
 * - aucune erreur n'est propagée — null en cas de problème
 */
export async function fetchOg(pageUrl: string): Promise<OgData | null> {
  if (!pageUrl) return null;
  let absolute = pageUrl;
  if (!/^https?:\/\//i.test(absolute)) absolute = `https://${absolute}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(absolute, {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr,en;q=0.7",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok || !res.body) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;

    // Lecture streamée, on s'arrête à </head> ou MAX_BYTES
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let html = "";
    let total = 0;
    while (total < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    try {
      reader.cancel();
    } catch {
      /* noop */
    }

    return parseOg(html, res.url || absolute);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseOg(html: string, baseUrl: string): OgData {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html;
  const collected: Record<string, string> = {};
  for (const re of [META_RE, META_RE_REV]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(head)) !== null) {
      const key = (re === META_RE ? m[1] : m[2]).toLowerCase();
      const val = re === META_RE ? m[2] : m[1];
      if (!collected[key]) collected[key] = decodeEntities(val.trim());
    }
  }

  const title =
    collected["og:title"] ??
    collected["twitter:title"] ??
    (head.match(TITLE_RE)?.[1]?.trim() ?? null);
  const description =
    collected["og:description"] ??
    collected["twitter:description"] ??
    collected["description"] ??
    null;
  const rawImage = collected["og:image"] ?? collected["twitter:image"] ?? null;
  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(rawImage, baseUrl).toString();
    } catch {
      image = null;
    }
  }
  return {
    title: title ? truncate(title, 200) : null,
    description: description ? truncate(description, 400) : null,
    image,
    fetched_at: new Date(),
  };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Rafraîchit l'OG d'un prospect en arrière-plan, idempotent.
 * À appeler fire-and-forget après création (et au besoin manuel).
 */
export async function refreshOgForProspect(prospectId: string): Promise<void> {
  await dbConnect();
  const p = await Prospect.findById(prospectId)
    .select({ website_url: 1, og: 1 })
    .lean();
  if (!p?.website_url) return;
  if (isFresh(p.og?.fetched_at)) return;

  const og = await fetchOg(p.website_url);
  if (!og) return;
  await Prospect.updateOne({ _id: prospectId }, { $set: { og } });
}

function isFresh(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < STALE_DAYS * 86400_000;
}
