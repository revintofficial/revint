/**
 * Shared React Email layout for all transactional templates.
 *
 * Renders a polished, cross-client layout:
 *   - Accent bar at the card top (tone-aware)
 *   - Brand header with gradient logo tile + wordmark + tagline
 *   - Content slot
 *   - Footer with company address, support link, social row
 *
 * Inline styles only — <style> blocks are dropped by Gmail, Outlook, Yahoo.
 * Layout uses Row/Column (tables under the hood) so Outlook desktop renders.
 */

import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { AccentStrip, BrandMark, tokens, type Tone } from "./_primitives";

interface BaseEmailProps {
  /** Short snippet shown in the inbox list preview (Gmail, Outlook). */
  preview: string;
  /** Main content. Wrap related blocks in <Section> for clean spacing. */
  children: ReactNode;
  /** Appended to the footer — useful for per-template legal / opt-out notes. */
  footerNote?: ReactNode;
  /** Drives the top accent bar color. Defaults to "accent" (primary). */
  tone?: Tone;
  /** Optional language for the <html lang=""> attribute. Defaults to "en". */
  lang?: "tr" | "en";
}

const styles = {
  body: {
    backgroundColor: tokens.colors.bg,
    fontFamily: tokens.font,
    margin: 0,
    padding: "32px 16px",
    WebkitFontSmoothing: "antialiased" as const,
    MozOsxFontSmoothing: "grayscale" as const,
  },
  container: {
    backgroundColor: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: "14px",
    margin: "0 auto",
    maxWidth: "580px",
    overflow: "hidden" as const,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.06)",
  },
  headerSection: {
    padding: "28px 32px 20px 32px",
    borderBottom: `1px solid ${tokens.colors.borderSoft}`,
  },
  contentSection: {
    padding: "28px 32px 8px 32px",
  },
  footerSection: {
    padding: "20px 32px 28px 32px",
    backgroundColor: "#FAFBFC",
    borderTop: `1px solid ${tokens.colors.borderSoft}`,
  },
  footerText: {
    color: tokens.colors.textMuted,
    fontFamily: tokens.font,
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
  },
  footerDim: {
    color: tokens.colors.textFaint,
    fontFamily: tokens.font,
    fontSize: "11px",
    lineHeight: "16px",
    margin: "6px 0 0 0",
  },
  footerLink: {
    color: tokens.colors.textBody,
    textDecoration: "underline",
    fontWeight: 500,
  },
  footerLinkMuted: {
    color: tokens.colors.textMuted,
    textDecoration: "none",
    fontWeight: 500,
  },
};

export function BaseEmail({
  preview,
  children,
  footerNote,
  tone = "accent",
  lang = "en",
}: BaseEmailProps) {
  const copy = lang === "tr" ? footerCopy.tr : footerCopy.en;

  return (
    <Html lang={lang}>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <AccentStrip tone={tone} />

          <Section style={styles.headerSection}>
            <BrandMark />
          </Section>

          <Section style={styles.contentSection}>{children}</Section>

          <Section style={styles.footerSection}>
            {footerNote ? (
              <Text
                style={{
                  ...styles.footerText,
                  marginBottom: "10px",
                }}
              >
                {footerNote}
              </Text>
            ) : null}

            <Row>
              <td>
                <Text style={styles.footerText}>
                  <strong style={{ color: tokens.colors.text }}>Leadac AI</strong>{" "}
                  · {copy.tagline}
                </Text>
                <Text style={styles.footerDim}>
                  {copy.supportPrefix}{" "}
                  <Link
                    href="mailto:hello@leadacai.com"
                    style={styles.footerLink}
                  >
                    hello@leadacai.com
                  </Link>
                  {" · "}
                  <Link href="https://leadacai.com" style={styles.footerLinkMuted}>
                    leadacai.com
                  </Link>
                </Text>
                <Text style={styles.footerDim}>
                  {copy.address}
                </Text>
              </td>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const footerCopy = {
  tr: {
    tagline: "Yerel servis işletmeleri için AI destekli satış pipeline'ı",
    supportPrefix: "Destek:",
    address: "Leadac AI · Londra, UK",
  },
  en: {
    tagline: "AI-assisted sales pipeline for local service businesses",
    supportPrefix: "Support:",
    address: "Leadac AI · London, UK",
  },
};
