import { ImageResponse } from "next/og";

/**
 * Shared OG image template. Branded, 1200x630, readable at thumbnail size.
 *
 * Every opengraph-image.tsx route in the app should compose this helper
 * rather than hand-rolling its own layout. Keeps the social-preview look
 * consistent across the whole site.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

export type OgTemplateProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  badge?: string;
  accent?: string;
};

export function renderOgImage(props: OgTemplateProps) {
  const { title, eyebrow, subtitle, badge, accent = "hsl(248 62% 78%)" } = props;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #0f0f16 100%)",
          padding: "72px 80px",
          fontFamily:
            '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 24,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.01em",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${accent} 0%, hsl(248 62% 50%) 100%)`,
                display: "flex",
              }}
            />
            Leadac AI
          </div>
          {badge && (
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: accent,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "flex",
              }}
            >
              {badge}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: accent,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                display: "flex",
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: title.length > 80 ? 58 : 72,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              display: "flex",
              maxWidth: "100%",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                display: "flex",
                maxWidth: 1000,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <span>leadac.ai</span>
          <span>Postcode and a niche. Fresh local leads.</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
