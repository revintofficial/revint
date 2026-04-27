/**
 * Compact relative-time formatter used by the leads list ("2h ago",
 * "3d ago", "Jul 12"). Intentionally simple — date-fns is in the dep
 * tree but pulling formatDistanceToNow into every list cell is
 * unnecessary for this resolution.
 */
export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) return "now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
