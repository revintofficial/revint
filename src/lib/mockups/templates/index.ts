/**
 * Mockup template registry.
 *
 * Each niche pack points to a `mockupTemplateId`. The template id resolves to a
 * render function here. Right now every id falls through to the generic
 * Gemini-markdown renderer in `lib/mockup.ts` so the architecture is in place
 * without 10 hand-built HTML templates blocking launch.
 *
 * To ship a niche-specific template later: drop a function below that returns
 * a fully formed HTML document for that niche, and add the template id to
 * `HANDCRAFTED_TEMPLATE_IDS` so the opener writer can claim its specific UI
 * elements in cold outreach. Until a template is in that set, the opener
 * writer falls back to generic phrasing ("a quick scoped pass") so the email
 * never promises a vertical-specific mock that the renderer hasn't shipped.
 */

import { renderMockupHtml } from "@/lib/mockup";
import type { WorkspaceBranding } from "@/lib/branding";
import { getNicheBySlug } from "@/lib/niches";

export interface MockupRenderInput {
  businessName: string;
  city: string | null;
  websiteUrl: string | null;
  planMarkdown: string;
  workspaceName?: string;
  branding?: WorkspaceBranding | null;
}

export type MockupRenderer = (input: MockupRenderInput) => string;

const REGISTRY: Record<string, MockupRenderer> = {
  // Niche-specific renderers go here. Example:
  // "phone-repair": (input) => renderPhoneRepairTemplate(input),
};

const DEFAULT_RENDERER: MockupRenderer = (input) => renderMockupHtml(input);

/**
 * Template ids whose renderer ships a hand-built, niche-specific UI
 * (room-charge integration screen for hotels, tab-split for bars, etc.).
 * The opener writer reads this set to decide whether the email may
 * reference vertical-specific UI claims. Add an id here only when the
 * matching renderer is wired up in `REGISTRY` above — otherwise the
 * email will promise UI the prospect won't see.
 */
const HANDCRAFTED_TEMPLATE_IDS: ReadonlySet<string> = new Set<string>([
  // Empty for launch — every niche currently uses the generic renderer.
  // First handcrafted templates landing in v1.1: fnb-fine-dining,
  // fnb-bar-club, fnb-qsr (highest-LTV F&B sub-verticals first).
]);

export function getMockupRenderer(templateId: string | null | undefined): MockupRenderer {
  if (!templateId) return DEFAULT_RENDERER;
  return REGISTRY[templateId] || DEFAULT_RENDERER;
}

export function isHandcraftedMockupTemplate(
  templateId: string | null | undefined,
): boolean {
  if (!templateId) return false;
  return HANDCRAFTED_TEMPLATE_IDS.has(templateId);
}

/**
 * Resolves the mockup template id a lead should use. Falls back from
 * sub-niche → parent niche → generic in that order, mirroring how the
 * memory and pitch layers fall back. Returned id always resolves to a
 * renderer (even if just the default markdown one) so callers can pass
 * the value straight to `getMockupRenderer`.
 */
export function getMockupTemplateForLead(lead: {
  subNicheSlug: string | null;
  nicheSlug: string | null;
}): { templateId: string; isHandcrafted: boolean; resolvedFrom: "subNiche" | "niche" | "generic" } {
  if (lead.subNicheSlug) {
    const pack = getNicheBySlug(lead.subNicheSlug);
    if (pack?.mockupTemplateId) {
      return {
        templateId: pack.mockupTemplateId,
        isHandcrafted: isHandcraftedMockupTemplate(pack.mockupTemplateId),
        resolvedFrom: "subNiche",
      };
    }
  }
  if (lead.nicheSlug) {
    const pack = getNicheBySlug(lead.nicheSlug);
    if (pack?.mockupTemplateId) {
      return {
        templateId: pack.mockupTemplateId,
        isHandcrafted: isHandcraftedMockupTemplate(pack.mockupTemplateId),
        resolvedFrom: "niche",
      };
    }
  }
  return { templateId: "generic", isHandcrafted: false, resolvedFrom: "generic" };
}
