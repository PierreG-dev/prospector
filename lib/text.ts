/** Lowercase + strip accents + collapse whitespace. */
export function normalize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** URL-safe slug (a-z 0-9 with single dashes). */
export function slug(input: string | null | undefined): string {
  return normalize(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
