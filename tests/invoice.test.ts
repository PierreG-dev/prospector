import { describe, expect, it } from "vitest";
import { INVOICES, getInvoiceEstimate, formatEur, unitLabel } from "@/lib/trade/invoice";
import type { TradeBucket } from "@/lib/trade/detect";

const ALL_BUCKETS: TradeBucket[] = [
  "plombier", "chauffagiste", "electricien", "garagiste", "menuisier", "macon",
  "couvreur", "peintre", "restaurant", "boulangerie", "boucherie", "coiffeur",
  "estheticienne", "fleuriste", "opticien", "kine", "dentiste", "veterinaire",
  "auto_ecole", "immobilier",
];

describe("invoice estimates", () => {
  it("couvre tous les TradeBucket connus", () => {
    for (const b of ALL_BUCKETS) {
      expect(INVOICES[b], `bucket ${b} manquant`).toBeDefined();
    }
  });

  it("respecte low ≤ typical ≤ high pour chaque bucket", () => {
    for (const b of ALL_BUCKETS) {
      const e = INVOICES[b];
      expect(e.low, `${b}.low`).toBeGreaterThan(0);
      expect(e.typical, `${b}.typical ≥ low`).toBeGreaterThanOrEqual(e.low);
      expect(e.high, `${b}.high ≥ typical`).toBeGreaterThanOrEqual(e.typical);
    }
  });

  it("getInvoiceEstimate(null) → null", () => {
    expect(getInvoiceEstimate(null)).toBeNull();
  });

  it("getInvoiceEstimate('electricien') retourne un objet cohérent", () => {
    const e = getInvoiceEstimate("electricien");
    expect(e).not.toBeNull();
    expect(e!.typical).toBe(500);
    expect(e!.unit).toBe("prestation");
  });

  it("formatEur produit un montant en euros formaté FR", () => {
    // Utilise   (NBSP) qui est le séparateur produit par Intl fr-FR.
    expect(formatEur(500)).toMatch(/500\s*€/);
    expect(formatEur(5000)).toMatch(/5\s*000\s*€/);
  });

  it("unitLabel mappe chaque unité vers un libellé lisible", () => {
    expect(unitLabel("ticket")).toBe("ticket moyen");
    expect(unitLabel("chantier")).toBe("par chantier");
    expect(unitLabel("prestation")).toBe("par prestation");
    expect(unitLabel("forfait")).toBe("forfait");
    expect(unitLabel("commission")).toBe("par vente");
  });
});
