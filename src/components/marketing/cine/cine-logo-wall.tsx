"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Building2 } from "lucide-react";

export type CineLogoWallEntry = {
  /** Plain-text label for the logo slot. Used while we have not collected
   *  written permission for real logos. Replaces "[anonymous logo]" with
   *  a short description like "F&B SaaS BD team" or "Local SEO agency". */
  label: string;
  /** Optional optional-real-logo image src (public path). When set, renders
   *  the image instead of the text slot. */
  imgSrc?: string;
  /** Optional alt for the image. */
  imgAlt?: string;
};

type Props = {
  /** Operator-tone framing line. Default reads: "Used by N agencies in M cities. Real logos when our customers want them up — we don't ship anonymous claims." */
  framing?: string;
  /** Optional eyebrow text above the framing. */
  eyebrow?: string;
  /** Slots — usually 5-8 entries. */
  entries: CineLogoWallEntry[];
};

/**
 * Light-section logo wall placeholder. Until at least 3 customers grant
 * written permission for their real logo, this renders as text-slot
 * placeholders with the operator-tone framing baked in. The framing line
 * is itself the trust signal — "we don't ship anonymous claims" is more
 * credible than a row of grey-scale logos with no source.
 *
 * Once written permission lands for at least 3 customers, swap individual
 * entries to use `imgSrc` and the slot renders the image instead of the
 * text label. Mixed text/image rows render fine.
 */
export function CineLogoWall({ eyebrow, framing, entries }: Props) {
  const reduce = useReducedMotion();

  const fallbackFraming =
    "Used by a small group of operators running outbound across the UK and Europe. We add a logo here when the customer asks us to. We don't ship anonymous proof.";

  return (
    <section
      id="trust"
      className="vx-light-section relative py-16 md:py-20"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-4 mb-10 max-w-2xl mx-auto">
          {eyebrow && (
            <span className="vx-badge-light">{eyebrow}</span>
          )}
          <p className="text-[14px] md:text-[15px] text-[color:var(--vx-ink-mute)] leading-relaxed max-w-xl">
            {framing ?? fallbackFraming}
          </p>
        </div>

        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4"
        >
          {entries.map((e) => (
            <div
              key={e.label}
              className="rounded-xl px-4 py-5 flex items-center justify-center gap-2 min-h-[80px]"
              style={{
                background: "var(--vx-card)",
                border: "1px dashed var(--vx-rule, rgba(22,19,31,0.10))",
              }}
            >
              {e.imgSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={e.imgSrc}
                  alt={e.imgAlt ?? e.label}
                  className="max-h-8 w-auto opacity-70 hover:opacity-100 transition-opacity"
                />
              ) : (
                <>
                  <Building2
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: "var(--vx-ink-mute)" }}
                    aria-hidden
                  />
                  <span className="text-[12px] md:text-[12.5px] text-[color:var(--vx-ink-soft)] font-medium text-center">
                    {e.label}
                  </span>
                </>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
