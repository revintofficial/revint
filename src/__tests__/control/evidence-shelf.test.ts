// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toDecisionCard } from "@/lib/control/decision";
import { buildShelf, drawerOrder, isSocialUrl, orderDrawers, shelfAuditFromRow, skipReasonText, turkishNumber, type ShelfInput, type ShelfRun } from "@/lib/control/evidence-shelf";

const FINISHED = "2026-09-28T10:00:00.000Z";
const lead = { websiteUrl: "https://dishoom.com", googleMapsUri: "https://maps.google.com/?cid=1", address: "12 Upper St Martin's Ln, London", rating: 4.6, reviewCount: 1200 };

function run(workerKind: string, output: unknown, status = "SUCCEEDED"): ShelfRun {
  return { workerKind, status, finishedAt: FINISHED, output, errorMsg: null };
}
function reviewRunWith({ count = 120, bars = [] as Array<{ label: string; pct: number }>, pains = [] as unknown[], strengths = [] as string[] } = {}) {
  return run("REVIEW_ANALYST", { reviewsAnalyzedCount: count, weaknessKpis: bars.map(b => ({ label: b.label, percent: b.pct })), painPhrases: pains, strengthPhrases: strengths, summary: "" });
}
function auditRunWith(output: Record<string, unknown>) {
  return run("WEBSITE_AUDITOR", output);
}
function briefOutput(head: Record<string, unknown> = {}) {
  return {
    briefMode: "head-agent",
    salesConfidence: 72,
    missingSources: [],
    headAgent: {
      recommendedPackage: "growth", wedge: "reservation", primaryAngle: "Rezervasyon → Growth",
      talkTrack: "", recommendedModules: [{ module: "reservation" }], excludedModules: [], confidence: 72, evidenceRefs: [],
      roomOne: { plan: "growth", wedge: "reservation", evidence: ["https://dishoom.com — rezervasyon TheFork üzerinden"], bans: ["Fiyat konuşma"], backup: "bill_wait" },
      roomTwo: { status: "attached" },
      ...head,
    },
  };
}
function cardWithTalkTrack(talkTrack: string) {
  return toDecisionCard(briefOutput({ talkTrack }), { finishedAt: FINISHED, locationCount: 1 });
}
function input(over: Partial<ShelfInput> = {}): ShelfInput {
  const card = over.card ?? toDecisionCard(briefOutput(), { finishedAt: FINISHED, locationCount: 1 });
  return { runs: [], card, lead, locationCount: 1, ...over };
}
const drawer = (shelf: ReturnType<typeof buildShelf>, key: string) => shelf.find(d => d.key === key)!;

