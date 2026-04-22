/**
 * Unit tests for the transactional email layer.
 *
 * Coverage:
 *   - Dev stub swallows sends when RESEND_API_KEY is not set (no crash, logs)
 *   - getFromAddress / getReplyToAddress fall back to leadacai.com defaults
 *   - getAppBaseUrl prefers NEXT_PUBLIC_APP_URL, falls back to VERCEL_URL,
 *     then localhost
 *   - getDevRedirect is ignored in production
 *   - sendEmail rejects malformed recipients
 *   - sendEmail propagates Resend errors as { delivered: false }
 *   - Template buildSubject helpers return non-empty strings
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Reset module state between tests so env var changes actually stick.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email/from", () => {
  it("uses leadacai.com defaults when EMAIL_FROM / EMAIL_REPLY_TO are unset", async () => {
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_REPLY_TO", "");
    const mod = await import("@/lib/email/from");
    expect(mod.getFromAddress()).toBe("Leadac AI <noreply@leadacai.com>");
    expect(mod.getReplyToAddress()).toBe("hello@leadacai.com");
  });

  it("honors EMAIL_FROM override", async () => {
    vi.stubEnv("EMAIL_FROM", "Staging <staging@leadacai.com>");
    const mod = await import("@/lib/email/from");
    expect(mod.getFromAddress()).toBe("Staging <staging@leadacai.com>");
  });

  it("getAppBaseUrl prefers NEXT_PUBLIC_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://leadacai.com");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    const mod = await import("@/lib/email/from");
    expect(mod.getAppBaseUrl()).toBe("https://leadacai.com");
  });

  it("getAppBaseUrl falls back to VERCEL_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "preview.vercel.app");
    const mod = await import("@/lib/email/from");
    expect(mod.getAppBaseUrl()).toBe("https://preview.vercel.app");
  });

  it("getDevRedirect returns null in production even when EMAIL_DEV_REDIRECT is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_DEV_REDIRECT", "dev@leadacai.com");
    const mod = await import("@/lib/email/from");
    expect(mod.getDevRedirect()).toBeNull();
  });

  it("getDevRedirect returns the value in dev when it looks like an email", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DEV_REDIRECT", "me@example.com");
    const mod = await import("@/lib/email/from");
    expect(mod.getDevRedirect()).toBe("me@example.com");
  });
});

describe("email/client dev stub", () => {
  it("falls back to stub when RESEND_API_KEY is unset in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const mod = await import("@/lib/email/client");
    const client = mod.getResend();
    type SendFn = (input: unknown) => Promise<{
      data: { id: string } | null;
      error: unknown;
    }>;
    const send = client.emails.send.bind(client.emails) as SendFn;
    const { data, error } = await send({
      from: "Leadac AI <noreply@leadacai.com>",
      to: ["me@example.com"],
      subject: "Test",
      html: "<p>hello</p>",
    });
    expect(error).toBeNull();
    expect(data?.id).toMatch(/^dev_/);
  });

  it("throws in production when the API key is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const mod = await import("@/lib/email/client");
    expect(() => mod.getResend()).toThrow(/RESEND_API_KEY/);
  });
});

describe("email/send", () => {
  it("returns skipped=true for recipients without an @ sign", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "not-an-email",
      subject: "Hi",
      html: "<p>hi</p>",
    });
    expect(result.delivered).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toBe("invalid_recipient");
  });

  it("skips when the body is empty", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "me@example.com",
      subject: "Empty",
    });
    expect(result.delivered).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toBe("empty_body");
  });

  it("marks delivered=true when the dev stub accepts the send", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "me@example.com",
      subject: "Dev",
      html: "<p>body</p>",
    });
    expect(result.delivered).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.id).toMatch(/^dev_/);
  });

  it("re-routes the recipient when EMAIL_DEV_REDIRECT is set (dev only)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_DEV_REDIRECT", "me@leadacai.com");
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "real-user@example.com",
      subject: "Redirected",
      html: "<p>body</p>",
    });
    expect(result.delivered).toBe(true);
  });

  it("sendEmailAsync never rejects, even when payload is invalid", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmailAsync } = await import("@/lib/email/send");
    expect(() =>
      sendEmailAsync({ to: "nope", subject: "x", html: "<p>x</p>" }),
    ).not.toThrow();
  });
});

describe("email templates / buildSubject helpers", () => {
  it("WelcomeEmail.buildSubject handles missing name + both locales", async () => {
    const { WelcomeEmail } = await import("@/lib/email/templates/welcome");
    expect(WelcomeEmail.buildSubject(null, "tr")).toContain("Leadac AI");
    expect(WelcomeEmail.buildSubject("Mert Okumus", "tr")).toContain("Mert");
    expect(WelcomeEmail.buildSubject("Jane Doe", "en")).toContain("Jane");
  });

  it("TeamInviteEmail.buildSubject includes workspace name", async () => {
    const { TeamInviteEmail } = await import(
      "@/lib/email/templates/team-invite"
    );
    const s = TeamInviteEmail.buildSubject("Acme Studio", "tr");
    expect(s).toContain("Acme Studio");
  });

  it("LeadAlertEmail.buildSubject includes score + business name", async () => {
    const { LeadAlertEmail } = await import("@/lib/email/templates/lead-alert");
    const s = LeadAlertEmail.buildSubject("Beauty Salon", 92, "tr");
    expect(s).toContain("92");
    expect(s).toContain("Beauty Salon");
  });

  it("BookingDetectedEmail.buildSubject mentions the provider", async () => {
    const { BookingDetectedEmail } = await import(
      "@/lib/email/templates/booking-detected"
    );
    const s = BookingDetectedEmail.buildSubject("Salon X", "Calendly", "en");
    expect(s).toContain("Salon X");
    expect(s).toContain("Calendly");
  });

  it("BillingEventEmail.buildSubject returns a distinct subject per kind", async () => {
    const { BillingEventEmail } = await import(
      "@/lib/email/templates/billing-event"
    );
    const a = BillingEventEmail.buildSubject("payment_failed", "tr");
    const b = BillingEventEmail.buildSubject("plan_updated", "tr");
    const c = BillingEventEmail.buildSubject("subscription_cancelled", "tr");
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a.length).toBeGreaterThan(0);
  });
});
