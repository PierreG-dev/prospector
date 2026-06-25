import { describe, expect, it } from "vitest";
import { buildBody } from "@/lib/notify/pushover";
import { buildTitle, buildMessage } from "@/lib/notify/processor";

const CREDS = { token: "t-abc", user: "u-xyz" };

describe("buildBody — Pushover form encoding", () => {
  it("encode les champs basiques", () => {
    const b = buildBody(
      { title: "Hello", message: "World", url: "https://x.test" },
      CREDS
    );
    expect(b.get("token")).toBe("t-abc");
    expect(b.get("user")).toBe("u-xyz");
    expect(b.get("title")).toBe("Hello");
    expect(b.get("message")).toBe("World");
    expect(b.get("url")).toBe("https://x.test");
    expect(b.get("priority")).toBe("0");
    expect(b.has("retry")).toBe(false);
    expect(b.has("expire")).toBe(false);
  });

  it("priority 2 ajoute retry & expire et clamp les valeurs", () => {
    const b = buildBody(
      { title: "u", message: "m", priority: 2, retry: 10, expire: 999999 },
      CREDS
    );
    expect(b.get("priority")).toBe("2");
    expect(Number(b.get("retry"))).toBeGreaterThanOrEqual(30); // clamp min
    expect(Number(b.get("expire"))).toBeLessThanOrEqual(10800); // clamp max
  });

  it("priority 2 sans retry/expire passés → défauts valides", () => {
    const b = buildBody({ title: "u", message: "m", priority: 2 }, CREDS);
    expect(Number(b.get("retry"))).toBeGreaterThanOrEqual(30);
    expect(Number(b.get("expire"))).toBeGreaterThan(0);
    expect(Number(b.get("expire"))).toBeLessThanOrEqual(10800);
  });

  it("tronque title et message", () => {
    const long = "x".repeat(2000);
    const b = buildBody({ title: long, message: long }, CREDS);
    expect(b.get("title")!.length).toBeLessThanOrEqual(250);
    expect(b.get("message")!.length).toBeLessThanOrEqual(1024);
  });
});

describe("buildTitle / buildMessage", () => {
  it("titre relance inclut index/3 et nom", () => {
    expect(
      buildTitle({
        kind: "relance",
        relance_index: 2,
        prospectName: "Plomberie Durand",
      })
    ).toBe("Relance 2/3 — Plomberie Durand");
  });

  it("titre simple sans index", () => {
    expect(
      buildTitle({ kind: "simple", relance_index: null, prospectName: "X" })
    ).toBe("Rappel — X");
  });

  it("message inclut label + contexte (trade · ville) + échéance", () => {
    const m = buildMessage({
      label: "Suite devis",
      trade: "plombier",
      city: "Toulouse",
      due_at: new Date("2026-06-12T10:00:00Z"),
    });
    expect(m).toContain("Suite devis");
    expect(m).toContain("plombier · Toulouse");
    expect(m).toMatch(/Échéance\s?:/);
  });

  it("message survit aux champs null", () => {
    const m = buildMessage({
      label: null,
      trade: null,
      city: null,
      due_at: new Date(),
    });
    expect(m).toMatch(/Échéance/);
  });
});
