/**
 * Render and send every transactional email variant to a test inbox so
 * you can audit the design end-to-end in a real client (Gmail, Outlook,
 * Apple Mail).
 *
 * Coverage:
 *   - Welcome             — TR + EN
 *   - Team invite         — TR OWNER, EN ADMIN, TR MEMBER (all roles, both locales)
 *   - Lead alert          — TR (hot 92), EN (warm 76)
 *   - Booking detected    — TR + EN
 *   - Billing events      — TR payment_failed, EN plan_updated, TR subscription_cancelled
 *
 * Total: 12 emails per run.
 *
 * Usage:
 *   npx tsx scripts/preview-emails.ts [recipient@example.com]
 *
 * Defaults to meertseker@gmail.com if no argument is provided. Reads
 * RESEND_API_KEY + EMAIL_FROM / EMAIL_REPLY_TO from .env.
 */

import "dotenv/config";
import { sendEmail } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";
import { TeamInviteEmail } from "@/lib/email/templates/team-invite";
import { LeadAlertEmail } from "@/lib/email/templates/lead-alert";
import { BookingDetectedEmail } from "@/lib/email/templates/booking-detected";
import { BillingEventEmail } from "@/lib/email/templates/billing-event";

const recipient = process.argv[2] ?? "meertseker@gmail.com";

interface PreviewSpec {
  name: string;
  run: () => Promise<unknown>;
}

const sends: PreviewSpec[] = [
  // -------------------------------- Welcome --------------------------------
  {
    name: "welcome (tr)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${WelcomeEmail.buildSubject("Mert Okumus", "tr")}`,
        react: WelcomeEmail({
          fullName: "Mert Okumus",
          workspaceName: "Revint HQ",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "welcome" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
  {
    name: "welcome (en)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${WelcomeEmail.buildSubject("Jane Doe", "en")}`,
        react: WelcomeEmail({
          fullName: "Jane Doe",
          workspaceName: "Acme Studio",
          locale: "en",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "welcome" },
          { name: "locale", value: "en" },
        ],
      }),
  },

  // ------------------------------ Team invite ------------------------------
  {
    name: "team-invite (tr, OWNER)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${TeamInviteEmail.buildSubject("Revint HQ", "tr")}`,
        react: TeamInviteEmail({
          inviterName: "Mert Okumus",
          workspaceName: "Revint HQ",
          role: "OWNER",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "team_invite" },
          { name: "role", value: "OWNER" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
  {
    name: "team-invite (en, ADMIN)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${TeamInviteEmail.buildSubject("Acme Studio", "en")}`,
        react: TeamInviteEmail({
          inviterName: "Jane Doe",
          workspaceName: "Acme Studio",
          role: "ADMIN",
          locale: "en",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "team_invite" },
          { name: "role", value: "ADMIN" },
          { name: "locale", value: "en" },
        ],
      }),
  },
  {
    name: "team-invite (tr, MEMBER)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${TeamInviteEmail.buildSubject("Salon Pipeline", "tr")}`,
        react: TeamInviteEmail({
          inviterName: "Alex Turner",
          workspaceName: "Salon Pipeline",
          role: "MEMBER",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "team_invite" },
          { name: "role", value: "MEMBER" },
          { name: "locale", value: "tr" },
        ],
      }),
  },

  // ------------------------------- Lead alert ------------------------------
  {
    name: "lead-alert (tr, score 92, hot)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${LeadAlertEmail.buildSubject("Barber Shop Okumus", 92, "tr")}`,
        react: LeadAlertEmail({
          businessName: "Barber Shop Okumus",
          score: 92,
          city: "Kadikoy, Istanbul",
          reasonSummary:
            "Active Instagram presence but no booking system — 4.8 average, 120 positive reviews in the last 30 days.",
          leadId: "preview_lead_id",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "lead_alert" },
          { name: "tone", value: "hot" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
  {
    name: "lead-alert (en, score 76, warm)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${LeadAlertEmail.buildSubject("Glow Beauty Studio", 76, "en")}`,
        react: LeadAlertEmail({
          businessName: "Glow Beauty Studio",
          score: 76,
          city: "Camden, London",
          reasonSummary:
            "Active social presence, 4.5 average rating, 80 reviews — but the website is a single static page with no booking link.",
          leadId: "preview_lead_id",
          locale: "en",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "lead_alert" },
          { name: "tone", value: "warm" },
          { name: "locale", value: "en" },
        ],
      }),
  },

  // --------------------------- Booking detected ----------------------------
  {
    name: "booking-detected (tr, Calendly)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${BookingDetectedEmail.buildSubject("Glow Beauty", "Calendly", "tr")}`,
        react: BookingDetectedEmail({
          businessName: "Glow Beauty",
          provider: "Calendly",
          leadId: "preview_lead_id",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "booking_detected" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
  {
    name: "booking-detected (en, Cal.com)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${BookingDetectedEmail.buildSubject("Sharp Cuts Barber", "Cal.com", "en")}`,
        react: BookingDetectedEmail({
          businessName: "Sharp Cuts Barber",
          provider: "Cal.com",
          leadId: "preview_lead_id",
          locale: "en",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "booking_detected" },
          { name: "locale", value: "en" },
        ],
      }),
  },

  // ----------------------------- Billing events ----------------------------
  {
    name: "billing payment_failed (tr, $79)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${BillingEventEmail.buildSubject("payment_failed", "tr")}`,
        react: BillingEventEmail({
          kind: "payment_failed",
          amountFormatted: "$79.00",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "billing_event" },
          { name: "kind", value: "payment_failed" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
  {
    name: "billing plan_updated (en, Pro Team)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${BillingEventEmail.buildSubject("plan_updated", "en")}`,
        react: BillingEventEmail({
          kind: "plan_updated",
          planName: "Pro Team",
          locale: "en",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "billing_event" },
          { name: "kind", value: "plan_updated" },
          { name: "locale", value: "en" },
        ],
      }),
  },
  {
    name: "billing subscription_cancelled (tr)",
    run: () =>
      sendEmail({
        to: recipient,
        subject: `[Preview] ${BillingEventEmail.buildSubject("subscription_cancelled", "tr")}`,
        react: BillingEventEmail({
          kind: "subscription_cancelled",
          locale: "tr",
        }),
        tags: [
          { name: "type", value: "preview" },
          { name: "template", value: "billing_event" },
          { name: "kind", value: "subscription_cancelled" },
          { name: "locale", value: "tr" },
        ],
      }),
  },
];

async function main() {
  console.log(`\n→ Sending ${sends.length} template previews to ${recipient}\n`);

  let ok = 0;
  let fail = 0;

  for (const s of sends) {
    try {
      const res = (await s.run()) as {
        id: string | null;
        delivered: boolean;
        error?: string;
      };
      if (res.delivered) {
        ok++;
        console.log(`  ✓ ${s.name.padEnd(42)} id=${res.id}`);
      } else {
        fail++;
        console.log(`  ✗ ${s.name.padEnd(42)} ${res.error ?? "unknown"}`);
      }
      // Small gap so Resend doesn't see a burst as suspicious.
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      fail++;
      console.log(
        `  ✗ ${s.name.padEnd(42)} exception: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `\nDone. ${ok} delivered, ${fail} failed. Check ${recipient} inbox (and spam folder on first run).\n`,
  );
}

main().catch((err) => {
  console.error("preview-emails failed:", err);
  process.exit(1);
});
