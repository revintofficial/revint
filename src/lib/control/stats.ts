/** Small, dependency-free statistics for the control room. No bare pass rate leaves this file. */

export type Interval = { p: number; low: number; high: number; n: number; decidable: boolean };

/** Below this many items a rate never decides a gate. */
export const MIN_DECIDABLE_N = 50;
/** A 95% interval wider than this is too loose to act on. */
export const MAX_DECIDABLE_WIDTH = 0.25;

/** 95% Wilson score interval. `total = 0` returns an undecidable empty interval. */
export function wilson(passed: number, total: number, z = 1.96): Interval {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(passed)) {
    return { p: 0, low: 0, high: 0, n: 0, decidable: false };
  }
  const k = Math.min(Math.max(passed, 0), total);
  const p = k / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  const low = Math.max(0, center - half);
  const high = Math.min(1, center + half);
  return { p, low, high, n: total, decidable: total >= MIN_DECIDABLE_N && high - low <= MAX_DECIDABLE_WIDTH };
}

export function percent(value: number): string {
  return `%${Math.round(value * 100)}`;
}

/** `%60 (12/20) · %39–%78 · karar için yetersiz`. Rate, count, and interval always travel together. */
export function formatRate(passed: number, total: number): string {
  const interval = wilson(passed, total);
  if (interval.n === 0) return "Veri yok · karar için yetersiz";
  const base = `${percent(interval.p)} (${Math.min(Math.max(passed, 0), total)}/${total}) · ${percent(interval.low)}–${percent(interval.high)}`;
  return interval.decidable ? base : `${base} · karar için yetersiz`;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
