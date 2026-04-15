import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "text-white shadow-[0_4px_14px_0_rgba(10,132,255,0.4)] hover:shadow-[0_6px_20px_0_rgba(10,132,255,0.5)] hover:-translate-y-0.5 bg-gradient-to-br from-[#0A84FF] to-[#007AFF]",
        gradient:
          "text-white shadow-[0_4px_14px_0_rgba(10,132,255,0.4)] hover:shadow-[0_6px_20px_0_rgba(10,132,255,0.5)] hover:-translate-y-0.5 bg-gradient-to-br from-[#0A84FF] to-[#007AFF]",
        destructive:
          "text-white shadow-[0_4px_14px_0_rgba(255,69,58,0.4)] hover:shadow-[0_6px_20px_0_rgba(255,69,58,0.5)] hover:-translate-y-0.5 bg-gradient-to-br from-[#FF453A] to-[#FF3B30]",
        outline: "text-white border hover:bg-white/5",
        secondary: "text-white hover:brightness-110",
        ghost: "text-white hover:bg-white/5",
        link: "text-[#0A84FF] underline-offset-4 hover:underline hover:text-[#64D2FF]",
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
    backgroundColor: "rgba(44, 44, 46, 0.8)",
    borderColor: "rgba(84, 84, 88, 0.35)",
    boxShadow: "0 2px 8px 0 rgba(0, 0, 0, 0.3)",
  },
  secondary: {
    backgroundColor: "rgba(44, 44, 46, 0.8)",
    borderColor: "rgba(84, 84, 88, 0.35)",
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
