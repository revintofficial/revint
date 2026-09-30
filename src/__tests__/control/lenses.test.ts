// @vitest-environment node
import { expect, it } from "vitest";
import { currentLensReviews, missingLenses } from "@/lib/control/lenses";
it("takes the newest verdict per lens and ignores null legacy rows", () => {
 const rows = [{ lens: null, createdAt: new Date(4), verdict: "PASS" }, { lens: "TECHNICAL", createdAt: new Date(1), verdict: "FAIL" }, { lens: "TECHNICAL", createdAt: new Date(3), verdict: "PASS" }, { lens: "DOMAIN", createdAt: new Date(2), verdict: "FAIL" }];
 expect(currentLensReviews(rows).map(r => r.verdict)).toEqual(["PASS", "FAIL"]);
 expect(missingLenses(rows)).toEqual(["SALES"]);
});
