/**
 * FineDine module-fit — backward-compatible facade.
 *
 * The scoring engine is now niche-agnostic and lives under
 * `./vertical-pack/`. F&B is the first registered pack
 * (`./vertical-pack/packs/fnb.ts`). This file preserves the original
 * `computeFnbModuleFit` API and the F&B types so existing callers (and
 * the upcoming Head Agent synthesis pass) don't need to change.
 *
 * New code should prefer importing from `./vertical-pack` directly:
 *   import { computeModuleFit, FNB_PACK } from "@/lib/playbook/vertical-pack";
 */

import { computeModuleFit, type ModuleFit, type ScoredPlay, type ModuleFitResult } from "./vertical-pack/engine";
import { FNB_PACK, type FineDineModule, type FnbSignals } from "./vertical-pack/packs/fnb";

export type { FineDineModule, FnbSignals } from "./vertical-pack/packs/fnb";
export type SignalSource = string;

export type FnbModuleFit = ModuleFit<FineDineModule>;
export type FnbScoredPlay = ScoredPlay<FineDineModule>;
export type FnbModuleFitResult = ModuleFitResult<FineDineModule>;

/** Re-exported play library + types from the F&B pack. */
export { FNB_PACK } from "./vertical-pack/packs/fnb";

/**
 * Deterministic FineDine module-fit over raw signals. Thin wrapper over
 * the generic engine bound to the F&B pack.
 */
export function computeFnbModuleFit(s: FnbSignals): FnbModuleFitResult {
  return computeModuleFit(FNB_PACK, s);
}
