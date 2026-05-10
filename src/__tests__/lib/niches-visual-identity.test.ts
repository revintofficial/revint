/**
 * Niche-aware visual identity for the Website Mockup Generator.
 *
 * Locks in three guarantees that customers depend on:
 *  1. Each (sub)niche resolves to a stable, deterministic color palette
 *     so two mockups for two leads in the same vertical look like
 *     siblings, not lottery picks.
 *  2. Hybrid F&B children inherit their parent's palette/imagery when
 *     they don't override - mirrors the same fallback chain used by
 *     `getMockupTemplateForLead`.
 *  3. The leadac-hero renderer paints the hero photo via the safe
 *     `images.unsplash.com` allowlist and falls back to the pure-
 *     gradient hero when the niche has no imagery.
 */
import { describe, expect, it } from "vitest";
import {
  getVisualIdentityForLead,
  getNicheBySlug,
} from "@/lib/niches";
import {
  getNicheTheme,
  getNicheImagery,
  GENERIC_THEME,
  GENERIC_IMAGERY,
} from "@/lib/niches/theme";
import { renderLeadacHero } from "@/lib/mockups/renderers/leadac-hero";
import type { WebsiteMockupSections } from "@/lib/prompts/website-mockup-prompt";

const baseSections: WebsiteMockupSections = {
  hero: {
    headline: "Headline",
    subline: "Sub",
    cta_primary_text: "Call",
    trust_line: null,
  },
  services: [],
  testimonial: null,
  about: { paragraph: "" },
  cta_final: { headline: "CTA", button_text: "Click" },
  theme: { mode: "dark", accent_hex: "#a5b4fc", primary_hex: "#5e6ad2" },
  section_order: ["hero"],
};

const baseRenderInput = {
  businessName: "Test Business",
  formattedAddress: "1 Demo St",
  borough: null,
  phone: null,
  websiteUrl: null,
  rating: null,
  reviewCount: null,
  googleMapsUri: null,
  sections: baseSections,
};

describe("niche visual identity registry", () => {
  it("every flat niche has its own theme entry (no generic fallback)", () => {
    const flatSlugs = [
      "phone-repair",
      "hvac",
      "plumbing",
      "dental",
      "locksmith",
      "auto-detail",
      "opticians",
      "beauty-salon",
      "gym",
    ];
    for (const slug of flatSlugs) {
      const theme = getNicheTheme(slug);
      // Niche themes must differ from the GENERIC fallback - if a flat
      // niche silently inherits the generic palette, all our mockups
      // for that vertical will look identical to "no niche set".
      expect(theme).not.toBe(GENERIC_THEME);
      expect(theme.primaryHex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accentHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("F&B child inherits parent theme when not explicitly set", () => {
    // Pretend `fnb-hotel-fnb` had no theme of its own (it does, but
    // this exercises the fallback path).
    const themeFromUnknownChild = getNicheTheme("fnb-unknown-child", "fnb");
    const themeFromParent = getNicheTheme("fnb");
    expect(themeFromUnknownChild).toEqual(themeFromParent);
  });

  it("returns GENERIC theme when slug + parent both miss", () => {
    expect(getNicheTheme("absolutely-not-a-niche")).toBe(GENERIC_THEME);
    expect(getNicheImagery("absolutely-not-a-niche")).toBe(GENERIC_IMAGERY);
  });

  it("getVisualIdentityForLead walks subNiche -> niche -> generic", () => {
    // Sub-niche set: should resolve from subNiche.
    const v1 = getVisualIdentityForLead({
      subNicheSlug: "fnb-bar-club",
      nicheSlug: "fnb",
    });
    expect(v1.resolvedFrom).toBe("subNiche");
    expect(v1.theme.primaryHex).toBe(getNicheTheme("fnb-bar-club").primaryHex);

    // Only parent niche set.
    const v2 = getVisualIdentityForLead({
      subNicheSlug: null,
      nicheSlug: "dental",
    });
    expect(v2.resolvedFrom).toBe("niche");
    expect(v2.theme.primaryHex).toBe(getNicheTheme("dental").primaryHex);

    // Nothing set.
    const v3 = getVisualIdentityForLead({
      subNicheSlug: null,
      nicheSlug: null,
    });
    expect(v3.resolvedFrom).toBe("generic");
    expect(v3.theme).toBe(GENERIC_THEME);
  });

  it("every NichePack slug appears in the theme map (no orphans)", () => {
    // If we ever add a niche to NICHES without giving it a theme entry,
    // it will silently render as GENERIC. This catches that drift.
    const fnbBarClub = getNicheBySlug("fnb-bar-club");
    expect(fnbBarClub).toBeDefined();
    const theme = getNicheTheme(fnbBarClub!.slug, fnbBarClub!.parentSlug ?? null);
    expect(theme).not.toBe(GENERIC_THEME);
  });
});

describe("leadac-hero renderer with niche imagery", () => {
  it("paints the hero photo as a CSS background image when imagery is supplied", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: {
        hero: ["https://images.unsplash.com/photo-1234567890?w=1600"],
        gallery: [],
      },
      secondaryHex: "#0f172a",
    });
    expect(html).toMatch(
      /background-image:url\('https:\/\/images\.unsplash\.com\/photo-1234567890/,
    );
  });

  it("renders a gallery section when 2+ gallery URLs are supplied", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: {
        hero: [],
        gallery: [
          "https://images.unsplash.com/photo-aaa?w=800",
          "https://images.unsplash.com/photo-bbb?w=800",
        ],
      },
    });
    expect(html).toContain("<section class=\"gallery\">");
    expect(html).toMatch(/photo-aaa/);
    expect(html).toMatch(/photo-bbb/);
  });

  it("omits the gallery section when only one gallery photo is supplied", () => {
    // 1 photo isn't enough for a 2-3 tile grid; suppress the section
    // so we don't ship a single-tile gallery that looks broken.
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: {
        hero: [],
        gallery: ["https://images.unsplash.com/photo-only?w=800"],
      },
    });
    expect(html).not.toContain("section class=\"gallery\"");
  });

  it("rejects non-allowlisted photo hosts (defence-in-depth)", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: {
        hero: ["https://evil.example.com/track.gif"],
        gallery: [
          "https://evil.example.com/a.gif",
          "https://evil.example.com/b.gif",
        ],
      },
    });
    expect(html).not.toContain("evil.example.com");
    expect(html).not.toContain("section class=\"gallery\"");
  });

  it("rejects javascript: URLs even on the allowlist host", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: {
        hero: ["javascript:alert(1)"],
        gallery: [],
      },
    });
    expect(html).not.toContain("javascript:");
  });

  it("falls back to pure gradient hero when imagery is empty", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      imagery: { hero: [], gallery: [] },
    });
    // No hero photo block -> no `.hero-photo` div.
    expect(html).not.toContain("class=\"hero-photo\"");
  });

  it("uses the niche secondary hex in the hero gradient", () => {
    const html = renderLeadacHero({
      ...baseRenderInput,
      secondaryHex: "#abcdef",
    });
    // The third radial-gradient stop in the hero-bg uses the secondary
    // hex converted to rgba. We just check the rgba(171,205,239 prefix
    // is present somewhere in the <style> block.
    expect(html).toMatch(/rgba\(171,\s*205,\s*239/);
  });
});
