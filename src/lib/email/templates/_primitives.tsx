/**
 * Shared design primitives for transactional email templates.
 *
 * Inline styles only — Gmail, Outlook, Yahoo strip <style> blocks. Layout
 * leans on <table> via React Email's Section/Row/Column so older clients
 * (Outlook desktop, corporate gateways) render correctly. Keep visual
 * novelty here so templates only express structure + copy.
 */

import { Button, Row, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export const tokens = {
  colors: {
    ink: "#0B0F19",
    text: "#1F2937",
    textBody: "#334155",
    textMuted: "#64748B",
    textFaint: "#94A3B8",
    bg: "#F4F5F7",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    borderSoft: "#EEF0F3",
    accent: "#4F46E5",
    accentSoft: "#EEF2FF",
    success: "#047857",
    successSoft: "#D1FAE5",
    warning: "#B45309",
    warningSoft: "#FEF3C7",
    danger: "#B91C1C",
    dangerSoft: "#FEE2E2",
    gradientStart: "#6366F1",
    gradientEnd: "#8B5CF6",
  },
  font:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, 'Helvetica Neue', Arial, sans-serif",
  radius: { sm: "6px", md: "10px", lg: "14px", pill: "999px" },
} as const;

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneMap: Record<
  Tone,
  { fg: string; bg: string; border: string; strip: string }
> = {
  neutral: {
    fg: tokens.colors.text,
    bg: "#F8FAFC",
    border: tokens.colors.borderSoft,
    strip: tokens.colors.ink,
  },
  accent: {
    fg: tokens.colors.accent,
    bg: tokens.colors.accentSoft,
    border: "#E0E7FF",
    strip: tokens.colors.accent,
  },
  success: {
    fg: tokens.colors.success,
    bg: tokens.colors.successSoft,
    border: "#BBF7D0",
    strip: tokens.colors.success,
  },
  warning: {
    fg: tokens.colors.warning,
    bg: tokens.colors.warningSoft,
    border: "#FDE68A",
    strip: tokens.colors.warning,
  },
  danger: {
    fg: tokens.colors.danger,
    bg: tokens.colors.dangerSoft,
    border: "#FECACA",
    strip: tokens.colors.danger,
  },
};

export function toneStyles(tone: Tone) {
  return toneMap[tone];
}

/* ----------------------------- Brand mark ------------------------------ */

export function BrandMark() {
  return (
    <Row>
      <td style={{ paddingRight: "12px", width: "44px", verticalAlign: "middle" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "11px",
            backgroundColor: tokens.colors.gradientStart,
            backgroundImage: `linear-gradient(135deg, ${tokens.colors.gradientStart} 0%, ${tokens.colors.gradientEnd} 100%)`,
            color: "#FFFFFF",
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: "40px",
            textAlign: "center",
            letterSpacing: "-0.02em",
            boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
          }}
        >
          L
        </div>
      </td>
      <td style={{ verticalAlign: "middle" }}>
        <Text
          style={{
            margin: 0,
            color: tokens.colors.ink,
            fontFamily: tokens.font,
            fontSize: "17px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: "22px",
          }}
        >
          Revint
        </Text>
        <Text
          style={{
            margin: 0,
            color: tokens.colors.textMuted,
            fontFamily: tokens.font,
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: "16px",
            letterSpacing: "0.01em",
          }}
        >
          Local sales, AI assisted
        </Text>
      </td>
    </Row>
  );
}

/* --------------------------- Accent top strip -------------------------- */

export function AccentStrip({ tone = "accent" }: { tone?: Tone }) {
  const { strip } = toneMap[tone];
  return (
    <div
      style={{
        height: "3px",
        width: "100%",
        backgroundColor: strip,
        backgroundImage:
          tone === "accent"
            ? `linear-gradient(90deg, ${tokens.colors.gradientStart} 0%, ${tokens.colors.gradientEnd} 100%)`
            : undefined,
        borderTopLeftRadius: "14px",
        borderTopRightRadius: "14px",
      }}
    />
  );
}

/* -------------------------------- Badge -------------------------------- */

export function Badge({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: string;
}) {
  const t = toneMap[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 11px",
        borderRadius: tokens.radius.pill,
        backgroundColor: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: "16px",
        letterSpacing: "0.02em",
        fontFamily: tokens.font,
      }}
    >
      {icon ? <span style={{ marginRight: "6px" }}>{icon}</span> : null}
      {children}
    </span>
  );
}

/* ------------------------------- InfoCard ------------------------------ */

export function InfoCard({
  tone = "neutral",
  children,
  style,
}: {
  tone?: Tone;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const t = toneMap[tone];
  return (
    <Section
      style={{
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: tokens.radius.md,
        padding: "16px 18px",
        margin: "16px 0",
        ...style,
      }}
    >
      {children}
    </Section>
  );
}

/* ------------------------------- StatRow ------------------------------- */

export function StatRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Row style={{ margin: "0 0 6px 0" }}>
      <td
        style={{
          width: "38%",
          padding: "6px 12px 6px 0",
          verticalAlign: "top",
          color: tokens.colors.textMuted,
          fontFamily: tokens.font,
          fontSize: "13px",
          lineHeight: "20px",
          fontWeight: 500,
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "6px 0",
          verticalAlign: "top",
          color: tokens.colors.text,
          fontFamily: mono
            ? "'SF Mono', ui-monospace, Menlo, Consolas, monospace"
            : tokens.font,
          fontSize: "13px",
          lineHeight: "20px",
          fontWeight: 600,
        }}
      >
        {value}
      </td>
    </Row>
  );
}

