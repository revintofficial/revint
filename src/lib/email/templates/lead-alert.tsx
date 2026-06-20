/**
 * Lead alert — sent to the workspace owner when a newly analyzed lead
 * scores above the "hot" threshold. Rate-limited at the call site (one
 * alert per workspace per 24h) so a bulk discovery run doesn't turn
 * into 200 emails.
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
  ScoreMeter,
  StatRow,
  tokens,
} from "./_primitives";

interface LeadAlertEmailProps {
  businessName: string;
  score: number;
  city: string | null;
  reasonSummary: string | null;
  leadId: string;
  locale?: "tr" | "en";
}

const copy = {
  tr: {
    subject: (n: string, s: number) => `${s} puanlık sıcak lead: ${n}`,
    preview: "Yüksek skorlu yeni bir lead yakalandı.",
    eyebrow: "Sıcak lead",
    heading: "Yeni bir fırsat geldi",
    lede: (n: string) =>
      `${n} üzerinde yaptığımız analiz, sıcak lead eşiğini aştı. Özet aşağıda — satışa geçmek istersen tek tık uzakta.`,
    scoreLabel: "Fırsat skoru",
    businessLabel: "İşletme",
    cityLabel: "Konum",
    reasonLabel: "Ön değerlendirme",
    ctaLabel: "Lead'e git",
    footer:
      "Bu bildirim, aynı workspace için 24 saatte bir kez gider. Bulk discovery sonuçları tek tek düşmesin diye.",
  },
  en: {
    subject: (n: string, s: number) => `Hot lead (${s}): ${n}`,
    preview: "A high-scoring lead just landed.",
    eyebrow: "Hot lead",
    heading: "A fresh opportunity just landed",
    lede: (n: string) =>
      `Our analysis of ${n} just crossed the hot-lead threshold. Quick summary below — it's one click away from outreach.`,
    scoreLabel: "Opportunity score",
    businessLabel: "Business",
    cityLabel: "Location",
    reasonLabel: "Quick read",
    ctaLabel: "Open lead",
    footer:
      "We send at most one of these per workspace per 24h so a bulk discovery run doesn't flood your inbox.",
  },
} as const;

export function LeadAlertEmail({
  businessName,
  score,
  city,
  reasonSummary,
  leadId,
  locale = "en",
}: LeadAlertEmailProps) {
  const c = copy[locale];
  const baseUrl = getAppBaseUrl();
  const tone = score >= 85 ? "success" : "accent";

  return (
    <BaseEmail
      preview={c.preview}
      footerNote={c.footer}
      tone={tone}
      lang={locale}
    >
      <Section style={{ marginBottom: "4px" }}>
        <Badge tone={tone} icon="●">
          {c.eyebrow}
        </Badge>
      </Section>

      <H1>{c.heading}</H1>
      <Lede>{c.lede(businessName)}</Lede>

      <InfoCard tone={tone}>
        <ScoreMeter score={score} outOf={100} label={c.scoreLabel} />
      </InfoCard>

      <Section
        style={{
          backgroundColor: tokens.colors.surfaceAlt,
          border: `1px solid ${tokens.colors.borderSoft}`,
          borderRadius: "12px",
          padding: "14px 18px",
          margin: "0 0 20px 0",
        }}
      >
        <StatRow label={c.businessLabel} value={businessName} />
        {city ? <StatRow label={c.cityLabel} value={city} /> : null}
        {reasonSummary ? (
          <StatRow label={c.reasonLabel} value={reasonSummary} />
        ) : null}
      </Section>

      <Section style={{ margin: "4px 0 8px 0" }}>
        <PrimaryButton href={`${baseUrl}/app/leads/${leadId}`} tone="accent">
          {c.ctaLabel}
        </PrimaryButton>
      </Section>

      <Caption>
        {locale === "tr"
          ? "İpucu: sıcak lead'lerde 24 saatlik yanıt penceresi conversion oranını belirgin şekilde artırıyor."
          : "Tip: responding to hot leads within 24 hours measurably improves conversion."}
      </Caption>
    </BaseEmail>
  );
}

LeadAlertEmail.buildSubject = (
  businessName: string,
  score: number,
  locale: "tr" | "en" = "en",
) => copy[locale].subject(businessName, score);
