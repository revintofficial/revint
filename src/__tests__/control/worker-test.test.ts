// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ leads: vi.fn(), groupBy: vi.fn(), runs: vi.fn(), audits: vi.fn(), analyses: vi.fn(), rerun: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: m.leads, groupBy: m.groupBy },
    agentRun: { findMany: m.runs },
    websiteAudit: { findMany: m.audits },
    reviewAnalysis: { findMany: m.analyses },
  },
}));
vi.mock("@/lib/control/rerun", () => ({ rerunLeadWorker: m.rerun }));
import { TRIAL_MAX_LEADS, isTrialKind, listTrialRows, startWorkerTrial } from "@/lib/control/worker-test";
import { compareFacts, plainError, runFacts } from "@/lib/control/trial-facts";

const run = (id: string, leadId: string, status: string, createdAt: string, outputJson: unknown = {}, workerKind = "WEBSITE_AUDITOR") => ({
  id, leadId, workerKind, status, createdAt: new Date(createdAt), startedAt: new Date(createdAt), finishedAt: status === "PENDING" ? null : new Date(createdAt), costUsdCents: 0, errorMsg: status === "FAILED" ? "boom" : null, outputJson,
});
const lead = (id: string) => ({ id, businessName: id, websiteUrl: null, googleMapsUri: null, formattedAddress: "", rating: null, reviewCount: null, accountId: null });

beforeEach(() => {
  vi.clearAllMocks();
  m.leads.mockResolvedValue(["A", "B", "C", "D", "E"].map(lead));
  m.audits.mockResolvedValue([]);
  m.analyses.mockResolvedValue([]);
  m.groupBy.mockResolvedValue([]);
});

