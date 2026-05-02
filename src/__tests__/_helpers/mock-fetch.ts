/**
 * In-memory fetch mocking for SSRF + redirect-chain + size-cap tests.
 *
 * Why a custom helper instead of MSW: the SSRF tests need to assert
 * that the SUT (system under test) declines to follow a redirect to a
 * private address WITHOUT actually performing the second hop. MSW
 * intercepts at the request layer but still resolves the response,
 * which is the wrong shape for these tests.
 *
 * Usage:
 *   const restore = mockFetchChain([
 *     { url: "https://example.com", status: 302, headers: { Location: "http://169.254.169.254/" } },
 *     { url: "http://169.254.169.254/", status: 200, body: "<metadata>" },
 *   ]);
 *   try {
 *     await POST(request);
 *   } finally {
 *     restore();
 *   }
 *
 * The handler returns 404 for any URL not in the chain so a leaky
 * test fails loudly instead of hitting the network.
 */
import { vi, type Mock } from "vitest";

export interface FetchHop {
  /** Exact URL match. Use a function-form matcher via `match` for prefix matching. */
  url?: string;
  match?: (url: string) => boolean;
  status?: number;
  /** Response body (string) - default empty string. */
  body?: string | Uint8Array;
  /** Override / supplement response headers. Lower-case keys preferred. */
  headers?: Record<string, string>;
  /**
   * If set, calling fetch on this hop will throw the provided value.
   * Use to simulate connection-refused / DNS error / abort.
   */
  throws?: unknown;
}

export interface MockFetchOpts {
  /** Default response when no hop matches. Defaults to 404. */
  fallbackStatus?: number;
  /** Throw on fallback instead of responding 404. */
  fallbackThrows?: boolean;
}

/**
 * Replaces global.fetch with a deterministic in-memory handler.
 * Returns a `restore()` function that puts the original fetch back.
 */
export function mockFetchChain(hops: FetchHop[], opts: MockFetchOpts = {}): () => void {
  const original = globalThis.fetch;

  const handler: Mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlString = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      const hop = hops.find((h) =>
        h.url ? h.url === urlString : h.match ? h.match(urlString) : false,
      );

      if (!hop) {
        if (opts.fallbackThrows) {
          throw new Error(`mock-fetch: no hop registered for ${urlString}`);
        }
        return new Response(null, { status: opts.fallbackStatus ?? 404 });
      }

      if (hop.throws !== undefined) {
        throw hop.throws;
      }

      const status = hop.status ?? 200;
      const headers = new Headers(hop.headers ?? {});
      const body = hop.body ?? null;
      // Manual redirect support: when redirect: "manual" the SUT
      // expects a synthetic response it can parse the Location from
      // without the runtime auto-following. The Response constructor
      // permits 3xx + Location body.
      const redirect = init?.redirect ?? "follow";
      if (status >= 300 && status < 400 && redirect === "manual") {
        // Body must be null for redirect responses.
        return new Response(null, { status, headers });
      }

      return new Response(body as BodyInit | null, { status, headers });
    },
  );

  globalThis.fetch = handler as unknown as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

/**
 * Build a single-hop responder that produces a body of a given size.
 * Used to assert size-cap defences (e.g. M10: website-check rejects
 * 10MB+ payloads instead of OOMing the worker).
 */
export function buildLargeBody(bytes: number, fillChar = "x"): string {
  return fillChar.repeat(Math.max(0, Math.floor(bytes)));
}

/**
 * Convenience: a stream-style readable body to assert that the SUT
 * stops reading after the cap. The stream emits 1MB chunks until the
 * caller cancels the reader.
 */
export function buildLargeStream(totalBytes: number, chunkBytes = 1 << 20): ReadableStream<Uint8Array> {
  let emitted = 0;
  return new ReadableStream({
    async pull(controller) {
      if (emitted >= totalBytes) {
        controller.close();
        return;
      }
      const remaining = totalBytes - emitted;
      const size = Math.min(chunkBytes, remaining);
      controller.enqueue(new Uint8Array(size).fill(120 /* 'x' */));
      emitted += size;
    },
  });
}
