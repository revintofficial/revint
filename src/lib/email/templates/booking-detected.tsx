/**
 * Booking detected — fires when crawl finds an embedded booking system
 * (Calendly / Cal.com / Setmore / etc.) on a lead's site. This is
 * actually *negative* signal for the core Revint pitch ("modernize
 * your site"), so the alert tells the owner to DROP the lead from the
 * "no booking" segment rather than flagging it as hot.
 *
 * Rate limited at the call site identically to lead-alert.
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
} from "./_primitives";

interface BookingDetectedEmailProps {
  businessName: string;
  provider: string;
  leadId: string;
  locale?: "tr" | "en";
}

const copy = {
  tr: {
    subject: (n: string, p: string) => `${n} zaten ${p} kullanıyor`,
    preview: "Crawl sırasında aktif bir booking sistemi yakalandı.",
    eyebrow: "Booking bulundu",
    heading: (p: string) => `${p} tespit edildi`,
    intro: (n: string, p: string) =>
      `${n} sitesinde ${p} gömülü olarak yakalandı. Bu lead otomatik olarak "booking sistemi yok" segmentinden çıkarıldı — "modernize et" açısı artık geçerli değil. İstersen farklı bir açıyla (review yönetimi, SEO, reklam) devam edebilirsin.`,
    businessLabel: "İşletme",
    providerLabel: "Tespit edilen sistem",
    statusLabel: "Segment",
    statusValue: "Otomatik çıkarıldı",
    ctaLabel: "Lead'i incele",
    footer:
      "Bu tip bildirimler 24 saatte bir kez gider — crawl tekrarlı çalışsa da tek mail alırsın.",
  },
  en: {
    subject: (n: string, p: string) => `${n} already uses ${p}`,
    preview: "Crawl found an active booking system.",
    eyebrow: "Booking found",
    heading: (p: string) => `${p} detected`,
    intro: (n: string, p: string) =>
      `${p} is embedded on ${n}'s site. This lead has been auto-removed from the "no booking" segment — the "modernize" pitch no longer applies. You can still pursue them with a different angle (reviews, SEO, ads).`,
    businessLabel: "Business",
    providerLabel: "System found",
    statusLabel: "Segment",
    statusValue: "Auto-removed",
    ctaLabel: "Review lead",
    footer:
      "These alerts are sent at most once per 24h — repeated crawls won't retrigger the email.",
  },
} as const;

export function BookingDetectedEmail({
  businessName,
  provider,
  leadId,
  locale = "en",
}: BookingDetectedEmailProps) {
  const c = copy[locale];
  const baseUrl = getAppBaseUrl();

  return (
    <BaseEmail preview={c.preview} footerNote={c.footer} tone="warning" lang={locale}>
      <Section style={{ marginBottom: "4px" }}>
        <Badge tone="warning" icon="⚑">{c.eyebrow}</Badge>
      </Section>

      <H1>{c.heading(provider)}</H1>
      <Lede>{c.intro(businessName, provider)}</Lede>

      <InfoCard tone="warning">
        <StatRow label={c.businessLabel} value={businessName} />
        <StatRow label={c.providerLabel} value={provider} />
        <StatRow
          label={c.statusLabel}
          value={<Badge tone="warning">{c.statusValue}</Badge>}
        />
      </InfoCard>

      <Section style={{ margin: "6px 0 8px 0" }}>
        <PrimaryButton href={`${baseUrl}/app/leads/${leadId}`} tone="neutral">
          {c.ctaLabel}
        </PrimaryButton>
      </Section>

      <Caption>
        {locale === "tr"
          ? "İpucu: booking sistemi olan işletmelere \"review yönetimi\" ya da \"Google Ads\" açısı genellikle daha iyi çalışır."
          : "Tip: businesses with booking already live tend to respond better to \"review management\" or \"Google Ads\" angles."}
      </Caption>
    </BaseEmail>
  );
}

BookingDetectedEmail.buildSubject = (
  businessName: string,
  provider: string,
  locale: "tr" | "en" = "en",
) => copy[locale].subject(businessName, provider);