it("turns a site audit output into plain facts with no field names", () => {
  const facts = runFacts("WEBSITE_AUDITOR", {
    url: "https://x.test/", reachable: true, hasBookingSystem: false, hasContactForm: true, contactEmails: ["a@x.test"],
    socialProfiles: { instagram: "https://instagram.com/x", facebook: null }, servicesDetected: [],
    coverage: { opened: 4, failed: 1, skipped: 2, status: "partial", notOpened: [{ url: "https://x.test/menu", type: "menu", reason: "http_error" }] },
  });
  const value = (label: string) => facts.find((fact) => fact.label === label)?.value;
  expect(value("Siteye erişim")).toBe("Site açıldı");
  expect(value("Rezervasyon sistemi")).toBe("Görünmüyor");
  expect(value("E-posta adresleri")).toBe("a@x.test");
  expect(value("Sosyal hesaplar")).toBe("Instagram");
  expect(value("Okunan sayfalar")).toBe("4 sayfa açıldı · 1 açılamadı · 2 atlandı");
  expect(value("Tarama durumu")).toBe("Yarıda kaldı");
  expect(value("Okunamayan sayfalar")).toBe("/menu (sayfa hata verdi)");
  expect(facts.every((fact) => !/[{}\[\]"]|true|false|null/.test(fact.value))).toBe(true);
});

it("explains a run that stopped early in a sentence", () => {
  expect(runFacts("LEAD_INTELLIGENCE_BRIEF", { skipped: "head_agent_off" })[0]).toEqual({ label: "Sonuç", value: "Çalışmadan durdu: Head agent kapalı; bu brief karar üretmedi." });
  const thin = runFacts("REVIEW_ANALYST", { skipped: "thin_corpus", reason: "thin_corpus", count: 5, min: 30 });
  expect(thin[1]).toEqual({ label: "Yorum sayısı", value: "5 yorum var, analiz için en az 30 gerekir" });
  expect(runFacts("APIFY_GMAPS_DEEP", { skipped: true, reason: "brand_new_reason" })[0].value).toBe("Çalışmadan durdu (brand_new_reason).");
});

it("reads a head-agent brief as package, wedge and talk track", () => {
  const facts = runFacts("LEAD_INTELLIGENCE_BRIEF", {
    briefMode: "head-agent", salesConfidence: 82, headline: "Dishoom",
    headAgent: { wedge: "reservation", recommendedPackage: "growth", talkTrack: "Rezervasyon kaçağı.", recommendedModules: [{ module: "reservation" }, { module: "qr_menu" }] },
  });
  const value = (label: string) => facts.find((fact) => fact.label === label)?.value;
  expect(value("Kararı kim üretti")).toBe("Head agent");
  expect(value("Uygunluk puanı")).toBe("82 / 100");
  expect(value("Modül sırası")).toBe("1. Rezervasyon · 2. QR menü");
  expect(value("Konuşma")).toBe("Rezervasyon kaçağı.");
});

it("marks only the facts that differ from the previous run", () => {
  const compared = compareFacts(
    [{ label: "A", value: "1" }, { label: "B", value: "x" }, { label: "Gone", value: "g" }],
    [{ label: "A", value: "1" }, { label: "B", value: "y" }, { label: "New", value: "n" }],
  );
  expect(compared).toEqual([
    { label: "A", value: "1", before: null },
    { label: "B", value: "y", before: "x" },
    { label: "New", value: "n", before: "Önceki koşuda bu bilgi yoktu" },
    { label: "Gone", value: "Bu koşuda yok", before: "g" },
  ]);
  expect(compareFacts(null, [{ label: "A", value: "1" }])).toEqual([{ label: "A", value: "1", before: null }]);
});

it("gives every lead an outcome, a plain summary, and the changed facts", async () => {
  m.runs.mockResolvedValue([
    run("a2", "A", "SUCCEEDED", "2026-10-04T10:00:00Z", { reachable: true }),
    run("b2", "B", "PENDING", "2026-10-04T09:00:00Z"),
    run("c1", "C", "FAILED", "2026-10-04T08:00:00Z"),
    run("e1", "E", "SUCCEEDED", "2026-10-04T07:00:00Z", { skipped: true, reason: "no_website" }),
    run("a1", "A", "SUCCEEDED", "2026-10-01T10:00:00Z", { reachable: false }),
    run("b1", "B", "SUCCEEDED", "2026-10-01T09:00:00Z"),
    // A run of another step never counts as this step's result.
    run("d0", "D", "SUCCEEDED", "2026-10-04T11:00:00Z", {}, "REVIEW_ANALYST"),
  ]);
  const rows = await listTrialRows("ws", "WEBSITE_AUDITOR");
  expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws" } }));
  expect(m.runs).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws", leadId: { in: ["A", "B", "C", "D", "E"] } }) }));
  expect(m.audits).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: { in: ["A", "B", "C", "D", "E"] }, lead: { workspaceId: "ws" } } }));
  expect(rows.map((row) => [row.leadId, row.outcome])).toEqual([["A", "done"], ["B", "running"], ["C", "failed"], ["E", "stopped"], ["D", "never"]]);

  const a = rows[0];
  expect(a.changed).toBe(1);
  expect(a.summary).toBe("Önceki koşuya göre 1 bilgi değişti. Değişenler işaretli.");
  expect(a.facts.find((fact) => fact.label === "Siteye erişim")).toEqual({ label: "Siteye erişim", value: "Site açıldı", before: "Site açılmadı" });
  expect(rows[1]).toMatchObject({ facts: [], changed: null });
  expect(rows[2].summary).toBe("Koşu düştü. boom. Ayrıntısı Vaka izi'nde.");
  expect(rows[3]).toMatchObject({ changed: null, summary: "Bu işletmedeki ilk başarılı koşu; karşılaştırılacak önceki sonuç yok." });
  expect(rows[3].facts[0].value).toContain("Lead kaydında web adresi yok.");
  expect(rows[4]).toMatchObject({ latest: null, facts: [], summary: "Bu adım bu işletmede hiç çalışmadı." });
});

