/**
 * Public, unauthenticated demo-request endpoint.
 *
 * The marketing demo CTA on the homepage and pricing page links to
 * `/demo`, which renders a short form. This handler accepts the form
 * payload, IP-rate-limits to block form-spam attacks, sends a notify
 * email to the founder inbox, and (if the prospect provided a valid
 * email) sends a one-line confirmation back so they have something
 * receipt-shaped in their inbox before the founder replies.
 *
 * Auth model
 *   None. The form is on a marketing surface and the rate-limit
 *   bucket protects against spam abuse. No workspace context exists
 *   here — `requireUser()` would 401 anonymous prospects.
 *
 * Validation
 *   Hand-rolled. The codebase doesn't ship zod, and this is a five-
 *   field form; pulling in a runtime validator just for one route is
 *   not worth the bundle weight.
 *
 * Rate limit
 *   `LIMITS.demoRequest` — 5 submissions per IP per 10 minutes. A
 *   real prospect fills this out once. Anything over 5 in 10 minutes
 *   is a bot loop or a fat-fingered double-submit, neither of which
 *   we want to forward to the founder inbox.
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { brandedEmailHtml, escapeEmailHtml } from "@/lib/email/inline-html";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const FOUNDER_NOTIFY_EMAIL =
  process.env.DEMO_NOTIFY_EMAIL?.trim() || "mert@revint.dev";

const MAX_FIELD_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;

interface DemoRequestBody {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  postcodeNiche?: unknown;
  monthlyVolume?: unknown;
  notes?: unknown;
  // Hidden honeypot — real users never see / fill it. Any value here
  // means a bot autofilled every visible field; we silently 200 to
  // avoid telling the bot it tripped a trap.
  website?: unknown;
}

interface CleanRequest {
  name: string;
  email: string;
  company: string;
  postcodeNiche: string;
  monthlyVolume: string;
  notes: string;
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function isValidEmail(s: string): boolean {
  // Intentionally permissive — RFC-compliant email regex is famously
  // bad. We only need to reject obvious garbage; Resend rejects
  // anything actually undeliverable on send.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 320;
}

function validate(body: DemoRequestBody): CleanRequest | { error: string } {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return { error: "honeypot" };
  }

  const name = asString(body.name, MAX_FIELD_LENGTH);
  const email = asString(body.email, 320);
  const company = asString(body.company, MAX_FIELD_LENGTH);
  const postcodeNiche = asString(body.postcodeNiche, MAX_FIELD_LENGTH);
  const monthlyVolume = asString(body.monthlyVolume, MAX_FIELD_LENGTH) ?? "";
  const notes = asString(body.notes, MAX_NOTES_LENGTH) ?? "";

  if (!name) return { error: "missing_name" };
  if (!email || !isValidEmail(email)) return { error: "invalid_email" };
  if (!company) return { error: "missing_company" };
  if (!postcodeNiche) return { error: "missing_postcode_niche" };

  return { name, email, company, postcodeNiche, monthlyVolume, notes };
}

function extractClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim().slice(0, 45);
  return null;
}

function notifyHtml(req: CleanRequest, ip: string | null): string {
  return brandedEmailHtml({
    eyebrow: "Demo request",
    title: "New demo request",
    preheader: "A prospect asked for a Revint demo.",
    bodyHtml: `
      <p style="margin:0;">
        They asked us to audit <strong style="color:#1A1547;">${escapeEmailHtml(req.postcodeNiche)}</strong> live on the call. Reply directly to <a href="mailto:${escapeEmailHtml(req.email)}" style="color:#1F1291;text-decoration:underline;text-decoration-color:#38919F;">${escapeEmailHtml(req.email)}</a>.
      </p>`,
    rows: [
      ["Name", req.name],
      ["Email", req.email],
      ["Company", req.company],
      ["Postcode + niche to audit live", req.postcodeNiche],
      ["Monthly outbound volume", req.monthlyVolume || "—"],
      ["Notes", req.notes || "—"],
      ["Source IP", ip ?? "—"],
    ],
  });
}

function notifyText(req: CleanRequest, ip: string | null): string {
  return [
    "New demo request",
    "",
    `Name:                          ${req.name}`,
    `Email:                         ${req.email}`,
    `Company:                       ${req.company}`,
    `Postcode + niche to audit live: ${req.postcodeNiche}`,
    `Monthly outbound volume:       ${req.monthlyVolume || "—"}`,
    `Notes:                         ${req.notes || "—"}`,
    `Source IP:                     ${ip ?? "—"}`,
    "",
    `Reply directly to ${req.email}.`,
  ].join("\n");
}

function confirmationHtml(req: CleanRequest): string {
  return brandedEmailHtml({
    eyebrow: "Demo request received",
    title: "We got your demo request",
    preheader: "We got your Revint demo request.",
    bodyHtml: `
      <p style="margin:0 0 14px 0;">Hi ${escapeEmailHtml(req.name.split(" ")[0] || "there")},</p>
      <p style="margin:0 0 14px 0;">Got it — Mert from Revint here. A 15-min walkthrough is booked into the calendar; you'll get the link in a follow-up shortly.</p>
      <p style="margin:0 0 14px 0;">Before the call I'll run the audit on <strong style="color:#1A1547;">${escapeEmailHtml(req.postcodeNiche)}</strong> so we can open a real audited shortlist on screen instead of a slide deck. You'll walk away with a list of audited prospects either way — no signup required.</p>
      <p style="margin:0;">If the timing slips or you'd like to add anything, just reply to this email.</p>`,
    footerHtml: "Mert - Revint",
  });
}

function confirmationText(req: CleanRequest): string {
  return [
    `Hi ${req.name.split(" ")[0] || "there"},`,
    "",
    "Got it — Mert from Revint here. A 15-min walkthrough is booked into the calendar; you'll get the link in a follow-up shortly.",
    "",
    `Before the call I'll run the audit on ${req.postcodeNiche} so we can open a real audited shortlist on screen instead of a slide deck. You'll walk away with a list of audited prospects either way — no signup required.`,
    "",
    "If the timing slips or you'd like to add anything, just reply to this email.",
    "",
    "— Mert · Revint",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req);
  const subject = `demo:${ip ?? "anon"}`;
  const rl = await checkRateLimit(subject, LIMITS.demoRequest);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: DemoRequestBody;
  try {
    body = (await req.json()) as DemoRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const cleaned = validate(body);
  if ("error" in cleaned) {
    if (cleaned.error === "honeypot") {
      // Bot tripped the trap. Pretend it succeeded so the bot's
      // success signal looks identical to a real submission.
      logger.info("demo.honeypot_caught", { ip });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: cleaned.error },
      { status: 400 },
    );
  }

  const subjectLine = `Demo request — ${cleaned.company} (${cleaned.postcodeNiche})`;

  const notifyResult = await sendEmail({
    to: FOUNDER_NOTIFY_EMAIL,
    subject: subjectLine,
    html: notifyHtml(cleaned, ip),
    text: notifyText(cleaned, ip),
    replyTo: cleaned.email,
    tags: [
      { name: "type", value: "demo_request_notify" },
      { name: "source", value: "marketing_demo_form" },
    ],
  });

  if (!notifyResult.delivered) {
    logger.error("demo.notify_failed", {
      err: notifyResult.error,
      email: cleaned.email,
      ip,
    });
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }

  // Best-effort confirmation. If this fails the founder still got
  // the lead, so we log and shrug rather than turning the form red.
  const confirmResult = await sendEmail({
    to: cleaned.email,
    subject: "We got your demo request — Revint",
    html: confirmationHtml(cleaned),
    text: confirmationText(cleaned),
    tags: [
      { name: "type", value: "demo_request_confirm" },
      { name: "source", value: "marketing_demo_form" },
    ],
  });
  if (!confirmResult.delivered) {
    logger.warn("demo.confirm_failed", {
      err: confirmResult.error,
      email: cleaned.email,
    });
  }

  logger.info("demo.request_received", {
    company: cleaned.company,
    postcodeNiche: cleaned.postcodeNiche,
    notifyId: notifyResult.id,
    confirmId: confirmResult.id,
  });

  return NextResponse.json({ ok: true });
}
