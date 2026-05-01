import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps children with iOS safe-area padding. Picks edges via the `edges` prop:
 *   <SafeArea edges={["top", "bottom"]}>...</SafeArea>
 *
 * On RN this maps to `react-native-safe-area-context`'s `<SafeAreaView>`.
 */
export type SafeAreaEdge = "top" | "bottom" | "left" | "right";

export function SafeArea({
  edges = ["top", "bottom", "left", "right"],
  className,
  asChild,
  children,
  ...rest
}: {
  edges?: SafeAreaEdge[];
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const safeClasses = [
    edges.includes("top") && "safe-pt",
    edges.includes("bottom") && "safe-pb",
    edges.includes("left") && "safe-pl",
    edges.includes("right") && "safe-pr",
  ]
    .filter(Boolean)
    .join(" ");

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn(safeClasses, className, child.props.className),
    });
  }

  return (
    <div className={cn(safeClasses, className)} {...rest}>
      {children}
    </div>
  );
}
