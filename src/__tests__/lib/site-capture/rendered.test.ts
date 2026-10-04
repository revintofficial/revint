// src/__tests__/lib/site-capture/rendered.test.ts
/**
 * Runs VISIBLE_TEXT_SCRIPT in happy-dom. happy-dom computes innerText from CSS
 * display (inline and stylesheet), but it renders the content of a closed
 * <details>, ignores the `hidden` attribute for innerText and always reports a
 * layout box; those parts are asserted on the DOM state instead.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { VISIBLE_TEXT_SCRIPT } from "@/lib/site-capture/rendered";

const windows: Window[] = [];
afterEach(() => {
  for (const w of windows.splice(0)) w.close();
});

function run(html: string): { result: unknown; document: Window["document"] } {
  const w = new Window({ url: "https://bistro.test/" });
  windows.push(w);
  w.document.write(html);
  return { result: w.eval(VISIBLE_TEXT_SCRIPT), document: w.document };
}

describe("VISIBLE_TEXT_SCRIPT", () => {
  it("returns null when the body is not rendered, so the page keeps its HTML-derived text", () => {
    expect(run(`<html><body style="display:none"><p>Hello</p><script>var s = 1</script></body></html>`).result).toBeNull();
    expect(run(`<html style="display:none"><body><p>Hello</p></body></html>`).result).toBeNull();
    expect(run(`<html><head><style>body{display:none}</style></head><body><p>Hello</p></body></html>`).result).toBeNull();
  });

  it("returns the rendered text, opening <details> and the panels of collapsed aria-controls", () => {
    const { result, document } = run(
      `<html><head><style>.state{display:none}</style></head><body>` +
        `<p>For larger bookings please get in touch</p>` +
        `<details><summary>Deposits</summary><p>Groups of 8 pay a deposit.</p></details>` +
        `<button aria-expanded="false" aria-controls="  faq-a\tfaq-b ">Questions</button>` +
        `<div id="faq-a" hidden>Answer A</div><div id="faq-b" style="display:none">Answer B</div>` +
        `<div class="state">Card details are required to secure your reservation.</div>` +
        `<div style="display:none">Unfortunately the transaction for this booking has failed.</div>` +
        `<script>var widget = "script text";</script></body></html>`,
    );
    expect(typeof result).toBe("string");
    const text = result as string;
    expect(text).toContain("For larger bookings please get in touch");
    expect(text).toContain("Answer B");
    expect(text).not.toContain("Card details are required");
    expect(text).not.toContain("transaction for this booking has failed");
    expect(text).not.toContain("script text");
    expect(document.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(document.getElementById("faq-a")?.hasAttribute("hidden")).toBe(false);
    expect((document.getElementById("faq-b") as unknown as { style: { display: string } }).style.display).toBe("");
  });

  it("leaves panels of controls that are not collapsed, and every other hidden block, untouched", () => {
    const { document } = run(
      `<html><body><button aria-expanded="true" aria-controls="p">x</button><div id="p" hidden>P</div>` +
        `<div id="q" hidden>Q</div></body></html>`,
    );
    expect(document.getElementById("p")?.hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("q")?.hasAttribute("hidden")).toBe(true);
  });

  it("un-hides at most 300 distinct panels; repeated references to one panel do not use the cap up", () => {
    const many = Array.from({ length: 310 }, (_, i) => `p${i}`);
    const capped = run(
      `<html><body><button aria-expanded="false" aria-controls="${many.join(" ")}">x</button>` +
        many.map((id) => `<div id="${id}" hidden>${id}</div>`).join("") +
        `</body></html>`,
    ).document;
    const opened = many.filter((id) => !capped.getElementById(id)?.hasAttribute("hidden"));
    expect(opened).toHaveLength(300);

    const repeated = run(
      `<html><body>` +
        Array.from({ length: 400 }, () => `<button aria-expanded="false" aria-controls="same same">x</button>`).join("") +
        `<button aria-expanded="false" aria-controls="other">y</button>` +
        `<div id="same" hidden>Same</div><div id="other" hidden>Other</div></body></html>`,
    ).document;
    expect(repeated.getElementById("same")?.hasAttribute("hidden")).toBe(false);
    expect(repeated.getElementById("other")?.hasAttribute("hidden")).toBe(false);
  });

  it("examines at most 5,000 collapsed controls", () => {
    const { document } = run(
      `<html><body>` +
        Array.from({ length: 5_000 }, () => `<button aria-expanded="false" aria-controls="missing">x</button>`).join("") +
        `<button aria-expanded="false" aria-controls="late">y</button><div id="late" hidden>Late</div></body></html>`,
    );
    expect(document.getElementById("late")?.hasAttribute("hidden")).toBe(true);
  });
});
