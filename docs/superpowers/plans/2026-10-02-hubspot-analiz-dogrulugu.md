# HubSpot'a giden analizin doğruluğu — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FineDine SDR'ının HubSpot'ta gördüğü her satırın (paket, kaçak, konuşma, satma listesi, kanıt) tek bir karardan gelmesi ve o kararın girdilerinin kanıtlı olması; dört adımlı zincirin ne ürettiğinin sayıyla ölçülmesi.

**Architecture:** Zincir aynı kalır (Harita, Site, Yorum, Karar). Üç toplayıcı daha fazla *kanıtlı gerçek* üretir (harita yükündeki hazır alanlar, sitenin alt sayfaları, doğrulanmış yorum alıntıları), Oda 1 bunları okur, HubSpot yazımı ve App Card yalnızca head agent kararını gösterir. Yeni kuyruk, yeni worker türü, yeni tablo yok.

**Tech Stack:** Next.js 16.2.3, Prisma 6, BullMQ `agent-runs`, Playwright + cheerio, Gemini 2.5 Flash (yorum), Claude (Oda 2), HubSpot CRM API, Vitest.

**Spec:** Ayrı bir spec yok. Dayanak: bu kağıdın §Bulgular bölümü (2 Ekim 2026 kod incelemesi) ve `2026-10-02-final-guncelleme-plani` kağıdının F1, F2, F8 bulguları. Öğrenme döngüsü, yargıç modeli ve eval paneli bu planın dışındadır.

## Global Constraints

- Her Prisma sorgusu workspace verisinde `workspaceId` taşır.
- Prisma tipleri `@/generated/prisma/client`'tan gelir, `@prisma/client`'tan değil.
- Yeni BullMQ kuyruğu yok; yeni worker türü yok.
- Yeni Gemini çağıran uç nokta yok; yorum çıkarımı `REVIEW_ANALYST` içinde kalır.
- Semantic memory yalnızca `src/lib/ai-core/memory.ts` üzerinden.
- Prisma şeması değişmez (bu planda migration yok).
- `null` = bilinmiyor. Hiçbir alan "görmedim" için `false` yazmaz.
- Commit mesajları repodaki biçimde: `fix: …`, `feat(hubspot): …`.

## Bulgular (kodda doğrulandı, 2 Ekim 2026)

**HubSpot katmanı**

| # | Bulgu | Yer |
|---|---|---|
| H1 | Bayrak kapalıyken brief `{ skipped: "head_agent_off" }` döner, koşu yine SUCCEEDED olur ve hook HubSpot'a yazar; açı eski skorlayıcıdan veya deterministik playbook'tan gelir | `brief-hook.ts:41`, `writeback.ts:330-336` |
| H2 | `revint_next_best_action` önce `LeadNextAction.openingHook`'u okur. O satırı yazan `runSdrBrainPass`, tetikleyici ve why-now yoksa çıkıyor; ikisi de zincirden çıktı. Eski lead'de bayat cümle QA'dan geçmiş konuşmanın önüne geçer | `writeback.ts:338`, `lead-intelligence-brief.ts:2080` |
| H3 | Boş değer yazılmıyor: kart düz karta ya da "Arama yok"a dönünce önceki konuşma HubSpot'ta kalır | `writeback.ts:337-339` |
| H4 | SDR'a en çok lazım olan satırlar HubSpot'a gitmiyor: yasaklar, "bunu satma" modülleri, eksik kaynaklar, analiz tarihi | `writeback.ts:260-393` |
| H5 | App Card ikinci bir karar motoru çalıştırıyor: `decision.*` playbook `pickAngle`'dan, `fit.*` eski skorlayıcıdan, `dossier` zincirden çıkmış worker'dan | `card-data/route.ts:823-885` |

**Analiz katmanı**

| # | Bulgu | Yer |
|---|---|---|
| A1 | Site için yalnızca ana sayfa açılıyor. `hasQrMenu = false` ve `hasOnlineOrdering = false`, ana sayfada bir menü *linki* görülünce yazılıyor; menü sayfası açılmıyor | `crawler.ts:250`, `extractor.ts:667-675` |
| A2 | `hasBookingSystem` düz boolean; rezervasyon widget'ı alt sayfada olan her site "rezervasyon yok" orta sinyali üretir | `extractor.ts:708`, `head-agent.ts:198-204` |
| A3 | Pazar yeri linki (Deliveroo) `hasOnlineOrdering = true` yapıyor, bu da marketplace kaçağını söndürüyor; `hasDeliveryIntegration` ise HTML'de ham alt dize | `extractor.ts:182-221, 700`, `head-agent.ts:219-229` |
| A4 | `hasPrepayment`, `tableCount`, `languageCount`, `tastingMenu`, `centralPurchasing`, `deliveryPlatforms` hiçbir yerde üretilmiyor | `lead-intelligence-brief.ts:1351-1381` |
| A5 | Harita worker'ı Apify yükündeki rezervasyon linklerini, sipariş platformlarını, menü linkini ve servis seçeneklerini okumadan atıyor | `gmaps-deep.ts:195-229, 470-482` |
| A6 | Oda 1, Gemini'nin yazdığı özet cümlede anahtar kelime arıyor; `pay` geçen tek cümle güçlü sinyal sayılıp kaçağı belirliyor. Sayı, tekrar, doğrulama yok | `head-agent.ts:132-139, 211-214` |
| A7 | Acı cümleleri yorum metniyle karşılaştırılmadan `yorum: "…"` diye karta giriyor | `head-agent.ts:168-170` |
| A8 | Kotadan atlanan harita adımı `missingSources`'a girmiyor; denetimin yaşı okunmuyor | `lead-intelligence-brief.ts:1408-1424` |
| A9 | Oda 3 cümlede kanıt *kimliği* arıyor, cümlenin o kanıtla örtüştüğüne bakmıyor; Oda 2 araçla çektiği ham veriyi herhangi bir `E` kimliğinin altına yazabilir | `head-agent.ts:771` |

## Review Focus

1. **Eski denetimler (alt sayfa verisi yok):** `siteFacts` taşımayan denetimde "rezervasyon yok", "QR menü yok", "doğrudan sipariş yok" artık `null` olur; lead yeniden taranana kadar daha az kaçak çıkar. Beklenen: yanlış sinyal yerine "Arama yok". Test: Task 7.
2. **Apify yükünde alan yok ya da biçimi farklı:** `extractMapFacts` boş gerçekler döner, asla fırlatmaz; harita koşusu yorumları yine yazar. Test: Task 4.
3. **Alt sayfa açılmıyor, başka alana yönleniyor ya da asılı kalıyor:** ana sayfa denetimi yine döner, o tür "görülmedi" kalır. Test: Task 5.
4. **Gemini alıntıyı yeniden yazıyor:** doğrulanamayan alıntı sayılmaz, `mentions = 0` olan cümle Oda 1'e sinyal olarak girmez. Test: Task 6 ve 7.
5. **Portalda yeni HubSpot alanları tanımlı değil:** bilinmeyen alan tüm PATCH'i 400 ile düşürür. Beklenen: üç yeni alan çıkarılıp bir kez daha denenir, eski 11 alan yazılır. Test: Task 2.

---

### Task 1: Zincirin ürettiğini ölçen rapor

Dört worker'a inen zincir gerçek lead üzerinde hiç ölçülmedi. Bu betik salt okur ve önce/sonra karşılaştırmasının tek aracıdır.

**Files:**
- Create: `src/lib/control/analysis-baseline.ts`
- Create: `scripts/analysis-baseline.ts`
- Test: `src/__tests__/control/analysis-baseline.test.ts`

**Interfaces:**
- Consumes: `toRoomOneAudit` (`src/lib/agent-workers/lead-intelligence-brief.ts`), `buildRevintProperties` (`src/lib/integrations/hubspot/writeback.ts`), `normalizeForGrounding` (`src/lib/review-analysis/kpi-filter.ts`).
- Produces: `summarizeLead(input: BaselineLeadInput): LeadBaseline`, `aggregateBaseline(rows: LeadBaseline[]): BaselineReport`, `renderBaselineMarkdown(report: BaselineReport): string`, `RULE_INPUTS`, `CHAIN_WORKERS`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/control/analysis-baseline.test.ts
import { describe, expect, it } from "vitest";
import {
  aggregateBaseline,
  renderBaselineMarkdown,
  reviewQuotesOf,
  stepState,
  summarizeLead,
  type BaselineLeadInput,
} from "@/lib/control/analysis-baseline";

const finished = new Date("2026-10-02T10:00:00Z");

function input(over: Partial<BaselineLeadInput> = {}): BaselineLeadInput {
  return {
    leadId: "lead_1",
    businessName: "Padella",
    runs: {
      APIFY_GMAPS_DEEP: { id: "r1", status: "SUCCEEDED", outputJson: { reviewsCount: 80 }, finishedAt: finished },
      WEBSITE_AUDITOR: { id: "r2", status: "SUCCEEDED", outputJson: { reachable: true }, finishedAt: finished },
      REVIEW_ANALYST: { id: "r3", status: "SUCCEEDED", outputJson: { skipped: "thin_corpus" }, finishedAt: finished },
      LEAD_INTELLIGENCE_BRIEF: {
        id: "r4",
        status: "SUCCEEDED",
        finishedAt: finished,
        outputJson: {
          briefMode: "head-agent",
          missingSources: ["reviews"],
          headAgent: {
            wedge: "bill_wait",
            recommendedPackage: "starter",
            roomTwo: { status: "attached" },
            roomOne: { evidence: ['yorum: "waited ages for the bill"', "site — menü PDF"] },
          },
        },
      },
    },
    roomOneAudit: { bookingProvider: "OpenTable", hasPrepayment: null, deliveryPlatforms: [], tableCount: null },
    reviewTexts: ["Lovely pasta but we waited ages for the bill."],
    nextActionCreatedAt: null,
    hubspotProps: { revint_recommended_angle: "Hesap bekleme → Starter", revint_next_best_action: "" },
    ...over,
  };
}

describe("stepState", () => {
  it("separates skipped, failed and missing from ok", () => {
    expect(stepState(null)).toBe("missing");
    expect(stepState({ id: "x", status: "FAILED", outputJson: null, finishedAt: null })).toBe("failed");
    expect(stepState({ id: "x", status: "SUCCEEDED", outputJson: { skipped: true }, finishedAt: null })).toBe("skipped");
    expect(stepState({ id: "x", status: "SUCCEEDED_NO_MEMORY", outputJson: {}, finishedAt: null })).toBe("ok");
  });
});

describe("reviewQuotesOf", () => {
  it("reads both evidence shapes and ignores site evidence", () => {
    expect(reviewQuotesOf(['yorum: "a b c"', 'yorum (3/80): "d e f"', "site — x"])).toEqual(["a b c", "d e f"]);
  });
});

describe("summarizeLead", () => {
  it("reports step states, known rule inputs and verified review quotes", () => {
    const s = summarizeLead(input());
    expect(s.steps.REVIEW_ANALYST).toBe("skipped");
    expect(s.known.bookingProvider).toBe(true);
    expect(s.known.hasPrepayment).toBe(false);
    expect(s.known.deliveryPlatforms).toBe(false); // empty array is not knowledge
    expect(s.brief).toMatchObject({ mode: "head-agent", wedge: "bill_wait", plan: "starter", roomTwo: "attached" });
    expect(s.reviewQuotes).toEqual({ total: 1, verified: 1 });
    expect(s.hubspotFilled).toEqual(["revint_recommended_angle"]);
  });

  it("counts a quote that is in no review as unverified", () => {
    const s = summarizeLead(input({ reviewTexts: ["Great food."] }));
    expect(s.reviewQuotes).toEqual({ total: 1, verified: 0 });
  });

  it("flags a skipped brief that would still write an angle to HubSpot", () => {
    const runs = input().runs;
    const s = summarizeLead(
      input({
        runs: { ...runs, LEAD_INTELLIGENCE_BRIEF: { id: "r4", status: "SUCCEEDED", outputJson: { skipped: "head_agent_off" }, finishedAt: finished } },
      }),
    );
    expect(s.flags.skippedBriefWritesHubspot).toBe(true);
  });

  it("flags an open next action that is older than the brief", () => {
    const s = summarizeLead(input({ nextActionCreatedAt: new Date("2026-06-21T00:00:00Z") }));
    expect(s.flags.staleNextAction).toBe(true);
  });
});

