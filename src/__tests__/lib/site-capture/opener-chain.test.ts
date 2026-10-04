// src/__tests__/lib/site-capture/opener-chain.test.ts
import { describe, expect, it, vi } from "vitest";
import type { Response } from "playwright";
import { checkNavigationChain, redirectChainUrls } from "@/lib/site-capture/opener";

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