describe("buildShelf", () => {
  it("returns the four drawers Harita, Site, Yorum, Karar", () => {
    expect(buildShelf(input()).map(d => d.label)).toEqual(["Harita", "Site", "Yorum", "Karar"]);
  });

  it("puts the percentage next to the sample size", () => {
    const shelf = buildShelf(input({ runs: [reviewRunWith({ count: 5, bars: [{ label: "bekleme", pct: 100 }] })] }));
    const reviews = drawer(shelf, "reviews");
    expect(reviews.rows[0].claim.text).toContain("%100");
    expect(reviews.rows[0].support.text).toContain("5 yorum");
    expect(reviews.rows[0].conflict).toBe("Beş yorum, yüzde yüz küresel sorun olamaz.");
  });

  it("does not flag a percentage from a corpus at or above the threshold", () => {
    const shelf = buildShelf(input({ runs: [reviewRunWith({ count: 80, bars: [{ label: "bekleme", pct: 40 }] })] }));
    expect(drawer(shelf, "reviews").rows[0].conflict).toBeNull();
  });

  it("marks an instagram address as not a website", () => {
    const shelf = buildShelf(input({ runs: [auditRunWith({ skipped: true, reason: "social_media_only", url: "https://instagram.com/x" })] }));
    const site = drawer(shelf, "site");
    expect(site.rows.some(r => r.support.text.includes("Sosyal profil"))).toBe(true);
    expect(isSocialUrl("https://www.instagram.com/x")).toBe(true);
    expect(isSocialUrl("https://dishoom.com")).toBe(false);
  });

  it("reads a social URL as a social profile even when the auditor did not flag it", () => {
    const shelf = buildShelf(input({ runs: [auditRunWith({ reachable: true, url: "https://facebook.com/burger" })] }));
    expect(drawer(shelf, "site").rows[0].support.text).toContain("Sosyal profil");
  });

  it("says kontrol edilmedi when hasQrMenu is null, never no", () => {
    const audit = shelfAuditFromRow({ url: "https://dishoom.com", reachable: true, crawlError: null, crawlAttemptedAt: new Date(FINISHED), hasBookingSystem: true, bookingProvider: "TheFork", rawFeaturesJson: { hasQrMenu: null, hasOnlineOrdering: false } });
    const shelf = buildShelf(input({ runs: [auditRunWith({ reachable: true, url: "https://dishoom.com" })], audit }));
    const texts = drawer(shelf, "site").rows.map(r => r.claim.text);
    expect(texts).toContain("Rezervasyon var (TheFork)");
    expect(texts).toContain("QR menü kontrol edilmedi");
    expect(texts).toContain("Online sipariş yok");
  });

  it("flags a talk track pain that is not in the review drawer", () => {
    const shelf = buildShelf(input({
      card: cardWithTalkTrack("Müşteriler park sorunundan şikayetçi."),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput()), reviewRunWith({ bars: [{ label: "bekleme", pct: 40 }] })],
    }));
    const decision = drawer(shelf, "decision");
    expect(decision.rows.some(r => r.conflict === "Brief'te var, yorumda yok.")).toBe(true);
  });

  it("does not flag a talk track pain the reviews carry", () => {
    const shelf = buildShelf(input({
      card: cardWithTalkTrack("Misafirler bekleme süresinden şikayet ediyor."),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput()), reviewRunWith({ bars: [{ label: "bekleme", pct: 40 }] })],
    }));
    expect(drawer(shelf, "decision").rows.some(r => r.conflict === "Brief'te var, yorumda yok.")).toBe(false);
  });

  it("flags a frequency claim the reviews cannot carry (polarity)", () => {
    const shelf = buildShelf(input({
      card: cardWithTalkTrack("Misafirler sık sık yavaş servisten şikayet ediyor."),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput()), reviewRunWith({ count: 120, bars: [{ label: "yavaş servis", pct: 8 }] })],
    }));
    expect(drawer(shelf, "decision").rows.some(r => r.conflict?.includes("sık şikayet"))).toBe(true);
  });

  it("flags a site observation when the site is a social profile (type)", () => {
    const shelf = buildShelf(input({
      card: cardWithTalkTrack("Sitenizi inceledim, rezervasyon yok."),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput()), auditRunWith({ skipped: true, reason: "social_media_only", url: "https://instagram.com/x" })],
    }));
    expect(drawer(shelf, "decision").rows.some(r => r.conflict === "Konuşma site gözlemi gibi konuşuyor, site açık değil.")).toBe(true);
  });

  it("flags a branch count that is not the account's (identity)", () => {
    const shelf = buildShelf(input({
      card: cardWithTalkTrack("Üç şubeniz için tek panel öneriyoruz."),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput())],
      locationCount: 1,
    }));
    expect(drawer(shelf, "decision").rows.some(r => r.conflict === "Konuşmada 3 şube, hesapta 1 lokasyon.")).toBe(true);
  });

  it("flags a quoted review that the review drawer does not hold (identity)", () => {
    const out = briefOutput({ evidenceRefs: ['yorum: "garson hiç gelmedi"'] });
    const shelf = buildShelf(input({
      card: toDecisionCard(out, { finishedAt: FINISHED, locationCount: 1 }),
      runs: [run("LEAD_INTELLIGENCE_BRIEF", out), reviewRunWith({ pains: [{ text: "hesap çok geç geldi", sellable: true }] })],
    }));
    expect(drawer(shelf, "decision").rows.some(r => r.conflict?.startsWith("Alıntı yorum çekmecesinde yok"))).toBe(true);
  });

  it("puts Room 1 on the right of the decision drawer", () => {
    const shelf = buildShelf(input({ runs: [run("LEAD_INTELLIGENCE_BRIEF", briefOutput())] }));
    const support = drawer(shelf, "decision").rows.map(r => r.support.text).join("\n");
    expect(support).toContain("Oda 1 paketi: Growth");
    expect(support).toContain("Oda 1 kaçağı: Rezervasyon · yedek: Hesap bekleme");
    expect(support).toContain("Yasaklar: Fiyat konuşma");
    expect(support).toContain("rezervasyon TheFork");
  });

  it("says kayıt yok for a worker that never ran", () => {
    const shelf = buildShelf(input({ runs: [] }));
    expect(shelf.every(d => d.empty)).toBe(true);
    expect(shelf.every(d => d.rows[0].claim.text === "Kayıt yok")).toBe(true);
  });

  it("writes skipped reasons in Turkish", () => {
    const shelf = buildShelf(input({ runs: [
      run("APIFY_GMAPS_DEEP", { skipped: "apify_quota", reason: "apify_quota", statusCode: 402 }),
      run("REVIEW_ANALYST", { skipped: "thin_corpus", reason: "thin_corpus", count: 12, min: 30 }),
      run("LEAD_INTELLIGENCE_BRIEF", { skipped: "head_agent_off" }),
    ] }));
    expect(drawer(shelf, "map").rows[0].support.text).toContain("Apify kotası doldu");
    expect(drawer(shelf, "reviews").rows[0].support.text).toContain("12 yorum, en az 30");
    expect(drawer(shelf, "decision").rows[0].support.text).toContain("Head agent kapalı");
    expect(skipReasonText("thin_corpus")).toMatch(/eşiğin altında/);
  });

  it("never puts duration or dollars on the shelf", () => {
    const text = JSON.stringify(buildShelf(input({ runs: [
      run("APIFY_GMAPS_DEEP", { reviewsCount: 80, costUsdCents: 1234, durationMs: 4000 }),
      auditRunWith({ reachable: true, url: "https://dishoom.com" }),
      reviewRunWith({ bars: [{ label: "bekleme", pct: 40 }] }),
      run("LEAD_INTELLIGENCE_BRIEF", briefOutput()),
    ] })));
    expect(text).not.toMatch(/\$|saniye|\bdk\b/);
  });

  it("orders drawers by lens", () => {
    expect(drawerOrder("SALES")).toEqual(["decision", "reviews", "site", "map"]);
    expect(drawerOrder("TECHNICAL")[0]).toBe("map");
    expect(drawerOrder("DOMAIN")).toEqual(["site", "decision", "reviews", "map"]);
    expect(orderDrawers(buildShelf(input()), "SALES").map(d => d.key)).toEqual(["decision", "reviews", "site", "map"]);
  });

  it("spells numbers in Turkish", () => {
    expect(turkishNumber(5)).toBe("beş");
    expect(turkishNumber(100)).toBe("yüz");
    expect(turkishNumber(42)).toBe("kırk iki");
  });
});