describe("aggregateBaseline", () => {
  it("turns per-lead rows into rates and a markdown report", () => {
    const report = aggregateBaseline([summarizeLead(input()), summarizeLead(input({ leadId: "lead_2", roomOneAudit: null }))]);
    expect(report.leads).toBe(2);
    expect(report.knownRate.bookingProvider).toBe(50);
    expect(report.knownRate.hasPrepayment).toBe(0);
    expect(report.wedges).toEqual({ bill_wait: 2 });
    expect(report.reviewQuotes).toEqual({ total: 2, verified: 2 });
    expect(renderBaselineMarkdown(report)).toContain("| hasPrepayment | 0% |");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/control/analysis-baseline.test.ts`
Expected: FAIL, `Cannot find module '@/lib/control/analysis-baseline'`.

- [ ] **Step 3: Write the summarizers**

```ts
// src/lib/control/analysis-baseline.ts
/**
 * Analysis baseline: what the four-step lead chain produces and what
 * reaches HubSpot, as numbers. Pure summarizers; the DB reads live in
 * scripts/analysis-baseline.ts.
 */
import { normalizeForGrounding } from "@/lib/review-analysis/kpi-filter";

export const CHAIN_WORKERS = [
  "APIFY_GMAPS_DEEP",
  "WEBSITE_AUDITOR",
  "REVIEW_ANALYST",
  "LEAD_INTELLIGENCE_BRIEF",
] as const;
export type ChainWorker = (typeof CHAIN_WORKERS)[number];

/** Room 1 rule inputs (`RoomOneAudit` in head-agent.ts). */
export const RULE_INPUTS = [
  "bookingProvider",
  "hasBookingSystem",
  "hasOnlineReservation",
  "hasPrepayment",
  "tableCount",
  "hasQrMenu",
  "menuUrl",
  "hasOnlineOrdering",
  "deliveryPlatforms",
  "languageCount",
  "tastingMenu",
  "centralPurchasing",
] as const;
export type RuleInput = (typeof RULE_INPUTS)[number];

export type StepState = "ok" | "skipped" | "failed" | "missing";

export interface BaselineRun {
  id: string;
  status: string;
  outputJson: unknown;
  finishedAt: Date | null;
}

export interface BaselineLeadInput {
  leadId: string;
  businessName: string;
  runs: Partial<Record<ChainWorker, BaselineRun | null>>;
  /** The audit Room 1 would read for this lead (`toRoomOneAudit`). */
  roomOneAudit: Record<string, unknown> | null;
  reviewTexts: string[];
  /** Newest non-superseded LeadNextAction. */
  nextActionCreatedAt: Date | null;
  /** What `buildRevintProperties` would write right now. */
  hubspotProps: Record<string, string> | null;
}

export interface LeadBaseline {
  leadId: string;
  businessName: string;
  steps: Record<ChainWorker, StepState>;
  known: Record<RuleInput, boolean>;
  brief: {
    mode: string | null;
    wedge: string | null;
    plan: string | null;
    roomTwo: string | null;
    missingSources: string[];
    skipped: string | null;
  };
  reviewQuotes: { total: number; verified: number };
  flags: { staleNextAction: boolean; skippedBriefWritesHubspot: boolean };
  hubspotFilled: string[];
}

export interface BaselineReport {
  leads: number;
  stepRate: Record<ChainWorker, Record<StepState, number>>;
  knownRate: Record<RuleInput, number>;
  wedges: Record<string, number>;
  plans: Record<string, number>;
  roomTwo: Record<string, number>;
  missingSources: Record<string, number>;
  reviewQuotes: { total: number; verified: number };
  flags: { staleNextAction: number; skippedBriefWritesHubspot: number };
  hubspotFillRate: Record<string, number>;
}

const SUCCEEDED = new Set(["SUCCEEDED", "SUCCEEDED_NO_MEMORY"]);

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function isKnown(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  return Array.isArray(v) ? v.length > 0 : true;
}
function pct(n: number, of: number): number {
  return of === 0 ? 0 : Math.round((n / of) * 100);
}
function bump(into: Record<string, number>, key: string | null): void {
  if (key) into[key] = (into[key] ?? 0) + 1;
}

export function stepState(run: BaselineRun | null | undefined): StepState {
  if (!run) return "missing";
  if (!SUCCEEDED.has(run.status)) return "failed";
  return obj(run.outputJson).skipped ? "skipped" : "ok";
}

/** Quoted text of `yorum: "…"` / `yorum (3/80): "…"` evidence lines. */
export function reviewQuotesOf(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  const out: string[] = [];
  for (const e of evidence) {
    if (typeof e !== "string" || !e.startsWith("yorum")) continue;
    const m = e.match(/"([\s\S]+)"\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function summarizeLead(input: BaselineLeadInput): LeadBaseline {
  const steps = Object.fromEntries(
    CHAIN_WORKERS.map((k) => [k, stepState(input.runs[k])]),
  ) as Record<ChainWorker, StepState>;
  const briefRun = input.runs.LEAD_INTELLIGENCE_BRIEF ?? null;
  const out = obj(briefRun?.outputJson);
  const head = obj(out.headAgent);
  const audit = input.roomOneAudit ?? {};
  const known = Object.fromEntries(RULE_INPUTS.map((k) => [k, isKnown(audit[k])])) as Record<RuleInput, boolean>;

  const corpus = input.reviewTexts.map((t) => normalizeForGrounding(t));
  const quotes = reviewQuotesOf(obj(head.roomOne).evidence);
  const verified = quotes.filter((q) => {
    const n = normalizeForGrounding(q);
    return n.length > 0 && corpus.some((c) => c.includes(n));
  }).length;

  const props = input.hubspotProps ?? {};
  return {
    leadId: input.leadId,
    businessName: input.businessName,
    steps,
    known,
    brief: {
      mode: text(out.briefMode),
      wedge: text(head.wedge),
      plan: text(head.recommendedPackage),
      roomTwo: text(obj(head.roomTwo).status),
      missingSources: Array.isArray(out.missingSources) ? out.missingSources.map(String) : [],
      skipped: out.skipped ? String(out.skipped) : null,
    },
    reviewQuotes: { total: quotes.length, verified },
    flags: {
      staleNextAction: Boolean(
        input.nextActionCreatedAt && briefRun?.finishedAt && input.nextActionCreatedAt < briefRun.finishedAt,
      ),
      skippedBriefWritesHubspot:
        steps.LEAD_INTELLIGENCE_BRIEF === "skipped" && isKnown(props.revint_recommended_angle),
    },
    hubspotFilled: Object.keys(props)
      .filter((k) => isKnown(props[k]))
      .sort(),
  };
}

export function aggregateBaseline(rows: LeadBaseline[]): BaselineReport {
  const n = rows.length;
  const stepRate = Object.fromEntries(
    CHAIN_WORKERS.map((k) => {
      const c: Record<StepState, number> = { ok: 0, skipped: 0, failed: 0, missing: 0 };
      for (const r of rows) c[r.steps[k]] += 1;
      return [k, c];
    }),
  ) as Record<ChainWorker, Record<StepState, number>>;
  const knownRate = Object.fromEntries(
    RULE_INPUTS.map((k) => [k, pct(rows.filter((r) => r.known[k]).length, n)]),
  ) as Record<RuleInput, number>;

  const wedges: Record<string, number> = {};
  const plans: Record<string, number> = {};
  const roomTwo: Record<string, number> = {};
  const missingSources: Record<string, number> = {};
  const filled: Record<string, number> = {};
  const reviewQuotes = { total: 0, verified: 0 };
  const flags = { staleNextAction: 0, skippedBriefWritesHubspot: 0 };
  for (const r of rows) {
    bump(wedges, r.brief.wedge);
    bump(plans, r.brief.plan);
    bump(roomTwo, r.brief.roomTwo);
    for (const s of r.brief.missingSources) bump(missingSources, s);
    for (const k of r.hubspotFilled) bump(filled, k);
    reviewQuotes.total += r.reviewQuotes.total;
    reviewQuotes.verified += r.reviewQuotes.verified;
    if (r.flags.staleNextAction) flags.staleNextAction += 1;
    if (r.flags.skippedBriefWritesHubspot) flags.skippedBriefWritesHubspot += 1;
  }
  const hubspotFillRate = Object.fromEntries(
    Object.keys(filled)
      .sort()
      .map((k) => [k, pct(filled[k], n)]),
  );
  return { leads: n, stepRate, knownRate, wedges, plans, roomTwo, missingSources, reviewQuotes, flags, hubspotFillRate };
}

function table(head: string[], body: Array<Array<string | number>>): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

export function renderBaselineMarkdown(report: BaselineReport): string {
  const counts = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => [k, v]);
  return [
    `# Analiz tabanı: ${report.leads} lead`,
    "## Zincir adımları",
    table(
      ["Adım", "ok", "skipped", "failed", "missing"],
      CHAIN_WORKERS.map((k) => [k, report.stepRate[k].ok, report.stepRate[k].skipped, report.stepRate[k].failed, report.stepRate[k].missing]),
    ),
    "## Oda 1 girdileri (bilinen oranı)",
    table(["Alan", "Bilinen"], RULE_INPUTS.map((k) => [k, `${report.knownRate[k]}%`])),
    "## Karar dağılımı",
    table(["Kaçak", "Adet"], counts(report.wedges)),
    table(["Paket", "Adet"], counts(report.plans)),
    table(["Oda 2", "Adet"], counts(report.roomTwo)),
    table(["Eksik kaynak", "Adet"], counts(report.missingSources)),
    "## Yorum alıntıları",
    `Kartlardaki alıntı: ${report.reviewQuotes.total}, gerçek yorumda bulunan: ${report.reviewQuotes.verified}`,
    "## HubSpot",
    table(["Alan", "Dolu"], Object.entries(report.hubspotFillRate).map(([k, v]) => [k, `${v}%`])),
    `Bayat sonraki-adım cümlesi: ${report.flags.staleNextAction} · Atlanan brief yine de yazıyor: ${report.flags.skippedBriefWritesHubspot}`,
  ].join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/control/analysis-baseline.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 5: Write the script**

```ts
// scripts/analysis-baseline.ts
/**
 * Read-only baseline of the lead analysis chain for one workspace.
 *
 *   npx tsx scripts/analysis-baseline.ts <workspaceId>              # last 30 leads, markdown
 *   npx tsx scripts/analysis-baseline.ts <workspaceId> --limit 50
 *   npx tsx scripts/analysis-baseline.ts <workspaceId> --json       # per-lead rows
 *
 * Writes nothing. Every query is scoped to the given workspace.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { toRoomOneAudit } from "@/lib/agent-workers/lead-intelligence-brief";
import { buildRevintProperties } from "@/lib/integrations/hubspot/writeback";
import {
  CHAIN_WORKERS,
  aggregateBaseline,
  renderBaselineMarkdown,
  summarizeLead,
  type BaselineRun,
  type ChainWorker,
} from "@/lib/control/analysis-baseline";

async function main() {
  const args = process.argv.slice(2);
  const workspaceId = args.find((a) => !a.startsWith("--"));
  if (!workspaceId) throw new Error("usage: analysis-baseline.ts <workspaceId> [--limit N] [--json]");
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Math.max(1, Number(args[limitAt + 1]) || 30) : 30;

  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { websiteAudit: true, reviewAnalysis: true, googleReviews: { select: { text: true } } },
  });

  const rows = [];
  for (const lead of leads) {
    const runs: Partial<Record<ChainWorker, BaselineRun | null>> = {};
    for (const kind of CHAIN_WORKERS) {
      runs[kind] = await prisma.agentRun.findFirst({
        where: { workspaceId, leadId: lead.id, workerKind: kind },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, outputJson: true, finishedAt: true },
      });
    }
    const nextAction = await prisma.leadNextAction.findFirst({
      where: { workspaceId, leadId: lead.id, supersededAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const brief = runs.LEAD_INTELLIGENCE_BRIEF;
    const briefSucceeded = brief && (brief.status === "SUCCEEDED" || brief.status === "SUCCEEDED_NO_MEMORY");
    const built = await buildRevintProperties(prisma, workspaceId, lead.id, briefSucceeded ? { briefRunId: brief.id } : {});
    rows.push(
      summarizeLead({
        leadId: lead.id,
        businessName: lead.businessName,
        runs,
        roomOneAudit: toRoomOneAudit(lead as never) as Record<string, unknown> | null,
        reviewTexts: lead.googleReviews.map((r) => r.text ?? ""),
        nextActionCreatedAt: nextAction?.createdAt ?? null,
        hubspotProps: built?.properties ?? null,
      }),
    );
  }

  console.log(args.includes("--json") ? JSON.stringify(rows, null, 2) : renderBaselineMarkdown(aggregateBaseline(rows)));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Typecheck, then take the "before" measurement**

Run: `npx tsc --noEmit`
Expected: hata yok. `AgentRun.createdAt` ya da `Lead.createdAt` yok hatası çıkarsa `prisma/schema.prisma`'daki alan adını kullan.

Run (Redis ve worker'lar açık, FineDine Beta workspace id'si ile):

```bash
npx tsx scripts/analysis-baseline.ts <workspaceId> --limit 30 > docs/decisions/2026-10-02-analiz-tabani-once.md
```

Expected: beş kör alan (`hasPrepayment`, `tableCount`, `languageCount`, `tastingMenu`, `centralPurchasing`) ve `deliveryPlatforms` için "Bilinen" sütunu `0%`. Brief adımı `skipped` çıkıyorsa workspace'te bayrak kapalıdır: `docs/runbooks/head-agent-live.md`'ye göre `CLAUDE_HEAD_AGENT_WORKSPACES`'e workspace id'sini ekle, worker'ı yeniden başlat, 10 lead'in analizini yeniden çalıştır ve betiği tekrar koştur.

- [ ] **Step 7: Commit**

```bash
git add src/lib/control/analysis-baseline.ts src/__tests__/control/analysis-baseline.test.ts scripts/analysis-baseline.ts docs/decisions/2026-10-02-analiz-tabani-once.md
git commit -m "feat(control): baseline report for what the lead chain produces and writes to HubSpot"
```

---

### Task 2: HubSpot yazımı yalnızca bu brief'in kararını yazar

**Files:**
- Modify: `src/lib/integrations/hubspot/brief-hook.ts:33-44`
- Modify: `src/lib/integrations/hubspot/writeback.ts:144-199, 320-376, 532-565`
- Modify: `src/lib/integrations/hubspot/properties.ts` (üç tanım, `REVINT_PROPERTIES` dizisinde `revint_action_sheet_url`'den önce)
- Modify: `docs/runbooks/hubspot-writeback.md` (§1 tablo)
- Test: `src/__tests__/lib/hubspot-brief-hook.test.ts`, `src/__tests__/lib/hubspot-writeback.test.ts`, `src/__tests__/lib/hubspot-properties.test.ts`

**Interfaces:**
- Consumes: brief çıktısındaki `headAgent.roomOne.bans`, `headAgent.excludedModules`, `headAgent.roomTwo.status`, `headAgent.generatedAt`, `missingSources` (bugün var); `headAgent.openQuestions` (Task 7 doldurur, yoksa boş liste).
- Produces: `HeadAgentWritebackView` üzerinde `bans: string[]`, `excludedModules: Array<{ module: string; why: string }>`, `openQuestions: string[]`, `missingSources: string[]`, `roomTwoStatus: string | null`, `generatedAt: string | null`. HubSpot alanları: `revint_do_not_pitch`, `revint_open_questions`, `revint_analyzed_at`.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/hubspot-brief-hook.test.ts` içine, `describe("writebackAfterBriefRun")` bloğuna ekle:

```ts
  it("does not write back a brief that skipped itself", async () => {
    const prisma = prismaWith({ ...BRIEF, outputJson: { skipped: "head_agent_off" } });
    const res = await writebackAfterBriefRun(prisma as never, "run_1");
    expect(res).toEqual({ status: "NOT_APPLICABLE", reason: "brief_skipped" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
```

`src/__tests__/lib/hubspot-writeback.test.ts` içine, `describe("buildRevintProperties")` bloğuna ekle:

```ts
  const FULL_HEAD_AGENT = {
    ...HEAD_AGENT_OUTPUT,
    missingSources: ["reviews"],
    headAgent: {
      ...HEAD_AGENT_OUTPUT.headAgent,
      generatedAt: "2026-10-02T10:00:00.000Z",
      roomOne: { bans: ["Tek şubeye Premium önerme."] },
      roomTwo: { status: "attached" },
      excludedModules: [{ module: "reservation", why: "Rezervasyon sağlayıcısı zaten var (OpenTable)." }],
      openQuestions: ["Kaç masa var? (20 üstü Growth)"],
    },
  };

  it("writes the do-not-pitch list, the open questions and the analysis time", async () => {
    const prisma = makePrisma({ briefOutput: FULL_HEAD_AGENT });
    const p = (await buildRevintProperties(prisma as never, WS, LEAD, { briefRunId: "run_brief" }))!.properties;
    expect(p.revint_do_not_pitch).toBe(
      "- Tek şubeye Premium önerme.\n- reservation: Rezervasyon sağlayıcısı zaten var (OpenTable).",
    );
    expect(p.revint_open_questions).toBe("- Kaç masa var? (20 üstü Growth)\n- Eksik kaynak: reviews");
    expect(p.revint_analyzed_at).toBe("2026-10-02T10:00:00.000Z");
  });

  it("uses the head-agent talk even when an older next action exists", async () => {
    const prisma = makePrisma({ briefOutput: FULL_HEAD_AGENT });
    prisma.leadNextAction.findFirst = vi.fn(async () => ({ openingHook: "stale Gemini hook", timingWindowStart: null }));
    const p = (await buildRevintProperties(prisma as never, WS, LEAD, { briefRunId: "run_brief" }))!.properties;
    expect(p.revint_next_best_action).toContain("40-minute Friday wait");
  });

  it("clears the talk and ignores the old scorer when the card is plain", async () => {
    const plain = { ...FULL_HEAD_AGENT, headAgent: { ...FULL_HEAD_AGENT.headAgent, talkTrack: "", primaryAngle: "Arama yok", wedge: "none" } };
    const prisma = makePrisma({
      briefOutput: plain,
      salesOpportunity: { bestSalesAngle: "multi_location", recommendedPackageReason: "Growth · Multi-location" },
    });
    const p = (await buildRevintProperties(prisma as never, WS, LEAD, { briefRunId: "run_brief" }))!.properties;
    expect(p.revint_next_best_action).toBe("");
    expect(p.revint_recommended_angle).toBe("Arama yok");
  });
```

Aynı dosyada, `describe("enqueueCrmWriteback")` bloğuna (yoksa dosyanın sonuna yeni bir `describe` olarak) ekle:

```ts
  it("retries without the new properties when the portal has not provisioned them", async () => {
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT });
    mocks.client.updateCompany
      .mockRejectedValueOnce(new Error('400 Property "revint_do_not_pitch" does not exist'))
      .mockResolvedValueOnce({ id: "company_9", properties: {} });
    const res = await enqueueCrmWriteback(prisma as never, {
      workspaceId: WS,
      leadId: LEAD,
      reason: "analysis",
      briefRunId: "run_brief",
    });
    expect(res.status).toBe("SUCCESS");
    const second = mocks.client.updateCompany.mock.calls[1][1] as Record<string, string>;
    expect(second.revint_do_not_pitch).toBeUndefined();
    expect(second.revint_recommended_angle).toBe("Hesap bekleme → Growth");
  });
```

`src/__tests__/lib/hubspot-properties.test.ts` içinde sayıları güncelle: `toHaveLength(11)` → `toHaveLength(14)`; `toHaveBeenCalledTimes(22)` ve `toHaveLength(22)` → `28`; `toHaveLength(20)` → `26`; test adlarındaki "11" → "14".

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/lib/hubspot-brief-hook.test.ts src/__tests__/lib/hubspot-writeback.test.ts src/__tests__/lib/hubspot-properties.test.ts`
Expected: FAIL. Hook testi `enqueue` çağrıldığı için, writeback testleri `revint_do_not_pitch` tanımsız olduğu için, properties testi 11 ≠ 14 olduğu için kalır.

- [ ] **Step 3: Skip skipped briefs in the hook**

`brief-hook.ts` içinde `select`'e `outputJson: true` ekle ve `if (!run.leadId)` satırından hemen sonra şunu koy:

```ts
    // A brief that skipped itself (head agent off) has no decision. Writing
    // back would push the old scorer / playbook angle as if it were fresh.
    const out = run.outputJson;
    if (out && typeof out === "object" && !Array.isArray(out) && (out as Record<string, unknown>).skipped) {
      return { status: "NOT_APPLICABLE", reason: "brief_skipped" };
    }
```

- [ ] **Step 4: Add the three properties**

`properties.ts` içinde `REVINT_PROPERTIES` dizisinde `revint_source_conflicts` tanımından sonra, `revint_action_sheet_url`'den önce ekle; dosya başındaki "Eleven canonical properties" yorumunu "Fourteen" yap ve C grubuna üç adı ekle:

```ts
  {
    name: "revint_do_not_pitch",
    label: "Revint Do Not Pitch",
    type: "string",
    fieldType: "textarea",
    description: "What the rep must not sell or say on this account, with the reason (existing tools, playbook bans).",
  },
  {
    name: "revint_open_questions",
    label: "Revint Open Questions",
    type: "string",
    fieldType: "textarea",
    description: "Facts the analysis could not see. Ask these on the call before pitching.",
  },
  {
    name: "revint_analyzed_at",
    label: "Revint Analyzed At",
    type: "datetime",
    fieldType: "date",
    description: "When this account was last analysed by Revint.",
  },
```

- [ ] **Step 5: Read the new fields and write one decision**

`writeback.ts` içinde `HeadAgentWritebackView`'a alanları ekle:

```ts
  /** Room 1 bans: sentences the rep must not say. */
  bans: string[];
  excludedModules: Array<{ module: string; why: string }>;
  /** Unknown rule inputs phrased as questions for the call. */
  openQuestions: string[];
  missingSources: string[];
  /** "attached" = Claude's talk passed QA; anything else is a plain card. */
  roomTwoStatus: string | null;
  generatedAt: string | null;
```

`parseHeadAgentOutput` içinde `return {` satırından önce:

```ts
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const roomOne = h.roomOne && typeof h.roomOne === "object" ? (h.roomOne as Record<string, unknown>) : {};
  const roomTwo = h.roomTwo && typeof h.roomTwo === "object" ? (h.roomTwo as Record<string, unknown>) : {};
  const excludedModules = Array.isArray(h.excludedModules)
    ? h.excludedModules
        .map((m) => {
          if (!m || typeof m !== "object") return null;
          const r = m as Record<string, unknown>;
          return { module: String(r.module ?? ""), why: String(r.why ?? "") };
        })
        .filter((m): m is { module: string; why: string } => m !== null && m.module !== "")
    : [];
```

ve dönen nesneye ekle:

```ts
    bans: strList(roomOne.bans),
    excludedModules,
    openQuestions: strList(h.openQuestions),
    missingSources: strList(o.missingSources),
    roomTwoStatus: str(roomTwo.status),
    generatedAt: str(h.generatedAt),
```

`buildRevintProperties` içinde `const pkg = …` satırından önce:

```ts
  // A head-agent brief is the only decision for this lead. The old scorer,
  // the playbook angle and an older LeadNextAction are a different narrative.
  const ha = headAgent?.briefMode === "head-agent" ? headAgent : null;
```

`const angle = …` atamasını şununla değiştir:

```ts
  const angle =
    headAgent?.primaryAngle ??
    (wedgeFromAgent ? (pkg ? `${wedgeFromAgent} — Package: ${pkg}` : wedgeFromAgent) : null) ??
    (ha
      ? null
      : (str(opportunity?.recommendedPackageReason) ??
        wedgeLabel(opportunity?.bestSalesAngle) ??
        picked?.angle.label ??
        null));
```

`const nba = …` ve altındaki `if (nba)` satırını şununla değiştir:

```ts
  if (ha) {
    // "" clears a talk left by an earlier run when this card is plain.
    props.revint_next_best_action = clip(ha.talkTrack ?? "");
  } else {
    const nba = str(nextAction?.openingHook) ?? headAgent?.talkTrack ?? null;
    if (nba) props.revint_next_best_action = clip(nba);
  }
```

`props.revint_action_sheet_url = …` satırından önce:

```ts
  if (ha) {
    const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");
    props.revint_do_not_pitch = clip(
      bullets([...ha.bans, ...ha.excludedModules.map((m) => `${m.module}: ${m.why}`)]),
    );
    props.revint_open_questions = clip(
      bullets([...ha.openQuestions, ...ha.missingSources.map((s) => `Eksik kaynak: ${s}`)]),
    );
    if (ha.generatedAt) props.revint_analyzed_at = ha.generatedAt;
  }
```

Kanıt özetinin başlığına kart türünü ekle; `const header = [` dizisine son eleman olarak:

```ts
      headAgent.roomTwoStatus ? `Card: ${headAgent.roomTwoStatus === "attached" ? "talk passed QA" : `plain (${headAgent.roomTwoStatus})`}` : null,
```

- [ ] **Step 6: Survive a portal that has not provisioned the new properties**

`writeback.ts` içinde `isPrimaryAssociation` fonksiyonundan önce:

```ts
const NEW_PROPERTY_NAMES = ["revint_do_not_pitch", "revint_open_questions", "revint_analyzed_at"] as const;

/**
 * HubSpot fails the whole PATCH with a 400 when one property does not
 * exist. A portal that has not re-provisioned still gets the original
 * eleven: drop the new three and try once more.
 */
async function patchWithFallback<T>(
  patch: (props: Record<string, string>) => Promise<T>,
  props: Record<string, string>,
): Promise<T> {
  try {
    return await patch(props);
  } catch (err) {
    if (!/does not exist|PROPERTY_DOESNT_EXIST/i.test(errText(err))) throw err;
    const slim = { ...props };
    for (const k of NEW_PROPERTY_NAMES) delete slim[k];
    logger.warn("hubspot.writeback.unprovisioned_properties", { dropped: NEW_PROPERTY_NAMES });
    return patch(slim);
  }
}
```

`enqueueCrmWriteback` içinde iki çağrıyı değiştir:

```ts
      const res = await patchWithFallback((p) => client.updateCompany(companyId, p), built.properties);
```

```ts
      const res = await patchWithFallback((p) => client.updateContact(crmContactId, p), built.properties);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/hubspot-brief-hook.test.ts src/__tests__/lib/hubspot-writeback.test.ts src/__tests__/lib/hubspot-properties.test.ts src/__tests__/workers/agent-run-hubspot-writeback.test.ts`
Expected: PASS. Mevcut bir test, `briefMode: "head-agent"` çıktısı için `LeadNextAction.openingHook`'un ya da `SalesOpportunity` açısının kazanmasını bekliyorsa beklentiyi head agent değerine çevir; bu davranış değişikliği bu görevin amacıdır.

- [ ] **Step 8: Update the runbook and commit**

`docs/runbooks/hubspot-writeback.md` §1'de "11 alan" → "14 alan"; tabloya üç satır ekle (`revint_do_not_pitch`: Oda 1 yasakları + hariç tutulan modüller; `revint_open_questions`: bilinmeyen kural girdileri + eksik kaynaklar; `revint_analyzed_at`: `headAgent.generatedAt`); `revint_next_best_action` satırını "head agent brief'inde yalnızca `headAgent.talkTrack`, düz kartta boş" diye düzelt; §4 adım 5'e "yeni üç alan için `POST /api/integrations/hubspot/provision` çalıştır" cümlesini ekle.

```bash
git add src/lib/integrations/hubspot docs/runbooks/hubspot-writeback.md src/__tests__/lib/hubspot-brief-hook.test.ts src/__tests__/lib/hubspot-writeback.test.ts src/__tests__/lib/hubspot-properties.test.ts
git commit -m "fix(hubspot): write only the head-agent decision, clear stale talk, add do-not-pitch and open questions"
```

---

### Task 3: App Card tek karar gösterir

**Files:**
- Create: `src/lib/integrations/hubspot/head-agent-card.ts`
- Modify: `src/app/api/integrations/hubspot/card-data/route.ts:751-767, 823-840, 857-862, 879-885`
- Test: `src/__tests__/lib/hubspot-head-agent-card.test.ts`

**Interfaces:**
- Consumes: `parseHeadAgentOutput`, `HeadAgentWritebackView` (Task 2'deki alanlarla).
- Produces: `headAgentCardDecision(view: HeadAgentWritebackView | null): CardDecision | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/hubspot-head-agent-card.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/integrations/hubspot/client", () => ({
  getHubspotClient: vi.fn(),
  HubspotNotConnectedError: class extends Error {},
}));
vi.mock("@/lib/playbook/resolve", () => ({ getPlaybook: vi.fn() }));
vi.mock("@/lib/playbook/angle", () => ({
  pickAngle: vi.fn(),
  absenceSignalsFromAudit: vi.fn(),
  hasSlowServiceSignal: vi.fn(),
}));

import { parseHeadAgentOutput } from "@/lib/integrations/hubspot/writeback";
import { headAgentCardDecision } from "@/lib/integrations/hubspot/head-agent-card";

const OUTPUT = {
  briefMode: "head-agent",
  missingSources: ["reviews"],
  headAgent: {
    wedge: "reservation",
    recommendedPackage: "growth",
    primaryAngle: "Rezervasyon → Growth",
    talkTrack: "Bookings run through TheFork with no deposit.",
    confidence: 70,
    evidenceRefs: ["https://x — rezervasyon TheFork üzerinden, depozito görünmüyor"],
    sourceConflicts: [],
    roomOne: { bans: ["Tek şubeye Premium önerme."] },
    roomTwo: { status: "attached" },
    excludedModules: [{ module: "qr_menu", why: "Zaten var." }],
    openQuestions: ["Rezervasyonda depozito veya kart garantisi alıyorlar mı?"],
  },
};

describe("headAgentCardDecision", () => {
  it("builds every decision row from the head agent", () => {
    const d = headAgentCardDecision(parseHeadAgentOutput(OUTPUT))!;
    expect(d.recommendedAngle).toBe("Rezervasyon → Growth");
    expect(d.recommendedAngleKey).toBe("reservation");
    expect(d.pitchThis).toBe("Bookings run through TheFork with no deposit.");
    expect(d.nextBestAction).toBe(d.pitchThis);
    expect(d.whatNotToPitch).toBe("- Tek şubeye Premium önerme.\n- qr_menu: Zaten var.");
    expect(d.evidenceSummary).toContain("TheFork");
    expect(d.openQuestions).toBe("- Rezervasyonda depozito veya kart garantisi alıyorlar mı?\n- Eksik kaynak: reviews");
  });

  it("returns null for a legacy brief so the caller keeps its fallback", () => {
    expect(headAgentCardDecision(parseHeadAgentOutput({ headAgent: { primaryAngle: "QR Menu" } }))).toBeNull();
    expect(headAgentCardDecision(null)).toBeNull();
  });

  it("keeps empty rows null on a plain card", () => {
    const plain = { ...OUTPUT, headAgent: { ...OUTPUT.headAgent, talkTrack: "" } };
    expect(headAgentCardDecision(parseHeadAgentOutput(plain))!.pitchThis).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/hubspot-head-agent-card.test.ts`
Expected: FAIL, `Cannot find module '@/lib/integrations/hubspot/head-agent-card'`.

- [ ] **Step 3: Write the helper**

```ts
// src/lib/integrations/hubspot/head-agent-card.ts
/**
 * App Card "decision" block for a head-agent brief. The card used to
 * build these rows from the playbook angle and an older LeadNextAction,
 * which could contradict the brief shown two rows above.
 */
import type { HeadAgentWritebackView } from "./writeback";

export interface CardDecision {
  recommendedAngle: string | null;
  recommendedAngleKey: string | null;
  pitchThis: string | null;
  whatNotToPitch: string | null;
  nextBestAction: string | null;
  evidenceSummary: string | null;
  openQuestions: string | null;
}

function bullets(lines: string[]): string | null {
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : null;
}

/** `null` = not a head-agent brief; the caller keeps its playbook fallback. */
export function headAgentCardDecision(view: HeadAgentWritebackView | null): CardDecision | null {
  if (!view || view.briefMode !== "head-agent") return null;
  return {
    recommendedAngle: view.primaryAngle,
    recommendedAngleKey: view.wedge,
    pitchThis: view.talkTrack,
    whatNotToPitch: bullets([...view.bans, ...view.excludedModules.map((m) => `${m.module}: ${m.why}`)]),
    nextBestAction: view.talkTrack,
    evidenceSummary: bullets(view.evidenceRefs),
    openQuestions: bullets([...view.openQuestions, ...view.missingSources.map((s) => `Eksik kaynak: ${s}`)]),
  };
}
```

- [ ] **Step 4: Wire the route**

`card-data/route.ts` başına importları ekle:

```ts
import { parseHeadAgentOutput } from "@/lib/integrations/hubspot/writeback";
import { headAgentCardDecision } from "@/lib/integrations/hubspot/head-agent-card";
```

`const headAgent = asJsonObject(briefObj?.headAgent ?? null);` satırından sonra:

```ts
  const haDecision = headAgentCardDecision(parseHeadAgentOutput(briefRun?.outputJson));
```

`pitchSentence` atamasını değiştir (head agent brief'inde bayat cümleye düşmesin):

```ts
  const pitchSentence =
    headAgentTalkTrack ??
    (haDecision ? null : (nextAction?.openingHook ?? picked?.angle.whenToPitch ?? null));
```

Yanıttaki `decision: { … }` bloğunu şununla değiştir:

```ts
    decision: haDecision
      ? {
          recommendedAngle: haDecision.recommendedAngle,
          recommendedAngleKey: haDecision.recommendedAngleKey,
          pitchThis: truncate(haDecision.pitchThis, MAX_HOOK_CHARS),
          whatNotToPitch: truncate(haDecision.whatNotToPitch, MAX_EVIDENCE_CHARS),
          nextBestAction: truncate(haDecision.nextBestAction, MAX_HOOK_CHARS),
          nextBestActionConfidence: null,
          timingWindowStart: null,
          timingWindowEnd: null,
          channel: null,
          evidenceSummary: truncate(haDecision.evidenceSummary, MAX_EVIDENCE_CHARS),
          openQuestions: truncate(haDecision.openQuestions, MAX_EVIDENCE_CHARS),
        }
      : {
          recommendedAngle: picked?.angle.label ?? null,
          recommendedAngleKey: picked?.angle.key ?? null,
          pitchThis: picked?.angle.whenToPitch ?? null,
          whatNotToPitch: picked?.angle.whenNotToPitch ?? null,
          nextBestAction: truncate(nextAction?.openingHook ?? null, MAX_HOOK_CHARS),
          nextBestActionConfidence: nextAction?.confidence ?? null,
          timingWindowStart: nextAction?.timingWindowStart?.toISOString() ?? null,
          timingWindowEnd: nextAction?.timingWindowEnd?.toISOString() ?? null,
          channel: nextAction?.actionKind ?? null,
          evidenceSummary:
            picked && picked.matchedTriggers.length > 0
              ? truncate(`Signals: ${picked.matchedTriggers.join(", ")}`, MAX_EVIDENCE_CHARS)
              : null,
          openQuestions: null,
        },
```

`fit: { … }` bloğunu değiştir (eski skorlayıcının anlatısı head agent brief'inde gösterilmez):

```ts
    fit: {
      opportunityScore: opp?.opportunityScore ?? null,
      expectedPriceBand: haDecision ? null : (opp?.expectedPriceBand ?? null),
      whyGoodTarget: haDecision ? null : truncate(opp?.whyGoodTarget ?? null, MAX_EVIDENCE_CHARS),
      painPoints: haDecision ? [] : asStringList(opp?.likelyPainPoints, 5),
    },
```

`dossier:` ifadesinin koşulunu değiştir:

```ts
    dossier:
      !haDecision && (dossierSummary || dossierObj)
        ? {
            summary: dossierSummary,
            url: dossierUrl,
          }
        : null,
```

`reviews` bloğunda `leadScore: review.leadScore ?? null,` satırını `leadScore: null,` yap (analist artık puan yazmıyor, değer hep 0).

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/__tests__/lib/hubspot-head-agent-card.test.ts && npx tsc --noEmit`
Expected: PASS, tsc temiz.

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/hubspot/head-agent-card.ts src/app/api/integrations/hubspot/card-data/route.ts src/__tests__/lib/hubspot-head-agent-card.test.ts
git commit -m "fix(hubspot): the app card shows the head-agent decision, not a second playbook angle"
```

---

### Task 4: Harita yükündeki hazır gerçekler

Apify aktörü (`compass/crawler-google-places`) rezervasyon linklerini, sipariş platformlarını, menü linkini ve servis seçeneklerini zaten döndürüyor; worker bunları okumuyor.

**Files:**
- Create: `src/lib/delivery-platforms.ts`
- Create: `src/lib/agent-workers/apify/map-facts.ts`
- Modify: `src/lib/agent-workers/apify/gmaps-deep.ts:195-229` (tip), `:294-312` (girdi), `:470-482` (çıktı)
- Test: `src/__tests__/agent-workers/map-facts.test.ts`

**Interfaces:**
- Produces:
  - `deliveryPlatformFor(text: string): string | null`, `isDirectOrderingHost(host: string): boolean`
  - `interface MapLink { name: string | null; url: string }`
  - `interface MapFacts { reservationLinks: MapLink[]; orderLinks: MapLink[]; deliveryPlatforms: string[]; menuUrl: string | null; acceptsReservations: boolean | null; serviceOptions: string[]; price: string | null }`
  - `extractMapFacts(place: unknown): MapFacts`, `parseMapFacts(raw: unknown): MapFacts | null`, `countryCodeFromAddress(address: string | null | undefined): string | undefined`
  - `APIFY_GMAPS_DEEP` koşu çıktısında `mapFacts: MapFacts`.

- [ ] **Step 1: Confirm the actor's field names on one real place**

Run:

```bash
npx tsx -e "import('dotenv/config').then(async()=>{const{runSync}=await import('./src/lib/apify');const r=await runSync('compass/crawler-google-places',{startUrls:[{url:process.argv[1]}],maxCrawledPlacesPerSearch:1,maxReviews:0,language:'en'},{timeoutSec:300});const p=r.items[0]??{};for(const k of['reserveTableUrl','tableReservationLinks','orderBy','menu','additionalInfo','price'])console.log(k,JSON.stringify(p[k])?.slice(0,500))})" "<bir FineDine lead'inin googleMapsUri değeri>"
```

Expected: altı satır. Beklenen biçimler: `reserveTableUrl` string; `tableReservationLinks` `[{ name, url }]`; `orderBy` `[{ name, orderUrl }]` (bazı sürümlerde `url`); `menu` string; `additionalInfo` `{ "Service options": [{ "Dine-in": true }], "Planning": [{ "Accepts reservations": true }] }`; `price` string. Bir alan farklı adla geliyorsa Step 4'teki `extractMapFacts` içinde yalnızca o anahtarı düzelt ve farkı commit mesajına yaz.

- [ ] **Step 2: Write the failing test**

```ts
// src/__tests__/agent-workers/map-facts.test.ts
import { describe, expect, it } from "vitest";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";
import { countryCodeFromAddress, extractMapFacts, parseMapFacts } from "@/lib/agent-workers/apify/map-facts";

describe("deliveryPlatformFor", () => {
  it("names a marketplace from a url or a label", () => {
    expect(deliveryPlatformFor("https://deliveroo.co.uk/menu/london/x")).toBe("Deliveroo");
    expect(deliveryPlatformFor("Uber Eats")).toBe("Uber Eats");
    expect(deliveryPlatformFor("https://www.just-eat.co.uk/restaurants-x")).toBe("Just Eat");
    expect(deliveryPlatformFor("https://padella.co/order")).toBeNull();
  });
  it("knows direct-ordering vendors are not marketplaces", () => {
    expect(isDirectOrderingHost("order.flipdish.com")).toBe(true);
    expect(isDirectOrderingHost("deliveroo.co.uk")).toBe(false);
  });
});

describe("extractMapFacts", () => {
  it("reads reservation links, order platforms, menu and service options", () => {
    const facts = extractMapFacts({
      reserveTableUrl: "https://www.opentable.co.uk/r/x",
      tableReservationLinks: [{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }],
      orderBy: [
        { name: "Deliveroo", orderUrl: "https://deliveroo.co.uk/menu/x" },
        { name: "padella.co", url: "https://padella.co/order" },
      ],
      menu: "https://padella.co/menu",
      price: "££",
      additionalInfo: {
        "Service options": [{ "Dine-in": true }, { Delivery: true }, { Takeaway: false }],
        Planning: [{ "Accepts reservations": true }],
      },
    });
    expect(facts.reservationLinks).toEqual([{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }]);
    expect(facts.orderLinks).toHaveLength(2);
    expect(facts.deliveryPlatforms).toEqual(["Deliveroo"]);
    expect(facts.menuUrl).toBe("https://padella.co/menu");
    expect(facts.serviceOptions).toEqual(["Dine-in", "Delivery"]);
    expect(facts.acceptsReservations).toBe(true);
    expect(facts.price).toBe("££");
  });

  it("returns empty facts for a payload without these fields and never throws", () => {
    const empty = { reservationLinks: [], orderLinks: [], deliveryPlatforms: [], menuUrl: null, acceptsReservations: null, serviceOptions: [], price: null };
    expect(extractMapFacts({ title: "x" })).toEqual(empty);
    expect(extractMapFacts(null)).toEqual(empty);
    expect(extractMapFacts({ orderBy: "nope", additionalInfo: [1, 2], tableReservationLinks: [null, { url: 5 }] })).toEqual(empty);
  });

  it("round-trips through stored JSON", () => {
    const facts = extractMapFacts({ menu: "https://x.co/menu" });
    expect(parseMapFacts(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(parseMapFacts(undefined)).toBeNull();
  });
});

describe("countryCodeFromAddress", () => {
  it("reads the country from the end of a formatted address", () => {
    expect(countryCodeFromAddress("6 Southwark St, London SE1 1TQ, UK")).toBe("gb");
    expect(countryCodeFromAddress("İstiklal Cd. 12, 34435 Beyoğlu/İstanbul, Türkiye")).toBe("tr");
    expect(countryCodeFromAddress("12 Rue X, 75001 Paris, France")).toBe("fr");
    expect(countryCodeFromAddress("somewhere unknown")).toBeUndefined();
    expect(countryCodeFromAddress(null)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/agent-workers/map-facts.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Step 4: Write the two modules**

```ts
// src/lib/delivery-platforms.ts
/** Delivery marketplaces (commission) versus a venue's own ordering. */
const MARKETPLACES: Array<[RegExp, string]> = [
  [/deliveroo/i, "Deliveroo"],
  [/uber[\s-]?eats/i, "Uber Eats"],
  [/just[\s-]?eat/i, "Just Eat"],
  [/doordash/i, "DoorDash"],
  [/grubhub/i, "Grubhub"],
  [/\bwolt\b/i, "Wolt"],
  [/foodpanda/i, "foodpanda"],
  [/yemeksepeti/i, "Yemeksepeti"],
  [/\bgetir\b/i, "Getir"],
  [/talabat/i, "Talabat"],
  [/trendyol/i, "Trendyol Yemek"],
];

/** Marketplace name for a URL or a label; `null` when it is not one. */
export function deliveryPlatformFor(text: string): string | null {
  for (const [re, name] of MARKETPLACES) if (re.test(text)) return name;
  return null;
}

const DIRECT_ORDER_HOSTS = /(flipdish|gloriafood|slerp|order\.store|orderyoyo|oddle)/i;

/** White-label ordering vendors: the venue owns the order, no marketplace. */
export function isDirectOrderingHost(host: string): boolean {
  return DIRECT_ORDER_HOSTS.test(host);
}
```

```ts
// src/lib/agent-workers/apify/map-facts.ts
/**
 * Facts the Google Maps payload already carries and Room 1 needs:
 * who takes the bookings, which marketplaces deliver, where the menu is.
 * Defensive on purpose: the actor's output shape has changed before.
 */
import { deliveryPlatformFor } from "@/lib/delivery-platforms";

export interface MapLink {
  name: string | null;
  url: string;
}

export interface MapFacts {
  reservationLinks: MapLink[];
  orderLinks: MapLink[];
  /** Marketplace names among the order links. */
  deliveryPlatforms: string[];
  menuUrl: string | null;
  acceptsReservations: boolean | null;
  serviceOptions: string[];
  price: string | null;
}

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function httpUrl(v: unknown): string | null {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
}
function links(v: unknown, urlKeys: string[]): MapLink[] {
  if (!Array.isArray(v)) return [];
  const out: MapLink[] = [];
  for (const x of v) {
    const o = rec(x);
    if (!o) continue;
    const url = urlKeys.map((k) => httpUrl(o[k])).find((u): u is string => u !== null);
    if (!url || out.some((l) => l.url === url)) continue;
    out.push({ name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null, url });
  }
  return out;
}

export function extractMapFacts(place: unknown): MapFacts {
  const p = rec(place) ?? {};

  const reservationLinks = links(p.tableReservationLinks, ["url"]);
  const reserveUrl = httpUrl(p.reserveTableUrl);
  if (reserveUrl && !reservationLinks.some((l) => l.url === reserveUrl)) {
    reservationLinks.unshift({ name: null, url: reserveUrl });
  }

  const orderLinks = links(p.orderBy, ["orderUrl", "url"]);
  const deliveryPlatforms = [
    ...new Set(
      orderLinks
        .map((l) => deliveryPlatformFor(l.url) ?? (l.name ? deliveryPlatformFor(l.name) : null))
        .filter((x): x is string => x !== null),
    ),
  ];

  const serviceOptions: string[] = [];
  let acceptsReservations: boolean | null = null;
  for (const [group, items] of Object.entries(rec(p.additionalInfo) ?? {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      for (const [label, val] of Object.entries(rec(item) ?? {})) {
        if (typeof val !== "boolean") continue;
        if (/service options/i.test(group) && val) serviceOptions.push(label);
        if (/accepts reservations|reservations required/i.test(label) && acceptsReservations !== true) {
          acceptsReservations = val;
        }
      }
    }
  }

  return {
    reservationLinks,
    orderLinks,
    deliveryPlatforms,
    menuUrl: httpUrl(p.menu),
    acceptsReservations,
    serviceOptions,
    price: typeof p.price === "string" && p.price.trim() ? p.price.trim() : null,
  };
}

/** Re-read `mapFacts` from a stored run output. */
export function parseMapFacts(raw: unknown): MapFacts | null {
  const o = rec(raw);
  if (!o) return null;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    reservationLinks: links(o.reservationLinks, ["url"]),
    orderLinks: links(o.orderLinks, ["url"]),
    deliveryPlatforms: strs(o.deliveryPlatforms),
    menuUrl: httpUrl(o.menuUrl),
    acceptsReservations: typeof o.acceptsReservations === "boolean" ? o.acceptsReservations : null,
    serviceOptions: strs(o.serviceOptions),
    price: typeof o.price === "string" && o.price ? o.price : null,
  };
}

const COUNTRY_ENDINGS: Array<[RegExp, string]> = [
  [/(\buk|united kingdom|england|scotland|wales)$/i, "gb"],
  [/(türkiye|turkiye|turkey)$/i, "tr"],
  [/(\busa|united states)$/i, "us"],
  [/ireland$/i, "ie"],
  [/(germany|deutschland)$/i, "de"],
  [/france$/i, "fr"],
  [/(spain|españa)$/i, "es"],
  [/(italy|italia)$/i, "it"],
  [/netherlands$/i, "nl"],
  [/(united arab emirates|\buae)$/i, "ae"],
];

/** ISO-2 country for the actor's search fallback; `undefined` = let the actor decide. */
export function countryCodeFromAddress(address: string | null | undefined): string | undefined {
  const tail = (address ?? "").trim().replace(/[.\s]+$/, "");
  if (!tail) return undefined;
  for (const [re, code] of COUNTRY_ENDINGS) if (re.test(tail)) return code;
  return undefined;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/agent-workers/map-facts.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 6: Use them in the worker**

`gmaps-deep.ts` başına:

```ts
import { countryCodeFromAddress, extractMapFacts } from "./map-facts";
```

`PlaceItem` arayüzüne, `twitters?: string[];` satırından sonra:

```ts
  // Read by `extractMapFacts`; typed loosely because the actor has
  // changed these shapes before.
  reserveTableUrl?: unknown;
  tableReservationLinks?: unknown;
  orderBy?: unknown;
  menu?: unknown;
  additionalInfo?: unknown;
  price?: unknown;
```

Aktör girdisinde `countryCode: "gb",` satırını değiştir:

```ts
    // Only matters for the name + address search fallback. Derived from
    // the lead's own address; omitted when unknown.
    countryCode: countryCodeFromAddress(lead.formattedAddress),
```

`return { output: {` bloğuna `placeId: place.placeId,` satırından sonra:

```ts
      mapFacts: extractMapFacts(place),
```

- [ ] **Step 7: Run the worker tests and commit**

Run: `npx vitest run src/__tests__/agent-workers/apify-gmaps-deep.test.ts src/__tests__/agent-workers/map-facts.test.ts`
Expected: PASS. Mevcut bir test aktör girdisinde `countryCode: "gb"` bekliyorsa, test lead'inin adresine göre (`…, UK` → `"gb"`, adres yoksa `undefined`) güncelle.

```bash
git add src/lib/delivery-platforms.ts src/lib/agent-workers/apify/map-facts.ts src/lib/agent-workers/apify/gmaps-deep.ts src/__tests__/agent-workers/map-facts.test.ts src/__tests__/agent-workers/apify-gmaps-deep.test.ts
git commit -m "feat: the map worker keeps the reservation, ordering and menu facts Google already returns"
```

---

### Task 5: Site denetimi menü, rezervasyon ve sipariş sayfalarını da açar

**Files:**
- Create: `src/lib/site-facts.ts`
- Modify: `src/lib/crawler.ts` (dosya başı importlar; `return features;` satırından önce, bugün satır 377)
- Modify: `src/types/index.ts:152` (`WebsiteFeatures`)
- Modify: `src/lib/agent-workers/registry.ts:63` (`estimatedDurationMs`)
- Test: `src/__tests__/lib/site-facts.test.ts`

**Interfaces:**
- Consumes: `extractFeatures` (`src/lib/extractor.ts`), `deliveryPlatformFor`, `isDirectOrderingHost` (Task 4).
- Produces:
  - `type SubpageKind = "menu" | "reservation" | "order"`
  - `interface SiteFact<T> { value: T; url: string; quote: string | null }`
  - `interface SiteFacts { pagesVisited: Array<{ kind: SubpageKind; url: string; ok: boolean }>; bookingChecked: boolean; menuPageSeen: boolean; orderPageSeen: boolean; bookingProvider: SiteFact<string> | null; hasPrepayment: SiteFact<true> | null; tastingMenu: SiteFact<true> | null; languageCount: SiteFact<number> | null; deliveryPlatforms: SiteFact<string[]> | null; directOrdering: SiteFact<true> | null; qrMenuTool: SiteFact<string> | null; menuPdfUrl: string | null }`
  - `pickSubpages(homeHtml: string, homeUrl: string): SubpagePick`, `mergeSiteFacts(home: { url: string; html: string }, pages: VisitedPage[], pick: SubpagePick): SiteFacts`
  - `WebsiteFeatures.siteFacts?: SiteFacts` (dolayısıyla `WebsiteAudit.rawFeaturesJson.siteFacts`).

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/site-facts.test.ts
import { describe, expect, it } from "vitest";
import { mergeSiteFacts, pickSubpages } from "@/lib/site-facts";

const HOME = "https://padella.co/";
const homeHtml = `<html lang="en"><head>
  <link rel="alternate" hreflang="en" href="https://padella.co/" />
  <link rel="alternate" hreflang="it" href="https://padella.co/it/" />
  <link rel="alternate" hreflang="x-default" href="https://padella.co/" />
</head><body><nav>
  <a href="/menu">Menu</a>
  <a href="/reservations">Book a table</a>
  <a href="/order">Order online</a>
  <a href="https://deliveroo.co.uk/menu/london/padella">Deliveroo</a>
  <a href="https://other-site.com/menu">Partner menu</a>
  <a href="/files/wine.pdf">Wine menu</a>
  <a href="mailto:hi@padella.co">Email</a>
</nav></body></html>`;

describe("pickSubpages", () => {
  it("picks one same-host page per kind and never an external host", () => {
    const pick = pickSubpages(homeHtml, HOME);
    expect(pick.targets).toEqual([
      { kind: "reservation", url: "https://padella.co/reservations" },
      { kind: "menu", url: "https://padella.co/menu" },
      { kind: "order", url: "https://padella.co/order" },
    ]);
    expect(pick.menuPdfUrl).toBe("https://padella.co/files/wine.pdf");
    expect(pick.hasBookingLink).toBe(true);
  });

  it("reports no booking link on a site that has none", () => {
    const pick = pickSubpages(`<a href="/menu">Menu</a><a href="/about">About</a>`, HOME);
    expect(pick.hasBookingLink).toBe(false);
    expect(pick.targets).toEqual([{ kind: "menu", url: "https://padella.co/menu" }]);
  });
});

describe("mergeSiteFacts", () => {
  const pick = pickSubpages(homeHtml, HOME);

  it("finds prepayment on the booking page and a tasting menu on the menu page", () => {
    const facts = mergeSiteFacts({ url: HOME, html: homeHtml }, [
      { kind: "reservation", url: "https://padella.co/reservations", html: "<body><p>A deposit of £10 per person is required to secure your booking.</p></body>" },
      { kind: "menu", url: "https://padella.co/menu", html: "<body><h2>Seven-course tasting menu</h2><p>Our 7-course tasting menu changes weekly.</p></body>" },
      { kind: "order", url: "https://padella.co/order", html: "<body><a href='https://padella.co/order/checkout'>Order now</a></body>" },
    ], pick);
    expect(facts.hasPrepayment).toMatchObject({ value: true, url: "https://padella.co/reservations" });
    expect(facts.hasPrepayment!.quote).toContain("deposit of £10");
    expect(facts.tastingMenu).toMatchObject({ value: true, url: "https://padella.co/menu" });
    expect(facts.languageCount).toMatchObject({ value: 2, url: HOME });
    expect(facts.deliveryPlatforms).toMatchObject({ value: ["Deliveroo"], url: HOME });
    expect(facts.directOrdering).toMatchObject({ value: true });
    expect(facts.bookingChecked).toBe(true);
    expect(facts.menuPageSeen).toBe(true);
    expect(facts.orderPageSeen).toBe(true);
    expect(facts.menuPdfUrl).toBe("https://padella.co/files/wine.pdf");
  });

  it("keeps a kind unseen when its page could not be opened", () => {
    const facts = mergeSiteFacts({ url: HOME, html: homeHtml }, [
      { kind: "reservation", url: "https://padella.co/reservations", html: null },
      { kind: "menu", url: "https://padella.co/menu", html: null },
    ], pick);
    expect(facts.bookingChecked).toBe(false); // a booking link exists but was not read
    expect(facts.menuPageSeen).toBe(false);
    expect(facts.hasPrepayment).toBeNull();
    expect(facts.pagesVisited).toEqual([
      { kind: "reservation", url: "https://padella.co/reservations", ok: false },
      { kind: "menu", url: "https://padella.co/menu", ok: false },
    ]);
  });

  it("treats a site with no booking link at all as checked", () => {
    const html = `<a href="/menu">Menu</a>`;
    const facts = mergeSiteFacts({ url: HOME, html }, [], pickSubpages(html, HOME));
    expect(facts.bookingChecked).toBe(true);
    expect(facts.languageCount).toBeNull(); // no hreflang: unknown, not 1
    expect(facts.deliveryPlatforms).toBeNull();
    expect(facts.directOrdering).toBeNull();
  });

  it("does not count a marketplace link as the venue's own ordering", () => {
    const html = `<a href="https://deliveroo.co.uk/menu/x">Order online</a>`;
    const facts = mergeSiteFacts({ url: HOME, html }, [], pickSubpages(html, HOME));
    expect(facts.directOrdering).toBeNull();
    expect(facts.deliveryPlatforms!.value).toEqual(["Deliveroo"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/site-facts.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-facts'`.

- [ ] **Step 3: Write the module**

```ts
// src/lib/site-facts.ts
/**
 * Facts read from the pages a guest would open: menu, reservations,
 * ordering. The homepage alone cannot say "no QR menu" or "no deposit";
 * every fact here carries the URL it was read on. `null` = not seen.
 */
import * as cheerio from "cheerio";
import { extractFeatures } from "@/lib/extractor";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";

export type SubpageKind = "menu" | "reservation" | "order";
export interface SubpageTarget {
  kind: SubpageKind;
  url: string;
}
export interface VisitedPage extends SubpageTarget {
  /** `null` = the page could not be opened. */
  html: string | null;
}
export interface SubpagePick {
  targets: SubpageTarget[];
  menuPdfUrl: string | null;
  /** The homepage links to a booking surface (own page or external). */
  hasBookingLink: boolean;
}
export interface SiteFact<T> {
  value: T;
  url: string;
  quote: string | null;
}
export interface SiteFacts {
  pagesVisited: Array<{ kind: SubpageKind; url: string; ok: boolean }>;
  /** True when there is no booking link to follow, or the booking page was read. */
  bookingChecked: boolean;
  menuPageSeen: boolean;
  orderPageSeen: boolean;
  bookingProvider: SiteFact<string> | null;
  hasPrepayment: SiteFact<true> | null;
  tastingMenu: SiteFact<true> | null;
  languageCount: SiteFact<number> | null;
  deliveryPlatforms: SiteFact<string[]> | null;
  directOrdering: SiteFact<true> | null;
  qrMenuTool: SiteFact<string> | null;
  menuPdfUrl: string | null;
}

const RES_TEXT = /\b(reserv\w*|book(ing|ings)?|book a table|rezervasyon)\b/i;
const RES_PATH = /(^|\/)(reserv[\w-]*|book[\w-]*|rezervasyon)(\/|$|\.)/i;
const MENU_TEXT = /(^|[^\p{L}])(menu|menus|menü)($|[^\p{L}])/iu;
const MENU_PATH = /(^|\/)(menu|menus|our-menu|food-menu)(\/|$|\.|-)/i;
const ORDER_TEXT = /\border (online|now)\b/i;
const ORDER_PATH = /(^|\/)(order|order-online|online-order|ordering|order-now)(\/|$|\.)/i;
const PREPAY =
  /(deposit|card details (are |will be )?(required|needed|taken)|credit card (is )?required|pre-?pay(ment)?|cancellation (fee|charge)|no[- ]show (fee|charge)|kapora|ön ödeme)/i;
const TASTING = /(tasting menu|d[ée]gustation|chef'?s table|\b\d{1,2}[- ]course\b|tadım menüsü)/i;

interface Link {
  text: string;
  url: URL;
}

function linksOf(html: string, pageUrl: string): Link[] {
  const $ = cheerio.load(html);
  const out: Link[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      if (/^https?:$/.test(url.protocol)) out.push({ text: $(el).text().replace(/\s+/g, " ").trim(), url });
    } catch {
      // malformed href: not a link we can follow
    }
  });
  return out;
}

function bare(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}
function pathOf(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}
function bodyText(html: string): string {
  return cheerio.load(html)("body").text().replace(/\s+/g, " ").trim();
}
function snippet(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (!m) return null;
  return text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).trim();
}

/** Choose at most one same-host page per kind from the homepage links. */
export function pickSubpages(homeHtml: string, homeUrl: string): SubpagePick {
  const home = new URL(homeUrl);
  const byKind = new Map<SubpageKind, string>();
  let menuPdfUrl: string | null = null;
  let hasBookingLink = false;

  for (const l of linksOf(homeHtml, homeUrl)) {
    const path = pathOf(l.url);
    const isRes = RES_TEXT.test(l.text) || RES_PATH.test(path);
    const isMenu = MENU_TEXT.test(l.text) || MENU_PATH.test(path);
    const isOrder = ORDER_TEXT.test(l.text) || ORDER_PATH.test(path);
    if (isRes) hasBookingLink = true;
    if (bare(l.url.hostname) !== bare(home.hostname)) continue;
    if (isMenu && /\.pdf$/i.test(path)) {
      menuPdfUrl ??= l.url.href;
      continue;
    }
    if (l.url.pathname === home.pathname && !l.url.search) continue; // the homepage itself
    const kind: SubpageKind | null = isRes ? "reservation" : isMenu ? "menu" : isOrder ? "order" : null;
    if (kind && !byKind.has(kind)) byKind.set(kind, l.url.href.split("#")[0]);
  }

  const order: SubpageKind[] = ["reservation", "menu", "order"];
  return {
    targets: order.filter((k) => byKind.has(k)).map((k) => ({ kind: k, url: byKind.get(k)! })),
    menuPdfUrl,
    hasBookingLink,
  };
}

/** Merge the homepage and the opened subpages into one evidence-carrying record. */
export function mergeSiteFacts(
  home: { url: string; html: string },
  pages: VisitedPage[],
  pick: SubpagePick,
): SiteFacts {
  const opened = pages.filter((p): p is VisitedPage & { html: string } => p.html !== null);
  const all: Array<{ kind: SubpageKind | "home"; url: string; html: string }> = [
    { kind: "home", url: home.url, html: home.html },
    ...opened,
  ];
  const homeHost = bare(new URL(home.url).hostname);

  let bookingProvider: SiteFact<string> | null = null;
  let hasPrepayment: SiteFact<true> | null = null;
  let tastingMenu: SiteFact<true> | null = null;
  let directOrdering: SiteFact<true> | null = null;
  let qrMenuTool: SiteFact<string> | null = null;
  const platforms: string[] = [];
  let platformsUrl: string | null = null;

  for (const p of all) {
    const f = extractFeatures(p.html, p.url);
    if (!bookingProvider && f.bookingProvider) bookingProvider = { value: f.bookingProvider, url: p.url, quote: null };
    if (!qrMenuTool && f.detectedMenuTool) qrMenuTool = { value: f.detectedMenuTool, url: p.url, quote: null };

    for (const l of linksOf(p.html, p.url)) {
      const platform = deliveryPlatformFor(l.url.hostname);
      if (platform) {
        if (!platforms.includes(platform)) platforms.push(platform);
        platformsUrl ??= p.url;
        continue;
      }
      const ownOrder =
        isDirectOrderingHost(l.url.hostname) ||
        (bare(l.url.hostname) === homeHost && (ORDER_PATH.test(pathOf(l.url)) || ORDER_TEXT.test(l.text)));
      if (!directOrdering && ownOrder) directOrdering = { value: true, url: p.url, quote: l.text || l.url.href };
    }

    const text = bodyText(p.html);
    if (!hasPrepayment && (p.kind === "reservation" || p.kind === "home")) {
      const quote = snippet(text, PREPAY);
      if (quote) hasPrepayment = { value: true, url: p.url, quote };
    }
    if (!tastingMenu && (p.kind === "menu" || p.kind === "home")) {
      const quote = snippet(text, TASTING);
      if (quote) tastingMenu = { value: true, url: p.url, quote };
    }
  }

  const langs = new Set<string>();
  cheerio
    .load(home.html)('link[rel="alternate"][hreflang]')
    .each((_, el) => {
      const code = (el.attribs?.hreflang ?? "").toLowerCase().split("-")[0];
      if (code && code !== "x") langs.add(code);
    });

  return {
    pagesVisited: pages.map((p) => ({ kind: p.kind, url: p.url, ok: p.html !== null })),
    bookingChecked: !pick.hasBookingLink || opened.some((p) => p.kind === "reservation"),
    menuPageSeen: opened.some((p) => p.kind === "menu"),
    orderPageSeen: opened.some((p) => p.kind === "order"),
    bookingProvider,
    hasPrepayment,
    tastingMenu,
    languageCount: langs.size > 0 ? { value: langs.size, url: home.url, quote: [...langs].join(", ") } : null,
    deliveryPlatforms: platforms.length > 0 ? { value: platforms, url: platformsUrl ?? home.url, quote: null } : null,
    directOrdering,
    qrMenuTool,
    menuPdfUrl: pick.menuPdfUrl,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/site-facts.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 5: Open the subpages in the crawler**

`src/types/index.ts` içinde `WebsiteFeatures` arayüzünün son alanından sonra:

```ts
  /** Facts read from the menu / reservation / order pages (site-facts.ts). */
  siteFacts?: import("@/lib/site-facts").SiteFacts;
```

`src/lib/crawler.ts` importlarına:

```ts
import { mergeSiteFacts, pickSubpages, type SiteFacts, type VisitedPage } from "./site-facts";
```

`crawlWebsite` fonksiyonunun üstüne:

```ts
const SUBPAGE_TIMEOUT_MS = 8_000;
const SUBPAGE_BUDGET_MS = 20_000;

/**
 * Open the menu / reservation / order pages linked from the homepage.
 * Best-effort: a page that fails stays "not seen". Navigations go through
 * the same route guard as the homepage (set up by the caller).
 */
async function collectSiteFacts(page: Page, homeUrl: string, homeHtml: string): Promise<SiteFacts> {
  const pick = pickSubpages(homeHtml, homeUrl);
  const pages: VisitedPage[] = [];
  const deadline = Date.now() + SUBPAGE_BUDGET_MS;
  for (const target of pick.targets) {
    if (Date.now() >= deadline) {
      pages.push({ ...target, html: null });
      continue;
    }
    try {
      const res = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: SUBPAGE_TIMEOUT_MS });
      if (!res || res.status() >= 400) {
        pages.push({ ...target, html: null });
        continue;
      }
      await page.waitForTimeout(800);
      pages.push({ ...target, html: await page.content() });
    } catch {
      pages.push({ ...target, html: null });
    }
  }
  return mergeSiteFacts({ url: homeUrl, html: homeHtml }, pages, pick);
}
```

`crawlWebsite` içinde, mobil kontrolünden sonraki `return features;` satırını şununla değiştir:

```ts
    if (features.reachable) {
      try {
        features.siteFacts = await collectSiteFacts(page, finalUrl, html);
      } catch (err) {
        // The homepage audit stands on its own; subpages are extra evidence.
        console.error(`Subpage crawl failed for ${url}:`, err instanceof Error ? err.message : String(err));
      }
    }

    return features;
```

`src/lib/agent-workers/registry.ts` içinde `WEBSITE_AUDITOR` kaydında `estimatedDurationMs: 15000` → `estimatedDurationMs: 30000` (üç alt sayfa için 20 saniyelik bütçe eklendi).

- [ ] **Step 6: Typecheck, run the crawler-adjacent tests, commit**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/lib/site-facts.test.ts src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts`
Expected: tsc temiz, testler PASS.

```bash
git add src/lib/site-facts.ts src/lib/crawler.ts src/types/index.ts src/lib/agent-workers/registry.ts src/__tests__/lib/site-facts.test.ts
git commit -m "feat: the website audit reads the menu, reservation and order pages and records where each fact was seen"
```

---

### Task 6: Yorum cümleleri kategori, birebir alıntı ve sayı taşır

**Files:**
- Modify: `src/lib/review-analysis/pain-phrases.ts:15, 44-62`
- Create: `src/lib/review-analysis/quote-verify.ts`
- Modify: `src/lib/prompts/review-analysis-prompt.ts:121-122, 142`
- Modify: `src/lib/gemini.ts:852-862` (responseSchema)
- Modify: `src/lib/agent-workers/review-analyst.ts:542`
- Test: `src/__tests__/review-analysis/quote-verify.test.ts`

**Interfaces:**
- Consumes: `normalizeForGrounding` (`src/lib/review-analysis/kpi-filter.ts`).
- Produces:
  - `PAIN_CATEGORIES = ["bill", "reservation", "delivery", "menu", "repeat", "language", "wait", "other"] as const`, `type PainCategory`
  - `type PainPhrase = { text: string; sellable: boolean; category?: PainCategory; quotes?: string[]; mentions?: number }`
  - `verifyPainQuotes(phrases: PainPhrase[], reviewTexts: Array<string | null>): PainPhrase[]`
  - `ReviewAnalysis.painPhrases` satırlarında `category`, `quotes` (yalnızca doğrulananlar), `mentions` (alıntısı bulunan farklı yorum sayısı).

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/review-analysis/quote-verify.test.ts
import { describe, expect, it } from "vitest";
import { toPainPhrases } from "@/lib/review-analysis/pain-phrases";
import { verifyPainQuotes } from "@/lib/review-analysis/quote-verify";

const REVIEWS = [
  "Lovely pasta, but we waited 25 minutes for the bill and had to chase it twice.",
  "Great food. Getting the bill took forever though!",
  "Best cacio e pepe in London.",
  null,
];

describe("toPainPhrases", () => {
  it("keeps a valid category and up to five quotes, and drops an unknown category", () => {
    const [a, b] = toPainPhrases([
      { text: "slow bill", sellable: true, category: "bill", quotes: ["q1", "q2", "q3", "q4", "q5", "q6", 7] },
      { text: "rude staff", sellable: false, category: "vibes" },
    ]);
    expect(a.category).toBe("bill");
    expect(a.quotes).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(b.category).toBeUndefined();
    expect(b.quotes).toEqual([]);
  });

  it("still accepts legacy bare strings", () => {
    expect(toPainPhrases(["waited ages"])[0]).toMatchObject({ text: "waited ages", quotes: [] });
  });
});

describe("verifyPainQuotes", () => {
  it("counts distinct reviews whose text contains a quote", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, category: "bill", quotes: ["we waited 25 minutes for the bill", "Getting the bill took forever"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(2);
    expect(p.quotes).toEqual(["we waited 25 minutes for the bill", "Getting the bill took forever"]);
  });

  it("drops a paraphrase the model wrote itself", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, category: "bill", quotes: ["Guests complain about slow payment"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(0);
    expect(p.quotes).toEqual([]);
  });

  it("counts two quotes from the same review once", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, quotes: ["waited 25 minutes for the bill", "had to chase it twice"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(1);
    expect(p.quotes).toEqual(["waited 25 minutes for the bill"]);
  });

  it("ignores quotes too short to be evidence and tolerates punctuation and case", () => {
    const [p] = verifyPainQuotes(
      [{ text: "bill", sellable: true, quotes: ["the bill", "GETTING THE BILL took forever, though"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(1);
  });

  it("gives zero mentions to a phrase with no quotes", () => {
    expect(verifyPainQuotes([{ text: "x", sellable: true }], REVIEWS)[0].mentions).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/review-analysis/quote-verify.test.ts`
Expected: FAIL, `quote-verify` modülü yok.

- [ ] **Step 3: Extend the pain phrase shape**

`pain-phrases.ts` içinde `export type PainPhrase = …` satırını değiştir:

```ts
/** Closed set the analyst assigns; Room 1 maps these onto wedges. */
export const PAIN_CATEGORIES = ["bill", "reservation", "delivery", "menu", "repeat", "language", "wait", "other"] as const;
export type PainCategory = (typeof PAIN_CATEGORIES)[number];

export type PainPhrase = {
  text: string;
  sellable: boolean;
  category?: PainCategory;
  /** Verbatim review fragments. After `verifyPainQuotes`: only the ones found in a real review. */
  quotes?: string[];
  /** Distinct reviews containing a verified quote. Set by `verifyPainQuotes`. */
  mentions?: number;
};
```

`toPainPhrases` gövdesini değiştir:

```ts
export function toPainPhrases(raw: unknown): PainPhrase[] {
  if (!Array.isArray(raw)) return [];
  const out: PainPhrase[] = [];
  for (const item of raw) {
    let text = "";
    let modelSellable = false;
    let category: PainCategory | undefined;
    let quotes: string[] = [];
    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      text = typeof o.text === "string" ? o.text : typeof o.phrase === "string" ? o.phrase : "";
      modelSellable = o.sellable === true;
      if (typeof o.category === "string" && (PAIN_CATEGORIES as readonly string[]).includes(o.category)) {
        category = o.category as PainCategory;
      }
      if (Array.isArray(o.quotes)) {
        quotes = o.quotes.filter((q): q is string => typeof q === "string" && q.trim() !== "").slice(0, 5);
      }
    }
    text = text.trim();
    if (!text) continue;
    out.push({ text, sellable: isSellablePainText(text, modelSellable), ...(category ? { category } : {}), quotes });
  }
  return out;
}
```

- [ ] **Step 4: Write the verifier**

```ts
// src/lib/review-analysis/quote-verify.ts
/**
 * A pain phrase is evidence only when a guest actually wrote it. The
 * model returns verbatim fragments; this keeps the ones found in a real
 * review and counts how many distinct reviews carry one.
 */
import { normalizeForGrounding } from "./kpi-filter";
import type { PainPhrase } from "./pain-phrases";

const MIN_QUOTE_WORDS = 3;

export function verifyPainQuotes(phrases: PainPhrase[], reviewTexts: Array<string | null>): PainPhrase[] {
  const corpus = reviewTexts.map((t) => normalizeForGrounding(t ?? ""));
  return phrases.map((p) => {
    const reviews = new Set<number>();
    const kept: string[] = [];
    for (const quote of p.quotes ?? []) {
      const needle = normalizeForGrounding(quote);
      if (needle.split(" ").length < MIN_QUOTE_WORDS) continue;
      const at = corpus.findIndex((c) => c.includes(needle));
      if (at === -1 || reviews.has(at)) continue;
      reviews.add(at);
      kept.push(quote.trim());
    }
    return { ...p, quotes: kept, mentions: reviews.size };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/review-analysis/quote-verify.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 6: Ask the model for a category and verbatim quotes**

`src/lib/prompts/review-analysis-prompt.ts` içinde JSON örneğindeki `painPhrases` satırını (bugün 122) değiştir:

```
    { "text": "<short pain phrase, in the customer's own voice>", "sellable": <true|false>, "category": "<bill|reservation|delivery|menu|repeat|language|wait|other>", "quotes": ["<verbatim fragment copied from one review>"] }
```

`- painPhrases: 3-5 items. …` kuralının (bugün 142) hemen altına iki satır ekle:

```
- painPhrases.category: "bill" = waiting for / paying / splitting the bill or the card machine; "reservation" = booking, no-shows, deposits, a lost reservation; "delivery" = delivery or takeaway orders and delivery apps; "menu" = the menu itself is hard to read, out of date, missing allergens or only a PDF; "repeat" = regulars, coming back often; "language" = language barrier, tourists, translation; "wait" = waiting for a table or for food; "other" = everything else. A complaint that only mentions price or value is "other", never "bill".
- painPhrases.quotes: 1-5 fragments, each COPIED CHARACTER FOR CHARACTER from a different numbered review above, 4 to 25 words long. Do not fix typos, do not translate, do not merge two reviews. If no review says it in its own words, return an empty array.
```

`src/lib/gemini.ts` içinde `painPhrases` şemasındaki `properties` nesnesine iki alan ekle ve `required`'ı güncelle (aynı dosyadaki KPI `label` alanı `enum` kullanıyor; `category` için aynı yazımı kullan):

```ts
                text: { type: SchemaType.STRING },
                sellable: { type: SchemaType.BOOLEAN },
                category: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: ["bill", "reservation", "delivery", "menu", "repeat", "language", "wait", "other"],
                },
                quotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ["text", "sellable", "category", "quotes"],
```

- [ ] **Step 7: Verify quotes in the worker**

`src/lib/agent-workers/review-analyst.ts` başına:

```ts
import { verifyPainQuotes } from "@/lib/review-analysis/quote-verify";
```

`const painPhrases: PainPhrase[] = toPainPhrases(analysis.painPhrases);` satırını değiştir:

```ts
    // Quotes are checked against the stored review text; `mentions` is the
    // number of distinct reviews that carry one. A phrase with no verified
    // quote stays in the row for the UI but is not evidence (Room 1 drops it).
    const painPhrases: PainPhrase[] = verifyPainQuotes(
      toPainPhrases(analysis.painPhrases),
      lead.googleReviews.map((r) => r.text),
    );
```

Hemen altındaki `logger.info` çağrısının (bugün satır 575-581, `painPhrases: painPhrases.length` içeren) alanlarına ekle:

```ts
      verifiedPainPhrases: painPhrases.filter((p) => (p.mentions ?? 0) > 0).length,
```

- [ ] **Step 8: Run the analyst tests and commit**

Run: `npx vitest run src/__tests__/review-analysis src/__tests__/agent-workers/review-analyst.test.ts src/__tests__/agent-workers/review-analyst-corpus.test.ts && npx tsc --noEmit`
Expected: PASS. Bir test saklanan `painPhrases` satırını `{ text, sellable }` ile tam eşitlik (`toEqual`) olarak bekliyorsa `quotes: []` ve `mentions: 0` alanlarını beklentiye ekle.

```bash
git add src/lib/review-analysis src/lib/prompts/review-analysis-prompt.ts src/lib/gemini.ts src/lib/agent-workers/review-analyst.ts src/__tests__/review-analysis/quote-verify.test.ts
git commit -m "feat: review pain phrases carry a category, verbatim quotes checked against the corpus, and a mention count"
```

---

### Task 7: Oda 1 kanıtlı girdileri okur

**Files:**
- Create: `src/lib/ai-core/agent/room-one-audit.ts`
- Modify: `src/lib/ai-core/agent/head-agent.ts:113-117, 168-182, 184-301, 354-371, 471-493, 543-558, 577-600, 898-916`
- Modify: `src/lib/agent-workers/lead-intelligence-brief.ts:1351-1381, 1395-1424, 1447-1449, 1467`
- Modify: `scripts/analysis-baseline.ts` (Task 1)
- Test: `src/__tests__/ai-core/room-one-audit.test.ts`, `src/__tests__/ai-core/head-agent-room-one.test.ts`

**Interfaces:**
- Consumes: `MapFacts`, `parseMapFacts` (Task 4); `SiteFacts` (Task 5); `painPhrases[].category | quotes | mentions` (Task 6); `deliveryPlatformFor` (Task 4).
- Produces:
  - `buildRoomOneAudit(src: RoomOneAuditSource): RoomOneAudit | null`
  - `toRoomOneAudit(lead: HydratedLead, mapFacts?: MapFacts | null): RoomOneAudit | null`
  - `loadMapFacts(workspaceId: string, leadId: string): Promise<{ facts: MapFacts | null; skipped: boolean }>`
  - `openQuestionsFor(audit: RoomOneAudit, wedge: HeadAgentWedge, locationCount: number): string[]`
  - `HeadAgentDecision.openQuestions?: string[]`; `RoomOnePainPhrase.category | mentions | quote`
  - Yorum kanıtı biçimi: `yorum (3/80): "…"` (sayı biliniyorsa), yoksa `yorum: "…"`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/ai-core/room-one-audit.test.ts
import { describe, expect, it } from "vitest";
import { buildRoomOneAudit, type RoomOneAuditSource } from "@/lib/ai-core/agent/room-one-audit";

const NO_MAP = null;
function src(over: Partial<RoomOneAuditSource> = {}): RoomOneAuditSource {
  return {
    hasWebsite: true,
    websiteUrl: "https://padella.co",
    audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: {} },
    mapFacts: NO_MAP,
    venueType: null,
    ...over,
  };
}
const SITE = {
  pagesVisited: [],
  bookingChecked: true,
  menuPageSeen: true,
  orderPageSeen: false,
  bookingProvider: null,
  hasPrepayment: null,
  tastingMenu: null,
  languageCount: null,
  deliveryPlatforms: null,
  directOrdering: null,
  qrMenuTool: null,
  menuPdfUrl: null,
};
function withSite(site: Record<string, unknown>, features: Record<string, unknown> = {}) {
  return src({
    audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { ...features, siteFacts: { ...SITE, ...site } } },
  });
}

describe("buildRoomOneAudit", () => {
  it("reads an old audit without subpage facts as unknown, never as absent", () => {
    const a = buildRoomOneAudit(
      src({ audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { hasQrMenu: false, hasOnlineOrdering: false, hasDeliveryIntegration: true } } }),
    )!;
    expect(a.hasBookingSystem).toBeNull();
    expect(a.hasOnlineReservation).toBeNull();
    expect(a.hasQrMenu).toBeNull();
    expect(a.hasOnlineOrdering).toBeNull();
    expect(a.marketplaceOrdering).toBeNull(); // a raw substring is not evidence
  });

  it("says no booking only when the booking surface was checked", () => {
    expect(buildRoomOneAudit(withSite({ bookingChecked: true }))!.hasBookingSystem).toBe(false);
    expect(buildRoomOneAudit(withSite({ bookingChecked: false }))!.hasBookingSystem).toBeNull();
  });

  it("says no QR menu and no direct ordering only when the menu page was read", () => {
    const seen = buildRoomOneAudit(withSite({ menuPageSeen: true }, { hasQrMenu: false }))!;
    expect(seen.hasQrMenu).toBe(false);
    expect(seen.hasOnlineOrdering).toBe(false);
    const unseen = buildRoomOneAudit(withSite({ menuPageSeen: false }, { hasQrMenu: false }))!;
    expect(unseen.hasQrMenu).toBeNull();
    expect(unseen.hasOnlineOrdering).toBeNull();
  });

  it("fills the blind rule inputs from site facts", () => {
    const a = buildRoomOneAudit(
      withSite({
        hasPrepayment: { value: true, url: "https://padella.co/reservations", quote: "deposit of £10" },
        tastingMenu: { value: true, url: "https://padella.co/menu", quote: "7-course tasting menu" },
        languageCount: { value: 2, url: "https://padella.co", quote: "en, it" },
        deliveryPlatforms: { value: ["Deliveroo"], url: "https://padella.co", quote: null },
      }),
    )!;
    expect(a.hasPrepayment).toBe(true);
    expect(a.tastingMenu).toBe(true);
    expect(a.languageCount).toBe(2);
    expect(a.deliveryPlatforms).toEqual(["Deliveroo"]);
    expect(a.marketplaceOrdering).toBe(true);
  });

  it("takes the booking provider and marketplaces from Google when the site shows none", () => {
    const a = buildRoomOneAudit(
      withSite({ bookingChecked: false }, {}),
    )!;
    expect(a.bookingProvider).toBeNull();
    const withMap = buildRoomOneAudit({
      ...withSite({ bookingChecked: false }),
      mapFacts: {
        reservationLinks: [{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }],
        orderLinks: [{ name: "Uber Eats", url: "https://www.ubereats.com/store/x" }],
        deliveryPlatforms: ["Uber Eats"],
        menuUrl: "https://padella.co/menu",
        acceptsReservations: true,
        serviceOptions: [],
        price: null,
      },
    })!;
    expect(withMap.bookingProvider).toBe("OpenTable");
    expect(withMap.hasBookingSystem).toBe(true);
    expect(withMap.hasOnlineReservation).toBe(true);
    expect(withMap.deliveryPlatforms).toEqual(["Uber Eats"]);
    expect(withMap.menuUrl).toBe("https://padella.co/menu");
  });

  it("counts a non-marketplace Google order link as the venue's own ordering", () => {
    const a = buildRoomOneAudit({
      ...withSite({}),
      mapFacts: { reservationLinks: [], orderLinks: [{ name: "padella.co", url: "https://padella.co/order" }], deliveryPlatforms: [], menuUrl: null, acceptsReservations: null, serviceOptions: [], price: null },
    })!;
    expect(a.hasOnlineOrdering).toBe(true);
  });

  it("returns map-only facts for a lead with no site audit, and null with nothing at all", () => {
    expect(buildRoomOneAudit(src({ audit: null }))).toBeNull();
    expect(buildRoomOneAudit(src({ audit: null, hasWebsite: false }))).toMatchObject({ hasWebsite: false, websiteBroken: false });
  });
});
```

`src/__tests__/ai-core/head-agent-room-one.test.ts` içine yeni bir `describe` ekle (import satırına `openQuestionsFor` ekle):

```ts
describe("roomOne — verified review evidence", () => {
  const audit = { reachable: true };

  it("treats one unverified legacy phrase as a single medium signal", () => {
    const out = roomOne({ audit, reviews: { count: 80, painPhrases: [{ text: "waited ages for the bill" }] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
  });

  it("makes a strong bill signal from two reviews and prints the count with the real quote", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "slow to bring the bill", category: "bill", mentions: 3, quote: "we waited 25 minutes for the bill" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("bill_wait");
    expect(out.evidence[0]).toBe('yorum (3/80): "we waited 25 minutes for the bill"');
  });

  it("drops a phrase whose quotes were found in no review", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "slow to bring the bill", category: "bill", mentions: 0 }, { text: "bill took ages", category: "bill", mentions: 0 }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("follows the analyst category, not a keyword in the summary", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "not worth what you pay", category: "other", mentions: 4, quote: "not worth what you pay for the portion" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });
});

describe("openQuestionsFor", () => {
  it("asks only for the unknown inputs that matter to the chosen wedge", () => {
    expect(openQuestionsFor({ hasPrepayment: null }, "reservation", 1)).toEqual([
      "Rezervasyonda depozito veya kart garantisi alıyorlar mı?",
    ]);
    expect(openQuestionsFor({ tableCount: null, languageCount: null }, "bill_wait", 1)).toEqual([
      "Kaç masa var? (20 üstü Growth)",
      "Menü kaç dilde?",
    ]);
    expect(openQuestionsFor({ hasPrepayment: true, centralPurchasing: null }, "reservation", 3)).toEqual([
      "Satın alma kararı şubede mi, merkezde mi?",
    ]);
    expect(openQuestionsFor({}, "none", 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/ai-core/room-one-audit.test.ts src/__tests__/ai-core/head-agent-room-one.test.ts`
Expected: FAIL. `room-one-audit` modülü ve `openQuestionsFor` yok; "strong bill signal" testi eski biçim (`yorum: "…"`) yüzünden kalır.

- [ ] **Step 3: Write the pure audit mapper**

```ts
// src/lib/ai-core/agent/room-one-audit.ts
/**
 * Maps what the collectors saw onto Room 1's tri-state audit.
 * `false` is written only when the surface was actually read
 * (`siteFacts.bookingChecked`, `menuPageSeen`, `orderPageSeen`);
 * otherwise the field stays `null`.
 */
import { deliveryPlatformFor } from "@/lib/delivery-platforms";
import type { MapFacts } from "@/lib/agent-workers/apify/map-facts";
import type { SiteFacts } from "@/lib/site-facts";
import type { RoomOneAudit, VenueType } from "./head-agent";

export interface RoomOneAuditSource {
  hasWebsite: boolean | null;
  websiteUrl: string | null;
  audit: {
    reachable: boolean | null;
    url: string | null;
    hasBookingSystem: boolean | null;
    bookingProvider: string | null;
    rawFeaturesJson: unknown;
  } | null;
  mapFacts: MapFacts | null;
  venueType: VenueType | null;
}

function nonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function isPdf(url: string | null): boolean {
  return url !== null && /\.pdf(\?|#|$)/i.test(url);
}

export function buildRoomOneAudit(src: RoomOneAuditSource): RoomOneAudit | null {
  const map = src.mapFacts;
  const mapBooking = map?.reservationLinks[0] ?? null;
  const mapProvider = mapBooking ? (mapBooking.name ?? hostOf(mapBooking.url)) : null;
  const mapPlatforms = map?.deliveryPlatforms ?? [];
  const mapOwnOrdering = (map?.orderLinks ?? []).some((l) => deliveryPlatformFor(l.url) === null && !(l.name && deliveryPlatformFor(l.name)));

  const wa = src.audit;
  if (!wa) {
    const base: RoomOneAudit | null = src.hasWebsite === false ? { hasWebsite: false, websiteBroken: false } : null;
    if (!map) return base;
    return {
      ...(base ?? { hasWebsite: src.hasWebsite }),
      bookingProvider: mapProvider,
      hasBookingSystem: mapProvider ? true : null,
      hasOnlineReservation: mapProvider ? true : null,
      deliveryPlatforms: mapPlatforms.length > 0 ? mapPlatforms : null,
      marketplaceOrdering: mapPlatforms.length > 0 ? true : null,
      hasOnlineOrdering: mapOwnOrdering ? true : null,
      menuUrl: map.menuUrl,
      pdfMenu: map.menuUrl ? isPdf(map.menuUrl) : null,
      venueType: src.venueType,
    };
  }

  const f = (wa.rawFeaturesJson && typeof wa.rawFeaturesJson === "object" ? wa.rawFeaturesJson : {}) as Record<string, unknown>;
  const sf = (f.siteFacts && typeof f.siteFacts === "object" ? f.siteFacts : null) as SiteFacts | null;

  const provider =
    nonEmpty(wa.bookingProvider) ?? nonEmpty(f.bookingProvider) ?? sf?.bookingProvider?.value ?? mapProvider;
  const sawBooking = wa.hasBookingSystem === true || f.hasOnlineReservation === true || provider !== null;
  const bookingChecked = sf?.bookingChecked === true;

  const platforms = [...new Set([...(sf?.deliveryPlatforms?.value ?? []), ...mapPlatforms])];
  const ownOrdering = sf?.directOrdering != null || mapOwnOrdering;
  const orderingChecked = sf != null && (sf.menuPageSeen || sf.orderPageSeen);

  const detectedMenuTool = nonEmpty(f.detectedMenuTool) ?? sf?.qrMenuTool?.value ?? null;
  const menuUrl = nonEmpty(f.menuUrl) ?? sf?.menuPdfUrl ?? map?.menuUrl ?? null;
  const hasQr = f.hasQrMenu === true || sf?.qrMenuTool != null;

  return {
    reachable: wa.reachable,
    websiteUrl: src.websiteUrl ?? wa.url ?? null,
    hasWebsite: src.hasWebsite ?? true,
    websiteBroken: src.hasWebsite !== false && wa.reachable === false ? true : wa.reachable === true ? false : null,
    hasBookingSystem: sawBooking ? true : bookingChecked ? false : null,
    hasOnlineReservation: sawBooking ? true : bookingChecked ? false : null,
    bookingProvider: provider,
    hasPrepayment: sf?.hasPrepayment ? true : null,
    tableCount: finiteNumber(f.tableCount),
    hasQrMenu: hasQr ? true : sf?.menuPageSeen ? false : null,
    pdfMenu: menuUrl ? isPdf(menuUrl) && !detectedMenuTool : null,
    menuUrl,
    detectedMenuTool,
    hasOnlineOrdering: ownOrdering ? true : orderingChecked ? false : null,
    marketplaceOrdering: platforms.length > 0 ? true : null,
    deliveryPlatforms: platforms.length > 0 ? platforms : null,
    languageCount: sf?.languageCount?.value ?? finiteNumber(f.languageCount),
    tastingMenu: sf?.tastingMenu ? true : null,
    venueType: src.venueType,
  };
}
```

- [ ] **Step 4: Use the mapper in the brief worker and report skipped or stale sources**

`lead-intelligence-brief.ts` importlarına:

```ts
import { buildRoomOneAudit } from "@/lib/ai-core/agent/room-one-audit";
import { parseMapFacts, type MapFacts } from "@/lib/agent-workers/apify/map-facts";
```

`toRoomOneAudit` fonksiyonunun tamamını şununla değiştir (dışa açık ad aynı kalır):

```ts
export function toRoomOneAudit(lead: HydratedLead, mapFacts: MapFacts | null = null): RoomOneAudit | null {
  const wa = lead.websiteAudit;
  return buildRoomOneAudit({
    hasWebsite: lead.hasWebsite ?? null,
    websiteUrl: lead.websiteUrl ?? null,
    audit: wa
      ? {
          reachable: wa.reachable,
          url: wa.url,
          hasBookingSystem: triBool(wa.hasBookingSystem),
          bookingProvider: wa.bookingProvider,
          rawFeaturesJson: wa.rawFeaturesJson,
        }
      : null,
    mapFacts,
    venueType: deriveVenueType([lead.subNicheSlug, lead.nicheSlug, lead.primaryType], lead.priceLevel),
  });
}

/** 30 days: older than this the site may have changed under the audit. */
const AUDIT_STALE_MS = 30 * 24 * 60 * 60 * 1000;

/** Map facts from the lead's latest successful Google Maps run. */
export async function loadMapFacts(
  workspaceId: string,
  leadId: string,
): Promise<{ facts: MapFacts | null; skipped: boolean }> {
  const run = await prisma.agentRun.findFirst({
    where: { workspaceId, leadId, workerKind: "APIFY_GMAPS_DEEP", status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] } },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const out =
    run?.outputJson && typeof run.outputJson === "object" && !Array.isArray(run.outputJson)
      ? (run.outputJson as Record<string, unknown>)
      : null;
  if (!out) return { facts: null, skipped: false };
  if (out.skipped) return { facts: null, skipped: true };
  return { facts: parseMapFacts(out.mapFacts), skipped: false };
}
```

Artık kullanılmayan `nonEmpty` ve `finiteNumber` yardımcılarını bu dosyadan sil (tsc ya da eslint "unused" derse; başka kullanım varsa bırak).

`runRestaurantBrief` içinde `const reviewAnalysis = lead.reviewAnalysis` bloğundan önce:

```ts
  const map = await loadMapFacts(workspaceId, leadId);
  const skippedSources: string[] = [];
  // A quota-skipped map pull is a missing source, not a clean bill.
  if (map.skipped) skippedSources.push("map");
  const auditAt = lead.websiteAudit?.crawlAttemptedAt ?? null;
  if (auditAt && Date.now() - auditAt.getTime() > AUDIT_STALE_MS) skippedSources.push("website_stale");
```

`buildBriefDecision` çağrısında `audit: toRoomOneAudit(lead),` satırını değiştir ve bir alan ekle:

```ts
      audit: toRoomOneAudit(lead, map.facts),
      skippedSources,
```

Aynı fonksiyonda `sellablePains` tanımını değiştir (kanıt artık gerçek alıntıyı taşıyor):

```ts
  const sellablePains = normalizePainPhrases(lead.reviewAnalysis?.painPhrases)
    .filter((p) => p.sellable !== false && p.mentions !== 0)
    .map((p) => p.quote ?? p.text);
```

ve `evidence:` satırındaki `note.startsWith("yorum:")` ifadesini `note.startsWith("yorum")` yap.

- [ ] **Step 5: Teach Room 1 categories, counts and open questions**

`head-agent.ts` içinde `RoomOnePainPhrase` arayüzünü değiştir:

```ts
export interface RoomOnePainPhrase {
  text: string;
  /** Missing = true (backwards compat with pre-`sellable` analyst rows). */
  sellable?: boolean;
  /** Analyst category. Missing on rows written before the category existed. */
  category?: string | null;
  /** Distinct reviews with a verified quote. Missing on older rows; 0 = not evidence. */
  mentions?: number | null;
  /** First verified verbatim quote. */
  quote?: string | null;
}
```

`reviewRef` ve `usablePhrases` fonksiyonlarını değiştir; `isAbout` ekle:

```ts
function reviewRef(p: RoomOnePainPhrase, corpus: number | null): string {
  const body = (p.quote ?? p.text).trim();
  return typeof p.mentions === "number" && corpus ? `yorum (${p.mentions}/${corpus}): "${body}"` : `yorum: "${body}"`;
}

/** Category when the analyst gave one; keyword match only for older rows. */
function isAbout(p: RoomOnePainPhrase, key: keyof typeof PHRASE): boolean {
  return p.category ? p.category === key : PHRASE[key].test(p.text);
}

/** Two verified reviews make a review signal strong; one, or an unverified row, is medium. */
function reviewStrength(p: RoomOnePainPhrase): Strength {
  return typeof p.mentions === "number" && p.mentions >= 2 ? "strong" : "medium";
}

function usablePhrases(reviews: RoomOneInput["reviews"]): RoomOnePainPhrase[] {
  const count = reviews?.count;
  if (typeof count === "number" && count < REVIEW_CORPUS_MIN) return [];
  return (reviews?.painPhrases ?? []).filter(
    (p) => p && typeof p.text === "string" && p.text.trim() && p.sellable !== false && p.mentions !== 0,
  );
}
```

`collectSignals` imzasını ve yorum döngülerini değiştir:

```ts
function collectSignals(
  audit: RoomOneAudit,
  phrases: RoomOnePainPhrase[],
  locationCount: number,
  corpus: number | null,
): WedgeSignal[] {
```

İçindeki altı yorum döngüsünü sırasıyla şu satırlarla değiştir:

```ts
    for (const p of phrases) {
      if (isAbout(p, "reservation")) out.push({ wedge: "reservation", strength: "medium", evidence: reviewRef(p, corpus) });
    }
```

```ts
  for (const p of phrases) {
    if (isAbout(p, "bill")) out.push({ wedge: "bill_wait", strength: reviewStrength(p), evidence: reviewRef(p, corpus) });
  }
```

```ts
  for (const p of phrases) {
    if (isAbout(p, "delivery")) out.push({ wedge: "marketplace", strength: "medium", evidence: reviewRef(p, corpus) });
  }
```

```ts
    for (const p of phrases) {
      if (isAbout(p, "menu")) out.push({ wedge: "menu_surface", strength: "medium", evidence: reviewRef(p, corpus) });
    }
```

```ts
  for (const p of phrases) {
    if (isAbout(p, "repeat")) out.push({ wedge: "guest_repeat", strength: "medium", evidence: reviewRef(p, corpus) });
  }
```

`planFor` imzasında `phrases: string[]` → `phrases: RoomOnePainPhrase[]`, içindeki `phrases.some((p) => PHRASE.language.test(p))` → `phrases.some((p) => isAbout(p, "language"))`.

`evaluateRoomOne` içinde `collectSignals` çağrısını değiştir:

```ts
  const corpus = typeof input.reviews?.count === "number" ? input.reviews.count : null;
  const signals = collectSignals(audit, phrases, locationCount, corpus);
```

`toFnbSignals` içinde `const language = …` satırını değiştir:

```ts
  const language = phrases.some((p) => p.sellable !== false && p.mentions !== 0 && isAbout(p, "language"));
```

`normalizePainPhrases` içinde nesne dalının sonundaki `out.push(…)` satırını değiştir:

```ts
    const quotes = Array.isArray(o.quotes) ? o.quotes.filter((q): q is string => typeof q === "string" && q.trim() !== "") : [];
    out.push({
      text: text.trim(),
      ...(typeof o.sellable === "boolean" ? { sellable: o.sellable } : {}),
      ...(typeof o.category === "string" ? { category: o.category } : {}),
      ...(typeof o.mentions === "number" ? { mentions: o.mentions } : {}),
      ...(quotes[0] ? { quote: quotes[0].trim() } : {}),
    });
```

`packageFitScore` fonksiyonundan önce ekle:

```ts
/**
 * Rule inputs nobody could see, phrased for the first minute of the
 * call. Only the ones that would change this card's package or stop it.
 */
export function openQuestionsFor(audit: RoomOneAudit, wedge: HeadAgentWedge, locationCount: number): string[] {
  if (wedge === "none") return [];
  const q: string[] = [];
  if (wedge === "reservation" && audit.hasPrepayment == null) {
    q.push("Rezervasyonda depozito veya kart garantisi alıyorlar mı?");
  }
  if (wedge === "bill_wait" && audit.tableCount == null) q.push("Kaç masa var? (20 üstü Growth)");
  if ((wedge === "bill_wait" || wedge === "menu_surface") && audit.languageCount == null) q.push("Menü kaç dilde?");
  if (locationCount >= 2 && audit.centralPurchasing == null) q.push("Satın alma kararı şubede mi, merkezde mi?");
  return q;
}
```

`HeadAgentDecision` arayüzüne `sourceConflicts` alanından sonra:

```ts
  /** Unknown rule inputs the rep should ask about. */
  openQuestions?: string[];
```

`buildBriefDecision` içindeki `const decision: HeadAgentDecision = {` nesnesine `sourceConflicts: [],` satırından sonra:

```ts
    openQuestions: openQuestionsFor(audit, r1.wedge, input.locationCount ?? 1),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/ai-core src/__tests__/agent-workers src/__tests__/control && npx tsc --noEmit`
Expected: yeni testler PASS. Eski testlerde iki tür beklenti değişir; ikisi de bu görevin amacıdır:

1. Tek bir eski biçim yorum cümlesiyle (`{ text }` ya da çıplak string) `bill_wait` bekleyen test: fixture'a doğrulanmış biçimi ver. Örnek dönüşüm:

```ts
// önce
painPhrases: [{ text: "waited 40 minutes for the bill" }]
// sonra
painPhrases: [{ text: "waited 40 minutes for the bill", category: "bill", mentions: 2, quote: "waited 40 minutes for the bill" }]
```

ve kanıt beklentisini `yorum (2/<count>): "waited 40 minutes for the bill"` yap.

2. `rawFeaturesJson`'da `siteFacts` olmadan `hasBookingSystem: false`, `hasQrMenu: false` ya da `hasOnlineOrdering: false` üzerinden sinyal bekleyen test: fixture'a `siteFacts: { bookingChecked: true, menuPageSeen: true, orderPageSeen: false, pagesVisited: [], bookingProvider: null, hasPrepayment: null, tastingMenu: null, languageCount: null, deliveryPlatforms: null, directOrdering: null, qrMenuTool: null, menuPdfUrl: null }` ekle.

- [ ] **Step 7: Let the baseline script see map facts**

`scripts/analysis-baseline.ts` içinde importu genişlet ve çağrıyı değiştir:

```ts
import { loadMapFacts, toRoomOneAudit } from "@/lib/agent-workers/lead-intelligence-brief";
```

```ts
    const map = await loadMapFacts(workspaceId, lead.id);
```

```ts
        roomOneAudit: toRoomOneAudit(lead as never, map.facts) as Record<string, unknown> | null,
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai-core/agent/room-one-audit.ts src/lib/ai-core/agent/head-agent.ts src/lib/agent-workers/lead-intelligence-brief.ts scripts/analysis-baseline.ts src/__tests__
git commit -m "feat: Room 1 reads map and subpage facts, counted review quotes, and lists the open questions"
```

---

### Task 8: Oda 3 cümleyi gösterdiği kanıtla karşılaştırır

**Files:**
- Modify: `src/lib/ai-core/agent/head-agent.ts` (`roomThreeQa` ve çağrısı)
- Test: `src/__tests__/ai-core/head-agent-grounding.test.ts`

**Interfaces:**
- Produces: `unsupportedTokens(sentence: string, evidenceText: string): string[]`; Oda 3 hata kodu `unsupported_fact:<token>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/ai-core/head-agent-grounding.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-core/agent/claude", () => ({
  callClaudeJson: vi.fn(),
  runClaudeToolLoop: vi.fn(),
  parseClaudeJson: vi.fn(),
  getHeadAgentModel: () => "mock",
  isAnthropicConfigured: () => false,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { unsupportedTokens } from "@/lib/ai-core/agent/head-agent";

describe("unsupportedTokens", () => {
  const evidence = 'yorum (3/80): "we waited 25 minutes for the bill" https://x — rezervasyon TheFork üzerinden, depozito görünmüyor';

  it("accepts numbers and names that are in the cited evidence", () => {
    expect(unsupportedTokens("3 of your 80 recent reviews mention a 25 minute wait for the bill (E1).", evidence)).toEqual([]);
    expect(unsupportedTokens("Bookings go through TheFork with no deposit.", evidence)).toEqual([]);
  });

  it("flags a number the evidence does not carry", () => {
    expect(unsupportedTokens("Guests wait 40 minutes for the bill.", evidence)).toEqual(["40"]);
  });

  it("flags a provider or platform the evidence does not name", () => {
    expect(unsupportedTokens("You pay OpenTable per cover and Deliveroo a commission.", evidence)).toEqual(["OpenTable", "Deliveroo"]);
  });

  it("allows the package limits Room 2 was told about", () => {
    expect(unsupportedTokens("Growth covers 250 reservations with prepayment across 50 tables.", evidence)).toEqual([]);
  });

  it("does not read evidence ids as numbers", () => {
    expect(unsupportedTokens("The menu is a PDF (E2, E3).", "site — menü PDF")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ai-core/head-agent-grounding.test.ts`
Expected: FAIL, `unsupportedTokens` dışa açık değil.

- [ ] **Step 3: Write the check and wire it into Room 3**

`head-agent.ts` içinde `roomThreeQa` fonksiyonundan önce:

```ts
/** Plan limits from SYSTEM_PROMPT; Room 2 may state these without review evidence. */
const PLAN_NUMBERS = new Set(["10", "20", "50", "250"]);

const NAMED_ENTITY =
  /\b(?:the ?fork|open ?table|quandoo|resy|designmynight|sevenrooms|resdiary|tock|deliveroo|uber ?eats|just ?eat|doordash|wolt|yemeksepeti|getir)\b/gi;

/**
 * Numbers and provider / platform names in a sentence that its cited
 * evidence does not contain. Room 2 can read raw reviews and the audit
 * through tools; a fact it found there but did not cite is not on the card.
 */
export function unsupportedTokens(sentence: string, evidenceText: string): string[] {
  const hay = evidenceText.toLowerCase();
  const squashed = hay.replace(/\s+/g, "");
  const text = sentence.replace(/\bE\d+\b/g, " ");
  const out: string[] = [];
  for (const n of text.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!PLAN_NUMBERS.has(n) && !hay.includes(n)) out.push(n);
  }
  for (const name of text.match(NAMED_ENTITY) ?? []) {
    if (!squashed.includes(name.toLowerCase().replace(/\s+/g, ""))) out.push(name);
  }
  return [...new Set(out)];
}
```

`roomThreeQa` argüman tipine bir alan ekle:

```ts
  /** Facts given to Room 2 outside the evidence list (rating, review count). */
  allowedFacts: string[];
```

`sentence_without_evidence` satırından hemen sonra:

```ts
  for (const s of sentences) {
    const cited = s.evidence.map((id) => evidenceIds.get(id) ?? "").join(" ");
    const bad = unsupportedTokens(s.text, `${cited} ${args.allowedFacts.join(" ")}`);
    if (bad.length > 0) {
      issues.push(`unsupported_fact:${bad[0]}`);
      break;
    }
  }
```

`buildBriefDecision` içindeki çağrıyı değiştir:

```ts
  const qa = roomThreeQa({
    raw,
    ev,
    evidenceIds,
    shortlist,
    approvedClaimTexts,
    allowedFacts: [input.rating, input.reviewCount].filter((v) => v != null).map(String),
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/ai-core && npx tsc --noEmit`
Expected: PASS. Oda 3'ü doğrudan çağıran bir test varsa çağrıya `allowedFacts: []` ekle.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-core/agent/head-agent.ts src/__tests__/ai-core/head-agent-grounding.test.ts
git commit -m "feat: Room 3 fails a sentence whose numbers or provider names are not in the evidence it cites"
```

---

### Task 9: Sonra ölçümü ve kabul

**Files:**
- Create: `docs/decisions/2026-10-02-analiz-tabani-sonra.md` (betik çıktısı + karşılaştırma)

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: üçü de temiz.

- [ ] **Step 2: Provision the new HubSpot properties**

Worker ve uygulamayı bu commit'le yeniden başlat. FineDine Beta workspace'i için `POST /api/integrations/hubspot/provision` çağır (ya da Ayarlar → Entegrasyonlar → Reconnect).

Run: `npx tsx scripts/hubspot-verify.ts --portal <portalId>`
Expected: contacts ve companies için `14/14 defined`.

- [ ] **Step 3: Re-run the same leads**

Task 1'deki 30 lead için analizi yeniden çalıştır (Harita, Site, Yorum, Karar dördü de; lead sayfasındaki "analizi yeniden çalıştır" ya da `lead_created` zincirini tetikleyen mevcut yol). Zincir bittiğinde:

```bash
npx tsx scripts/analysis-baseline.ts <workspaceId> --limit 30 > docs/decisions/2026-10-02-analiz-tabani-sonra.md
```

- [ ] **Step 4: Compare against the acceptance table**

| Ölçüt | Önce (beklenen) | Kabul |
|---|---|---|
| Atlanan brief yine de yazıyor | > 0 ya da bayrak kapalı | 0 |
| Bayat sonraki-adım cümlesi HubSpot'ta | eski lead'lerde > 0 | head agent brief'i olan lead'lerde etkisiz (alan yalnızca `talkTrack`) |
| `revint_do_not_pitch`, `revint_open_questions`, `revint_analyzed_at` dolu | %0 | head agent brief'i olan her lead'de |
| `deliveryPlatforms` bilinen | %0 | > %0 ve her değerin kaynağı link (site ya da Google) |
| `hasPrepayment`, `tastingMenu`, `languageCount` bilinen | %0 | > %0; her biri `siteFacts` içinde URL ve alıntıyla |
| `tableCount`, `centralPurchasing` bilinen | %0 | %0 kalır; ilgili kartlarda soru olarak görünür |
| Karttaki yorum alıntısı gerçek yorumda | ölçülecek | %100 (`verified = total`) |
| "Arama yok" oranı | ölçülecek | yükselmesi beklenir; yükselişin nedeni `siteFacts` olmayan eski denetimse yeniden tarama sonrası düşer |
| Oda 2 `qa_failed` oranı | ölçülecek | `unsupported_fact` kaynaklı düşüşler elle 10 örnek okunur; haklıysa kalır |

Beş lead'i elle aç: HubSpot Company kaydındaki açı, konuşma, satma listesi ve sorular ile Revint'teki kart aynı kararı söylemeli; App Card'da ikinci bir açı görünmemeli.

- [ ] **Step 5: Commit the measurement**

```bash
git add docs/decisions/2026-10-02-analiz-tabani-sonra.md
git commit -m "docs: before/after baseline for the analysis accuracy plan"
```

---

## Bu planın dışında

- Öğrenme döngüsü (SDR düzeltmeleri, sonuç verisi), yargıç modeli, eval panelindeki koşu kimliği ve çoklu deneme.
- `tableCount` ve `centralPurchasing` için otomatik kaynak. Kamuya açık güvenilir bir kaynak yok; bu planda SDR sorusu olarak karta gider.
- `hubspot-app` kart arayüzünde "Sorular" bölümü. Alan yanıtta (`decision.openQuestions`) ve HubSpot property'sinde hazır; arayüz ayrı iş.
- Sahibi yanıtlarının saklanması (`GoogleReview` şema değişikliği gerektirir).
- Places API Atmosphere alanları: aynı bilgiler Apify yükünde var; ek maliyet ve saklama kısıtı getirmeden kullanılıyor.
- Açılış yazarının (`OPENER_WRITER`) karta bağlanması; zincirde değil, tıklayınca çalışıyor.
- Model yükseltmesi (`claude-sonnet-4-5` → daha yeni): ayrı bir karşılaştırma koşusuyla.
