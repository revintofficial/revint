import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border text-sm text-white ring-offset-black transition-colors duration-200 focus:outline-none focus:border-(--leadac-500) focus:shadow-[0_0_0_4px_hsl(248_62%_50%/0.15)] disabled:cursor-not-allowed disabled:opacity-50 px-3 py-2",
        className
      )}
      style={{
        backgroundColor: "var(--leadac-card)",
        borderColor: "var(--leadac-border)",
        ...style,
      }}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
