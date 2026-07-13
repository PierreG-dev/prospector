import { describe, expect, it } from "vitest";
import { bucketize, toParisParts, type TriEvent } from "@/lib/stats/sessions";

describe("toParisParts — timezone Europe/Paris", () => {
  it("mardi 10h Paris en hiver (UTC+1)", () => {
    // 2026-01-06 09:00 UTC = mardi 10:00 Paris (CET)
    const d = new Date("2026-01-06T09:00:00Z");
    expect(toParisParts(d)).toEqual({ dow: 2, hour: 10 });
  });

  it("mardi 10h Paris en été (UTC+2, DST)", () => {
    // 2026-07-07 08:00 UTC = mardi 10:00 Paris (CEST)
    const d = new Date("2026-07-07T08:00:00Z");
    expect(toParisParts(d)).toEqual({ dow: 2, hour: 10 });
  });

  it("dimanche = 7", () => {
    // 2026-01-11 12:00 UTC = dimanche 13h Paris
    const d = new Date("2026-01-11T12:00:00Z");
    expect(toParisParts(d)).toEqual({ dow: 7, hour: 13 });
  });

  it("passage minuit Paris", () => {
    // 2026-01-06 23:30 UTC = mercredi 00:30 Paris (hiver)
    const d = new Date("2026-01-06T23:30:00Z");
    expect(toParisParts(d)).toEqual({ dow: 3, hour: 0 });
  });
});

describe("bucketize", () => {
  const evts: TriEvent[] = [
    { to: "qualify", created_at: new Date("2026-01-06T09:00:00Z") }, // Mar 10h
    { to: "qualify", created_at: new Date("2026-01-06T09:30:00Z") }, // Mar 10h
    { to: "reject", created_at: new Date("2026-01-06T09:45:00Z") }, // Mar 10h
    { to: "snooze", created_at: new Date("2026-01-06T13:00:00Z") }, // Mar 14h
    { to: "qualify", created_at: new Date("2026-07-08T08:00:00Z") }, // Mer 10h (été)
  ];

  it("compte les buckets dow/hour", () => {
    const r = bucketize(evts);
    expect(r.total).toBe(5);
    expect(r.qualify).toBe(3);

    const mar10 = r.buckets.find((b) => b.dow === 2 && b.hour === 10);
    expect(mar10).toBeDefined();
    expect(mar10!.total).toBe(3);
    expect(mar10!.qualify).toBe(2);
    expect(mar10!.reject).toBe(1);
    expect(mar10!.snooze).toBe(0);

    const mer10 = r.buckets.find((b) => b.dow === 3 && b.hour === 10);
    expect(mer10?.total).toBe(1);
    expect(mer10?.qualify).toBe(1);
  });

  it("marginaux by_dow toujours 7 entrées", () => {
    const r = bucketize(evts);
    expect(r.by_dow).toHaveLength(7);
    expect(r.by_dow[1].total).toBe(4); // Mardi (index 1 = dow 2)
    expect(r.by_dow[1].qualify).toBe(2);
    expect(r.by_dow[0].total).toBe(0); // Lundi vide
  });

  it("marginaux by_hour toujours 24 entrées", () => {
    const r = bucketize(evts);
    expect(r.by_hour).toHaveLength(24);
    expect(r.by_hour[10].total).toBe(4);
    expect(r.by_hour[14].total).toBe(1);
    expect(r.by_hour[0].total).toBe(0);
  });

  it("best_slot pointe le bucket le plus rempli", () => {
    const r = bucketize(evts);
    expect(r.best_slot).toEqual({ dow: 2, hour: 10, total: 3 });
  });

  it("liste vide → total 0, best_slot null", () => {
    const r = bucketize([]);
    expect(r.total).toBe(0);
    expect(r.best_slot).toBeNull();
    expect(r.by_dow).toHaveLength(7);
    expect(r.by_hour).toHaveLength(24);
    expect(r.by_dow.every((d) => d.total === 0)).toBe(true);
  });
});
