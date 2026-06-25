import { describe, expect, it } from "vitest";
import { rouletteIndex, combinedWeight } from "@/lib/queue/pick";

describe("rouletteIndex", () => {
  it("renvoie toujours un index dans [0, n[", () => {
    for (let i = 0; i < 100; i++) {
      const idx = rouletteIndex([1, 2, 3, 4]);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("favorise les poids forts (loi des grands nombres)", () => {
    const weights = [1, 0, 0, 99]; // l'index 3 doit gagner ~99% du temps
    let win = 0;
    for (let i = 0; i < 1000; i++) {
      if (rouletteIndex(weights) === 3) win++;
    }
    expect(win).toBeGreaterThan(900);
  });

  it("traite les poids négatifs comme zéro", () => {
    const idx = rouletteIndex([-10, 5]);
    // Sur 100 essais, idx==1 quasi tout le temps
    let win = 0;
    for (let i = 0; i < 200; i++) {
      if (rouletteIndex([-10, 5]) === 1) win++;
    }
    expect(win).toBeGreaterThan(190);
    expect([0, 1]).toContain(idx);
  });

  it("uniforme si tous poids nuls", () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      counts[rouletteIndex([0, 0, 0, 0])]++;
    }
    // chaque bucket doit recevoir ~1000 ± 200
    counts.forEach((c) => expect(c).toBeGreaterThan(700));
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
});
