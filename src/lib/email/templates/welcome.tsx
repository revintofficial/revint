/**
 * Welcome email — sent once per user on first workspace creation.
 *
 * Tone: short, practical, gets them to the first action (add first lead
 * or run first discovery) without marketing fluff.
 */

import { Section } from "@react-email/components";
import { BaseEmail } from "./base";
import { getAppBaseUrl } from "../from";
import {
  Badge,
  Caption,
  GhostLink,
  H1,
  Lede,
  PrimaryButton,
  StepList,
  tokens,
} from "./_primitives";

interface WelcomeEmailProps {
  fullName?: string | null;
  workspaceName: string;
  locale?: "tr" | "en";
}

const copy = {
  tr: {
    subject: (name: string) => `${name}, Revint hoş geldin`,
    preview: "Hesabın hazır. İlk lead'ini bulmaya geç.",
    eyebrow: "Hesap hazır",
    heading: (name: string) => `Hoş geldin${name ? `, ${name}` : ""}`,
    intro: (ws: string) =>
      `${ws} workspace'in açıldı. Alışmanın en hızlı yolu üç şeyi sırayla denemek — her biri bir tık:`,
    steps: [
      "Bir niş + ilçe yaz, discovery 60 saniyede 50 aday çıkarsın.",
      "Beğendiğin bir lead'i aç, Mockup sekmesine bak — Gemini o iş için hazır site önerisi üretmiş olacak.",
      "Opener iyi göründüyse inbox'ını bağla, tek tıkla gönder.",
    ],
    ctaLabel: "Pano'ya git",
    secondaryLabel: "Dokümantasyon",
    footer:
      "Soru, feedback ya da takıldığın bir yer olursa bu maile doğrudan cevap verebilirsin — hello@revint.dev'a düşer.",
  },
  en: {
    subject: (name: string) => `${name}, welcome to Revint`,
    preview: "Your account is ready. Find your first lead.",
    eyebrow: "Account ready",
    heading: (name: string) => `Welcome${name ? `, ${name}` : ""}`,
    intro: (ws: string) =>
      `Your ${ws} workspace is live. The fastest way to learn it is to do three things in a row — one click each:`,
    steps: [
      "Type a niche + district — discovery surfaces 50 candidates in 60s.",
      "Open one that looks right and check the Mockup tab — Gemini drafts a site tailored to that exact business.",
      "If the opener reads well, connect your inbox and send it in a click.",
    ],
    ctaLabel: "Open dashboard",
    secondaryLabel: "Docs",
    footer:
      "Questions or stuck anywhere? Reply directly to this email — it lands at hello@revint.dev.",
  },
} as const;

export function WelcomeEmail({
  fullName,
  workspaceName,
  locale = "en",
}: WelcomeEmailProps) {
  const c = copy[locale];
  const firstName = (fullName ?? "").split(" ")[0] ?? "";
  const baseUrl = getAppBaseUrl();

  return (
    <BaseEmail preview={c.preview} footerNote={c.footer} tone="accent" lang={locale}>
      <Section style={{ marginBottom: "4px" }}>
        <Badge tone="success">{c.eyebrow}</Badge>
      </Section>

      <H1>{c.heading(firstName)}</H1>
      <Lede>{c.intro(workspaceName)}</Lede>

      <Section
        style={{
          backgroundColor: "#FAFBFC",
          border: `1px solid ${tokens.colors.borderSoft}`,
          borderRadius: "12px",
          padding: "18px 20px 12px 20px",
          margin: "18px 0 22px 0",
        }}
      >
        <StepList items={[...c.steps]} />
      </Section>

      <Section style={{ margin: "4px 0 8px 0" }}>
        <PrimaryButton href={`${baseUrl}/app/dashboard`} tone="accent">
          {c.ctaLabel}
        </PrimaryButton>
        <GhostLink href={`${baseUrl}/docs`}>{c.secondaryLabel} →</GhostLink>
      </Section>

      <Caption>
        {locale === "tr"
          ? "İpucu: ilk discovery'yi sakin bir saatte çalıştır — sonuçları tek tek incelemek lead kalitesi için çok fark ediyor."
          : "Tip: run your first discovery during a quiet moment — going through results one-by-one dramatically improves lead quality."}
      </Caption>
    </BaseEmail>
  );
}

WelcomeEmail.buildSubject = (
  fullName: string | null | undefined,
  locale: "tr" | "en" = "en",
) => {
  const firstName = (fullName ?? "").split(" ")[0] ?? "";
  return copy[locale].subject(
    firstName || (locale === "tr" ? "merhaba" : "hey"),
  );
};
