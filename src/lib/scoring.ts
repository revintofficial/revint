import type { WebsiteFeatures } from "@/types";

interface ScoreBreakdown {
  score: number;
  reasons: string[];
}

export function calculateDeterministicScore(
  hasWebsite: boolean,
  rating: number | null,
  reviewCount: number | null,
  features: WebsiteFeatures | null
): ScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];

  if (!hasWebsite) {
    score += 40;
    reasons.push("no_website");
  }

  if (features) {
    if (!features.mobileFriendlyGuess) {
      score += 25;
      reasons.push("poor_mobile");
    }

    if (!features.hasBookingSystem) {
      score += 10;
      reasons.push("no_booking");
    }

    if (!features.hasWhatsappLink) {
      score += 8;
      reasons.push("no_whatsapp");
    }

    if (!features.https) {
      score += 8;
      reasons.push("no_https");
    }

    if (!features.metaDescription && !features.title) {
      score += 6;
      reasons.push("weak_seo");
    }

    if (features.loadTimeMs && features.loadTimeMs > 5000) {
      score += 5;
      reasons.push("slow_site");
    }

    if (!features.reachable) {
      score += 15;
      reasons.push("site_unreachable");
    }

    if (!features.hasEcommerce) {
      score += 3;
      reasons.push("no_ecommerce");
    }

    if (features.servicesDetected.length < 2) {
      score += 4;
      reasons.push("services_unclear");
    }
  } else if (hasWebsite) {
    score += 10;
    reasons.push("uncrawled_website");
  }

  if (rating && rating >= 4.0 && reviewCount && reviewCount >= 50) {
    score += 10;
    reasons.push("high_rating_weak_site");
  } else if (rating && rating >= 4.0 && reviewCount && reviewCount >= 20) {
    score += 5;
    reasons.push("good_rating");
  }

  return {
    score: Math.min(score, 100),
    reasons,
  };
}

export function suggestOffer(
  score: number,
  reasons: string[]
): "starter" | "growth" | "sales" {
  if (reasons.includes("no_website")) return "starter";
  if (score >= 60) return "sales";
  if (score >= 35) return "growth";
  return "starter";
}

export function estimatePriceBand(offer: "starter" | "growth" | "sales"): string {
  switch (offer) {
    case "starter":
      return "£500-800";
    case "growth":
      return "£800-1500";
    case "sales":
      return "£1500-3000";
  }
}
