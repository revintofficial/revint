import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

// Variants follow the leadac whisper-not-shout rule: tinted background +
// soft semantic text + matching translucent border. Pure neon backgrounds
// are gone; everything reads as a subtle category, not an alert.
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-(--leadac-500) focus:ring-offset-2 focus:ring-offset-black",
  {
    variants: {
      variant: {
        default: "border-transparent text-white",
        secondary: "border-transparent text-white",
        destructive: "border-transparent",
        success: "border-transparent",
        warning: "border-transparent",
        outline: "text-white/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// All tints are the same shape: 14% fill + 25% border + high-contrast
// soft text variant. `default` uses the darker --leadac-700 so white
// text on warm ochre stays AA-contrast compliant (the old 500 swatch
// hit ~2.8:1 which failed WCAG AA).
const variantBgStyles: Record<string, React.CSSProperties> = {
  default: { backgroundColor: "var(--leadac-700)", color: "#fff" },
  secondary: { backgroundColor: "var(--leadac-hover)", color: "var(--leadac-text-1)" },
  destructive: {
    backgroundColor: "color-mix(in oklab, var(--leadac-error) 14%, transparent)",
    color: "var(--leadac-error-soft)",
    borderColor: "color-mix(in oklab, var(--leadac-error) 25%, transparent)",
  },
  success: {
    backgroundColor: "color-mix(in oklab, var(--leadac-success) 14%, transparent)",
    color: "var(--leadac-success-soft)",
    borderColor: "color-mix(in oklab, var(--leadac-success) 25%, transparent)",
  },
  warning: {
    backgroundColor: "color-mix(in oklab, var(--leadac-warning) 14%, transparent)",
    color: "var(--leadac-warning-soft)",
    borderColor: "color-mix(in oklab, var(--leadac-warning) 25%, transparent)",
  },
  outline: { borderColor: "var(--leadac-border)" },
};

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, style, ...props }: BadgeProps) {
  const inlineStyle = variant ? { ...variantBgStyles[variant], ...style } : style;
  return (
    <div className={cn(badgeVariants({ variant }), className)} style={inlineStyle} {...props} />
  );
}
