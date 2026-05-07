/**
 * Display helpers for the admin dashboard. Pure functions; safe to
 * import from server or client components.
 */

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`;
  const hours = Math.floor(minutes / 60);
  const remM = minutes % 60;
  return remM === 0 ? `${hours}h` : `${hours}h ${remM}m`;
}

export function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function formatCountry(code: string | null | undefined): string {
  if (!code) return "—";
  try {
    return REGION_NAMES.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const cp = (s: string) =>
    String.fromCodePoint(...[...s.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
  return cp(code);
}

export function shortVisitorId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}
