// src/__tests__/lib/site-facts.test.ts
import { describe, expect, it } from "vitest";
import { mergeSiteFacts, pickSubpages } from "@/lib/site-facts";

const HOME = "https://padella.co/";
const homeHtml = `<html lang="en"><head>
  <link rel="alternate" hreflang="en" href="https://padella.co/" />
  <link rel="alternate" hreflang="it" href="https://padella.co/it/" />
  <link rel="alternate" hreflang="x-default" href="https://padella.co/" />
</head><body><nav>
  <a href="/menu">Menu</a>
  <a href="/reservations">Book a table</a>
  <a href="/order">Order online</a>
  <a href="https://deliveroo.co.uk/menu/london/padella">Deliveroo</a>
  <a href="https://other-site.com/menu">Partner menu</a>
  <a href="/files/wine.pdf">Wine menu</a>
  <a href="mailto:hi@padella.co">Email</a>
</nav></body></html>`;

describe("pickSubpages", () => {
  it("picks one same-host page per kind and never an external host", () => {
    const pick = pickSubpages(homeHtml, HOME);
    expect(pick.targets).toEqual([
      { kind: "reservation", url: "https://padella.co/reservations" },
      { kind: "menu", url: "https://padella.co/menu" },
      { kind: "order", url: "https://padella.co/order" },
    ]);
    expect(pick.menuPdfUrl).toBe("https://padella.co/files/wine.pdf");
    expect(pick.hasBookingLink).toBe(true);
  });

  it("reports no booking link on a site that has none", () => {
    const pick = pickSubpages(`<a href="/menu">Menu</a><a href="/about">About</a>`, HOME);
    expect(pick.hasBookingLink).toBe(false);
    expect(pick.targets).toEqual([{ kind: "menu", url: "https://padella.co/menu" }]);
  });
});

describe("pickSubpages PDFs", () => {
  it("never targets a PDF, even when its text or path looks like a booking page", () => {
    const pick = pickSubpages(`<a href="/book.pdf">Book a table</a>`, HOME);
    expect(pick.targets).toEqual([]);
    expect(pick.hasBookingLink).toBe(true);
    expect(pick.menuPdfUrl).toBeNull();
  });

  it("records a menu PDF as the menu document, not a target", () => {
    const pick = pickSubpages(`<a href="/menu.pdf">Menu</a>`, HOME);
    expect(pick.menuPdfUrl).toBe("https://padella.co/menu.pdf");
    expect(pick.targets).toEqual([]);
  });
});

describe("mergeSiteFacts regexes", () => {
  const run = (kind: "reservation" | "menu", text: string) => {
    const html = `<body><p>${text}</p></body>`;
    const url = `https://padella.co/${kind}`;
    return mergeSiteFacts({ url: HOME, html: "<body></body>" }, [{ kind, url, html }], pickSubpages("<body></body>", HOME));
  };

  it("does not read 'no deposit' or a cancellation fee as prepayment", () => {
    expect(run("reservation", "No deposit required for tables under 6").hasPrepayment).toBeNull();
    expect(run("reservation", "A cancellation fee applies").hasPrepayment).toBeNull();
    expect(run("reservation", "A deposit of £10 per person is required").hasPrepayment).toMatchObject({ value: true });
  });

  it("does not read a 3-course set lunch as a tasting menu", () => {
    expect(run("menu", "3-course set lunch £25").tastingMenu).toBeNull();
    expect(run("menu", "Our 7-course tasting menu").tastingMenu).toMatchObject({ value: true });
  });
});

describe("mergeSiteFacts", () => {
  const pick = pickSubpages(homeHtml, HOME);

  it("finds prepayment on the booking page and a tasting menu on the menu page", () => {
    const facts = mergeSiteFacts({ url: HOME, html: homeHtml }, [
      { kind: "reservation", url: "https://padella.co/reservations", html: "<body><p>A deposit of £10 per person is required to secure your booking.</p></body>" },
      { kind: "menu", url: "https://padella.co/menu", html: "<body><h2>Seven-course tasting menu</h2><p>Our 7-course tasting menu changes weekly.</p></body>" },
      { kind: "order", url: "https://padella.co/order", html: "<body><a href='https://padella.co/order/checkout'>Order now</a></body>" },
    ], pick);
    expect(facts.hasPrepayment).toMatchObject({ value: true, url: "https://padella.co/reservations" });
    expect(facts.hasPrepayment!.quote).toContain("deposit of £10");
    expect(facts.tastingMenu).toMatchObject({ value: true, url: "https://padella.co/menu" });
    expect(facts.languageCount).toMatchObject({ value: 2, url: HOME });
    expect(facts.deliveryPlatforms).toMatchObject({ value: ["Deliveroo"], url: HOME });
    expect(facts.directOrdering).toMatchObject({ value: true });
    expect(facts.bookingChecked).toBe(true);
    expect(facts.menuPageSeen).toBe(true);
    expect(facts.orderPageSeen).toBe(true);
    expect(facts.menuPdfUrl).toBe("https://padella.co/files/wine.pdf");
  });

  it("keeps a kind unseen when its page could not be opened", () => {
    const facts = mergeSiteFacts({ url: HOME, html: homeHtml }, [
      { kind: "reservation", url: "https://padella.co/reservations", html: null },
      { kind: "menu", url: "https://padella.co/menu", html: null },
    ], pick);
    expect(facts.bookingChecked).toBe(false); // a booking link exists but was not read
    expect(facts.menuPageSeen).toBe(false);
    expect(facts.hasPrepayment).toBeNull();
    expect(facts.pagesVisited).toEqual([
      { kind: "reservation", url: "https://padella.co/reservations", ok: false },
      { kind: "menu", url: "https://padella.co/menu", ok: false },
    ]);
  });

  it("treats a site with no booking link at all as checked", () => {
    const html = `<a href="/menu">Menu</a>`;
    const facts = mergeSiteFacts({ url: HOME, html }, [], pickSubpages(html, HOME));
    expect(facts.bookingChecked).toBe(true);
    expect(facts.languageCount).toBeNull(); // no hreflang: unknown, not 1
    expect(facts.deliveryPlatforms).toBeNull();
    expect(facts.directOrdering).toBeNull();
  });

  it("does not count a marketplace link as the venue's own ordering", () => {
    const html = `<a href="https://deliveroo.co.uk/menu/x">Order online</a>`;
    const facts = mergeSiteFacts({ url: HOME, html }, [], pickSubpages(html, HOME));
    expect(facts.directOrdering).toBeNull();
    expect(facts.deliveryPlatforms!.value).toEqual(["Deliveroo"]);
  });
});
