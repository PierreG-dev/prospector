import { describe, expect, it } from "vitest";
import {
  extractPlaceId,
  normalizeMapsUrl,
  registrableDomain,
  toE164,
  namegeo,
  computeKeys,
} from "@/lib/dedup/keys";
import { findDuplicateInMemory } from "@/lib/dedup/cascade";

describe("extractPlaceId", () => {
  it("extrait depuis ?query_place_id=", () => {
    const url =
      "https://www.google.com/maps/search/plombier+toulouse/@43.6,1.4,15z?query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4";
    expect(extractPlaceId(url)).toBe("ChIJN1t_tDeuEmsRUsoyG83frY4");
  });

  it("extrait depuis !1s0x…:0x…", () => {
    const url =
      "https://www.google.com/maps/place/Boulangerie+Durand/@43.6,1.4,17z/data=!4m6!3m5!1s0x12d2a3b4c5d6e7f8:0x9876543210abcdef!8m2!3d43.6!4d1.4";
    expect(extractPlaceId(url)).toBe("0x12d2a3b4c5d6e7f8:0x9876543210abcdef");
  });

  it("extrait depuis ?cid=", () => {
    const url = "https://maps.google.com/?cid=15229884632011298910";
    expect(extractPlaceId(url)).toBe("cid:15229884632011298910");
  });

  it("renvoie null si rien", () => {
    expect(extractPlaceId("https://example.com")).toBeNull();
    expect(extractPlaceId(null)).toBeNull();
    expect(extractPlaceId("")).toBeNull();
  });

  it("est case-insensible sur !1s", () => {
    const url =
      "https://www.google.com/maps/place/Foo/data=!1s0xABCDEF12:0x123456!8m2";
    expect(extractPlaceId(url)).toBe("0xabcdef12:0x123456");
  });
});

describe("normalizeMapsUrl", () => {
  it("retire @lat,lng,zoom", () => {
    const a = normalizeMapsUrl(
      "https://www.google.com/maps/place/Boulangerie/@43.6,1.4,17z/data=foo"
    );
    expect(a).not.toContain("@43.6");
    expect(a).toContain("/maps/place/Boulangerie/");
  });

  it("conserve query_place_id", () => {
    const n = normalizeMapsUrl(
      "https://www.google.com/maps/search/x?query_place_id=ChIJabc&hl=fr&gl=fr"
    );
    expect(n).toContain("query_place_id=ChIJabc");
    expect(n).not.toContain("hl=fr");
  });

  it("renvoie null sur hostname non Google", () => {
    expect(normalizeMapsUrl("https://example.com/maps/place/x")).toBeNull();
  });
});

describe("registrableDomain", () => {
  it("extrait le domaine registrable", () => {
    expect(registrableDomain("https://www.boulangerie-durand.fr/contact")).toBe(
      "boulangerie-durand.fr"
    );
    expect(registrableDomain("http://shop.example.co.uk/p")).toBe("example.co.uk");
  });

  it("ignore les plateformes partagées", () => {
    expect(registrableDomain("https://www.facebook.com/foo")).toBeNull();
    expect(registrableDomain("https://pagesjaunes.fr/x")).toBeNull();
    expect(registrableDomain("https://sites.google.com/view/x")).toBeNull();
  });

  it("renvoie null si absent ou invalide", () => {
    expect(registrableDomain(null)).toBeNull();
    expect(registrableDomain("")).toBeNull();
  });
});

describe("toE164", () => {
  it("normalise un numéro FR", () => {
    expect(toE164("05 61 12 34 56")).toBe("+33561123456");
    expect(toE164("0561123456")).toBe("+33561123456");
  });

  it("renvoie null sur invalide", () => {
    expect(toE164("abc")).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});

describe("namegeo", () => {
  it("slug name + city", () => {
    expect(namegeo("Boulangerie Durand", "Toulouse")).toBe(
      "boulangerie-durand|toulouse"
    );
  });

  it("ignore les accents", () => {
    expect(namegeo("Crêperie Bréhat", "Mâcon")).toBe(
      "creperie-brehat|macon"
    );
  });

  it("null si name ou city manquant", () => {
    expect(namegeo("X", null)).toBeNull();
    expect(namegeo(null, "Toulouse")).toBeNull();
  });
});

describe("findDuplicateInMemory cascade", () => {
  const base = [
    {
      id: "a",
      keys: {
        place_id: "ChIJabc",
        gmaps_url_norm: "https://google.com/maps/place/A/",
        domain: "a.fr",
        phone_e164: "+33561112233",
        namegeo: "boulangerie-a|toulouse",
      },
    },
    {
      id: "b",
      keys: {
        place_id: null,
        gmaps_url_norm: null,
        domain: "b.fr",
        phone_e164: null,
        namegeo: "boulangerie-b|blagnac",
      },
    },
  ];

  it("T1 sur place_id", () => {
    const res = findDuplicateInMemory(
      {
        place_id: "ChIJabc",
        gmaps_url_norm: null,
        domain: null,
        phone_e164: null,
        namegeo: null,
      },
      base
    );
    expect(res?.tier).toBe("T1");
    expect(res?.prospectId).toBe("a");
  });

  it("T2 sur domain", () => {
    const res = findDuplicateInMemory(
      {
        place_id: null,
        gmaps_url_norm: null,
        domain: "b.fr",
        phone_e164: null,
        namegeo: null,
      },
      base
    );
    expect(res?.tier).toBe("T2");
    expect(res?.matchedOn).toBe("domain");
  });

  it("T2 sur téléphone", () => {
    const res = findDuplicateInMemory(
      {
        place_id: null,
        gmaps_url_norm: null,
        domain: null,
        phone_e164: "+33561112233",
        namegeo: null,
      },
      base
    );
    expect(res?.tier).toBe("T2");
    expect(res?.prospectId).toBe("a");
  });

  it("T3 sur namegeo seul", () => {
    const res = findDuplicateInMemory(
      {
        place_id: null,
        gmaps_url_norm: null,
        domain: null,
        phone_e164: null,
        namegeo: "boulangerie-a|toulouse",
      },
      base
    );
    expect(res?.tier).toBe("T3");
  });

  it("aucun match → null", () => {
    const res = findDuplicateInMemory(
      {
        place_id: null,
        gmaps_url_norm: null,
        domain: "z.fr",
        phone_e164: null,
        namegeo: null,
      },
      base
    );
    expect(res).toBeNull();
  });
});

describe("computeKeys (intégration)", () => {
  it("combine tous les normalisateurs", () => {
    const k = computeKeys({
      name: "Boulangerie Durand",
      city: "Toulouse",
      phone: "05 61 12 34 56",
      website: "https://www.boulangerie-durand.fr/contact",
      gmapsUrl:
        "https://www.google.com/maps/place/Durand/@43.6,1.4,17z/data=!1s0xabc:0xdef",
    });
    expect(k.place_id).toBe("0xabc:0xdef");
    expect(k.domain).toBe("boulangerie-durand.fr");
    expect(k.phone_e164).toBe("+33561123456");
    expect(k.namegeo).toBe("boulangerie-durand|toulouse");
    expect(k.gmaps_url_norm).toContain("/maps/place/Durand/");
  });
});
