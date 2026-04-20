import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface ContentAnalysis {
  url: string;
  reachable: boolean;
  verdict: "placeholder" | "basic" | "developed" | "unreachable";
  score: number;
  signals: {
    label: string;
    status: "good" | "bad" | "warning";
    detail: string;
  }[];
  summary: string;
  htmlSize: number;
  wordCount: number;
  imageCount: number;
  internalLinkCount: number;
  hasCustomContent: boolean;
  isParked: boolean;
  isComingSoon: boolean;
  builderDetected: string | null;
}

const PLACEHOLDER_PHRASES = [
  "lorem ipsum",
  "dolor sit amet",
  "coming soon",
  "under construction",
  "site is under construction",
  "website coming soon",
  "we're working on it",
  "launching soon",
  "stay tuned",
  "check back later",
  "parked domain",
  "this domain is for sale",
  "domain for sale",
  "buy this domain",
  "this page is not yet available",
  "default web page",
  "it works!",
  "welcome to nginx",
  "apache2 default page",
  "congratulations! your website",
  "this is a placeholder",
  "sample page",
  "hello world",
  "just another wordpress site",
];

const PARKING_INDICATORS = [
  "godaddy",
  "sedoparking",
  "parkingcrew",
  "bodis.com",
  "hugedomains",
  "dan.com",
  "afternic",
  "namecheap parking",
  "domain parking",
  "registrar-servers",
  "above.com",
  "undeveloped.com",
];

