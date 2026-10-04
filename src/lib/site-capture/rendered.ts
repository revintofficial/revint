// src/lib/site-capture/rendered.ts
/**
 * The text a visitor can see on a page: `document.body.innerText` of the main
 * frame, after opening what a visitor can open with one click. Text derived
 * from the HTML also holds what the browser never renders (a booking widget's
 * hidden state messages, closed modals, `display: none` blocks); this does not.
 */
import type { Page } from "playwright";

export const MAX_VISIBLE_TEXT_CHARS = 200_000;
/** Collapsed panels an `aria-expanded="false"` control names that are un-hidden, at most. */
const MAX_EXPANDED_PANELS = 300;
/** `aria-expanded="false"` controls examined, at most: a hostile page cannot spend the time budget here. */
const MAX_EXAMINED_CONTROLS = 5_000;

/**
 * Evaluated in the page as a string. Returns null when there is no body or the
 * body is not rendered (`display: none` on it or on <html>, or no layout box):
 * `innerText` of an unrendered element is the raw text of every descendant,
 * scripts and hidden states included, so the HTML-derived text is better then.
 * Otherwise it clicks nothing (a click can navigate): sets `open` on every
 * <details>, and un-hides the distinct panels named by the whitespace-separated
 * `aria-controls` of each `aria-expanded="false"` control (removes `hidden`,
 * clears an inline `display: none`). Nothing else in the DOM is changed.
 * Returns the body's innerText (capped).
 */
export const VISIBLE_TEXT_SCRIPT = `(() => {
  const body = document.body;
  if (!body) return null;
  const hidden = (el) => getComputedStyle(el).display === "none";
  if (hidden(document.documentElement) || hidden(body) || body.getClientRects().length === 0) return null;
  for (const d of document.querySelectorAll("details")) d.open = true;
  const panels = new Set();
  let examined = 0;
  for (const control of document.querySelectorAll('[aria-expanded="false"][aria-controls]')) {
    if (examined++ >= ${MAX_EXAMINED_CONTROLS} || panels.size >= ${MAX_EXPANDED_PANELS}) break;
    for (const id of (control.getAttribute("aria-controls") || "").split(/\\s+/)) {
      if (panels.size >= ${MAX_EXPANDED_PANELS}) break;
      if (!id) continue;
      const panel = document.getElementById(id);
      if (!panel || panels.has(panel)) continue;
      panels.add(panel);
      panel.removeAttribute("hidden");
      if (panel.style && panel.style.display === "none") panel.style.removeProperty("display");
    }
  }
  return body.innerText.slice(0, ${MAX_VISIBLE_TEXT_CHARS});
})()`;

/**
 * Runs VISIBLE_TEXT_SCRIPT; `null` when it fails, returns no string or takes
 * longer than `timeoutMs` (the caller then falls back to the HTML-derived text).
 */
export async function readVisibleText(page: Pick<Page, "evaluate">, timeoutMs: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, timeoutMs));
  });
  try {
    const read = page.evaluate(VISIBLE_TEXT_SCRIPT).then(
      (v) => (typeof v === "string" ? v.slice(0, MAX_VISIBLE_TEXT_CHARS) : null),
      () => null,
    );
    return await Promise.race([read, timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
