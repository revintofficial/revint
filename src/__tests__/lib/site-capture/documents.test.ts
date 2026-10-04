// src/__tests__/lib/site-capture/documents.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safe-fetch")>()),
  safeFetchFollow: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { extractPdfText, fetchPdfText, type PdfDeps } from "@/lib/site-capture/documents";
import { safeFetchFollow, UrlGuardError } from "@/lib/safe-fetch";
import { logger } from "@/lib/logger";

beforeEach(() => {
  vi.mocked(safeFetchFollow).mockReset();
  vi.mocked(logger.warn).mockReset();
});

const PDF_HEAD = new TextEncoder().encode("%PDF-1.7\n");
const URL_ = "https://bistro.test/files/menu.pdf";

function deps(body: Uint8Array | string, init: { status?: number; headers?: Record<string, string> } = {}, text = "Tasting menu 85"): PdfDeps {
  return {
    fetch: async () => ({
      response: new Response(body, { status: init.status ?? 200, headers: init.headers }),
      finalUrl: URL_,
      redirectCount: 0,
    }),
    extract: async () => ({ text, pageCount: 1 }),
  };
}

describe("fetchPdfText", () => {
  it("returns the text of a PDF", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "Tasting menu 85 per person, seven courses, wine pairing 60") });
    expect(r).toEqual({
      ok: true,
      text: "Tasting menu 85 per person, seven courses, wine pairing 60",
      pageCount: 1,
      needsOcr: false,
    });
  });

  it("flags a PDF without a text layer", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "  \n ") });
    expect(r).toMatchObject({ ok: true, needsOcr: true });
  });

  // Review Focus 5: NUL bytes from PDF text must not reach Postgres.
  it("strips NUL bytes from the extracted text", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "Tasting\u0000 menu with enough words to count as a text layer") });
    expect(r.ok && r.text).toBe("Tasting menu with enough words to count as a text layer");
  });

  it("refuses a file over the size limit, by header or by stream", async () => {
    const byHeader = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, { headers: { "content-length": "99999999" } }) });
    expect(byHeader).toEqual({ ok: false, reason: "too_large", httpStatus: 200 });
    const big = new Uint8Array(2_000);
    big.set(PDF_HEAD);
    const byStream = await fetchPdfText(URL_, { maxBytes: 1_000, deps: deps(big) });
    expect(byStream).toEqual({ ok: false, reason: "too_large", httpStatus: 200 });
  });

  it("refuses a body that is not a PDF", async () => {
    const r = await fetchPdfText(URL_, { deps: deps("<html>not found</html>") });
    expect(r).toEqual({ ok: false, reason: "not_pdf", httpStatus: 200 });
  });

  it("reports blocked and http errors", async () => {
    expect(await fetchPdfText(URL_, { deps: deps("", { status: 403 }) })).toEqual({ ok: false, reason: "blocked", httpStatus: 403 });
    expect(await fetchPdfText(URL_, { deps: deps("", { status: 404 }) })).toEqual({ ok: false, reason: "http_error", httpStatus: 404 });
  });

  it("reports an address the SSRF guard rejects", async () => {
    const r = await fetchPdfText(URL_, {
      deps: {
        fetch: async () => {
          throw new UrlGuardError("Private addresses are not allowed");
        },
      },
    });
    expect(r).toEqual({ ok: false, reason: "unsafe_url", httpStatus: null });
  });

  it("reports an extractor failure as not_pdf and logs it", async () => {
    const boom = new Error("pdf.js failed to load");
    const r = await fetchPdfText(URL_, {
      deps: {
        ...deps(PDF_HEAD),
        extract: async () => {
          throw boom;
        },
      },
    });
    expect(r).toEqual({ ok: false, reason: "not_pdf", httpStatus: 200 });
    expect(logger.warn).toHaveBeenCalledWith("site_capture.pdf_extract_failed", { url: URL_, err: boom });
  });
});

describe("fetchPdfText deadline and cancellation", () => {
  /** A body that sends the PDF head and then never finishes. */
  function stallingDeps(onCancel?: () => void): PdfDeps {
    return {
      fetch: async () => ({
        response: new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(PDF_HEAD);
            },
            cancel() {
              onCancel?.();
            },
          }),
          { status: 200 },
        ),
        finalUrl: URL_,
        redirectCount: 0,
      }),
      extract: async () => ({ text: "never reached", pageCount: 1 }),
    };
  }

  it("ends a body that never finishes with timeout within the deadline", async () => {
    let cancelled = false;
    const started = Date.now();
    const r = await fetchPdfText(URL_, { timeoutMs: 100, deps: stallingDeps(() => (cancelled = true)) });
    const elapsed = Date.now() - started;
    expect(r).toEqual({ ok: false, reason: "timeout", httpStatus: 200 });
    expect(elapsed).toBeLessThan(1_000);
    await Promise.resolve();
    expect(cancelled).toBe(true);
  });

  it("ends with timeout when the request itself never answers", async () => {
    const r = await fetchPdfText(URL_, {
      timeoutMs: 50,
      deps: { fetch: () => new Promise<never>(() => {}) },
    });
    expect(r).toEqual({ ok: false, reason: "timeout", httpStatus: null });
  });

  it("ends with aborted when the caller's signal fires during the body read", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const r = await fetchPdfText(URL_, { timeoutMs: 5_000, signal: controller.signal, deps: stallingDeps() });
    expect(r).toEqual({ ok: false, reason: "aborted", httpStatus: 200 });
  });

  it("returns aborted without fetching when the signal is already aborted", async () => {
    const fetch = vi.fn<PdfDeps["fetch"]>();
    const controller = new AbortController();
    controller.abort();
    const r = await fetchPdfText(URL_, { signal: controller.signal, deps: { fetch } });
    expect(r).toEqual({ ok: false, reason: "aborted", httpStatus: null });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("fetchPdfText default fetch", () => {
  it("passes the timeout and the accept / user-agent headers to safeFetchFollow", async () => {
    vi.mocked(safeFetchFollow).mockResolvedValue({
      response: new Response("<html></html>", { status: 200 }),
      finalUrl: URL_,
      redirectCount: 0,
    });
    const r = await fetchPdfText(URL_, { timeoutMs: 7_000, userAgent: "RevintBot/1.0" });
    expect(r).toEqual({ ok: false, reason: "not_pdf", httpStatus: 200 });
    expect(safeFetchFollow).toHaveBeenCalledWith(URL_, {
      perHopTimeoutMs: 7_000,
      init: { headers: { accept: "application/pdf,*/*", "user-agent": "RevintBot/1.0" } },
    });
  });
});

describe("extractPdfText (real extractor)", () => {
  it("reads the text layer of a generated PDF", async () => {
    const mod = (await import("jspdf")) as unknown as Record<string, unknown>;
    const JsPdf = (mod.jsPDF ?? (mod.default as Record<string, unknown> | undefined)?.jsPDF ?? mod.default) as new () => {
      text(t: string, x: number, y: number): void;
      output(kind: "arraybuffer"): ArrayBuffer;
    };
    const doc = new JsPdf();
    doc.text("Tasting menu 85", 10, 10);
    const out = await extractPdfText(new Uint8Array(doc.output("arraybuffer")));
    expect(out.pageCount).toBe(1);
    expect(out.text).toContain("Tasting menu 85");
  });
});
