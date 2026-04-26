import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl", className)}
      style={{ backgroundColor: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.1)" }}
      {...props}
    />
  );
}

export { Skeleton };