describe("site drawer: capture coverage", () => {
  const auditRow = (siteFacts: Record<string, unknown>) =>
    shelfAuditFromRow({
      url: "https://dishoom.com",
      reachable: true,
      crawlError: null,
      crawlAttemptedAt: new Date(FINISHED),
      hasBookingSystem: true,
      bookingProvider: "SevenRooms",
      rawFeaturesJson: { siteFacts },
    });
  const siteRows = (siteFacts: Record<string, unknown>) =>
    drawer(
      buildShelf(input({ runs: [auditRunWith({ reachable: true, url: "https://dishoom.com" })], audit: auditRow(siteFacts) })),
      "site",
    ).rows;

  it("shows how many pages were read and which were not, with the reason", () => {
    const rows = siteRows({
      coverage: {
        status: "complete",
        opened: 9,
        skipped: 2,
        failed: 1,
        durationMs: 31_000,
        notOpened: [{ url: "https://dishoom.com/faq", type: "faq", reason: "timeout" }],
      },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapsam"))!;
    expect(row.claim.text).toBe("Kapsam: 9 sayfa açıldı · 2 atlandı · 1 açılamadı");
    expect(row.support.text).toBe("Okunamayan: /faq (zaman aşımı)");
    expect(row.conflict).toBeNull();
  });

  it("warns when the capture ran out of budget", () => {
    const rows = siteRows({
      coverage: { status: "partial", opened: 12, skipped: 20, failed: 0, durationMs: 150_000, notOpened: [{ url: "https://dishoom.com/group-feasts", type: "events", reason: "budget" }] },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapsam"))!;
    expect(row.support.text).toContain("/group-feasts (süre yetmedi)");
    expect(row.conflict).toBe("Yakalama yarıda kaldı; okunmayan sayfalar var.");
  });

  it("says so when every discovered page was read", () => {
    const rows = siteRows({ coverage: { status: "complete", opened: 5, skipped: 0, failed: 0, durationMs: 9_000, notOpened: [] } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapsam"))!.support.text).toBe("Keşfedilen her sayfa okundu");
  });

  it("never says every page was read when pages were skipped without a listed reason", () => {
    const rows = siteRows({ coverage: { status: "complete", opened: 9, skipped: 6, failed: 0, durationMs: 20_000, notOpened: [] } });
    const row = rows.find((r) => r.claim.text.startsWith("Kapsam"))!;
    expect(row.support.text).toBe("Atlananlar: tür sınırı ya da yinelenen sayfa");
    expect(row.support.muted).toBeUndefined();
  });

  it("lists the first four unread pages and counts the rest", () => {
    const notOpened = ["a", "b", "c", "d", "e", "f"].map((p) => ({ url: `https://dishoom.com/${p}`, type: "other", reason: "timeout" }));
    const rows = siteRows({ coverage: { status: "complete", opened: 3, skipped: 0, failed: 6, durationMs: 40_000, notOpened } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapsam"))!.support.text).toBe(
      "Okunamayan: /a (zaman aşımı) · /b (zaman aşımı) · /c (zaman aşımı) · /d (zaman aşımı) · +2 diğer",
    );
  });

  it("flags a failed capture", () => {
    const rows = siteRows({ coverage: { status: "failed", opened: 0, skipped: 0, failed: 1, durationMs: 5_000, notOpened: [{ url: "https://dishoom.com/", type: "home", reason: "nav_error" }] } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapsam"))!.conflict).toBe("Yakalama başarısız; sayfalar okunamadı.");
  });

  it("flags a blocked capture", () => {
    const rows = siteRows({ coverage: { status: "blocked", opened: 0, skipped: 0, failed: 1, durationMs: 5_000, notOpened: [{ url: "https://dishoom.com/", type: "home", reason: "blocked" }] } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapsam"))!.conflict).toBe("Site botu engelledi; sayfalar okunamadı.");
  });

  it("states a group-only deposit as group-only, with its source", () => {
    const rows = siteRows({
      hasPrepayment: { value: true, url: "https://dishoom.com/group-feasts", quote: "For groups of 8 or more, we ask for card details", scope: "group_or_event" },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapora"))!;
    expect(row.claim.text).toBe("Kapora: kısıtlı (grup, etkinlik ya da özel gün için)");
    expect(row.support.text).toContain("https://dishoom.com/group-feasts");
    expect(row.support.text).toContain("For groups of 8 or more");
  });

  it("states a general deposit plainly", () => {
    const rows = siteRows({ hasPrepayment: { value: true, url: "https://dishoom.com/reservations", quote: "A deposit is required" } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapora"))!.claim.text).toBe("Kapora var");
  });

  it("adds no rows for an audit without capture data", () => {
    expect(siteRows({})).toHaveLength(3);
  });
});
