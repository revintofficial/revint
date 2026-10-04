/**
 * Revint AI — HubSpot Orta Alan Sekmesi
 *
 * Extension noktası: crm.record.tab
 * Sekme adı: "⭐ Revint AI"
 *
 * Bölümler (yukarıdan aşağı):
 *   0. Önerilen Paket     — RecommendedPackageHero (başlık + skor + paket kartı)
 *   0.5 Head Agent        — Açılış açısı + fit modüller (Claude synthesis)
 *   1. Kayıt Özellikleri  — 10 revint_* metriği (property grid)
 *   2. Müşteri Sesi       — Sentiment barları + top KPIs + tırnaklı sözler
 *   3. Website Raporu     — Tech sinyalleri + performans özeti
 *
 * Mock alanlar (revint_tier, revint_trust, revint_maturity,
 *               revint_gaps, revint_enterprise_signal) mevcut API
 * sinyallerinden türetilmektedir; gerçek scoring servisi entegre
 * edildiğinde bu türetmeler kaldırılacak.
 */
import React, { useEffect, useState } from "react";
import {
  hubspot,
  Flex,
  Box,
  Text,
  Heading,
  Divider,
  Tag,
  Link,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  ProgressBar,
  Tile,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Statistics,
  StatisticsItem,
  Button,
} from "@hubspot/ui-extensions";
import { REVINT_BASE_URL } from "./config";
import { strings as t, numberFormat, timeFormat, voiceSummary } from "./locale";

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

interface CardSignals {
  salesConfidence: number | null;
  icpFitScore: number | null;
  qualificationRisk: "low" | "medium" | "high" | null;
  qualificationRiskReason: string | null;
  subNicheSlug: string | null;
  subNicheLabel: string | null;
  stageLabel: string | null;
  temperature: "HOT" | "WARM" | "COLD" | null;
}

interface CardTiming {
  hoursSinceInbound: number | null;
  lastSyncedAt: string | null;
}

interface CardSentiment {
  positive: number | null;
  neutral: number | null;
  negative: number | null;
}

interface CardReviews {
  sentiment: CardSentiment;
  painPhrases: string[];
  praisePhrases: string[];
  topComplaints: Array<{ label: string; percent: number | null }>;
  topPraise: Array<{ label: string; percent: number | null }>;
  leadScore: number | null;
  rating: number | null;
  totalReviews: number | null;
  fullAnalysisUrl: string | null;
}

interface CardTechSignal {
  label: string;
  present: boolean;
  detail: string;
  priority: "critical" | "important" | "nice_to_have";
}

interface CardGlance {
  chips: string[];
}

interface CardPackage {
  name: string;
  priceLabel: string;
  reason: string | null;
  features: string[];
}

interface CardHeadAgentModule {
  module: string;
  label: string;
  readiness: number | null;
  why: string | null;
}

interface CardHeadAgent {
  primaryAngle: string | null;
  talkTrack: string | null;
  reasoning: string | null;
  confidence: number | null;
  recommendedModules: CardHeadAgentModule[];
  excludedModules: Array<{ module: string; why: string | null }>;
}

interface CardFit {
  opportunityScore: number | null;
}

interface CardPitch {
  headline: string | null;
  sentence: string | null;
}

interface CardDataResponse {
  found: boolean;
  reason?: string;
  lead?: { id: string; businessName: string | null };
  actionSheetUrl?: string;
  signals?: CardSignals;
  timing?: CardTiming;
  reviews?: CardReviews | null;
  techSignals?: CardTechSignal[] | null;
  glance?: CardGlance;
  location?: string | null;
  branchCount?: number | null;
  accountTier?: string | null;
  package?: CardPackage | null;
  headAgent?: CardHeadAgent | null;
  fit?: CardFit | null;
  pitch?: CardPitch | null;
}

// ---------------------------------------------------------------------------
// Türetme yardımcıları (mock)
// ---------------------------------------------------------------------------

function deriveTier(
  score: number | null,
): { label: string; variant: "danger" | "warning" | "success" | "default" } {
  if (score == null) return { label: t.tierUnknown, variant: "default" };
  if (score <= 25) return { label: t.tierSuspect, variant: "danger" };
  if (score <= 50) return { label: t.tierDeveloping, variant: "warning" };
  if (score <= 75) return { label: t.tierTargetCandidate, variant: "success" };
  return { label: t.tierTarget, variant: "success" };
}

