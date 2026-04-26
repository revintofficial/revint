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

const variantBgStyles: Record<string, React.CSSProperties> = {
  default: { backgroundColor: "var(--leadac-500)", color: "#fff" },
  secondary: { backgroundColor: "var(--leadac-hover)", color: "var(--leadac-text-1)" },
  destructive: {
    backgroundColor: "hsl(4 62% 54% / 0.14)",
    color: "hsl(4 42% 72%)",
    borderColor: "hsl(4 62% 54% / 0.25)",
  },
  success: {
    backgroundColor: "hsl(152 48% 50% / 0.14)",
    color: "hsl(152 28% 70%)",
    borderColor: "hsl(152 48% 50% / 0.25)",
  },
  warning: {
    backgroundColor: "hsl(38 70% 52% / 0.14)",
    color: "hsl(38 50% 72%)",
    borderColor: "hsl(38 70% 52% / 0.25)",
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
