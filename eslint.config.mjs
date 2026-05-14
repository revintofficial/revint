import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // -------------------------------------------------------------------
  // Truth Layer v1 — Contracts bus discipline (master plan §1.3).
  //
  // Every consumer of a Truth Layer contract MUST import from the
  // barrel `@/lib/sdr-brain/contracts`, never from the individual
  // contract files. This:
  //   - keeps `git grep "@/lib/sdr-brain/contracts"` honest about who
  //     consumes what (used by `scripts/check-contracts.ts`);
  //   - lets the Contracts Steward bump a contract's `__contractVersion`
  //     and have `tsc --noEmit` cascade-fail every downstream consumer;
  //   - prevents agents from importing private helpers that aren't part
  //     of the published contract surface.
  //
  // The contract files themselves can import from each other (severity
  // → switch-signal etc) — that's why the "self" pattern below is
  // excluded from the rule.
  // -------------------------------------------------------------------
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/lib/sdr-brain/contracts/**",
      // Tests + scripts may import directly when they are explicitly
      // exercising a single contract file (e.g. version-bump tests).
      "src/__tests__/sdr-brain/contracts/**",
      "scripts/check-contracts.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/sdr-brain/contracts/*",
                "src/lib/sdr-brain/contracts/*",
                "../sdr-brain/contracts/*",
                "../../sdr-brain/contracts/*",
                "../../../sdr-brain/contracts/*",
              ],
              message:
                "Import Truth Layer contracts from the barrel (`@/lib/sdr-brain/contracts`), not the individual files. See master plan §1.3.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