function deriveTrustLabel(
  risk: "low" | "medium" | "high" | null,
): { label: string; variant: "success" | "warning" | "danger" | "default" } {
  if (risk === "low") return { label: t.trustHigh, variant: "success" };
  if (risk === "medium") return { label: t.trustMedium, variant: "warning" };
  if (risk === "high") return { label: t.trustLow, variant: "danger" };
  return { label: t.trustUnknown, variant: "default" };
}

// revint_maturity: kritik tech sinyallerinin kaç tanesi mevcut / toplam
function deriveMaturity(techSignals: CardTechSignal[] | null): string {
  if (!techSignals || techSignals.length === 0) return "-";
  const present = techSignals.filter((s) => s.present).length;
  const total = techSignals.length;
  const ratio = total > 0 ? present / total : 0;
  const level =
    ratio <= 0.33
      ? t.maturityLow
      : ratio <= 0.66
        ? t.maturityMedium
        : t.maturityHigh;
  return `${level} (${present}/${total})`;
}

// revint_gaps: eksik kritik alanların kısa listesi
function deriveGaps(
  techSignals: CardTechSignal[] | null,
  glanceChips: string[],
): string {
  const criticalMissing = (techSignals ?? [])
    .filter((s) => !s.present && s.priority === "critical")
    .map((s) => s.label);

  // Chip anlamsal filtresi — hem EN hem TR öneklerini kabul eder (locale
  // değişikliğinde ekstra bakım gerekmesin diye).
  const chipGaps = glanceChips.filter((c) => {
    const lower = c.toLowerCase();
    return (
      lower.startsWith("no ") ||
      lower.includes("missing") ||
      lower.includes("slow") ||
      lower.includes("eksik") ||
      lower.includes("yavaş")
    );
  });

  const all = [...new Set([...criticalMissing, ...chipGaps])];
  if (all.length === 0) return "-";
  return all.slice(0, 3).join(", ");
}

// revint_enterprise_signal: çoklu lokasyon varsa Yes
function deriveEnterpriseSignal(
  branchCount: number | null,
  accountTier: string | null,
): string {
  if (branchCount != null && branchCount > 1) return t.enterpriseYes;
  if (accountTier === "TIER_1" || accountTier === "TIER_2") return t.enterpriseYes;
  return t.enterpriseNo;
}

// Göreli zaman — locale.timeFormat.inboundAge delegate.
function formatAnalyzedAt(hoursSinceInbound: number | null): string {
  return timeFormat.inboundAge(hoursSinceInbound);
}

// Segment artık server-side çevriliyor (route.ts → signals.subNicheLabel).
// Sadece defensive fallback: eski payload için slug'ı serbest biçimde göster.
function formatSegment(subNicheLabel: string | null, slug: string | null): string {
  if (subNicheLabel) return subNicheLabel;
  if (!slug) return t.segmentUnknown;
  return slug.replace(/^fnb-/, "F&B · ").replace(/-/g, " / ");
}

// tech signal'ın önceliğine göre tag rengi
function techSignalVariant(
  s: CardTechSignal,
): "success" | "danger" | "warning" | "default" {
  if (s.present) return "success";
  if (s.priority === "critical") return "danger";
  if (s.priority === "important") return "warning";
  return "default";
}

// ---------------------------------------------------------------------------
// Bileşen
// ---------------------------------------------------------------------------

interface ExtensionContext {
  portal?: { id: number | string };
  crm: {
    objectId: number | string;
    objectTypeId?: string;
    objectType?: string;
  };
}

interface FetchFn {
  (
    url: string,
    init?: {
      method?: string;
      body?: Record<string, unknown>;
      timeout?: number;
    },
  ): Promise<{ status: number; body: CardDataResponse }>;
}

interface CardActions {
  openIframeModal?: (payload: {
    uri: string;
    title?: string;
    width?: number;
    height?: number;
  }) => void;
}

// Header satırı için sıcaklık rozetinin renk varyantı.
function temperatureVariant(
  t: "HOT" | "WARM" | "COLD" | null,
): "error" | "warning" | "info" | "default" {
  if (t === "HOT") return "error";
  if (t === "WARM") return "warning";
  if (t === "COLD") return "info";
  return "default";
}

// deriveTier / deriveTrustLabel "danger" döndürüyor — @hubspot/ui-extensions
// v0.14.2 Tag.variant "error" bekliyor. Mevcut fonksiyonları değiştirmemek
// için hero bloğu bu normalize'ı kullanır (kartın kalan bölümlerine
// dokunmuyoruz; onlar ayrı bir temizlik turunda ele alınacak).
function normalizeTagVariant(
  v: "success" | "warning" | "danger" | "default",
): "success" | "warning" | "error" | "default" {
  return v === "danger" ? "error" : v;
}

