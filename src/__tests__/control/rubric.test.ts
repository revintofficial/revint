// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ERROR_CLASSES, RUBRIC, RUBRIC_ENTRIES, RUBRIC_LENS_CLASSES, RUBRIC_VERSION, isErrorClass, rubricEntry } from "@/lib/control/rubric";
import { LENS_ERROR_CLASSES } from "@/lib/control/lens-card";
import { errorClassLabel } from "@/lib/control/labels";

describe("rubric", () => {
  it("has a dated active version", () => {
    expect(RUBRIC_VERSION).toBe("2026-09-29.1");
  });

  it("gives every error class an include rule, an exclude rule, and two examples", () => {
    for (const entries of Object.values(RUBRIC)) {
      for (const e of entries) {
        expect(e.include.length).toBeGreaterThan(10);
        expect(e.exclude.length).toBeGreaterThan(10);
        expect(e.goodExample).toBeTruthy();
        expect(e.badExample).toBeTruthy();
        expect(e.goodExample).not.toBe(e.badExample);
      }
    }
  });

  it("covers all seven error classes across the three lenses", () => {
    const covered = new Set(Object.values(RUBRIC).flat().map(e => e.code));
    expect([...covered].sort()).toEqual([...ERROR_CLASSES].sort());
    expect(RUBRIC_ENTRIES.map(e => e.code)).toEqual([...ERROR_CLASSES]);
  });

  it("offers each lens exactly the classes its review form offers", () => {
    for (const lens of ["TECHNICAL", "DOMAIN", "SALES"] as const) {
      expect(RUBRIC[lens].map(e => e.code)).toEqual([...LENS_ERROR_CLASSES[lens]]);
      expect([...RUBRIC_LENS_CLASSES[lens]]).toEqual([...LENS_ERROR_CLASSES[lens]]);
    }
  });

  it("uses the same Turkish label the rest of the control room uses", () => {
    for (const e of RUBRIC_ENTRIES) expect(e.label).toBe(errorClassLabel(e.code));
  });

  it("anchors examples in the FineDine cases", () => {
    const text = RUBRIC_ENTRIES.map(e => `${e.goodExample} ${e.badExample}`).join(" ");
    for (const name of ["Dishoom", "Bianco43", "Honest Burgers"]) expect(text).toContain(name);
  });

  it("looks up entries by code and rejects unknown codes", () => {
    expect(rubricEntry("STALE_SOURCE")?.label).toBe("Kaynak eski");
    expect(rubricEntry("ALREADY_CUSTOMER")).toBeNull();
    expect(isErrorClass("PIPELINE_OMISSION")).toBe(true);
    expect(isErrorClass("OUT_OF_PROFILE")).toBe(false);
  });
});