it("says so in one sentence when one run stopped and the other worked, instead of marking every fact", async () => {
  m.leads.mockResolvedValue([lead("A"), lead("B")]);
  m.runs.mockResolvedValue([
    run("a2", "A", "SUCCEEDED", "2026-10-04T10:00:00Z", { skipped: "head_agent_off" }, "LEAD_INTELLIGENCE_BRIEF"),
    run("b2", "B", "SUCCEEDED", "2026-10-04T09:00:00Z", { briefMode: "head-agent", salesConfidence: 70, headAgent: { wedge: "reservation" } }, "LEAD_INTELLIGENCE_BRIEF"),
    run("a1", "A", "SUCCEEDED", "2026-10-01T10:00:00Z", { briefMode: "head-agent", salesConfidence: 58, headAgent: { wedge: "bill_wait" } }, "LEAD_INTELLIGENCE_BRIEF"),
    run("b1", "B", "SUCCEEDED", "2026-10-01T09:00:00Z", { skipped: "head_agent_off" }, "LEAD_INTELLIGENCE_BRIEF"),
  ]);
  const [a, b] = await listTrialRows("ws", "LEAD_INTELLIGENCE_BRIEF");
  expect(a).toMatchObject({ outcome: "stopped", changed: 1, summary: "Önceki koşu sonuç üretmişti; bu koşu çalışmadan durdu. Sebebi aşağıda." });
  expect(a.facts).toEqual([{ label: "Sonuç", value: "Çalışmadan durdu: Head agent kapalı; bu brief karar üretmedi.", before: null }]);
  expect(b).toMatchObject({ outcome: "done", changed: 1, summary: "Önceki koşu çalışmadan durmuştu; bu koşu sonuç üretti." });
  expect(b.facts.every((fact) => fact.before === null)).toBe(true);
});

it("turns stored error messages into a plain sentence without the JSON body", () => {
  expect(plainError('Apify compass/crawler-google-places returned 402: {\n  "error": { "type": "concurrent-runs-limit-exceeded" }\n}')).toContain("aynı anda çalışabilecek iş sınırına takıldı");
  expect(plainError("[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com")).toContain("Gemini");
  expect(plainError('Something odd happened: {"a":1}')).toBe("Something odd happened. Ayrıntısı Vaka izi'nde.");
  expect(plainError(null)).toBe("Hata mesajı kaydedilmemiş.");
});

it("only chain workers can be trialled", () => {
  expect(isTrialKind("WEBSITE_AUDITOR")).toBe(true);
  expect(isTrialKind("LEAD_INTELLIGENCE_BRIEF")).toBe(true);
  expect(isTrialKind("OPENER_WRITER")).toBe(false);
});

it("queues one audited rerun per distinct lead, capped, and reports what did not queue", async () => {
  m.rerun
    .mockResolvedValueOnce({ ok: true, runId: "r1", enqueued: true })
    .mockResolvedValueOnce({ ok: true, runId: "r2", enqueued: false })
    .mockResolvedValueOnce({ ok: false, status: 404, error: "Not found" });
  const result = await startWorkerTrial({ actorUserId: "u", actorRole: "ADMIN", workspaceId: "ws", workerKind: "WEBSITE_AUDITOR", leadIds: ["A", "A", "B", "C"], reason: "deep capture" });
  expect(m.rerun).toHaveBeenCalledTimes(3);
  expect(m.rerun).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws", leadId: "A", workerKind: "WEBSITE_AUDITOR", reason: "deep capture" }));
  expect(result).toEqual({ started: ["A"], notQueued: ["B"], rejected: [{ leadId: "C", error: "Not found" }] });

  m.rerun.mockResolvedValue({ ok: true, runId: "r", enqueued: true });
  const many = await startWorkerTrial({ actorUserId: "u", actorRole: "ADMIN", workspaceId: "ws", workerKind: "WEBSITE_AUDITOR", leadIds: Array.from({ length: 25 }, (_, i) => `L${i}`), reason: "x" });
  expect(many.started).toHaveLength(TRIAL_MAX_LEADS);
});
