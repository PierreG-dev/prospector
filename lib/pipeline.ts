import type { PipelineStatus } from "@/lib/types";

export const PIPELINE_ORDER: PipelineStatus[] = [
  "a_contacter",
  "contacte",
  "rdv_pris",
  "client",
  "perdu",
];

export const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  a_contacter: "À contacter",
  contacte: "Contacté",
  rdv_pris: "RDV pris",
  client: "Client",
  perdu: "Perdu",
};

export const PIPELINE_TONE: Record<
  PipelineStatus,
  "accent" | "accent2" | "warn" | "neutral" | "danger"
> = {
  a_contacter: "neutral",
  contacte: "accent",
  rdv_pris: "warn",
  client: "accent2",
  perdu: "danger",
};

/** Cadence par défaut pour la 1ère relance après passage à `contacte` (en jours). */
export const RELANCE_FIRST_DELAY_DAYS = 3;

export function isPipelineAdvance(
  from: PipelineStatus | null,
  to: PipelineStatus
): boolean {
  // Toute transition depuis `contacte` vers autre chose qu'`a_contacter`
  // est considérée comme une avancée → coupe l'escalade.
  if (from === "contacte" && to !== "contacte" && to !== "a_contacter") return true;
  return false;
}
