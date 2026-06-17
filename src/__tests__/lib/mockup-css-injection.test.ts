/**
 * M6 regression - branding hex colors are interpolated raw into the
 * `<style>:root { --accent: <value> }</style>` block in the mockup
 * HTML. Without `sanitizeHex`, a malicious workspace admin could
 * set `accentColor = "; }body{background:url(...)}"` to break out
 * of the property and inject arbitrary CSS into a public page.
 */
import { describe, expect, it } from "vitest";
import { sanitizeHex, renderMockupHtml } from "@/lib/mockup";

describe("M6 - sanitizeHex", () => {
  it("accepts #RGB", () => {
    expect(sanitizeHex("#abc", "#fff")).toBe("#abc");
  });

  it("accepts #RRGGBB", () => {
    expect(sanitizeHex("#aabbcc", "#fff")).toBe("#aabbcc");
  });

  it("accepts #RRGGBBAA", () => {
    expect(sanitizeHex("#aabbccdd", "#fff")).toBe("#aabbccdd");
  });

  it("strips surrounding whitespace before validating", () => {
    expect(sanitizeHex("  #aabbcc  ", "#fff")).toBe("#aabbcc");
  });

  it("rejects CSS-injection breakout", () => {
    expect(
      sanitizeHex("#000;}body{background:url(http://evil)}", "#fff"),
    ).toBe("#fff");
  });

  it("rejects javascript-shaped strings", () => {
    expect(sanitizeHex("javascript:alert(1)", "#fff")).toBe("#fff");
  });

  it("rejects a literal newline", () => {
    expect(sanitizeHex("#aaa\n;evil:1", "#fff")).toBe("#fff");
  });

  it("rejects null/undefined", () => {
    expect(sanitizeHex(null, "#fff")).toBe("#fff");
    expect(sanitizeHex(undefined, "#fff")).toBe("#fff");
  });

  it("rejects non-hex shape (no leading #)", () => {
    expect(sanitizeHex("aabbcc", "#fff")).toBe("#fff");
  });
});

describe("M6 - renderMockupHtml uses sanitized branding colors", () => {
  it("malicious accentColor never reaches the rendered <style> body", () => {
    const html = renderMockupHtml({
      businessName: "Test Co",
      city: null,
      websiteUrl: null,
      planMarkdown: "# hello",
      branding: {
        accentColor: "#000;}body{background:url(http://evil/track.gif)}",
        primaryColor: "#000",
        footerText: null,
        hideRevintCredit: false,
        logoUrl: null,
      },
    });
    expect(html).not.toContain("evil");
    expect(html).not.toMatch(/url\(http:\/\/evil/);
    // The fallback default must be present so the page still renders.
    expect(html).toMatch(/--accent:\s*#a5b4fc/);
  });

  it("a benign hex color is interpolated as-is", () => {
    const html = renderMockupHtml({
      businessName: "Test Co",
      city: null,
      websiteUrl: null,
      planMarkdown: "# hello",
      branding: {
        accentColor: "#ff5500",
        primaryColor: "#cc4400",
        footerText: null,
        hideRevintCredit: false,
        logoUrl: null,
      },
    });
    expect(html).toMatch(/--accent:\s*#ff5500/);
    expect(html).toMatch(/--primary:\s*#cc4400/);
  });
});
