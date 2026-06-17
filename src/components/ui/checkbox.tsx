"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--revint-500)/55 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-(--revint-500) data-[state=checked]:border-(--revint-500) data-[state=indeterminate]:bg-(--revint-500) data-[state=indeterminate]:border-(--revint-500)",
      className
    )}
    style={{ borderColor: "var(--revint-border)" }}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
      {props.checked === "indeterminate" ? (
        <Minus className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
