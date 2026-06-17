import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: "default" | "gradient";
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn("relative h-2 w-full overflow-hidden rounded-full", className)}
        style={{ backgroundColor: "var(--revint-hover)" }}
        {...props}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: "var(--revint-500)" }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

interface CircularProgressProps extends HTMLAttributes<SVGSVGElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  gradient?: boolean;
}

function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  className,
  ...props
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("transform -rotate-90", className)}
      {...props}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--revint-h) var(--revint-ns) 14%)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--revint-h) var(--revint-s) 50%)" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease-out" }} />
    </svg>
  );
}

export { Progress, CircularProgress };
