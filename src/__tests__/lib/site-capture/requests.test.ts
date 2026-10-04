// src/__tests__/lib/site-capture/requests.test.ts
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { recordThirdPartyRequests } from "@/lib/site-capture/requests";

function fakePage() {
  const main = { id: "main" };
  let handler: ((req: unknown) => void) | null = null;
  const page = {
    on: (_event: string, cb: (req: unknown) => void) => {
      handler = cb;
    },
    mainFrame: () => main,
  } as unknown as Page;
  const emit = (url: string, type: string, frame: unknown = main) =>
    handler?.({ url: () => url, resourceType: () => type, frame: () => frame });
  return { page, emit };
}

describe("recordThirdPartyRequests", () => {
  it("keeps third-party script, xhr, fetch and sub-frame requests as origin + path", () => {
    const { page, emit } = fakePage();
    const read = recordThirdPartyRequests(page, "https://www.bistro.co.uk/");
    emit("https://www.sevenrooms.com/widget/embed.js?venue=bistro", "script");
    emit("https://api.vendor.test/v1/slots?date=1", "xhr");
    emit("https://book.vendor.test/embed", "document", { id: "child" });
    emit("https://www.sevenrooms.com/widget/embed.js?venue=other", "script");
    expect(read()).toEqual([
      "https://www.sevenrooms.com/widget/embed.js",
      "https://api.vendor.test/v1/slots",
      "https://book.vendor.test/embed",
    ]);
  });

  it("ignores the venue's own hosts, images and the main document", () => {
    const { page, emit } = fakePage();
    const read = recordThirdPartyRequests(page, "https://www.bistro.co.uk/");
    emit("https://cdn.bistro.co.uk/app.js", "script");
    emit("https://images.vendor.test/hero.jpg", "image");
    emit("https://other.test/", "document");
    emit("data:text/plain,hi", "fetch");
    expect(read()).toEqual([]);
  });
});
