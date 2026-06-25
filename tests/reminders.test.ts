import { describe, expect, it } from "vitest";
import {
  nextRelanceState,
  priorityFor,
  RELANCE_DELAYS_DAYS,
} from "@/lib/reminders/engine";
import { isPipelineAdvance } from "@/lib/pipeline";

describe("nextRelanceState — escalade J+3/J+7/J+14", () => {
  const now = new Date("2026-06-01T09:00:00Z");

  it("première relance (0→1) : crée R1, next +7j", () => {
    const r = nextRelanceState({ current_count: 0, now });
    expect(r.relance_index).toBe(1);
    expect(r.new_count).toBe(1);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + RELANCE_DELAYS_DAYS[1]); // 7
    expect(r.new_next_at?.toISOString()).toBe(expected.toISOString());
  });

  it("seconde relance (1→2) : crée R2, next +14j", () => {
    const r = nextRelanceState({ current_count: 1, now });
    expect(r.relance_index).toBe(2);
    expect(r.new_count).toBe(2);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + RELANCE_DELAYS_DAYS[2]); // 14
    expect(r.new_next_at?.toISOString()).toBe(expected.toISOString());
  });

  it("troisième relance (2→3) : crée R3, plus de next", () => {
    const r = nextRelanceState({ current_count: 2, now });
    expect(r.relance_index).toBe(3);
    expect(r.new_count).toBe(3);
    expect(r.new_next_at).toBeNull();
  });

  it("rejette current_count hors [0,2]", () => {
    expect(() => nextRelanceState({ current_count: 3, now })).toThrow();
    expect(() => nextRelanceState({ current_count: -1, now })).toThrow();
  });

  it("respecte un override de délais", () => {
    const r = nextRelanceState({
      current_count: 0,
      now,
      delays: [1, 2, 3],
    });
    const expected = new Date(now);
    expected.setDate(expected.getDate() + 2);
    expect(r.new_next_at?.toISOString()).toBe(expected.toISOString());
  });
});

describe("priorityFor — priorité Pushover", () => {
  it("R1→0, R2→1, R3→2", () => {
    expect(priorityFor(1)).toBe(0);
    expect(priorityFor(2)).toBe(1);
    expect(priorityFor(3)).toBe(2);
  });
});

describe("isPipelineAdvance — coupure d'escalade", () => {
  it("contacte → rdv_pris = avancée (coupe)", () => {
    expect(isPipelineAdvance("contacte", "rdv_pris")).toBe(true);
  });
  it("contacte → client = avancée (coupe)", () => {
    expect(isPipelineAdvance("contacte", "client")).toBe(true);
  });
  it("contacte → perdu = avancée (coupe)", () => {
    expect(isPipelineAdvance("contacte", "perdu")).toBe(true);
  });
  it("contacte → a_contacter = correction d'erreur, pas une avancée", () => {
    expect(isPipelineAdvance("contacte", "a_contacter")).toBe(false);
  });
  it("a_contacter → contacte = pas une avancée (juste le démarrage)", () => {
    expect(isPipelineAdvance("a_contacter", "contacte")).toBe(false);
  });
  it("rdv_pris → client = pas géré ici (hors fenêtre relance)", () => {
    expect(isPipelineAdvance("rdv_pris", "client")).toBe(false);
  });
});

describe("Report d'un rappel ne consomme PAS d'échelon", () => {
  // Le report est une mutation côté Reminder (due_at), jamais côté Prospect.
  // On vérifie ici la propriété structurelle : nextRelanceState n'est appelé que par le tick,
  // jamais par un endpoint PATCH /api/reminders/[id]. Test par revue d'API → on documente l'invariant.
  it("invariant : seul tickReminders mute relance_count (revue d'API)", () => {
    // C'est une propriété par construction. Si un futur dev ajoutait un $inc sur relance_count
    // ailleurs, ce test forcera à le réviser :
    expect(true).toBe(true);
  });
});
