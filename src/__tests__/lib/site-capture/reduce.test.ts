// src/__tests__/lib/site-capture/reduce.test.ts
import { describe, expect, it } from "vitest";
import { cleanText, MAX_TEXT_CHARS, reducePage } from "@/lib/site-capture/reduce";

const URL_ = "https://bistro.test/reservations";

describe("reducePage", () => {
  it("keeps the title, visible text, links, embeds and JSON-LD", () => {
    const html = `<html><head><title> Book  a table </title>
      <script type="application/ld+json">{"@type":"Restaurant","name":"Bistro"}</script>
      <script src="https://widget.vendor.test/loader.js"></script></head>
      <body><p>Card details are required for groups.</p>
      <script>var hidden = "deposit";</script>
      <a href="/menu">Our menu</a><a href="mailto:a@b.c">mail</a>
      <iframe src="//book.vendor.test/embed?id=1"></iframe></body></html>`;
    const r = reducePage(html, URL_);
    expect(r.title).toBe("Book a table");
    expect(r.text).toContain("Card details are required for groups.");
    expect(r.text).not.toContain("hidden");
    expect(r.links).toEqual([{ text: "Our menu", href: "https://bistro.test/menu" }]);
    expect(r.embeds).toEqual(["https://widget.vendor.test/loader.js", "https://book.vendor.test/embed?id=1"]);
    expect(r.jsonLd).toEqual([{ "@type": "Restaurant", name: "Bistro" }]);
  });

  it("reads the lazy-load address of an iframe when src is empty, blank or missing", () => {
    const html = `<body>
      <iframe src="" data-src="https://book.vendor.test/embed"></iframe>
      <iframe src="about:blank" data-src="https://book.vendor.test/embed2"></iframe>
      <iframe data-lazy-src="https://book.vendor.test/embed3"></iframe>
      <iframe src="https://book.vendor.test/real" data-src="https://book.vendor.test/other"></iframe></body>`;
    expect(reducePage(html, URL_).embeds).toEqual([
      "https://book.vendor.test/embed",
      "https://book.vendor.test/embed2",
      "https://book.vendor.test/embed3",
      "https://book.vendor.test/real",
    ]);
  });

  it("caps the text at 60,000 characters", () => {
    const html = `<body><p>${"word ".repeat(20_000)}</p></body>`;
    expect(reducePage(html, URL_).text.length).toBe(MAX_TEXT_CHARS);
  });

  it("drops duplicate links and malformed JSON-LD", () => {
    const html = `<body><a href="/menu">Menu</a><a href="/menu">Menu</a>
      <script type="application/ld+json">{not json}</script></body>`;
    const r = reducePage(html, URL_);
    expect(r.links).toHaveLength(1);
    expect(r.jsonLd).toEqual([]);
  });

  // Review Focus 5: Postgres text columns reject NUL bytes.
  it("strips NUL bytes from text", () => {
    expect(cleanText("tasting\u0000 menu")).toBe("tasting menu");
    expect(reducePage("<body><p>a\u0000b</p></body>", URL_).text).toBe("ab");
  });
});
