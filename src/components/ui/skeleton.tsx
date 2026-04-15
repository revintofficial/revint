import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl", className)}
      style={{ backgroundColor: "rgba(235, 235, 245, 0.1)" }}
      {...props}
    />
  );
}

export { Skeleton };
