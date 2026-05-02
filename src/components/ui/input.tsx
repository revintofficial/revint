import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border text-sm text-white ring-offset-black transition-colors duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none focus:border-(--leadac-500) focus:shadow-[0_0_0_4px_hsl(var(--leadac-h)_var(--leadac-s)_50%/0.15)] disabled:cursor-not-allowed disabled:opacity-50 px-3 py-2",
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
Input.displayName = "Input";

export { Input };
