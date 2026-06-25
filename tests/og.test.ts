import { describe, expect, it } from "vitest";
import { parseOg } from "@/lib/og/fetch";

const BASE = "https://example.com/foo/bar";

describe("parseOg", () => {
  it("extrait og:title, og:description, og:image", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Boulangerie Durand" />
        <meta property="og:description" content="Pains & viennoiseries depuis 1947" />
        <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
      </head><body>x</body></html>
    `;
    const og = parseOg(html, BASE);
    expect(og.title).toBe("Boulangerie Durand");
    expect(og.description).toBe("Pains & viennoiseries depuis 1947");
    expect(og.image).toBe("https://cdn.example.com/cover.jpg");
    expect(og.fetched_at).toBeInstanceOf(Date);
  });

  it("résout les URLs relatives sur og:image", () => {
    const html = `<head><meta property="og:image" content="/static/cover.png"></head>`;
    const og = parseOg(html, BASE);
    expect(og.image).toBe("https://example.com/static/cover.png");
  });

  it("retombe sur twitter:* puis <title> et name=description", () => {
    const html = `
      <head>
        <title>Mon site - Accueil</title>
        <meta name="description" content="Description vanilla">
        <meta name="twitter:image" content="https://cdn.example.com/tw.jpg">
      </head>
    `;
    const og = parseOg(html, BASE);
    expect(og.title).toBe("Mon site - Accueil");
    expect(og.description).toBe("Description vanilla");
    expect(og.image).toBe("https://cdn.example.com/tw.jpg");
  });

  it("survit à l'ordre inverse content=… property=…", () => {
    const html = `<head><meta content="Titre inversé" property="og:title"></head>`;
    const og = parseOg(html, BASE);
    expect(og.title).toBe("Titre inversé");
  });

  it("renvoie null sur les champs absents", () => {
    const og = parseOg("<head></head>", BASE);
    expect(og.title).toBeNull();
    expect(og.description).toBeNull();
    expect(og.image).toBeNull();
  });

  it("ignore les og:image invalides", () => {
    const html = `<head><meta property="og:image" content="not a url"></head>`;
    const og = parseOg(html, BASE);
    expect(og.image).toBe("https://example.com/foo/not%20a%20url");
  });

  it("decode les entités HTML", () => {
    const html = `<head><meta property="og:title" content="Au P&#39;tit Bistrot &amp; Co"></head>`;
    const og = parseOg(html, BASE);
    expect(og.title).toBe("Au P'tit Bistrot & Co");
  });
});