/* ----------------------------- ScoreMeter ------------------------------ */

/**
 * Horizontal meter + big number for lead scores. Tone auto-picks from the
 * value — 85+ success, 70+ accent, 50+ warning, else neutral.
 */
export function ScoreMeter({
  score,
  outOf = 100,
  label,
}: {
  score: number;
  outOf?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((score / outOf) * 100)));
  const tone: Tone =
    score >= 85 ? "success" : score >= 70 ? "accent" : score >= 50 ? "warning" : "neutral";
  const t = toneMap[tone];

  return (
    <Section style={{ margin: "8px 0 12px 0" }}>
      <Row>
        <td style={{ verticalAlign: "middle", width: "auto" }}>
          <Text
            style={{
              margin: 0,
              color: t.fg,
              fontFamily: tokens.font,
              fontSize: "32px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: "36px",
            }}
          >
            {score}
            <span
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: tokens.colors.textMuted,
                marginLeft: "4px",
              }}
            >
              / {outOf}
            </span>
          </Text>
          {label ? (
            <Text
              style={{
                margin: "2px 0 0 0",
                color: tokens.colors.textMuted,
                fontFamily: tokens.font,
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </Text>
          ) : null}
        </td>
      </Row>
      <div
        style={{
          marginTop: "10px",
          height: "6px",
          width: "100%",
          backgroundColor: tokens.colors.borderSoft,
          borderRadius: tokens.radius.pill,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: t.strip,
            backgroundImage:
              tone === "success"
                ? "linear-gradient(90deg, #10B981 0%, #059669 100%)"
                : tone === "accent"
                  ? `linear-gradient(90deg, ${tokens.colors.gradientStart} 0%, ${tokens.colors.gradientEnd} 100%)`
                  : undefined,
            borderRadius: tokens.radius.pill,
          }}
        />
      </div>
    </Section>
  );
}

/* ------------------------------ Headings ------------------------------- */

export function H1({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: tokens.colors.ink,
        fontFamily: tokens.font,
        fontSize: "24px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: "30px",
        margin: "0 0 12px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: tokens.colors.textBody,
        fontFamily: tokens.font,
        fontSize: "15px",
        fontWeight: 400,
        lineHeight: "23px",
        margin: "0 0 16px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: tokens.colors.textMuted,
        fontFamily: tokens.font,
        fontSize: "13px",
        lineHeight: "20px",
        margin: "0 0 8px 0",
      }}
    >
      {children}
    </Text>
  );
}

/* ------------------------------- Buttons ------------------------------- */

export function PrimaryButton({
  href,
  children,
  tone = "neutral",
}: {
  href: string;
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger";
}) {
  const palette: Record<string, { bg: string; fg: string; shadow: string }> = {
    neutral: {
      bg: tokens.colors.ink,
      fg: "#FFFFFF",
      shadow: "0 1px 2px rgba(11, 15, 25, 0.08), 0 4px 10px rgba(11, 15, 25, 0.14)",
    },
    accent: {
      bg: tokens.colors.accent,
      fg: "#FFFFFF",
      shadow: "0 1px 2px rgba(79, 70, 229, 0.1), 0 4px 12px rgba(79, 70, 229, 0.25)",
    },
    danger: {
      bg: tokens.colors.danger,
      fg: "#FFFFFF",
      shadow: "0 1px 2px rgba(185, 28, 28, 0.1), 0 4px 12px rgba(185, 28, 28, 0.25)",
    },
  };
  const p = palette[tone];
  return (
    <Button
      href={href}
      style={{
        backgroundColor: p.bg,
        borderRadius: "10px",
        color: p.fg,
        display: "inline-block",
        fontFamily: tokens.font,
        fontSize: "14px",
        fontWeight: 600,
        letterSpacing: "-0.005em",
        padding: "13px 22px",
        textDecoration: "none",
        boxShadow: p.shadow,
      }}
    >
      {children}
    </Button>
  );
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        color: tokens.colors.textMuted,
        fontFamily: tokens.font,
        fontSize: "13px",
        fontWeight: 500,
        textDecoration: "underline",
        marginLeft: "14px",
      }}
    >
      {children}
    </a>
  );
}

/* ------------------------------ Step list ------------------------------ */

export function StepList({ items }: { items: string[] }) {
  return (
    <Section style={{ margin: "4px 0 8px 0" }}>
      {items.map((item, i) => (
        <Row key={item} style={{ margin: "0 0 10px 0" }}>
          <td
            style={{
              width: "28px",
              paddingRight: "12px",
              verticalAlign: "top",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.accentSoft,
                color: tokens.colors.accent,
                fontSize: "12px",
                fontWeight: 700,
                lineHeight: "24px",
                textAlign: "center",
                fontFamily: tokens.font,
              }}
            >
              {i + 1}
            </div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Text
              style={{
                margin: 0,
                color: tokens.colors.textBody,
                fontFamily: tokens.font,
                fontSize: "14px",
                lineHeight: "22px",
                paddingTop: "1px",
              }}
            >
              {item}
            </Text>
          </td>
        </Row>
      ))}
    </Section>
  );
}

/* ------------------------------ Divider -------------------------------- */

export function SoftDivider() {
  return (
    <div
      style={{
        height: "1px",
        backgroundColor: tokens.colors.borderSoft,
        margin: "20px 0",
      }}
    />
  );
}
