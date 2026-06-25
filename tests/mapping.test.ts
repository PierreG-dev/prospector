import { describe, expect, it } from "vitest";
import { mapApifyItem } from "@/lib/import/map";
import { parseApifyJson } from "@/lib/import/parse";
import { scoreV1 } from "@/lib/scoring/score";

describe("mapApifyItem (table §3)", () => {
  it("mappe les champs présents", () => {
    const c = mapApifyItem({
      title: "Plomberie Durand",
      totalScore: 4.6,
      reviewsCount: 128,
      street: "12 rue des Lilas",
      city: "Toulouse",
      state: null,
      countryCode: "FR",
      website: "https://www.plomberie-durand.fr",
      phone: "05 61 12 34 56",
      categories: ["Plombier"],
      url: "https://www.google.com/maps/place/Durand/@43.6,1.4,17z/data=!1s0xabc:0xdef",
      categoryName: "Plombier",
    });
    expect(c.name).toBe("Plomberie Durand");
    expect(c.category).toBe("Plombier");
    expect(c.categories).toEqual(["Plombier"]);
    expect(c.address).toBe("12 rue des Lilas");
    expect(c.city).toBe("Toulouse");
    expect(c.country_code).toBe("FR");
    expect(c.website_url).toBe("https://www.plomberie-durand.fr");
    expect(c.has_website).toBe(true);
    expect(c.gmaps_rating).toBe(4.6);
    expect(c.gmaps_reviews).toBe(128);
    expect(c.trade).toBe("plombier");
    expect(c.keys.domain).toBe("plomberie-durand.fr");
    expect(c.keys.phone_e164).toBe("+33561123456");
    expect(c.keys.place_id).toBe("0xabc:0xdef");
    expect(c.owner_name).toBeNull();
    expect(c.email).toBeNull();
    expect(c.postal_code).toBeNull();
    expect(c.raw).toBeDefined();
  });

  it("survit aux champs absents", () => {
    const c = mapApifyItem({
      title: "X",
    });
    expect(c.name).toBe("X");
    expect(c.phone).toBeNull();
    expect(c.has_website).toBe(false);
    expect(c.keys.place_id).toBeNull();
    expect(c.keys.domain).toBeNull();
    expect(c.keys.phone_e164).toBeNull();
    expect(c.trade).toBeNull();
  });

  it("ignore les catégories non string", () => {
    const c = mapApifyItem({
      title: "Y",
      categories: ["Restaurant", null as unknown as string, "", "Pizzeria"],
    });
    expect(c.categories).toEqual(["Restaurant", "Pizzeria"]);
    expect(c.trade).toBe("restaurant");
  });
});

describe("parseApifyJson", () => {
  it("accepte un tableau d'items", () => {
    const json = JSON.stringify([{ title: "A" }, { title: "B" }, { foo: 1 }]);
    const items = parseApifyJson(json);
    expect(items.length).toBe(2);
  });

  it("rejette un objet racine", () => {
    expect(() => parseApifyJson('{"items":[]}')).toThrow();
  });

  it("rejette un JSON invalide", () => {
    expect(() => parseApifyJson("not json")).toThrow();
  });
});

describe("scoreV1", () => {
  const base = mapApifyItem({
    title: "Plomberie Sans Site",
    phone: "05 61 12 34 56",
    reviewsCount: 25,
    categoryName: "Plombier",
  });

  it("favorise l'absence de site", () => {
    // +40 pas de site, +15 tel, +15 >=10 avis, +10 trade prio = 80
    expect(scoreV1(base)).toBe(80);
  });

  it("pénalise un site propre + bien noté", () => {
    const equipped = mapApifyItem({
      title: "Plomberie Star",
      phone: "05 61 12 34 56",
      reviewsCount: 200,
      totalScore: 4.8,
      website: "https://www.plomberie-star.fr",
      categoryName: "Plombier",
    });
    // +15 tel, +15 avis, +10 trade, -30 wellEquipped = 10
    expect(scoreV1(equipped)).toBe(10);
  });

  it("compense plateforme partagée", () => {
    const fb = mapApifyItem({
      title: "Salon FB",
      phone: "05 61 12 34 56",
      website: "https://facebook.com/salonfb",
      categoryName: "Salon de coiffure",
    });
    // domain=null (FB), has_website=true → branche +20 plateforme partagée, +15 tel, +10 trade = 45
    expect(scoreV1(fb)).toBe(45);
  });
});
