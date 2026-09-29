// @vitest-environment node
import { expect, it } from "vitest";
import { toDecisionCard } from "@/lib/control/decision";
import { lensDecisionRows, technicalSourceLines } from "@/lib/control/lens-card";

const card = toDecisionCard({
  salesConfidence: 64,
  headline: "Kurs sitesi randevu toplamıyor",
  briefMode: "brief-analysis",
  headAgent: {
    confidence: 70,
    recommendedModules: [{ module: "website" }, { module: "reservation" }],
    primaryAngle: "Daha çok kayıt",
    talkTrack: "Üç şubeniz var.",
    recommendedPackage: "Web",
    excludedModules: [{ module: "order_and_pay", why: "Kurs sipariş almaz" }],
    sourceConflicts: [{ claim: "Yorumlar 2024'te kalmış." }],
    evidenceRefs: ["site"],
    reasoning: "Kısa",
  },
}, { finishedAt: "2026-09-28T19:44:37.126Z", locationCount: 2 });

it("shows Teknik the claim, source time, evidence, and a missing worker as Kayıt yok", () => {
  expect(lensDecisionRows(card, "TECHNICAL").map((row) => row.label)).toEqual([
    "İddialar",
    "Kaynak zamanı (brief bitişi)",
    "Kanıt",
    "Karar üretimi",
  ]);
  const lines = technicalSourceLines([], []);
  expect(lines.map((line) => line.group)).toEqual(["Harita", "Site", "Yorum", "Karar", "CRM"]);
  expect(lines.every((line) => line.value === "Kayıt yok")).toBe(true);
});

it("shows Alan the score, module order, package, and exclusions", () => {
  expect(lensDecisionRows(card, "DOMAIN").map((row) => row.label)).toEqual([
    "ICP uyumu",
    "Karar güveni",
    "Birincil modül",
    "Modüller (öncelik sırası)",
    "Paket",
    "Hariç tutulanlar",
  ]);
  expect(lensDecisionRows(card, "DOMAIN").find((row) => row.label === "Birincil modül")?.value).toBe("Web sitesi");
});

it("shows Satış the talk track, location count, package, and claims", () => {
  const rows = lensDecisionRows(card, "SALES");
  expect(rows.map((row) => row.label)).toEqual([
    "Konuşma",
    "Aynı hesaptaki lokasyon",
    "Paket",
    "İddialar",
    "Açı",
    "ICP uyumu",
  ]);
  expect(rows.find((row) => row.label === "Aynı hesaptaki lokasyon")?.value).toBe("2");
  expect(rows.find((row) => row.label === "Konuşma")?.value).toBe("Üç şubeniz var.");
});
