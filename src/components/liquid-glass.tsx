"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type LiquidGlassIntensity = "soft" | "default" | "strong";

type LiquidGlassProps = React.HTMLAttributes<HTMLDivElement> & {
  contentClassName?: string;
  distortion?: number;
  intensity?: LiquidGlassIntensity;
  interactive?: boolean;
};

const intensityClasses: Record<LiquidGlassIntensity, string> = {
  soft:
    "border-[hsl(var(--revint-h)_var(--revint-nts)_88%_/_0.24)] bg-[hsl(var(--revint-h)_var(--revint-ns)_11%_/_0.20)] shadow-[0_10px_32px_hsl(var(--revint-h)_var(--revint-ns)_2%_/_0.24),0_0_0_1px_hsl(var(--revint-h)_var(--revint-nts)_96%_/_0.08)_inset]",
  default:
    "border-[hsl(var(--revint-h)_var(--revint-nts)_88%_/_0.32)] bg-[hsl(var(--revint-h)_var(--revint-ns)_10%_/_0.32)] shadow-[0_14px_44px_hsl(var(--revint-h)_var(--revint-ns)_2%_/_0.30),0_0_0_1px_hsl(var(--revint-h)_var(--revint-nts)_96%_/_0.10)_inset]",
  strong:
    "border-[hsl(var(--revint-h)_var(--revint-nts)_88%_/_0.42)] bg-[hsl(var(--revint-h)_var(--revint-ns)_8%_/_0.44)] shadow-[0_18px_58px_hsl(var(--revint-h)_var(--revint-ns)_2%_/_0.40),0_0_0_1px_hsl(var(--revint-h)_var(--revint-nts)_96%_/_0.14)_inset]",
};

export function LiquidGlass({
  children,
  className,
  contentClassName,
  distortion = 42,
  intensity = "default",
  interactive = false,
  style,
  ...props
}: LiquidGlassProps) {
  const reactId = React.useId().replace(/:/g, "");
  const filterId = `liquid-glass-${reactId}`;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border text-[var(--revint-text-1)] backdrop-blur-2xl",
        intensityClasses[intensity],
        interactive &&
          "transition-all duration-300 ease-out hover:-translate-y-px hover:border-[hsl(var(--revint-h)_var(--revint-s)_68%_/_0.48)] hover:bg-[hsl(var(--revint-h)_var(--revint-ns)_10%_/_0.40)]",
        className,
      )}
      style={{
        backdropFilter: "blur(28px) saturate(190%) contrast(1.05)",
        WebkitBackdropFilter: "blur(28px) saturate(190%) contrast(1.05)",
        ...style,
      }}
      {...props}
    >
      <LiquidGlassFilter distortion={distortion} id={filterId} />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-95"
        style={{
          backdropFilter: "blur(8px) saturate(210%)",
          WebkitBackdropFilter: "blur(8px) saturate(210%)",
          filter: `url(#${filterId})`,
          isolation: "isolate",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--revint-h) var(--revint-nts) 96% / 0.28) 0%, hsl(var(--revint-h) var(--revint-nts) 96% / 0.07) 28%, transparent 58%), radial-gradient(90% 70% at 10% 0%, hsl(var(--revint-h) var(--revint-s) 72% / 0.18), transparent 62%), radial-gradient(80% 75% at 100% 100%, hsl(var(--revint-h) var(--revint-ns) 70% / 0.08), transparent 64%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1px 1px 0 hsl(var(--revint-h) var(--revint-nts) 96% / 0.52), inset -1px -1px 0 hsl(var(--revint-h) var(--revint-ns) 4% / 0.24), inset 0 0 28px hsl(var(--revint-h) var(--revint-nts) 96% / 0.06)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 top-0 z-20 h-px bg-[hsl(var(--revint-h)_var(--revint-nts)_96%_/_0.68)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-8 z-20 h-28 w-px bg-[linear-gradient(to_bottom,transparent,hsl(var(--revint-h)_var(--revint-nts)_96%_/_0.52),transparent)]"
      />

      <div className={cn("relative z-30", contentClassName)}>{children}</div>
    </div>
  );
}

function LiquidGlassFilter({
  distortion,
  id,
}: {
  distortion: number;
  id: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0"
      focusable="false"
    >
      <filter
        id={id}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          baseFrequency="0.006 0.014"
          numOctaves="1"
          result="turbulence"
          seed="17"
          type="fractalNoise"
        />
        <feGaussianBlur in="turbulence" result="softMap" stdDeviation="2.2" />
        <feSpecularLighting
          in="softMap"
          lightingColor="var(--revint-text-1)"
          result="specLight"
          specularConstant="0.75"
          specularExponent="90"
          surfaceScale="3"
        >
          <fePointLight x="-180" y="-160" z="260" />
        </feSpecularLighting>
        <feComposite
          in="specLight"
          in2="SourceGraphic"
          k1="0"
          k2="1"
          k3="0.7"
          k4="0"
          operator="arithmetic"
          result="litImage"
        />
        <feDisplacementMap
          in="litImage"
          in2="softMap"
          scale={distortion}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export const Component = () => (
  <div className="flex min-h-[320px] items-center justify-center bg-[var(--revint-bg)] p-8">
    <LiquidGlass
      className="rounded-3xl"
      contentClassName="max-w-sm p-6 text-center"
      intensity="strong"
      interactive
    >
      <p className="text-sm font-semibold text-[var(--revint-text-1)]">
        Liquid glass is installed and ready for Revint surfaces.
      </p>
      <p className="mt-2 text-sm font-normal text-[var(--revint-text-2)]">
        It uses the project color tokens and the registry SVG distortion filter.
      </p>
    </LiquidGlass>
  </div>
);

export default LiquidGlass;
