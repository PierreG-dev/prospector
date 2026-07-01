import type { TradeBucket } from "./detect";

export type InvoiceEstimate = {
  low: number;
  high: number;
  typical: number;
  unit: "ticket" | "chantier" | "prestation" | "forfait" | "commission";
  note?: string;
};

const INVOICES: Record<TradeBucket, InvoiceEstimate> = {
  plombier:     { low: 150,  high: 1500,  typical: 350,  unit: "prestation", note: "dépannage ~250€, installation 1000€+" },
  chauffagiste: { low: 200,  high: 5000,  typical: 800,  unit: "prestation", note: "entretien 150€, chaudière 3–5k€" },
  electricien:  { low: 200,  high: 3000,  typical: 500,  unit: "prestation", note: "dépannage 200–500€, rénovation 2k€+" },
  couvreur:     { low: 1500, high: 15000, typical: 5000, unit: "chantier",   note: "réfection toiture" },
  menuisier:    { low: 500,  high: 5000,  typical: 1500, unit: "chantier",   note: "porte/fenêtre pose incluse" },
  macon:        { low: 1500, high: 20000, typical: 5000, unit: "chantier",   note: "gros œuvre / extension" },
  peintre:      { low: 800,  high: 5000,  typical: 2500, unit: "chantier",   note: "pièce à appartement complet" },
  garagiste:    { low: 150,  high: 1200,  typical: 400,  unit: "prestation", note: "révision + petites réparations" },
  auto_ecole:   { low: 1200, high: 2000,  typical: 1500, unit: "forfait",    note: "permis B forfait complet" },

  restaurant:   { low: 18,   high: 60,    typical: 30,   unit: "ticket" },
  boulangerie:  { low: 3,    high: 15,    typical: 7,    unit: "ticket" },
  boucherie:    { low: 12,   high: 40,    typical: 22,   unit: "ticket" },

  coiffeur:      { low: 20,  high: 80,    typical: 40,   unit: "prestation" },
  estheticienne: { low: 30,  high: 120,   typical: 60,   unit: "prestation" },
  fleuriste:     { low: 15,  high: 60,    typical: 30,   unit: "ticket" },

  opticien:     { low: 150,  high: 600,   typical: 350,  unit: "prestation", note: "monture + verres" },
  kine:         { low: 20,   high: 40,    typical: 25,   unit: "prestation", note: "séance conventionnée" },
  dentiste:     { low: 25,   high: 1500,  typical: 150,  unit: "prestation", note: "consult vs prothèses/implants" },
  veterinaire:  { low: 40,   high: 300,   typical: 90,   unit: "prestation", note: "consultation + soins" },

  immobilier:   { low: 3000, high: 20000, typical: 8000, unit: "commission", note: "commission par vente ~5% du bien" },
};

const UNIT_LABEL: Record<InvoiceEstimate["unit"], string> = {
  ticket: "ticket moyen",
  chantier: "par chantier",
  prestation: "par prestation",
  forfait: "forfait",
  commission: "par vente",
};

export function getInvoiceEstimate(bucket: TradeBucket | null): InvoiceEstimate | null {
  if (!bucket) return null;
  return INVOICES[bucket] ?? null;
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function unitLabel(u: InvoiceEstimate["unit"]): string {
  return UNIT_LABEL[u];
}

export { INVOICES };
