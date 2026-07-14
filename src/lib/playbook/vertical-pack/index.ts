/**
 * Vertical pack registry — public entry point.
 *
 * Add a niche by writing a pack under `./packs/<niche>.ts` and
 * registering it here. The engine and the Head Agent stay unchanged.
 */

export * from "./engine";
export { FNB_PACK, type FineDineModule, type FnbSignals, type FnbNormalized } from "./packs/fnb";

import { FNB_PACK } from "./packs/fnb";
import { computeModuleFit, type ModuleFitResult, type VerticalPack } from "./engine";

/** Known pack ids. Extend as new niches are added. */
export type VerticalPackId = "fnb";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const REGISTRY: Record<VerticalPackId, VerticalPack<any, any, any>> = {
  fnb: FNB_PACK,
};

/** Resolve a registered pack by id (undefined if unknown). */
export function getVerticalPack(id: string): VerticalPack<string, unknown, unknown> | undefined {
  return REGISTRY[id as VerticalPackId];
}

/** All registered packs (for diagnostics / UI). */
export function listVerticalPacks(): Array<{ id: string; label: string }> {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, label: p.label }));
}

/**
 * Run a registered pack by id over raw substrate. Returns null if the
 * pack id is unknown (caller decides the fallback).
 */
export function runVerticalPack(
  id: string,
  raw: unknown,
): ModuleFitResult<string> | null {
  const pack = getVerticalPack(id);
  if (!pack) return null;
  return computeModuleFit(pack, raw);
}
