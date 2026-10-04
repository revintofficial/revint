// src/lib/site-capture/body.ts
/**
 * Reads a fetch body with a byte cap, stopping at the cap instead of
 * buffering the whole response (`response.text()` would read an endless body
 * until memory runs out). Shared by the PDF download and the text / HTML
 * fallback fetches.
 */

export const STOP = Symbol("stop");

/**
 * `"too_large"` = over the limit (with `truncate`, the first `maxBytes` bytes
 * are returned instead); `STOP` = `stop` resolved while the body was being read
 * (the reader is cancelled).
 */
export async function readCapped(
  response: Response,
  maxBytes: number,
  stop: Promise<typeof STOP>,
  opts: { truncate?: boolean } = {},
): Promise<Uint8Array | "too_large" | typeof STOP> {
  const declared = Number(response.headers.get("content-length"));
  if (!opts.truncate && Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    return "too_large";
  }
  if (!response.body) {
    const buf = await Promise.race([response.arrayBuffer(), stop]);
    if (buf === STOP) return STOP;
    const all = new Uint8Array(buf);
    if (all.byteLength <= maxBytes) return all;
    return opts.truncate ? all.subarray(0, maxBytes) : "too_large";
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
    if (total + value.byteLength > maxBytes) {
      await reader.cancel().catch(() => {});
      if (!opts.truncate) return "too_large";
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      break;
    }
    total += value.byteLength;
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

const NEVER = new Promise<typeof STOP>(() => {});

/**
 * The first `maxBytes` bytes of the body, decoded as UTF-8. The caller keeps
 * its own deadline around the whole call.
 */
export async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const bytes = await readCapped(response, maxBytes, NEVER, { truncate: true });
  // With `truncate` and a stop that never fires, only bytes come back.
  return typeof bytes === "object" ? new TextDecoder("utf-8").decode(bytes) : "";
}
