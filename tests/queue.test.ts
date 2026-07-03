import { describe, expect, it } from "vitest";
import { argmax, combinedWeight, invisibilityBoost } from "@/lib/queue/pick";

describe("argmax", () => {
  it("retourne l'index du poids maximal", () => {
    expect(argmax([1, 2, 3, 4])).toBe(3);
    expect(argmax([10, 2, 8])).toBe(0);
    expect(argmax([0, 99, 0])).toBe(1);
  });

  it("en cas d'égalité, prend le premier", () => {
    expect(argmax([5, 5, 5])).toBe(0);
  });

  it("fonctionne avec des poids négatifs (prend le moins négatif)", () => {
    expect(argmax([-3, -1, -5])).toBe(1);
  });

  it("fonctionne avec un seul élément", () => {
    expect(argmax([42])).toBe(0);
  });
});

describe("combinedWeight", () => {
  it("exclut les scores nuls ou négatifs (poids = 0)", () => {
    const now = new Date();
    expect(combinedWeight(0, "plombier", now)).toBe(0);
    expect(combinedWeight(-5, "plombier", now)).toBe(0);
  });

  it("trade null → poids 0.5 (multiplié par le score)", () => {
    const w = combinedWeight(40, null, new Date());
    expect(w).toBe(40 * 0.5);
  });

  it("rank null → boost neutre (rétrocompat imports sans champ rank)", () => {
    const now = new Date();
    expect(combinedWeight(40, null, now, null)).toBe(combinedWeight(40, null, now));
  });

  it("rank élevé booste sans renverser un vrai gap de score", () => {
    const now = new Date();
    // no-site score 65, rank 1 (top Google) vs vrai-site score 20, rank 20 (invisible)
    const noSiteTop = combinedWeight(65, null, now, 1);
    const trueSiteInvisible = combinedWeight(20, null, now, 20);
    expect(noSiteTop).toBeGreaterThan(trueSiteInvisible);
  });

  it("à score égal, rank plus élevé gagne", () => {
    const now = new Date();
    const rankLow = combinedWeight(40, null, now, 2);
    const rankHigh = combinedWeight(40, null, now, 18);
    expect(rankHigh).toBeGreaterThan(rankLow);
  });
});

describe("invisibilityBoost", () => {
  it("null ou rank invalide → 1 (neutre)", () => {
    expect(invisibilityBoost(null)).toBe(1);
    expect(invisibilityBoost(0)).toBe(1);
    expect(invisibilityBoost(-3)).toBe(1);
  });

  it("rank=5 → 1 (pivot)", () => {
    expect(invisibilityBoost(5)).toBe(1);
  });

  it("plancher 0.75 pour les tops Google", () => {
    expect(invisibilityBoost(1)).toBeCloseTo(0.76, 2);
    // Rien ne descend en dessous de 0.75 (rank >= 1 par contrat)
  });

  it("plafond 1.75 pour les très invisibles", () => {
    expect(invisibilityBoost(20)).toBe(1.75);
    expect(invisibilityBoost(50)).toBe(1.75);
  });

  it("monotonie croissante", () => {
    expect(invisibilityBoost(3)).toBeLessThan(invisibilityBoost(8));
    expect(invisibilityBoost(8)).toBeLessThan(invisibilityBoost(15));
  });
});
