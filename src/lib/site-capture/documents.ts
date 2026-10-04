// src/lib/site-capture/documents.ts
/**
 * Menu PDFs: downloaded through the SSRF-safe fetch, size-capped, and
 * reduced to their text layer. A PDF without one is flagged `needsOcr`
 * (OCR is out of scope).
 */
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

/** `null` = over the limit. */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) {
    const all = new Uint8Array(await response.arrayBuffer());
    return all.byteLength > maxBytes ? null : all;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
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
  opts: { timeoutMs?: number; maxBytes?: number; userAgent?: string; deps?: Partial<PdfDeps> } = {},
): Promise<PdfTextResult> {
  const headers: Record<string, string> = { accept: "application/pdf,*/*" };
  if (opts.userAgent) headers["user-agent"] = opts.userAgent;
  const deps: PdfDeps = {
    fetch: (u, timeoutMs) => safeFetchFollow(u, { perHopTimeoutMs: timeoutMs, init: { headers } }),
    extract: extractPdfText,
    ...opts.deps,
  };

  let fetched: SafeFetchResult;
  try {
    fetched = await deps.fetch(url, opts.timeoutMs ?? 15_000);
  } catch (err) {
    if (err instanceof UrlGuardError) return { ok: false, reason: "unsafe_url", httpStatus: null };
    const name = err instanceof Error ? err.name : "";
    return { ok: false, reason: name === "AbortError" || name === "TimeoutError" ? "timeout" : "nav_error", httpStatus: null };
  }

  const status = fetched.response.status;
  if (status >= 400) {
    const blocked = status === 401 || status === 403 || status === 429;
    return { ok: false, reason: blocked ? "blocked" : "http_error", httpStatus: status };
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(fetched.response, opts.maxBytes ?? MAX_PDF_BYTES);
  } catch {
    return { ok: false, reason: "nav_error", httpStatus: status };
  }
  if (bytes === null) return { ok: false, reason: "too_large", httpStatus: status };
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not_pdf", httpStatus: status };

  try {
    const { text, pageCount } = await deps.extract(bytes);
    const clean = cleanText(text).replace(/[ \t]+/g, " ").trim();
    const needsOcr = clean.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE * Math.max(1, pageCount);
    return { ok: true, text: clean.slice(0, MAX_TEXT_CHARS), pageCount, needsOcr };
  } catch {
    return { ok: false, reason: "not_pdf", httpStatus: status };
  }
}
