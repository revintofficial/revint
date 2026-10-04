// src/lib/site-capture/ledger.ts
/**
 * Coverage ledger: every discovered address ends with exactly one result
 * (opened, skipped with a reason, failed with a reason). This is what lets
 * the audit say "looked and not there" instead of a bare "no".
 */
import type { LedgerEntry, LedgerReason } from "./types";
import { urlKey } from "./url";

export class CoverageLedger {
  private readonly byKey = new Map<string, LedgerEntry>();

  /** The first result recorded for an address stands. */
  record(entry: LedgerEntry): void {
    const key = urlKey(entry.url) ?? entry.url;
    if (!this.byKey.has(key)) this.byKey.set(key, entry);
  }

  has(url: string): boolean {
    return this.byKey.has(urlKey(url) ?? url);
  }

  entries(): LedgerEntry[] {
    return [...this.byKey.values()];
  }
}

export function summarizeLedger(entries: LedgerEntry[]): {
  opened: number;
  skipped: number;
  failed: number;
  byReason: Partial<Record<LedgerReason, number>>;
} {
  const out = { opened: 0, skipped: 0, failed: 0, byReason: {} as Partial<Record<LedgerReason, number>> };
  for (const e of entries) {
    out[e.outcome]++;
    if (e.reason) out.byReason[e.reason] = (out.byReason[e.reason] ?? 0) + 1;
  }
  return out;
}

/** Discovered addresses without a ledger result (must be empty at the end of a capture). */
export function missingFromLedger(discovered: string[], entries: LedgerEntry[]): string[] {
  const keys = new Set(entries.map((e) => urlKey(e.url) ?? e.url));
  return discovered.filter((u) => !keys.has(urlKey(u) ?? u));
}
