/**
 * High-level notification helpers called from workers and webhooks. Each
 * helper:
 *   - resolves the workspace owner's email + locale
 *   - applies a Redis-backed cooldown so bulk runs don't spam the inbox
 *   - renders and dispatches the template fire-and-forget
 *
 * Cooldown policy: one email per workspace per event `kind` per window.
 * This is the simplest, most forgiving rate limit — if it proves too
 * aggressive we can later key on (workspace, lead) with a shorter window.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/redis";
import { sendEmailAsync } from "./send";
import { LeadAlertEmail } from "./templates/lead-alert";
import { BookingDetectedEmail } from "./templates/booking-detected";
import { BillingEventEmail, type BillingEventKind } from "./templates/billing-event";

type NotificationKind =
  | "lead_alert"
  | "booking_detected"
  | "billing_event";

const DEFAULT_COOLDOWN_SECONDS: Record<NotificationKind, number> = {
  lead_alert: 24 * 60 * 60,
  booking_detected: 24 * 60 * 60,
  billing_event: 0,
};

/**
 * Acquire a cooldown slot via Redis `SET NX EX`. Returns true when the slot
 * was granted (caller should send), false when a prior send is still in
 * the cooldown window. Redis outages fail *open* (returns true) — we'd
 * rather accidentally send twice than silently drop an alert.
 */
async function tryAcquireCooldown(
  kind: NotificationKind,
  workspaceId: string,
  extraKey?: string,
): Promise<boolean> {
  const ttl = DEFAULT_COOLDOWN_SECONDS[kind];
  if (ttl <= 0) return true;

  const key = `email-cooldown:${kind}:${workspaceId}${extraKey ? `:${extraKey}` : ""}`;
  try {
    const redis = getRedis();
    const result = await redis.set(key, "1", "EX", ttl, "NX");
    return result === "OK";
  } catch (err) {
    logger.warn("email.cooldown_redis_error", { err, kind, workspaceId });
    return true;
  }
}

interface OwnerContact {
  email: string;
  locale: "tr" | "en";
}

async function resolveOwnerContact(
  workspaceId: string,
): Promise<OwnerContact | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      language: true,
      owner: { select: { email: true } },
    },
  });
  if (!workspace?.owner?.email) return null;
  const email = workspace.owner.email;
  if (!email.includes("@") || email.endsWith("@user.local")) return null;

  const locale: "tr" | "en" = workspace.language === "tr" ? "tr" : "en";
  return { email, locale };
}

// --------------------------- Lead alert ----------------------------------

export const HOT_LEAD_SCORE_THRESHOLD = 85;

interface NotifyLeadAlertInput {
  workspaceId: string;
  leadId: string;
  businessName: string;
  score: number;
  city: string | null;
  reasonSummary: string | null;
}

export async function notifyHotLead(input: NotifyLeadAlertInput): Promise<void> {
  if (input.score < HOT_LEAD_SCORE_THRESHOLD) return;

  const owner = await resolveOwnerContact(input.workspaceId);
  if (!owner) return;

  const granted = await tryAcquireCooldown("lead_alert", input.workspaceId);
  if (!granted) {
    logger.debug("email.lead_alert_cooldown_hit", {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
    });
    return;
  }

  sendEmailAsync({
    to: owner.email,
    subject: LeadAlertEmail.buildSubject(input.businessName, input.score, owner.locale),
    react: LeadAlertEmail({
      businessName: input.businessName,
      score: input.score,
      city: input.city,
      reasonSummary: input.reasonSummary,
      leadId: input.leadId,
      locale: owner.locale,
    }),
    tags: [
      { name: "type", value: "lead_alert" },
      { name: "workspace_id", value: input.workspaceId },
    ],
  });
}

// --------------------------- Booking detected ----------------------------

interface NotifyBookingDetectedInput {
  workspaceId: string;
  leadId: string;
  businessName: string;
  provider: string;
}

export async function notifyBookingDetected(
  input: NotifyBookingDetectedInput,
): Promise<void> {
  const owner = await resolveOwnerContact(input.workspaceId);
  if (!owner) return;

  const granted = await tryAcquireCooldown(
    "booking_detected",
    input.workspaceId,
  );
  if (!granted) {
    logger.debug("email.booking_detected_cooldown_hit", {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
    });
    return;
  }

  sendEmailAsync({
    to: owner.email,
    subject: BookingDetectedEmail.buildSubject(
      input.businessName,
      input.provider,
      owner.locale,
    ),
    react: BookingDetectedEmail({
      businessName: input.businessName,
      provider: input.provider,
      leadId: input.leadId,
      locale: owner.locale,
    }),
    tags: [
      { name: "type", value: "booking_detected" },
      { name: "workspace_id", value: input.workspaceId },
    ],
  });
}

// --------------------------- Billing event -------------------------------

interface NotifyBillingEventInput {
  workspaceId: string;
  kind: BillingEventKind;
  planName?: string | null;
  amountFormatted?: string | null;
}

export async function notifyBillingEvent(
  input: NotifyBillingEventInput,
): Promise<void> {
  const owner = await resolveOwnerContact(input.workspaceId);
  if (!owner) return;

  sendEmailAsync({
    to: owner.email,
    subject: BillingEventEmail.buildSubject(input.kind, owner.locale),
    react: BillingEventEmail({
      kind: input.kind,
      planName: input.planName ?? null,
      amountFormatted: input.amountFormatted ?? null,
      locale: owner.locale,
    }),
    tags: [
      { name: "type", value: "billing_event" },
      { name: "billing_kind", value: input.kind },
      { name: "workspace_id", value: input.workspaceId },
    ],
  });
}
