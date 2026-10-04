// src/__tests__/lib/site-capture/documents.test.ts
import { describe, expect, it } from "vitest";
import { extractPdfText, fetchPdfText, type PdfDeps } from "@/lib/site-capture/documents";
import { UrlGuardError } from "@/lib/safe-fetch";

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
