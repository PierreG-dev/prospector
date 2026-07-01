import { describe, expect, it } from "vitest";
import { argmax, combinedWeight } from "@/lib/queue/pick";

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
});
