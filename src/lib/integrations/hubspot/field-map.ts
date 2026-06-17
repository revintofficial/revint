/**
 * FineDine v1 update — HubSpot ↔ Revint field mapping.
 *
 * Two responsibilities:
 *   1. Map a HubSpot deal pipeline stage id → a playbook stage key
 *      (inbound: webhook stage change → `Lead.playbookStageKey`).
 *   2. Map a playbook stage key → a HubSpot pipeline + stage id
 *      (outbound: writeback of a stage change).
 *
 * The mapping is derived from `PlaybookStage.hubspotPipelineId` /
 * `hubspotStageId` (set per workspace), with per-workspace overrides
 * stored in `CrmConnection.fieldMappingJson`. When no explicit mapping
 * exists we fall back to a best-effort label match against the
 * playbook stage label, which covers the common case where the customer
 * named their HubSpot stages similarly.
 */
import type { PlaybookShape, PlaybookStage } from "@/lib/playbook/types";

export interface CrmFieldMapping {
  /** HubSpot deal stage id → playbook stage key. */
  stageToPlaybook?: Record<string, string>;
  /** Playbook stage key → { pipelineId, stageId }. */
  playbookToStage?: Record<string, { pipelineId: string; stageId: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve the playbook stage key for an inbound HubSpot deal stage id.
 * Precedence: explicit `fieldMappingJson` override → playbook stage's
 * own `hubspotStageId` → label match. Returns null when nothing matches.
 */
export function mapHubspotStageToPlaybook(
  hubspotStageId: string,
  hubspotStageLabel: string | undefined,
  playbook: PlaybookShape,
  mapping: CrmFieldMapping | null | undefined,
): string | null {
  const override = mapping?.stageToPlaybook?.[hubspotStageId];
  if (override) return override;

  const byId = playbook.stages.find((s) => s.hubspotStageId === hubspotStageId);
  if (byId) return byId.key;

  if (hubspotStageLabel) {
    const target = normalize(hubspotStageLabel);
    const byLabel = playbook.stages.find(
      (s) => normalize(s.label) === target,
    );
    if (byLabel) return byLabel.key;
  }
  return null;
}

/**
 * Resolve the HubSpot { pipelineId, stageId } for an outbound playbook
 * stage change. Precedence: explicit override → playbook stage's own
 * hubspot ids + the connection default pipeline. Returns null when the
 * stage has no HubSpot mapping (writeback skips the deal stage update).
 */
export function mapPlaybookStageToHubspot(
  playbookStageKey: string,
  playbook: PlaybookShape,
  mapping: CrmFieldMapping | null | undefined,
  defaultPipelineId: string | null | undefined,
): { pipelineId: string; stageId: string } | null {
  const override = mapping?.playbookToStage?.[playbookStageKey];
  if (override) return override;

  const stage: PlaybookStage | undefined = playbook.stages.find(
    (s) => s.key === playbookStageKey,
  );
  if (stage?.hubspotStageId) {
    const pipelineId = stage.hubspotPipelineId ?? defaultPipelineId ?? undefined;
    if (pipelineId) return { pipelineId, stageId: stage.hubspotStageId };
  }
  return null;
}

/**
 * Build a best-effort default mapping from a HubSpot deal pipeline's
 * stages onto playbook stage keys by label similarity. Used at connect
 * time to pre-populate `fieldMappingJson` so the customer gets a working
 * mapping without manual configuration; they can refine it later.
 */
export function buildDefaultStageMapping(
  pipeline: {
    id: string;
    stages: Array<{ id: string; label: string }>;
  },
  playbook: PlaybookShape,
): CrmFieldMapping {
  const stageToPlaybook: Record<string, string> = {};
  const playbookToStage: Record<string, { pipelineId: string; stageId: string }> = {};

  for (const hsStage of pipeline.stages) {
    const target = normalize(hsStage.label);
    const match = playbook.stages.find((s) => normalize(s.label) === target);
    if (match) {
      stageToPlaybook[hsStage.id] = match.key;
      playbookToStage[match.key] = { pipelineId: pipeline.id, stageId: hsStage.id };
    }
  }

  return { stageToPlaybook, playbookToStage };
}
