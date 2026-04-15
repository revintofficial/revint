import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 focus:ring-offset-2 focus:ring-offset-black",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#0A84FF] text-white",
        secondary: "border-transparent text-white",
        destructive: "border-transparent text-[#FF453A]",
        success: "border-transparent text-[#30D158]",
        warning: "border-transparent text-[#FF9F0A]",
        outline: "text-white/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const variantBgStyles: Record<string, React.CSSProperties> = {
  secondary: { backgroundColor: "rgba(235, 235, 245, 0.1)", color: "rgba(235, 235, 245, 0.8)" },
  destructive: { backgroundColor: "rgba(255, 69, 58, 0.2)" },
  success: { backgroundColor: "rgba(48, 209, 88, 0.2)" },
  warning: { backgroundColor: "rgba(255, 159, 10, 0.2)" },
  outline: { borderColor: "rgba(84, 84, 88, 0.35)" },
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
