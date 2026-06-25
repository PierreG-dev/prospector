/**
 * Faux dataset Apify pour tester l'import sans run réel.
 *
 *   npm run seed                          → écrit `seed-apify.json` (40 items)
 *   npm run seed -- --post                → fait POST /api/import (app doit tourner)
 *   npm run seed -- --count=80 --post     → 80 items + POST
 */

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ApifyRoot } from "@/lib/import/parse";

type Tpl = {
  trade: string;
  names: string[];
  category: string;
  categories?: string[];
};

const TEMPLATES: Tpl[] = [
  { trade: "plombier", category: "Plombier", names: ["Plomberie Durand", "SARL Aqua Service", "Plombier Toulousain", "Dépann'Plomb", "Sani'Pro"] },
  { trade: "chauffagiste", category: "Chauffagiste", names: ["Chauffage Confort", "Thermo Service", "Eco Chauffage"] },
  { trade: "electricien", category: "Électricien", names: ["Électricité Martin", "Volt'Up", "Néon Pro"] },
  { trade: "boulangerie", category: "Boulangerie", names: ["Boulangerie du Capitole", "Le Pain Doré", "Aux Délices d'Émile"] },
  { trade: "restaurant", category: "Restaurant", names: ["Bistrot des Halles", "Pizzeria Bella Storia", "Le Petit Gourmet", "Brasserie de la Place"] },
  { trade: "coiffeur", category: "Salon de coiffure", names: ["Salon Hairmony", "Coiffure & Vous", "L'Atelier du Coiffeur"] },
  { trade: "fleuriste", category: "Fleuriste", names: ["Fleurs & Sens", "L'Artisan Fleuriste", "Rose Garden"] },
  { trade: "garagiste", category: "Garage automobile", names: ["Garage Lefèvre", "Auto Méca 31", "Carrosserie Sud"] },
  { trade: "opticien", category: "Opticien", names: ["Optique Vision", "L'Atelier Lunettes"] },
  { trade: "kine", category: "Masseur-kinésithérapeute", names: ["Cabinet Kiné Caraman", "Kinésithérapie Rangueil"] },
];

const CITIES = [
  "Toulouse",
  "Blagnac",
  "Colomiers",
  "Tournefeuille",
  "Muret",
  "Cugnaux",
  "Balma",
  "Ramonville",
];

const STREETS = [
  "12 rue des Lilas",
  "3 avenue Jean Jaurès",
  "47 boulevard de Strasbourg",
  "8 place du Capitole",
  "22 rue Bayard",
  "5 chemin des Maraîchers",
  "18 rue de la République",
  "9 allée des Roses",
];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function frPhone(rng: () => number): string {
  const prefix = pick(["05 61", "05 62", "06 12", "06 78", "07 81"], rng);
  const rest = Array.from({ length: 4 }, () =>
    String(Math.floor(rng() * 100)).padStart(2, "0")
  ).join(" ");
  return `${prefix} ${rest}`;
}

function mapsUrlFor(id: number, name: string, city: string): string {
  const placeSlug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  const hex1 = (0x12d2880000000000n + BigInt(id * 7919)).toString(16);
  const hex2 = (0x0a000000000000n + BigInt(id * 104729)).toString(16);
  return `https://www.google.com/maps/place/${placeSlug}+${encodeURIComponent(city)}/@43.6,1.4,15z/data=!4m6!3m5!1s0x${hex1}:0x${hex2}!8m2!3d43.6!4d1.4`;
}

function maybe<T>(rng: () => number, p: number, v: T): T | undefined {
  return rng() < p ? v : undefined;
}

function makeItem(id: number, rng: () => number): ApifyRoot {
  const tpl = pick(TEMPLATES, rng);
  const name = pick(tpl.names, rng);
  const city = pick(CITIES, rng);
  const street = pick(STREETS, rng);

  const hasWebsite = rng() < 0.55;
  const sharedHosts = ["facebook.com", "pagesjaunes.fr", "sites.google.com"];
  const ownDomain = `${name.toLowerCase().replace(/[^a-z]+/g, "-")}.fr`;
  const website = hasWebsite
    ? rng() < 0.2
      ? `https://${pick(sharedHosts, rng)}/${name.replace(/\s+/g, "")}`
      : `https://www.${ownDomain}`
    : undefined;

  const reviewsCount = Math.floor(rng() * 280);
  const totalScore = Number((3.5 + rng() * 1.5).toFixed(1));

  return {
    title: name,
    totalScore,
    reviewsCount,
    street,
    city,
    state: null,
    countryCode: "FR",
    website,
    phone: maybe(rng, 0.92, frPhone(rng)) ?? "",
    categories: tpl.categories ?? [tpl.category],
    url: mapsUrlFor(id, name, city),
    categoryName: tpl.category,
  };
}

function parseArgs(argv: string[]) {
  const out: { count: number; post: boolean; out: string } = {
    count: 40,
    post: false,
    out: "seed-apify.json",
  };
  for (const a of argv) {
    if (a.startsWith("--count=")) out.count = Number(a.slice(8));
    else if (a === "--post") out.post = true;
    else if (a.startsWith("--out=")) out.out = a.slice(6);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(42);
  const items: ApifyRoot[] = Array.from({ length: args.count }, (_, i) =>
    makeItem(i, rng)
  );

  const outPath = resolve(process.cwd(), args.out);
  writeFileSync(outPath, JSON.stringify(items, null, 2), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`✓ ${items.length} items écrits → ${outPath}`);

  if (args.post) {
    const url = process.env.SEED_URL ?? "http://localhost:3000/api/import";
    // eslint-disable-next-line no-console
    console.log(`→ POST ${url}`);
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Seed", items }),
    });
    const data = await r.json();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(data, null, 2));
    if (!r.ok) process.exit(1);
  }

  if (!existsSync(outPath)) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
