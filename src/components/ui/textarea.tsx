import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border text-sm text-white ring-offset-black transition-colors duration-200 focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_4px_rgba(10,132,255,0.1)] disabled:cursor-not-allowed disabled:opacity-50 px-3 py-2",
        className
      )}
      style={{
        backgroundColor: "rgba(44, 44, 46, 0.8)",
        borderColor: "rgba(84, 84, 88, 0.35)",
        ...style,
      }}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
