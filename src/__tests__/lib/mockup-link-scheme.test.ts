/**
 * M7 regression - the mockup HTML renders the lead's website URL as
 * `<a href="...">` and the workspace logo as `<img src="...">`.
 * `escapeHtml` does NOT transform the URL scheme so a stored
 * `javascript:alert(1)` payload would still execute on click. The
 * fix narrows both attribute sites to safe schemes.
 */
import { describe, expect, it } from "vitest";
import { safeUrl, safeImageUrl, renderMockupHtml } from "@/lib/mockup";

describe("M7 - safeUrl (link href)", () => {
  it("passes http/https through unchanged", () => {
    expect(safeUrl("http://example.com")).toBe("http://example.com/");
    expect(safeUrl("https://example.com/foo")).toBe("https://example.com/foo");
  });

  it("collapses javascript: to #", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("JAVASCRIPT:alert(1)")).toBe("#");
    expect(safeUrl("  javascript:alert(1)  ")).toBe("#");
  });

  it("collapses data: to # (text/html exfil channel)", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("collapses mailto: / tel: / file: to #", () => {
    expect(safeUrl("mailto:foo@bar")).toBe("#");
    expect(safeUrl("tel:+15551234")).toBe("#");
    expect(safeUrl("file:///etc/passwd")).toBe("#");
  });

  it("collapses null/undefined/empty to #", () => {
    expect(safeUrl(null)).toBe("#");
    expect(safeUrl(undefined)).toBe("#");
    expect(safeUrl("")).toBe("#");
    expect(safeUrl("   ")).toBe("#");
  });

  it("preserves protocol-relative and root-relative paths", () => {
    expect(safeUrl("//cdn.example/x.png")).toBe("//cdn.example/x.png");
    expect(safeUrl("/local/path")).toBe("/local/path");
  });
});

describe("M7 - safeImageUrl (img src)", () => {
  it("allows data: image whitelist", () => {
    expect(safeImageUrl("data:image/png;base64,iVBORw0KG=")).toMatch(/^data:image\/png/);
    expect(safeImageUrl("data:image/svg+xml;utf8,<svg></svg>")).toMatch(/^data:image\/svg/);
  });

  it("blocks data:text/html", () => {
    expect(safeImageUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("blocks javascript:", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBe("");
  });
});

describe("M7 - renderMockupHtml link safety", () => {
  it("never emits href=\"javascript:...\" even when the lead's website is malicious", () => {
    const html = renderMockupHtml({
      businessName: "Acme",
      city: "LA",
      websiteUrl: "javascript:alert(document.cookie)",
      planMarkdown: "# hello",
    });
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toMatch(/href="#"/);
  });

  it("never emits img src=\"javascript:...\" even when the branding logo is malicious", () => {
    const html = renderMockupHtml({
      businessName: "Acme",
      city: "LA",
      websiteUrl: null,
      planMarkdown: "# hello",
      branding: {
        accentColor: "#fff",
        primaryColor: "#fff",
        footerText: null,
        hideLeadacCredit: false,
        logoUrl: "javascript:alert(1)",
      },
    });
    expect(html).not.toMatch(/src="javascript:/i);
  });
});
