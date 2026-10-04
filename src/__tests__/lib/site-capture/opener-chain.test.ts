// src/__tests__/lib/site-capture/opener-chain.test.ts
import { describe, expect, it, vi } from "vitest";
import type { Page, Response } from "playwright";
import {
  checkNavigationChain,
  checkRecordedNavigations,
  recordMainFrameNavigations,
  redirectChainUrls,
} from "@/lib/site-capture/opener";

/** Refuses loopback and link-local addresses, like assertSafeFetchUrl does for these literals. */
const guard = vi.fn(async (url: string) => {
  const host = new URL(url).hostname;
  if (host === "127.0.0.1" || host.startsWith("169.254.")) throw new Error(`unsafe: ${host}`);
  return new URL(url);
});

/** A response whose request was redirected through `chain` (first requested URL first). */
function responseThrough(chain: string[]): Pick<Response, "request"> {
  type Req = { url: () => string; redirectedFrom: () => Req | null };
  let req: Req | null = null;
  for (const url of chain) {
    const prev: Req | null = req;
    req = { url: () => url, redirectedFrom: () => prev };
  }
  return { request: () => req } as unknown as Pick<Response, "request">;
}

describe("redirectChainUrls", () => {
  it("walks the redirect chain back to the first requested URL", () => {
    const res = responseThrough(["https://a.test/", "https://b.test/", "https://c.test/"]);
    expect(redirectChainUrls(res)).toEqual(["https://c.test/", "https://b.test/", "https://a.test/"]);
  });

  it("is empty without a response", () => {
    expect(redirectChainUrls(null)).toEqual([]);
  });
});

describe("checkNavigationChain", () => {
  it("refuses a chain whose middle hop is the metadata address", async () => {
    guard.mockClear();
    const hops = redirectChainUrls(
      responseThrough(["https://bistro.test/menu", "http://169.254.169.254/latest/meta-data/", "https://bistro.test/landed"]),
    );
    expect(await checkNavigationChain("https://bistro.test/landed", hops, guard)).toBe(false);
  });

  it("refuses a landed URL on loopback", async () => {
    guard.mockClear();
    const hops = redirectChainUrls(responseThrough(["https://bistro.test/menu"]));
    expect(await checkNavigationChain("http://127.0.0.1/", hops, guard)).toBe(false);
  });

  it("passes a clean chain", async () => {
    guard.mockClear();
    const hops = redirectChainUrls(responseThrough(["http://bistro.test/menu", "https://bistro.test/menu", "https://www.bistro.test/menu"]));
    expect(await checkNavigationChain("https://www.bistro.test/menu", hops, guard)).toBe(true);
  });

  it("calls the guard once per distinct URL", async () => {
    guard.mockClear();
    const hops = ["https://www.bistro.test/menu", "https://bistro.test/menu", "https://bistro.test/menu"];
    await checkNavigationChain("https://www.bistro.test/menu", hops, guard);
    expect(guard).toHaveBeenCalledTimes(2);
    expect(guard.mock.calls.map((c) => c[0]).sort()).toEqual(["https://bistro.test/menu", "https://www.bistro.test/menu"]);
  });
});

/** A page whose `request` events can be emitted by hand (navigation flag and frame per request). */
function fakeNavPage() {
  const main = { id: "main" };
  let handler: ((req: unknown) => void) | null = null;
  const page = {
    on: (_event: string, cb: (req: unknown) => void) => {
      handler = cb;
    },
    mainFrame: () => main,
  } as unknown as Page;
  const emit = (url: string, opts: { nav?: boolean; frame?: unknown } = {}) =>
    handler?.({ url: () => url, isNavigationRequest: () => opts.nav ?? true, frame: () => opts.frame ?? main });
  return { page, emit };
}

describe("recordMainFrameNavigations", () => {
  it("keeps main-frame navigation requests (redirect hops included) and ignores sub-frames and sub-resources", () => {
    const { page, emit } = fakeNavPage();
    const read = recordMainFrameNavigations(page);
    emit("https://bistro.test/menu");
    emit("https://bistro.test/script.js", { nav: false });
    emit("https://widget.test/frame", { frame: { id: "child" } });
    emit("https://redirector.test/r?to=x");
    emit("https://bistro.test/menu");
    expect(read()).toEqual({ urls: ["https://bistro.test/menu", "https://redirector.test/r?to=x"], overflow: false, total: 3 });
  });

  it("stops growing at the bound and flags the overflow", () => {
    const { page, emit } = fakeNavPage();
    const read = recordMainFrameNavigations(page, 3);
    for (let i = 0; i < 10; i++) emit(`https://loop.test/${i}`);
    const log = read();
    expect(log.urls).toHaveLength(3);
    expect(log.overflow).toBe(true);
    expect(log.total).toBe(10);
  });
});

describe("checkRecordedNavigations", () => {
  it("refuses a later navigation (meta refresh through a redirector) whose hop is the metadata address", async () => {
    guard.mockClear();
    const { page, emit } = fakeNavPage();
    const read = recordMainFrameNavigations(page);
    emit("https://bistro.test/");
    // Later: a meta refresh to a public redirector that answers 302 -> metadata, then lands back on a public page.
    emit("https://redirector.test/r");
    emit("http://169.254.169.254/");
    emit("https://bistro.test/after");
    expect(await checkRecordedNavigations("https://bistro.test/after", read(), guard)).toBe(false);
  });

  it("refuses a log that hit the bound without calling the guard", async () => {
    guard.mockClear();
    const { page, emit } = fakeNavPage();
    const read = recordMainFrameNavigations(page, 2);
    for (let i = 0; i < 5; i++) emit(`https://loop.test/${i}`);
    expect(await checkRecordedNavigations("https://loop.test/0", read(), guard)).toBe(false);
    expect(guard).not.toHaveBeenCalled();
  });

  it("passes a clean later navigation", async () => {
    guard.mockClear();
    const { page, emit } = fakeNavPage();
    const read = recordMainFrameNavigations(page);
    emit("https://bistro.test/");
    emit("https://bistro.test/welcome");
    expect(await checkRecordedNavigations("https://bistro.test/welcome", read(), guard)).toBe(true);
    expect(guard).toHaveBeenCalledTimes(2);
  });
});
