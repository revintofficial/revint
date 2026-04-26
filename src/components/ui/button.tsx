import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

// All variants compose from leadac-* tokens. Default/gradient share the
// indigo gradient that gives every CTA the landing-page glow without being
// shouty; destructive uses the desaturated error scale so warnings whisper
// instead of yell.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_24px_hsl(248_62%_34%/0.45)] hover:shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_hsl(248_62%_34%/0.55)] hover:-translate-y-0.5 bg-gradient-to-b from-(--leadac-500) to-(--leadac-700)",
        gradient:
          "text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_24px_hsl(248_62%_34%/0.45)] hover:shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_28px_hsl(248_62%_34%/0.55)] hover:-translate-y-0.5 bg-gradient-to-b from-(--leadac-500) to-(--leadac-700)",
        destructive:
          "text-white shadow-[0_4px_14px_0_hsl(4_62%_54%/0.4)] hover:shadow-[0_6px_20px_0_hsl(4_62%_54%/0.5)] hover:-translate-y-0.5 bg-gradient-to-br from-[hsl(4_62%_60%)] to-[hsl(4_62%_50%)]",
        outline: "text-white border hover:bg-white/5",
        secondary: "text-white hover:brightness-110",
        ghost: "text-white hover:bg-white/5",
        link: "text-(--leadac-300) underline-offset-4 hover:underline hover:text-(--leadac-200)",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3 text-[13px]",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const variantInlineStyles: Record<string, React.CSSProperties> = {
  outline: {
    backgroundColor: "hsl(var(--leadac-h) var(--leadac-ns) 14% / 0.8)",
    borderColor: "hsl(var(--leadac-h) var(--leadac-ns) 35% / 0.35)",
    boxShadow: "0 2px 8px 0 rgba(0, 0, 0, 0.3)",
  },
  secondary: {
    backgroundColor: "hsl(var(--leadac-h) var(--leadac-ns) 14% / 0.8)",
    borderColor: "hsl(var(--leadac-h) var(--leadac-ns) 35% / 0.35)",
    boxShadow: "0 2px 8px 0 rgba(0, 0, 0, 0.3)",
  },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const inlineStyle = variant ? { ...variantInlineStyles[variant], ...style } : style;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={inlineStyle}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
