import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border text-sm text-white ring-offset-black transition-colors duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none focus:border-[#0A84FF] focus:shadow-[0_0_0_4px_rgba(10,132,255,0.1)] disabled:cursor-not-allowed disabled:opacity-50 px-3 py-2",
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
Input.displayName = "Input";

export { Input };
