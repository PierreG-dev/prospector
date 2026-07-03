import { describe, expect, it } from "vitest";
import {
  argmax,
  combinedWeight,
  freshnessBoost,
  invisibilityBoost,
  mobilePhoneBoost,
  profileGapBoost,
  type PickSignals,
} from "@/lib/queue/pick";

const NEUTRAL: PickSignals = {
  rank: null,
  latestReviewAt: null,
  gaps: 0,
  phoneE164: null,
};

function s(overrides: Partial<PickSignals>): PickSignals {
  return { ...NEUTRAL, ...overrides };
}

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

  it("signaux absents → boost neutre (rétrocompat)", () => {
    const now = new Date();
    expect(combinedWeight(40, null, now, NEUTRAL)).toBe(
      combinedWeight(40, null, now)
    );
  });

  it("rank élevé booste sans renverser un vrai gap de score", () => {
    const now = new Date();
    const noSiteTop = combinedWeight(65, null, now, s({ rank: 1 }));
    const trueSiteInvisible = combinedWeight(20, null, now, s({ rank: 20 }));
    expect(noSiteTop).toBeGreaterThan(trueSiteInvisible);
  });

  it("à score égal, rank plus élevé gagne", () => {
    const now = new Date();
    expect(
      combinedWeight(40, null, now, s({ rank: 18 }))
    ).toBeGreaterThan(combinedWeight(40, null, now, s({ rank: 2 })));
  });

  it("à score égal, signaux 'lead chaud' cumulés font gagner", () => {
    const now = new Date();
    const cold = combinedWeight(40, null, now, NEUTRAL);
    const hot = combinedWeight(
      40,
      null,
      now,
      s({
        rank: 15,
        latestReviewAt: new Date(now.getTime() - 10 * 86_400_000),
        gaps: 2,
        phoneE164: "+33612345678",
      })
    );
    expect(hot).toBeGreaterThan(cold);
  });

  it("un no-site actif reste devant un vrai-site inactif si score comparable", () => {
    const now = new Date();
    const noSiteActif = combinedWeight(65, null, now, s({ gaps: 1 }));
    const vraiSiteMort = combinedWeight(
      20,
      null,
      now,
      s({
        rank: 20,
        latestReviewAt: new Date(now.getTime() - 10 * 86_400_000),
        phoneE164: "+33612345678",
      })
    );
    // le score reste dominant : 65 vs 20 ne se renverse pas facilement
    expect(noSiteActif).toBeGreaterThan(vraiSiteMort * 0.7);
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

describe("freshnessBoost", () => {
  const now = new Date("2026-07-04T10:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it("null → neutre", () => {
    expect(freshnessBoost(null, now)).toBe(1);
  });

  it("date invalide → neutre", () => {
    expect(freshnessBoost(new Date("nope"), now)).toBe(1);
  });

  it("date future absurde → neutre", () => {
    expect(freshnessBoost(new Date(now.getTime() + 86_400_000), now)).toBe(1);
  });

  it("avis très récent → 1.35", () => {
    expect(freshnessBoost(daysAgo(10), now)).toBe(1.35);
  });

  it("avis 60j → 1.20", () => {
    expect(freshnessBoost(daysAgo(60), now)).toBe(1.20);
  });

  it("avis 150j → 1.10", () => {
    expect(freshnessBoost(daysAgo(150), now)).toBe(1.10);
  });

  it("business dormant (400j) → 0.90", () => {
    expect(freshnessBoost(daysAgo(400), now)).toBe(0.90);
  });

  it("monotonie décroissante avec l'âge", () => {
    expect(freshnessBoost(daysAgo(10), now)).toBeGreaterThan(
      freshnessBoost(daysAgo(100), now)
    );
    expect(freshnessBoost(daysAgo(100), now)).toBeGreaterThan(
      freshnessBoost(daysAgo(400), now)
    );
  });
});

describe("profileGapBoost", () => {
  it("0 trou → 1.0", () => expect(profileGapBoost(0)).toBe(1.0));
  it("1 trou → 1.10", () => expect(profileGapBoost(1)).toBe(1.10));
  it("2 trous → 1.25", () => expect(profileGapBoost(2)).toBe(1.25));
  it("3 trous → 1.40 (jackpot)", () => expect(profileGapBoost(3)).toBe(1.40));
  it("clamp au delà de 3", () => expect(profileGapBoost(10)).toBe(1.40));
  it("clamp sous 0", () => expect(profileGapBoost(-5)).toBe(1.0));
});

describe("mobilePhoneBoost", () => {
  it("null → 1", () => expect(mobilePhoneBoost(null)).toBe(1));
  it("mobile 06 FR → 1.15", () =>
    expect(mobilePhoneBoost("+33612345678")).toBe(1.15));
  it("mobile 07 FR → 1.15", () =>
    expect(mobilePhoneBoost("+33712345678")).toBe(1.15));
  it("fixe FR → 1", () => expect(mobilePhoneBoost("+33512345678")).toBe(1));
  it("format non-E164 → 1", () => expect(mobilePhoneBoost("0612345678")).toBe(1));
});