function detectBuilder(html: string): string | null {
  const checks: Record<string, RegExp[]> = {
    Wix: [/wix\.com/i, /_wix_/i, /wixstatic\.com/i],
    Squarespace: [/squarespace\.com/i, /squarespace-cdn/i, /sqs-/i],
    WordPress: [/wp-content/i, /wp-includes/i, /wordpress/i],
    Shopify: [/cdn\.shopify\.com/i, /shopify/i],
    Weebly: [/weebly\.com/i, /editmysite/i],
    "GoDaddy Builder": [/godaddy\.com\/websites/i, /secureserver\.net/i, /website-builder/i],
    Webflow: [/webflow/i, /website-files\.com/i],
    "Google Sites": [/sites\.google\.com/i],
    Jimdo: [/jimdo/i, /jimdosite/i],
    Duda: [/duda\.co/i, /dudaone/i],
  };

  for (const [builder, patterns] of Object.entries(checks)) {
    if (patterns.some((p) => p.test(html))) {
      return builder;
    }
  }
  return null;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzeHtml(html: string, url: string): ContentAnalysis {
  const signals: ContentAnalysis["signals"] = [];
  let score = 0;
  const lowerHtml = html.toLowerCase();

  const htmlSize = html.length;
  const visibleText = stripHtmlTags(html);
  const words = visibleText.split(/\s+/).filter((w) => w.length > 1);
  const wordCount = words.length;

  const imgMatches = html.match(/<img[^>]+>/gi) || [];
  const imageCount = imgMatches.length;

  const internalLinks = html.match(/<a[^>]+href=["'][^"'#][^"']*["']/gi) || [];
  const internalLinkCount = internalLinks.length;

  const hasPlaceholder = PLACEHOLDER_PHRASES.some((phrase) =>
    lowerHtml.includes(phrase)
  );

  const isParked = PARKING_INDICATORS.some((indicator) =>
    lowerHtml.includes(indicator)
  );

  const isComingSoon =
    lowerHtml.includes("coming soon") ||
    lowerHtml.includes("under construction") ||
    lowerHtml.includes("launching soon");

  const builderDetected = detectBuilder(html);

  const hasTitle = /<title>[^<]+<\/title>/i.test(html);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : "";

  const hasMetaDesc = /meta[^>]+name=["']description["']/i.test(html);
  const hasH1 = /<h1[^>]*>[^<]+<\/h1>/i.test(html);
  const hasH2 = /<h2[^>]*>/i.test(html);
  const hasForms = /<form/i.test(html);
  const hasNav = /<nav/i.test(html);
  const hasFooter = /<footer/i.test(html);
  const hasCustomCss =
    /<link[^>]+stylesheet/i.test(html) || /<style/i.test(html);
  const hasJs =
    /<script[^>]+src/i.test(html) || /<script[^>]*>[^<]{50,}<\/script>/i.test(html);

  const hasFavicon = /rel=["'](?:shortcut )?icon["']/i.test(html);
  const hasOpenGraph = /property=["']og:/i.test(html);
  const hasViewport = /name=["']viewport["']/i.test(html);
  const hasStructuredData = /application\/ld\+json/i.test(html);

  if (htmlSize > 20000) {
    score += 10;
    signals.push({ label: "HTML Boyutu", status: "good", detail: `${(htmlSize / 1024).toFixed(0)} KB - Kapsamli icerik` });
  } else if (htmlSize > 5000) {
    score += 5;
    signals.push({ label: "HTML Boyutu", status: "warning", detail: `${(htmlSize / 1024).toFixed(0)} KB - Orta duzey icerik` });
  } else {
    signals.push({ label: "HTML Boyutu", status: "bad", detail: `${(htmlSize / 1024).toFixed(0)} KB - Cok az icerik` });
  }

  if (wordCount > 300) {
    score += 15;
    signals.push({ label: "Kelime Sayisi", status: "good", detail: `${wordCount} kelime - Zengin icerik` });
  } else if (wordCount > 100) {
    score += 8;
    signals.push({ label: "Kelime Sayisi", status: "warning", detail: `${wordCount} kelime - Az icerik` });
  } else {
    signals.push({ label: "Kelime Sayisi", status: "bad", detail: `${wordCount} kelime - Cok yetersiz` });
  }

  if (imageCount > 5) {
    score += 10;
    signals.push({ label: "Gorseller", status: "good", detail: `${imageCount} gorsel bulundu` });
  } else if (imageCount > 0) {
    score += 5;
    signals.push({ label: "Gorseller", status: "warning", detail: `Sadece ${imageCount} gorsel` });
  } else {
    signals.push({ label: "Gorseller", status: "bad", detail: "Hic gorsel yok" });
  }

  if (hasTitle && titleText.length > 5) {
    score += 5;
    signals.push({ label: "Title", status: "good", detail: titleText });
  } else {
    signals.push({ label: "Title", status: "bad", detail: hasTitle ? "Cok kisa title" : "Title yok" });
  }

  if (hasMetaDesc) {
    score += 5;
    signals.push({ label: "Meta Description", status: "good", detail: "Mevcut" });
  } else {
    signals.push({ label: "Meta Description", status: "bad", detail: "Eksik" });
  }

  if (hasNav) {
    score += 8;
    signals.push({ label: "Navigasyon", status: "good", detail: "Menu yapisi var" });
  } else {
    signals.push({ label: "Navigasyon", status: "bad", detail: "Menu yapisi yok" });
  }

  if (hasFooter) {
    score += 5;
    signals.push({ label: "Footer", status: "good", detail: "Footer bolumu var" });
  } else {
    signals.push({ label: "Footer", status: "warning", detail: "Footer yok" });
  }

  if (hasH1 && hasH2) {
    score += 8;
    signals.push({ label: "Baslik Yapisi", status: "good", detail: "H1 ve H2 mevcut" });
  } else if (hasH1) {
    score += 4;
    signals.push({ label: "Baslik Yapisi", status: "warning", detail: "Sadece H1 var" });
  } else {
    signals.push({ label: "Baslik Yapisi", status: "bad", detail: "Baslik yapisi eksik" });
  }

  if (hasForms) {
    score += 7;
    signals.push({ label: "Form / Iletisim", status: "good", detail: "Form elementi mevcut" });
  } else {
    signals.push({ label: "Form / Iletisim", status: "warning", detail: "Form bulunamadi" });
  }

  if (internalLinkCount > 10) {
    score += 8;
    signals.push({ label: "Dahili Linkler", status: "good", detail: `${internalLinkCount} link - Cok sayfali site` });
  } else if (internalLinkCount > 3) {
    score += 4;
    signals.push({ label: "Dahili Linkler", status: "warning", detail: `${internalLinkCount} link` });
  } else {
    signals.push({ label: "Dahili Linkler", status: "bad", detail: `Sadece ${internalLinkCount} link` });
  }

  if (hasOpenGraph) { score += 3; }
  if (hasFavicon) { score += 2; }
  if (hasViewport) { score += 3; }
  if (hasStructuredData) { score += 4; }

  const technicalFeatures = [hasOpenGraph, hasFavicon, hasViewport, hasStructuredData, hasCustomCss, hasJs].filter(Boolean).length;
  if (technicalFeatures >= 4) {
    signals.push({ label: "Teknik Kalite", status: "good", detail: `${technicalFeatures}/6 teknik ozellik mevcut` });
    score += 5;
  } else if (technicalFeatures >= 2) {
    signals.push({ label: "Teknik Kalite", status: "warning", detail: `${technicalFeatures}/6 teknik ozellik` });
  } else {
    signals.push({ label: "Teknik Kalite", status: "bad", detail: `${technicalFeatures}/6 teknik ozellik - Cok zayif` });
  }

  if (hasPlaceholder) {
    score -= 20;
    signals.push({ label: "Placeholder Icerik", status: "bad", detail: "Lorem ipsum veya placeholder metin tespit edildi" });
  }

  if (isParked) {
    score -= 30;
    signals.push({ label: "Park Edilmis Domain", status: "bad", detail: "Bu domain park sayfasi olabilir" });
  }

  if (isComingSoon) {
    score -= 15;
    signals.push({ label: "Coming Soon", status: "bad", detail: "Site henuz yayinda degil" });
  }

  if (builderDetected) {
    signals.push({ label: "Site Builder", status: "warning", detail: `${builderDetected} ile olusturulmus` });
  }

  score = Math.max(0, Math.min(100, score));

  const hasCustomContent = wordCount > 100 && !hasPlaceholder && !isParked;

  let verdict: ContentAnalysis["verdict"];
  let summary: string;

  if (isParked) {
    verdict = "placeholder";
    summary = "Bu domain park edilmis durumda. Aktif bir website bulunmuyor. Yeni site teklifi icin cok uygun bir hedef.";
  } else if (isComingSoon || (wordCount < 50 && !hasNav)) {
    verdict = "placeholder";
    summary = "Site henuz gelistirilmemis veya placeholder asamasinda. Icerik yok denecek kadar az. Profesyonel web tasarim teklifi icin ideal.";
  } else if (hasPlaceholder && wordCount < 150) {
    verdict = "placeholder";
    summary = "Placeholder icerik tespit edildi. Site bir sablon uzerinde kurulmus ama ozellesitirilmemis. Web gelistirme hizmeti icin uygun hedef.";
  } else if (score < 35) {
    verdict = "basic";
    summary = "Temel duzeyde bir website. Icerik az, teknik altyapi zayif. Ciddi bir yeniden tasarim veya gelistirme teklifi sunulabilir.";
  } else if (score < 65) {
    verdict = "basic";
    summary = "Orta duzeyde bir website. Bazi temel ozellikler mevcut ama profesyonel bir site icin yetersiz. Iyilestirme ve modernizasyon teklifi sunulabilir.";
  } else {
    verdict = "developed";
    summary = "Ciddi sekilde gelistirilmis bir website. Zengin icerik, iyi teknik altyapi ve profesyonel yapilandirma mevcut. Bakim/guncelleme veya ozel ozellik teklifleri daha uygun.";
  }

  return {
    url,
    reachable: true,
    verdict,
    score,
    signals,
    summary,
    htmlSize,
    wordCount,
    imageCount,
    internalLinkCount,
    hasCustomContent,
    isParked,
    isComingSoon,
    builderDetected,
  };
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json({
          url,
          reachable: false,
          verdict: "unreachable",
          score: 0,
          signals: [{ label: "Erisim", status: "bad", detail: `HTTP ${response.status} - Site erisilemedi` }],
          summary: `Website HTTP ${response.status} hatasi dondu. Site erisime kapali veya mevcut degil.`,
          htmlSize: 0,
          wordCount: 0,
          imageCount: 0,
          internalLinkCount: 0,
          hasCustomContent: false,
          isParked: false,
          isComingSoon: false,
          builderDetected: null,
        });
      }

      const html = await response.text();
      const analysis = analyzeHtml(html, url);

      return NextResponse.json(analysis);
    } catch (fetchError) {
      clearTimeout(timeout);
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : "Bilinmeyen hata";

      return NextResponse.json({
        url,
        reachable: false,
        verdict: "unreachable",
        score: 0,
        signals: [{ label: "Erisim", status: "bad", detail: `Baglanti hatasi: ${errorMessage}` }],
        summary: `Website'e erisilemedi: ${errorMessage}. DNS hatasi, sunucu kapali veya SSL sorunu olabilir.`,
        htmlSize: 0,
        wordCount: 0,
        imageCount: 0,
        internalLinkCount: 0,
        hasCustomContent: false,
        isParked: false,
        isComingSoon: false,
        builderDetected: null,
      });
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.website_check.error", { err: error });
    return NextResponse.json(
      { error: "Website check failed", details: String(error) },
      { status: 500 }
    );
  }
}