// priceLabel zaten "annual / billed annually / yıllık / /ay" gibi bir
// faturalandırma ifadesi taşıyorsa alt yazıyı bastırıyoruz — aksi halde
// SDR aynı bilgiyi iki kere okur.
const PRICE_CARRIES_BILLING_RE =
  /(annual|billed|yıllık|yillik|per\s*year|\/\s*yr|\/\s*ay|\/\s*mo|per\s*month)/i;

// ---------------------------------------------------------------------------
// Recommended Package Hero — kartın en üstündeki karar bloğu
// ---------------------------------------------------------------------------

function RecommendedPackageHero({
  businessName,
  temperature,
  hoursSinceInbound,
  salesConfidence,
  qualificationRisk,
  headAgentConfidence,
  opportunityScore,
  pkg,
  excludedModules,
}: {
  businessName: string | null;
  temperature: "HOT" | "WARM" | "COLD" | null;
  hoursSinceInbound: number | null;
  salesConfidence: number | null;
  qualificationRisk: "low" | "medium" | "high" | null;
  headAgentConfidence: number | null;
  opportunityScore: number | null;
  pkg: CardPackage | null;
  excludedModules: Array<{ module: string; why: string | null }>;
}) {
  const tier = deriveTier(salesConfidence);
  const trust = deriveTrustLabel(qualificationRisk);
  const priceLabel = pkg?.priceLabel ?? "—";
  const showBillingSubtitle =
    !!pkg?.priceLabel && !PRICE_CARRIES_BILLING_RE.test(pkg.priceLabel);

  return (
    <Flex direction="column" gap="md">
      {/* Başlık satırı: Revint AI + şirket · sağda HOT + gelişten beri */}
      <Flex
        direction="row"
        justify="between"
        align="center"
        wrap="wrap"
        gap="sm"
      >
        <Flex direction="row" gap="sm" align="center" wrap="wrap">
          <Heading>Revint AI</Heading>
          {businessName && (
            <Text variant="microcopy" inline>
              {businessName}
            </Text>
          )}
        </Flex>
        <Flex direction="row" gap="xs" align="center" wrap="wrap">
          {temperature && (
            <Tag variant={temperatureVariant(temperature)}>{temperature}</Tag>
          )}
          <Text variant="microcopy" inline>
            {t.inboundAge}: {timeFormat.inboundAge(hoursSinceInbound)}
          </Text>
        </Flex>
      </Flex>

      {/* Önerilen Paket bloğu */}
      <Tile>
        <Flex direction="column" gap="md">
          {/* Blok başlığı + Skor */}
          <Flex
            direction="row"
            justify="between"
            align="center"
            wrap="wrap"
            gap="sm"
          >
            <Text
              variant="microcopy"
              format={{ fontWeight: "demibold", textTransform: "uppercase" }}
            >
              {t.recommendedPackage}
            </Text>
            {salesConfidence != null && (
              <Tag variant={normalizeTagVariant(tier.variant)}>
                {t.score} {salesConfidence} · {tier.label}
              </Tag>
            )}
          </Flex>

          {/* İki sütun: sol paket · sağ güven */}
          <Flex direction="row" gap="md" wrap="wrap">
            {/* Sol: paket adı + fiyat */}
            <Tile compact>
              <Flex direction="column" gap="sm">
                <Tag variant="success" inline>
                  ★ {pkg?.name ?? "—"}
                </Tag>
                <Statistics>
                  <StatisticsItem label="" number={priceLabel}>
                    {showBillingSubtitle && (
                      <Text variant="microcopy">
                        {t.annualBillingSubtitle}
                      </Text>
                    )}
                  </StatisticsItem>
                </Statistics>
              </Flex>
            </Tile>

            {/* Sağ: veri güveni · head agent güveni · fırsat puanı */}
            <Tile compact>
              <Flex direction="column" gap="sm">
                <Flex direction="row" justify="between" align="center">
                  <Text variant="microcopy">{t.dataConfidence}</Text>
                  <Tag variant={normalizeTagVariant(trust.variant)}>
                    {trust.label}
                  </Tag>
                </Flex>
                <Flex direction="row" justify="between" align="center">
                  <Text variant="microcopy">{t.headAgentConfidence}</Text>
                  <Text format={{ fontWeight: "demibold" }} inline>
                    {headAgentConfidence != null
                      ? `${headAgentConfidence}%`
                      : "—"}
                  </Text>
                </Flex>
                <Flex direction="row" justify="between" align="center">
                  <Text variant="microcopy">{t.opportunityScore}</Text>
                  <Text format={{ fontWeight: "demibold" }} inline>
                    {opportunityScore != null
                      ? `${opportunityScore}/100`
                      : "—"}
                  </Text>
                </Flex>
              </Flex>
            </Tile>
          </Flex>

          {/* Why this package? */}
          <Box>
            <Text format={{ fontWeight: "demibold" }}>{t.whyThisPackage}</Text>
            <Text variant="microcopy">{pkg?.reason ?? "—"}</Text>
          </Box>

          {/* What's included */}
          <Box>
            <Text format={{ fontWeight: "demibold" }}>{t.whatsIncluded}</Text>
            {pkg && pkg.features.length > 0 ? (
              <Flex direction="row" gap="xs" wrap="wrap">
                {pkg.features.map((f, i) => (
                  <Tag key={i} variant="default">
                    {f}
                  </Tag>
                ))}
              </Flex>
            ) : (
              <Text variant="microcopy">—</Text>
            )}
          </Box>

          <Divider distance="xs" />

          {/* Don't pitch — one row per module */}
          <Box>
            <Text format={{ fontWeight: "demibold" }}>{t.dontPitch}</Text>
            {excludedModules.length > 0 ? (
              excludedModules.map((m, i) => (
                <Text key={i} variant="microcopy">
                  × {m.module}
                  {m.why ? ` — ${m.why}` : ""}
                </Text>
              ))
            ) : (
              <Text variant="microcopy">—</Text>
            )}
          </Box>
        </Flex>
      </Tile>
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Head Agent Block — Claude'un ürettiği açılış açısı + gerekçe + modül fit
// ---------------------------------------------------------------------------
//
// Kartın hero'sundan sonra ikinci ana blok. SDR'a "bu lead'i hangi
// argümanla açacağım, neden bu argüman, hangi modüller hazır?" sorusunu
// tek bakışta yanıtlar. Güven % + Önerilmeyen bilerek burada tekrar YOK
// (paket bloğunda gösteriliyor).

function HeadAgentBlock({
  primaryAngle,
  talkTrack,
  reasoning,
  recommendedModules,
}: {
  primaryAngle: string | null;
  talkTrack: string | null;
  reasoning: string | null;
  recommendedModules: CardHeadAgentModule[];
}) {
  return (
    <Tile>
      <Flex direction="column" gap="md">
        {/* Blok başlığı */}
        <Text
          variant="microcopy"
          format={{ fontWeight: "demibold", textTransform: "uppercase" }}
        >
          {t.headAgent}
        </Text>

        {/* Primary angle heading */}
        {primaryAngle ? (
          <Heading>{primaryAngle}</Heading>
        ) : (
          <Text variant="microcopy">—</Text>
        )}

        {/* Opening angle: talkTrack (main body copy) */}
        <Box>
          <Text format={{ fontWeight: "demibold" }}>{t.openingAngle}</Text>
          {talkTrack ? (
            <Text>{`"${talkTrack}"`}</Text>
          ) : (
            <Text variant="microcopy">—</Text>
          )}
        </Box>

        {/* Reasoning */}
        <Box>
          <Text format={{ fontWeight: "demibold" }}>{t.reasoning}</Text>
          <Text variant="microcopy">{reasoning ?? "—"}</Text>
        </Box>

        {/* Pitch these */}
        <Box>
          <Text format={{ fontWeight: "demibold" }}>{t.pitchThese}</Text>
          {recommendedModules.length > 0 ? (
            <Flex direction="column" gap="sm">
              {recommendedModules.map((m) => (
                <Box key={m.module}>
                  <Flex direction="row" justify="between" align="center">
                    <Text format={{ fontWeight: "demibold" }} inline>
                      {m.label}
                    </Text>
                    <Text variant="microcopy" inline>
                      {m.readiness ?? "—"}
                    </Text>
                  </Flex>
                  <ProgressBar value={m.readiness ?? 0} variant="success" />
                  {m.why && <Text variant="microcopy">{m.why}</Text>}
                </Box>
              ))}
            </Flex>
          ) : (
            <Text variant="microcopy">—</Text>
          )}
        </Box>
      </Flex>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Customer Voice Block — yorum sesi (sentiment + KPI + kendi sözleri)
// ---------------------------------------------------------------------------
//
// Kartta zaten var olan "Duygu Analizi" ve "Şikayet ve Övgü Etiketleri"
// bloklarının yerine geçer. Head Agent bloğunun hemen altında; SDR'a
// "bu yerin müşterileri ne diyor?" sorusunu tek bakışta yanıtlar.

// Sayı biçimleri locale.ts'den gelir (CARD_LOCALE'e göre).
const formatRating = numberFormat.rating;
const formatInt = numberFormat.int;

interface KpiRow {
  label: string;
  percent: number | null;
}

interface OpenIframeModal {
  (payload: {
    uri: string;
    title?: string;
    width?: number;
    height?: number;
  }): void;
}

// Etiketlerin ilk harfini kart tarafında büyült; seed/DB'ye dokunulmaz.
function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Yüzde yazısı locale'e göre (en → "72%", tr → "%72"); null ise "—".
function formatPercent(n: number | null): string {
  return n != null ? numberFormat.percent(n) : "—";
}

function CustomerVoiceBlock({
  rating,
  totalReviews,
  leadScore,
  sentiment,
  topComplaints,
  topPraise,
  painPhrases,
  praisePhrases,
  fullAnalysisUrl,
  businessName,
  openIframeModal,
}: {
  rating: number | null;
  totalReviews: number | null;
  leadScore: number | null;
  sentiment: { positive: number | null; neutral: number | null; negative: number | null };
  topComplaints: KpiRow[];
  topPraise: KpiRow[];
  painPhrases: string[];
  praisePhrases: string[];
  fullAnalysisUrl: string | null;
  businessName: string | null;
  openIframeModal?: OpenIframeModal;
}) {
  // Başlık özet satırı — sadece değeri olan parçalar
  const summaryParts: string[] = [];
  if (rating != null) summaryParts.push(`Google ${formatRating(rating)}★`);
  if (totalReviews != null) summaryParts.push(voiceSummary.reviews(formatInt(totalReviews)));
  if (leadScore != null) summaryParts.push(voiceSummary.score(leadScore));
  const summaryLine = summaryParts.join(" · ");

  // Kart tarafı sıralama: percent DESC, null'lar sona.
  const sortedComplaints = [...topComplaints]
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .slice(0, 3);
  const sortedPraise = [...topPraise]
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
    .slice(0, 3);

  const hasAnySentiment =
    sentiment.positive != null ||
    sentiment.neutral != null ||
    sentiment.negative != null;

  return (
    <Tile>
      <Flex direction="column" gap="md">
        {/* 1. Blok başlığı + sağda özet satırı */}
        <Flex
          direction="row"
          justify="between"
          align="center"
          wrap="wrap"
          gap="sm"
        >
          <Text
            variant="microcopy"
            format={{ fontWeight: "demibold", textTransform: "uppercase" }}
          >
            {t.voiceOfCustomer}
          </Text>
          {summaryLine && (
            <Text variant="microcopy" inline>
              {summaryLine}
            </Text>
          )}
        </Flex>

        {/* 2. Duygu dağılımı — 3 satır, etiket sütunu sabit genişlik */}
        {hasAnySentiment ? (
          <Flex direction="column" gap="xs">
            <SentimentRow
              label={t.sentimentPositive}
              percent={sentiment.positive}
              variant="success"
            />
            <SentimentRow
              label={t.sentimentNeutral}
              percent={sentiment.neutral}
              variant="warning"
            />
            {/* HubSpot danger varyantı değeri yok sayıp tam dolu çiziyor; kullanmayın. */}
            <SentimentRow
              label={t.sentimentNegative}
              percent={sentiment.negative}
              variant="warning"
            />
          </Flex>
        ) : (
          <Text variant="microcopy">—</Text>
        )}

        {/* 3. Divider */}
        <Divider distance="xs" />

        {/* 4. Top complaints — tek sütun, variant="warning" */}
        <Flex direction="column" gap="sm">
          <Text format={{ fontWeight: "demibold" }}>{t.topComplaints}</Text>
          {sortedComplaints.length > 0 ? (
            sortedComplaints.map((k, i) => (
              <KpiBar
                key={i}
                label={capitalizeFirst(k.label)}
                percent={k.percent}
                variant="warning"
              />
            ))
          ) : (
            <Text variant="microcopy">—</Text>
          )}
        </Flex>

        {/* 5. Divider */}
        <Divider distance="xs" />

        {/* 6. Top praise — tek sütun, variant="success" */}
        <Flex direction="column" gap="sm">
          <Text format={{ fontWeight: "demibold" }}>{t.topPraise}</Text>
          {sortedPraise.length > 0 ? (
            sortedPraise.map((k, i) => (
              <KpiBar
                key={i}
                label={capitalizeFirst(k.label)}
                percent={k.percent}
                variant="success"
              />
            ))
          ) : (
            <Text variant="microcopy">—</Text>
          )}
        </Flex>

        {/* 7. Divider */}
        <Divider distance="xs" />

        {/* 8. Yorumlarda öne çıkanlar — birebir alıntılar */}
        <Box>
          <Text format={{ fontWeight: "demibold" }}>{t.whatCustomersSay}</Text>
          {painPhrases.length === 0 && praisePhrases.length === 0 ? (
            <Text variant="microcopy">—</Text>
          ) : (
            <Flex direction="column" gap="xs">
              {painPhrases.length > 0 && (
                <Flex direction="row" gap="xs" wrap="wrap">
                  {painPhrases.slice(0, 3).map((p, i) => (
                    <Tag key={`pain-${i}`} variant="error">{`"${p}"`}</Tag>
                  ))}
                </Flex>
              )}
              {praisePhrases.length > 0 && (
                <Flex direction="row" gap="xs" wrap="wrap">
                  {praisePhrases.slice(0, 3).map((p, i) => (
                    <Tag key={`praise-${i}`} variant="success">{`"${p}"`}</Tag>
                  ))}
                </Flex>
              )}
            </Flex>
          )}
        </Box>

        {/* 9. Tam analiz linki — Button (Link tip-hatası nedeniyle) */}
        {fullAnalysisUrl && openIframeModal && (
          <Flex direction="row" justify="end">
            <Button
              variant="transparent"
              size="sm"
              onClick={() =>
                openIframeModal({
                  uri: fullAnalysisUrl,
                  title: `Revint — ${businessName ?? "lead"}`,
                  width: 1100,
                  height: 720,
                })
              }
            >
              {t.openFullAnalysis}
            </Button>
          </Flex>
        )}
      </Flex>
    </Tile>
  );
}

// Duygu satırı — etiket / bar / yüzde oranları `flex` ile sabitlendi
// (BoxProps `width` kabul etmiyor, bu yüzden sabit px yerine 1 : 5 : 1
// oranı kullanıyoruz; üç satır aynı sabit flex şeması ile aynı noktada
// başlayıp bitiyor).
function SentimentRow({
  label,
  percent,
  variant,
}: {
  label: string;
  percent: number | null;
  // "danger" intentionally excluded — HubSpot renders it as fully filled regardless of value.
  variant: "success" | "warning";
}) {
  return (
    <Flex direction="row" align="center" gap="sm">
      <Box flex={1}>
        <Text variant="microcopy" inline>
          {label}
        </Text>
      </Box>
      <Box flex={5}>
        <ProgressBar value={percent ?? 0} variant={variant} />
      </Box>
      <Box flex={1}>
        <Flex direction="row" justify="end">
          <Text variant="microcopy" inline>
            {formatPercent(percent)}
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
}

// KPI barı — üst satır etiket + yüzde, altında TAM GENİŞLİKTE bar.
function KpiBar({
  label,
  percent,
  variant,
}: {
  label: string;
  percent: number | null;
  variant: "success" | "danger" | "warning";
}) {
  return (
    <Flex direction="column" gap="xs">
      <Flex direction="row" justify="between" align="center">
        <Text format={{ fontWeight: "demibold" }} inline>
          {label}
        </Text>
        <Text variant="microcopy" inline>
          {formatPercent(percent)}
        </Text>
      </Flex>
      <ProgressBar value={percent ?? 0} variant={variant} />
    </Flex>
  );
}

// Yeniden kullanılabilir property satırı (label | value | badge?)
function PropertyRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell>
        <Text variant="microcopy" format={{ color: "secondary" }}>
          {label}
        </Text>
      </TableCell>
      <TableCell>
        {badge ?? (
          <Text variant="microcopy">{value || "-"}</Text>
        )}
      </TableCell>
    </TableRow>
  );
}

function RevintAITab({
  context,
  fetchFn,
  actions,
}: {
  context: ExtensionContext;
  fetchFn: FetchFn;
  actions: CardActions;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "empty"; reason: string }
    | { kind: "ready"; data: CardDataResponse }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const objectId = String(context.crm.objectId);
    const objectType =
      context.crm.objectType?.toUpperCase() ??
      context.crm.objectTypeId?.toUpperCase() ??
      "CONTACT";
    const portalId =
      context.portal?.id != null ? String(context.portal.id) : undefined;

    fetchFn(`${REVINT_BASE_URL}/api/integrations/hubspot/card-data`, {
      method: "POST",
      body: { objectId, objectType, portalId },
      timeout: 10_000,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "error", message: t.errorSignatureMismatch });
          return;
        }
        if (res.status >= 500) {
          setState({ kind: "error", message: t.errorUnavailable });
          return;
        }
        if (!res.body.found) {
          setState({ kind: "empty", reason: res.body.reason ?? "not_linked" });
          return;
        }
        setState({ kind: "ready", data: res.body });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "error", message: t.errorCantReach });
      });

    return () => {
      cancelled = true;
    };
  }, [context.crm.objectId, context.crm.objectType, context.portal?.id]);

  if (state.kind === "loading") {
    return (
      <Flex direction="row" justify="center" align="center">
        <LoadingSpinner label={t.loadingTab} />
      </Flex>
    );
  }

  if (state.kind === "error") {
    return (
      <ErrorState title={t.errorTitle} layout="vertical">
        <Text>{state.message}</Text>
      </ErrorState>
    );
  }

  if (state.kind === "empty") {
    const isNotLinked =
      state.reason === "lead_not_found" || state.reason === "not_linked";
    return (
      <EmptyState
        title={isNotLinked ? t.emptyNotInRevint : t.emptyPortalNotConnected}
        layout="vertical"
      >
        <Text>
          {isNotLinked ? t.emptyNotLinkedTab : t.emptyPortalInstructions}
        </Text>
      </EmptyState>
    );
  }

  const { data } = state;
  const signals = data.signals!;
  const timing = data.timing!;
  const reviews = data.reviews ?? null;
  const techSignals = data.techSignals ?? null;
  const glanceChips = data.glance?.chips ?? [];

  // Türetilmiş mock alanlar
  const tier = deriveTier(signals.salesConfidence);
  const trust = deriveTrustLabel(signals.qualificationRisk);
  const maturity = deriveMaturity(techSignals);
  const gaps = deriveGaps(techSignals, glanceChips);
  const enterpriseSignal = deriveEnterpriseSignal(
    data.branchCount ?? null,
    data.accountTier ?? null,
  );
  const analyzedAt = formatAnalyzedAt(timing.hoursSinceInbound);
  const segment = formatSegment(signals.subNicheLabel ?? null, signals.subNicheSlug);

  const hasTechSignals = techSignals != null && techSignals.length > 0;

  return (
    <Flex direction="column" gap="lg">

      {/* ═══════════════════════════════════════════════════════════════
          0. Başlık satırı + Önerilen Paket hero bloğu
          ═══════════════════════════════════════════════════════════════ */}
      <RecommendedPackageHero
        businessName={data.lead?.businessName ?? null}
        temperature={signals.temperature ?? null}
        hoursSinceInbound={timing.hoursSinceInbound ?? null}
        salesConfidence={signals.salesConfidence ?? null}
        qualificationRisk={signals.qualificationRisk ?? null}
        headAgentConfidence={data.headAgent?.confidence ?? null}
        opportunityScore={data.fit?.opportunityScore ?? null}
        pkg={data.package ?? null}
        excludedModules={data.headAgent?.excludedModules ?? []}
      />

      {/* ═══════════════════════════════════════════════════════════════
          0.5. Head Agent kararı — açılış açısı + gerekçe + fit modüller
          ═══════════════════════════════════════════════════════════════ */}
      <HeadAgentBlock
        primaryAngle={
          data.headAgent?.primaryAngle ?? data.pitch?.headline ?? null
        }
        talkTrack={
          data.headAgent?.talkTrack ?? data.pitch?.sentence ?? null
        }
        reasoning={data.headAgent?.reasoning ?? null}
        recommendedModules={data.headAgent?.recommendedModules ?? []}
      />

      {/* ═══════════════════════════════════════════════════════════════
          1. Kayıt Özellikleri — Revint Metrikleri
          ═══════════════════════════════════════════════════════════════ */}
      <Tile>
        <Flex direction="column" gap="sm">
          <Heading>{t.revintMetrics}</Heading>
          <Divider distance="xs" />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t.colMetric}</TableHeader>
                <TableHeader>{t.colValue}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <PropertyRow label={t.segment} value={segment} />
              <PropertyRow label={t.location} value={data.location ?? "-"} />
              <PropertyRow
                label={t.locations}
                value={
                  data.branchCount != null ? String(data.branchCount) : "-"
                }
              />
              <PropertyRow
                label={t.score}
                value={String(signals.salesConfidence ?? "-")}
              />
              <PropertyRow
                label={t.tier}
                value=""
                badge={<Tag variant={tier.variant}>{tier.label}</Tag>}
              />
              <PropertyRow label={t.gaps} value={gaps} />
              <PropertyRow label={t.digitalMaturity} value={maturity} />
              <PropertyRow
                label={t.dataConfidence}
                value=""
                badge={<Tag variant={trust.variant}>{trust.label}</Tag>}
              />
              <PropertyRow
                label={t.enterpriseSignal}
                value=""
                badge={
                  <Tag
                    variant={
                      enterpriseSignal === t.enterpriseYes
                        ? "success"
                        : "default"
                    }
                  >
                    {enterpriseSignal}
                  </Tag>
                }
              />
              <PropertyRow label={t.lastAnalyzed} value={analyzedAt} />
            </TableBody>
          </Table>
        </Flex>
      </Tile>

      {/* ═══════════════════════════════════════════════════════════════
          2. Müşteri Sesi — sentiment + top KPIs + kendi sözleri
          Head Agent bloğunun hemen altında; eski "Duygu Analizi" +
          "Şikayet ve Övgü Etiketleri" bloklarının yerini alır.
          ═══════════════════════════════════════════════════════════════ */}
      <CustomerVoiceBlock
        rating={reviews?.rating ?? null}
        totalReviews={reviews?.totalReviews ?? null}
        leadScore={reviews?.leadScore ?? null}
        sentiment={reviews?.sentiment ?? { positive: null, neutral: null, negative: null }}
        topComplaints={reviews?.topComplaints ?? []}
        topPraise={reviews?.topPraise ?? []}
        painPhrases={reviews?.painPhrases ?? []}
        praisePhrases={reviews?.praisePhrases ?? []}
        fullAnalysisUrl={reviews?.fullAnalysisUrl ?? null}
        businessName={data.lead?.businessName ?? null}
        openIframeModal={actions.openIframeModal}
      />


      {/* ═══════════════════════════════════════════════════════════════
          4. Website Raporu & Dönüşüm Sinyalleri
          ═══════════════════════════════════════════════════════════════ */}
      {hasTechSignals && (
        <Tile>
          <Flex direction="column" gap="sm">
            <Heading>{t.websiteReport}</Heading>
            <Divider distance="xs" />
            <Flex direction="column" gap="xs">
              {techSignals!.map((signal) => (
                <Box key={signal.label}>
                  <Flex direction="row" gap="xs" align="center" wrap="wrap">
                    <Tag variant={techSignalVariant(signal)}>
                      {signal.present ? "✓" : "✗"} {signal.label}
                    </Tag>
                    <Text
                      variant="microcopy"
                      format={{ color: "secondary" }}
                    >
                      {signal.detail}
                    </Text>
                  </Flex>
                </Box>
              ))}
            </Flex>

            {/* Glance chip'leri (website / perf sinyalleri) */}
            {glanceChips.length > 0 && (
              <>
                <Divider distance="xs" />
                <Text
                  variant="microcopy"
                  format={{ fontWeight: "demibold", color: "secondary" }}
                >
                  {t.overallSignals}
                </Text>
                <Flex direction="row" gap="xs" wrap="wrap">
                  {glanceChips.map((chip) => {
                    // Chip metni server-side (SERVER_LOCALE) üretildiği için
                    // kart tarafında ikinci çeviri katmanı YOK — olduğu gibi
                    // render edilir. Renk sadece anlamsal önekleri eşler.
                    const label = chip;
                    const lower = label.toLowerCase();
                    const variant = lower.startsWith("paket:") ||
                        lower.startsWith("package:") ||
                        lower.startsWith("yüksek puan") ||
                        lower.startsWith("high rating") ||
                        lower.startsWith("qr menü var") ||
                        lower.startsWith("qr menu present")
                      ? "success"
                      : lower.startsWith("yavaş site") ||
                          lower.startsWith("slow site")
                        ? "warning"
                        : "default";
                    return (
                      <Tag key={chip} variant={variant}>
                        {label}
                      </Tag>
                    );
                  })}
                </Flex>
              </>
            )}
          </Flex>
        </Tile>
      )}

      {/* Aksiyon sayfası linki */}
      {data.actionSheetUrl && (
        <Flex direction="row" justify="end">
          <Link
            onClick={() =>
              actions.openIframeModal?.({
                uri: data.actionSheetUrl!,
                title: `Revint — ${data.lead?.businessName ?? "lead"}`,
                width: 1100,
                height: 720,
              })
            }
          >
            {t.openActionSheet}
          </Link>
        </Flex>
      )}
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Extension kayıt noktası
// ---------------------------------------------------------------------------

hubspot.extend<"crm.record.tab">(({ context, actions }) => {
  const fetchFn: FetchFn = async (url, init) => {
    const res = await hubspot.fetch(url, {
      method: init?.method ?? "GET",
      body: init?.body,
      timeout: init?.timeout,
    });
    const body = (await res.json()) as CardDataResponse;
    return { status: res.status, body };
  };

  return (
    <RevintAITab
      context={context as ExtensionContext}
      fetchFn={fetchFn}
      actions={actions as CardActions}
    />
  );
});
