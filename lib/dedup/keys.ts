import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getDomain } from "tldts";
import { slug } from "@/lib/text";

/**
 * Plateformes partagées : un même domaine ≠ même entreprise.
 * On les exclut de la clé `domain` (mais on garde `website_url` brut sur le prospect).
 */
const SHARED_PLATFORMS = new Set([
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linktr.ee",
  "linktree.com",
  "pagesjaunes.fr",
  "pages-jaunes.fr",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "wa.me",
  "whatsapp.com",
  "telegram.org",
  "t.me",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "g.page",
  "sites.google.com",
  "wixsite.com",
  "wix.com",
]);

/** Extrait le place_id d'une URL Google Maps. Plusieurs formats possibles. */
export function extractPlaceId(url: string | null | undefined): string | null {
  if (!url) return null;
  // 1) `?query_place_id=ChIJ...` (forme "search")
  const qpid = url.match(/[?&]query_place_id=([^&#]+)/i);
  if (qpid) return decodeURIComponent(qpid[1]);

  // 2) `?cid=12345...` (CID décimal)
  const cid = url.match(/[?&]cid=([0-9]+)/);
  if (cid) return `cid:${cid[1]}`;

  // 3) Forme "data=" : `!1s0x47ab…:0x6f…` — on prend le bloc hex après !1s
  const data = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (data) return data[1].toLowerCase();

  // 4) Forme "/place/.../@.../data=" sans !1s mais avec `!3m…!4b1!4m…` — pas de clé extractible
  return null;
}

/**
 * Normalise une URL Maps en clé stable :
 * - retire `@lat,lng,zoom`
 * - retire les paramètres volatils (entry, hl, gl, ved, etc.)
 * - garde la partie `/place/<slug>/` et le `data=` identifiant
 */
export function normalizeMapsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/google\./i.test(u.hostname)) return null;

    // Drop /@lat,lng,zoom segment in pathname
    const pathNoAt = u.pathname.replace(/\/@-?\d+\.?\d*,-?\d+\.?\d*,?[^/]*/g, "");

    // Keep only meaningful params
    const keep = new URLSearchParams();
    const qpid = u.searchParams.get("query_place_id");
    if (qpid) keep.set("query_place_id", qpid);
    const cid = u.searchParams.get("cid");
    if (cid) keep.set("cid", cid);

    const q = keep.toString();
    return `https://${u.hostname.toLowerCase()}${pathNoAt}${q ? "?" + q : ""}`;
  } catch {
    return null;
  }
}

/** Domaine enregistrable (lowercase, sans www, sans sous-domaine) ou null si plateforme partagée. */
export function registrableDomain(
  website: string | null | undefined
): string | null {
  if (!website) return null;
  let host = website;
  try {
    host = new URL(
      website.startsWith("http") ? website : `https://${website}`
    ).hostname;
  } catch {
    /* keep raw */
  }
  const d = getDomain(host)?.toLowerCase() ?? null;
  if (!d) return null;
  if (SHARED_PLATFORMS.has(d)) return null;
  return d;
}

/** Phone → E.164 (FR par défaut). Renvoie null si invalide. */
export function toE164(
  phone: string | null | undefined,
  defaultCountry: "FR" = "FR"
): string | null {
  if (!phone) return null;
  try {
    const p = parsePhoneNumberFromString(phone, defaultCountry);
    return p && p.isValid() ? p.number : null;
  } catch {
    return null;
  }
}

/** Clé faible : `slug(name)|slug(city)`. Null si name ou city manquant. */
export function namegeo(
  name: string | null | undefined,
  city: string | null | undefined
): string | null {
  const n = slug(name);
  const c = slug(city);
  if (!n || !c) return null;
  return `${n}|${c}`;
}

export type DedupKeys = {
  place_id: string | null;
  gmaps_url_norm: string | null;
  domain: string | null;
  phone_e164: string | null;
  namegeo: string | null;
};

export function computeKeys(input: {
  name?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  gmapsUrl?: string | null;
}): DedupKeys {
  return {
    place_id: extractPlaceId(input.gmapsUrl),
    gmaps_url_norm: normalizeMapsUrl(input.gmapsUrl),
    domain: registrableDomain(input.website),
    phone_e164: toE164(input.phone),
    namegeo: namegeo(input.name, input.city),
  };
}

export { SHARED_PLATFORMS };
