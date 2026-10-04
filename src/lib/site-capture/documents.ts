// src/lib/site-capture/documents.ts
/**
 * Menu PDFs: downloaded through the SSRF-safe fetch, size-capped, and
 * reduced to their text layer. A PDF without one is flagged `needsOcr`
 * (OCR is out of scope).
 */
import { logger } from "@/lib/logger";
import { safeFetchFollow, UrlGuardError, type SafeFetchResult } from "@/lib/safe-fetch";
import { cleanText, MAX_TEXT_CHARS } from "./reduce";
import type { LedgerReason } from "./types";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
/** Fewer characters per page than this means there is no usable text layer. */
const MIN_CHARS_PER_PAGE = 40;

export type PdfTextResult =
  | { ok: true; text: string; pageCount: number; needsOcr: boolean }
  | { ok: false; reason: LedgerReason; httpStatus: number | null };

export interface PdfDeps {
  fetch(url: string, timeoutMs: number): Promise<SafeFetchResult>;
  extract(bytes: Uint8Array): Promise<{ text: string; pageCount: number }>;
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text, pageCount: totalPages };
}

const STOP = Symbol("stop");

/**
 * `"too_large"` = over the limit; `STOP` = the deadline passed or the caller
 * aborted while the body was being read (the reader is cancelled).
 */
async function readCapped(
  response: Response,
  maxBytes: number,
  stop: Promise<typeof STOP>,
): Promise<Uint8Array | "too_large" | typeof STOP> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    return "too_large";
  }
  if (!response.body) {
    const buf = await Promise.race([response.arrayBuffer(), stop]);
    if (buf === STOP) return STOP;
    const all = new Uint8Array(buf);
    return all.byteLength > maxBytes ? "too_large" : all;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await Promise.race([reader.read(), stop]);
    if (next === STOP) {
      reader.cancel().catch(() => {});
      return STOP;
    }
    const { done, value } = next;
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

export async function fetchPdfText(
  url: string,
  opts: {
    /** One deadline covering the request and the body download. Default 15 s. */
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    /** Cancels the download (reported as "aborted"). */
    signal?: AbortSignal;
    deps?: Partial<PdfDeps>;
  } = {},
): Promise<PdfTextResult> {
  if (opts.signal?.aborted) return { ok: false, reason: "aborted", httpStatus: null };

  const timeoutMs = opts.timeoutMs ?? 15_000;
  const headers: Record<string, string> = { accept: "application/pdf,*/*" };
  if (opts.userAgent) headers["user-agent"] = opts.userAgent;
  const deps: PdfDeps = {
    fetch: (u, ms) => safeFetchFollow(u, { perHopTimeoutMs: ms, init: { headers } }),
    extract: extractPdfText,
    ...opts.deps,
  };

  // One deadline for fetch + body; the caller's signal ends it early.
  let stoppedBy: "timeout" | "aborted" | null = null;
  let onStop: () => void = () => {};
  const stop = new Promise<typeof STOP>((resolve) => {
    onStop = () => resolve(STOP);
  });
  const timer = setTimeout(() => {
    stoppedBy ??= "timeout";
    onStop();
  }, timeoutMs);
  const onAbort = () => {
    stoppedBy ??= "aborted";
    onStop();
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    let fetched: SafeFetchResult;
    const pending = deps.fetch(url, timeoutMs);
    try {
      const first = await Promise.race([pending, stop]);
      if (first === STOP) {
        // Release the body if the request completes after we gave up.
        pending.then((late) => late.response.body?.cancel().catch(() => {}), () => {});
        return { ok: false, reason: stoppedBy ?? "timeout", httpStatus: null };
      }
      fetched = first;
    } catch (err) {
      if (err instanceof UrlGuardError) return { ok: false, reason: "unsafe_url", httpStatus: null };
      const name = err instanceof Error ? err.name : "";
      return { ok: false, reason: name === "AbortError" || name === "TimeoutError" ? "timeout" : "nav_error", httpStatus: null };
    }

    const status = fetched.response.status;
    if (status >= 400) {
      await fetched.response.body?.cancel().catch(() => {});
      const blocked = status === 401 || status === 403 || status === 429;
      return { ok: false, reason: blocked ? "blocked" : "http_error", httpStatus: status };
    }

    let bytes: Uint8Array | "too_large" | typeof STOP;
    try {
      bytes = await readCapped(fetched.response, opts.maxBytes ?? MAX_PDF_BYTES, stop);
    } catch {
      return { ok: false, reason: "nav_error", httpStatus: status };
    }
    if (bytes === STOP) return { ok: false, reason: stoppedBy ?? "timeout", httpStatus: status };
    if (bytes === "too_large") return { ok: false, reason: "too_large", httpStatus: status };
    if (!looksLikePdf(bytes)) return { ok: false, reason: "not_pdf", httpStatus: status };

    try {
      const { text, pageCount } = await deps.extract(bytes);
      const clean = cleanText(text).replace(/[ \t]+/g, " ").trim();
      const needsOcr = clean.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE * Math.max(1, pageCount);
      return { ok: true, text: clean.slice(0, MAX_TEXT_CHARS), pageCount, needsOcr };
    } catch (err) {
      // An environment failure (e.g. the extractor cannot load) must not pass silently as "not a PDF".
      logger.warn("site_capture.pdf_extract_failed", { url, err });
      return { ok: false, reason: "not_pdf", httpStatus: status };
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
