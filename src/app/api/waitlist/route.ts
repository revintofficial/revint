/**
 * Public, unauthenticated waitlist endpoint.
 *
 * The marketing homepage's WaitlistBlock posts here. Pricing is not
 * public yet, so during the pre-launch window this is the primary
 * intent-capture surface for agency prospects who want a slot when
 * we open the gates. Same disciplined shape as /api/demo/request:
 * IP rate-limit, honeypot, founder notify + best-effort confirmation
 * back to the prospect.
 *
 * Auth model
 *   None. Marketing surface, no workspace context.
 *
 * Rate limit
 *   `LIMITS.waitlist` — 5 submissions per IP per 10 minutes. Real
 *   prospects submit once.
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const FOUNDER_NOTIFY_EMAIL =
  process.env.WAITLIST_NOTIFY_EMAIL?.trim() ||
  process.env.DEMO_NOTIFY_EMAIL?.trim() ||
  "mert@leadacai.com";

const MAX_FIELD_LENGTH = 500;
const MAX_NOTES_LENGTH = 1500;

interface WaitlistBody {
  email?: unknown;
  company?: unknown;
  notes?: unknown;
  // Honeypot — real users never see / fill it.
  website?: unknown;
}

interface CleanRequest {
  email: string;
  company: string;
  notes: string;
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 320;
}

function validate(body: WaitlistBody): CleanRequest | { error: string } {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return { error: "honeypot" };
  }

  const email = asString(body.email, 320);
  const company = asString(body.company, MAX_FIELD_LENGTH) ?? "";
  const notes = asString(body.notes, MAX_NOTES_LENGTH) ?? "";

  if (!email || !isValidEmail(email)) return { error: "invalid_email" };

  return { email, company, notes };
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function notifyHtml(req: CleanRequest, ip: string | null): string {
  const rows = [
    ["Email", req.email],
    ["Agency / company", req.company || "—"],
    ["Notes", req.notes || "—"],
    ["Source IP", ip ?? "—"],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#888;vertical-align:top;white-space:nowrap;">${escapeHtml(
          label as string,
        )}</td><td style="padding:6px 0;color:#111;">${escapeHtml(
          value as string,
        )}</td></tr>`,
    )
    .join("");

  return `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;">
  <h2 style="font-size:18px;margin:0 0 8px;">New waitlist signup</h2>
  <p style="color:#666;margin:0 0 16px;font-size:14px;">
    Reply directly to <a href="mailto:${escapeHtml(req.email)}">${escapeHtml(req.email)}</a>.
  </p>
  <table style="border-collapse:collapse;font-size:14px;">
    ${rows}
  </table>
</div>`.trim();
}

function notifyText(req: CleanRequest, ip: string | null): string {
  return [
    "New waitlist signup",
    "",
    `Email:            ${req.email}`,
    `Agency / company: ${req.company || "—"}`,
    `Notes:            ${req.notes || "—"}`,
    `Source IP:        ${ip ?? "—"}`,
    "",
    `Reply directly to ${req.email}.`,
  ].join("\n");
}

function confirmationHtml(): string {
  return `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;color:#111;line-height:1.55;">
  <p>Hi,</p>
  <p>You're on the LeadAC waitlist. We're working with a small first cohort of agencies before opening pricing publicly. When we open a slot, this email gets the first ping.</p>
  <p>If you want to skip ahead, reply to this email with a postcode + niche you'd want me to audit on a 15-min call. I'll run the audit before we talk.</p>
  <p style="color:#666;font-size:13px;margin-top:24px;">— Mert · LeadAC</p>
</div>`.trim();
}

function confirmationText(): string {
  return [
    "Hi,",
    "",
    "You're on the LeadAC waitlist. We're working with a small first cohort of agencies before opening pricing publicly. When we open a slot, this email gets the first ping.",
    "",
    "If you want to skip ahead, reply to this email with a postcode + niche you'd want me to audit on a 15-min call. I'll run the audit before we talk.",
    "",
    "— Mert · LeadAC",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req);
  const subject = `wlst:${ip ?? "anon"}`;
  const rl = await checkRateLimit(subject, LIMITS.waitlist);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: WaitlistBody;
  try {
    body = (await req.json()) as WaitlistBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const cleaned = validate(body);
  if ("error" in cleaned) {
    if (cleaned.error === "honeypot") {
      logger.info("waitlist.honeypot_caught", { ip });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: cleaned.error },
      { status: 400 },
    );
  }

  const subjectLine = cleaned.company
    ? `Waitlist — ${cleaned.company} (${cleaned.email})`
    : `Waitlist — ${cleaned.email}`;

  const notifyResult = await sendEmail({
    to: FOUNDER_NOTIFY_EMAIL,
    subject: subjectLine,
    html: notifyHtml(cleaned, ip),
    text: notifyText(cleaned, ip),
    replyTo: cleaned.email,
    tags: [
      { name: "type", value: "waitlist_notify" },
      { name: "source", value: "marketing_waitlist_form" },
    ],
  });

  if (!notifyResult.delivered) {
    logger.error("waitlist.notify_failed", {
      err: notifyResult.error,
      email: cleaned.email,
      ip,
    });
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }

  const confirmResult = await sendEmail({
    to: cleaned.email,
    subject: "You're on the LeadAC waitlist",
    html: confirmationHtml(),
    text: confirmationText(),
    tags: [
      { name: "type", value: "waitlist_confirm" },
      { name: "source", value: "marketing_waitlist_form" },
    ],
  });
  if (!confirmResult.delivered) {
    logger.warn("waitlist.confirm_failed", {
      err: confirmResult.error,
      email: cleaned.email,
    });
  }

  logger.info("waitlist.signup_received", {
    company: cleaned.company || null,
    notifyId: notifyResult.id,
    confirmId: confirmResult.id,
  });

  return NextResponse.json({ ok: true });
}
