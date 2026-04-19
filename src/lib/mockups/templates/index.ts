/**
 * Mockup template registry.
 *
 * Each niche pack points to a `mockupTemplateId`. The template id resolves to a
 * render function here. Right now every id falls through to the generic
 * Gemini-markdown renderer in `lib/mockup.ts` so the architecture is in place
 * without 10 hand-built HTML templates blocking launch.
 *
 * To ship a niche-specific template later: drop a function below that returns
 * a fully formed HTML document for that niche, and the existing pipeline picks
 * it up automatically.
 */

import { renderMockupHtml } from "@/lib/mockup";
import type { WorkspaceBranding } from "@/lib/branding";

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

export function getMockupRenderer(templateId: string | null | undefined): MockupRenderer {
  if (!templateId) return DEFAULT_RENDERER;
  return REGISTRY[templateId] || DEFAULT_RENDERER;
}
