"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-1.5 w-full grow overflow-hidden rounded-full"
      style={{ backgroundColor: "hsl(var(--leadac-h) var(--leadac-ns) 20% / 0.5)" }}
    >
      <SliderPrimitive.Range
        className="absolute h-full"
        style={{ background: "linear-gradient(90deg, var(--leadac-500), var(--leadac-300))" }}
      />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        className="block h-4 w-4 rounded-full border-2 border-white bg-(--leadac-500) shadow-[0_2px_8px_hsl(248_62%_34%/0.5)] focus:outline-none focus:ring-2 focus:ring-(--leadac-500)/40 focus:ring-offset-2 focus:ring-offset-black disabled:pointer-events-none disabled:opacity-50 transition-transform hover:scale-110"
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
