/**
 * Billing event email — dispatched from the Stripe webhook handler on a
 * short list of high-signal events (payment failed, subscription changed,
 * subscription cancelled). No cooldown: these are rare, actionable, and
 * Stripe's own idempotency keeps retries from looking like spam.
 */

import { Section } from "@react-email/components";
import { BaseEmail } from "./base";
import { getAppBaseUrl } from "../from";
import {
  Badge,
  Caption,
  H1,
  InfoCard,
  Lede,
  PrimaryButton,
  StatRow,
  type Tone,
} from "./_primitives";

export type BillingEventKind =
  | "payment_failed"
  | "plan_updated"
  | "subscription_cancelled";

interface BillingEventEmailProps {
  kind: BillingEventKind;
  planName?: string | null;
  amountFormatted?: string | null;
  locale?: "tr" | "en";
}

const copy = {
  tr: {
    subject: {
      payment_failed: "Ödeme başarısız — aboneliğin risk altında",
      plan_updated: "Planın güncellendi",
      subscription_cancelled: "Aboneliğin iptal edildi",
    },
    preview: {
      payment_failed:
        "Son ödemen geçmedi. Kartını güncellemezsen abonelik askıya alınacak.",
      plan_updated: "Plan değişikliğin işleme alındı.",
      subscription_cancelled: "Aboneliğin iptal durumda.",
    },
    eyebrow: {
      payment_failed: "Aksiyon gerekli",
      plan_updated: "Plan güncellendi",
      subscription_cancelled: "Abonelik",
    },
    heading: {
      payment_failed: "Ödeme başarısız",
      plan_updated: "Plan güncellendi",
      subscription_cancelled: "Abonelik iptal edildi",
    },
    body: {
      payment_failed: (amt: string | null) =>
        `Stripe, ${amt ? amt + " tutarındaki " : ""}son ödemeni alamadı. ` +
        "Kartın bir sonraki denemede de reddedilirse Leadac AI aboneliğin otomatik olarak askıya alınır. Kart bilgilerini güncellemek için Billing'e git.",
      plan_updated: (plan: string | null) =>
        `Planın${plan ? ` ${plan} olarak` : ""} güncellendi. Yeni limitler hemen aktif — Usage sayfasından detayları görebilirsin.`,
      subscription_cancelled: () =>
        "Aboneliğin iptal edildi. Mevcut fatura dönemi sonuna kadar çalışmaya devam edersin, sonra otomatik olarak FREE plana düşersin. Geri dönmek istersen Billing sayfasından yeni bir abonelik başlatabilirsin.",
    },
    amountLabel: "Tutar",
    planLabel: "Plan",
    statusLabel: "Durum",
    statusValue: {
      payment_failed: "Retry bekleniyor",
      plan_updated: "Aktif",
      subscription_cancelled: "Dönem sonunda FREE",
    },
    ctaLabel: {
      payment_failed: "Kartı güncelle",
      plan_updated: "Billing'e git",
      subscription_cancelled: "Billing'e git",
    },
  },
  en: {
    subject: {
      payment_failed: "Payment failed — subscription at risk",
      plan_updated: "Plan updated",
      subscription_cancelled: "Subscription cancelled",
    },
    preview: {
      payment_failed:
        "Your last payment didn't go through. Update your card to keep service.",
      plan_updated: "Your plan change has been processed.",
      subscription_cancelled: "Your subscription is now cancelled.",
    },
    eyebrow: {
      payment_failed: "Action required",
      plan_updated: "Plan updated",
      subscription_cancelled: "Subscription",
    },
    heading: {
      payment_failed: "Payment failed",
      plan_updated: "Plan updated",
      subscription_cancelled: "Subscription cancelled",
    },
    body: {
      payment_failed: (amt: string | null) =>
        `Stripe couldn't charge your card${amt ? ` for ${amt}` : ""}. ` +
        "If the retry also fails we'll automatically pause your Leadac AI subscription. Open Billing to update the card.",
      plan_updated: (plan: string | null) =>
        `Your plan has been updated${plan ? ` to ${plan}` : ""}. The new limits are live immediately — check Usage for details.`,
      subscription_cancelled: () =>
        "Your subscription has been cancelled. You'll keep access until the end of the current billing period, then auto-downgrade to FREE. Re-subscribe any time from Billing.",
    },
    amountLabel: "Amount",
    planLabel: "Plan",
    statusLabel: "Status",
    statusValue: {
      payment_failed: "Retry pending",
      plan_updated: "Active",
      subscription_cancelled: "FREE at period end",
    },
    ctaLabel: {
      payment_failed: "Update card",
      plan_updated: "Open billing",
      subscription_cancelled: "Open billing",
    },
  },
} as const;

function toneFor(kind: BillingEventKind): Tone {
  if (kind === "payment_failed") return "danger";
  if (kind === "plan_updated") return "success";
  return "neutral";
}

function buttonTone(kind: BillingEventKind): "danger" | "accent" | "neutral" {
  if (kind === "payment_failed") return "danger";
  return "neutral";
}

export function BillingEventEmail({
  kind,
  planName,
  amountFormatted,
  locale = "en",
}: BillingEventEmailProps) {
  const c = copy[locale];
  const baseUrl = getAppBaseUrl();
  const tone = toneFor(kind);

  const body =
    kind === "payment_failed"
      ? c.body.payment_failed(amountFormatted ?? null)
      : kind === "plan_updated"
        ? c.body.plan_updated(planName ?? null)
        : c.body.subscription_cancelled();

  return (
    <BaseEmail preview={c.preview[kind]} tone={tone} lang={locale}>
      <Section style={{ marginBottom: "4px" }}>
        <Badge tone={tone} icon={kind === "payment_failed" ? "!" : undefined}>
          {c.eyebrow[kind]}
        </Badge>
      </Section>

      <H1>{c.heading[kind]}</H1>
      <Lede>{body}</Lede>

      <InfoCard tone={tone}>
        {amountFormatted && kind === "payment_failed" ? (
          <StatRow label={c.amountLabel} value={amountFormatted} mono />
        ) : null}
        {planName && kind === "plan_updated" ? (
          <StatRow label={c.planLabel} value={planName} />
        ) : null}
        <StatRow
          label={c.statusLabel}
          value={<Badge tone={tone}>{c.statusValue[kind]}</Badge>}
        />
      </InfoCard>

      <Section style={{ margin: "4px 0 8px 0" }}>
        <PrimaryButton
          href={`${baseUrl}/app/settings/billing`}
          tone={buttonTone(kind)}
        >
          {c.ctaLabel[kind]}
        </PrimaryButton>
      </Section>

      {kind === "payment_failed" ? (
        <Caption>
          {locale === "tr"
            ? "Kartı güncellersen retry otomatik tetiklenir — manuel bir şey yapmana gerek kalmaz."
            : "Updating the card triggers the retry automatically — nothing manual needed on your side."}
        </Caption>
      ) : null}
    </BaseEmail>
  );
}

BillingEventEmail.buildSubject = (
  kind: BillingEventKind,
  locale: "tr" | "en" = "en",
) => copy[locale].subject[kind];
