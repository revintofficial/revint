import type { PipelinePreset, Prisma } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";
import { diffValues } from "@/lib/control/diff";
import type { ControlRole } from "@/lib/control/roles";
import { parseClaims, type SalesClaim } from "@/lib/control/score";
import { NotFoundError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CalibrationSnapshot = {
  icpJson: Record<string, unknown>;
  packagesJson: Array<Record<string, unknown>>;
  claimsJson: { claims: SalesClaim[] };
  playbookJson: Record<string, unknown>;
  pipelineJson: { preset: string; steps: unknown[]; enabled: boolean };
};

const PRESETS = new Set<PipelinePreset>(["LITE", "BALANCED", "AGGRESSIVE", "CUSTOM"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...value } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPackageList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const rows: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (isRecord(item)) rows.push(item);
  }
  return rows;
}

function snapshotFromVersion(version: {
  icpJson: unknown;
  packagesJson: unknown;
  claimsJson: unknown;
  playbookJson: unknown;
  pipelineJson: unknown;
}): CalibrationSnapshot {
  const pipeline = asRecord(version.pipelineJson);
  return {
    icpJson: asRecord(version.icpJson),
    packagesJson: asPackageList(version.packagesJson),
    claimsJson: { claims: parseClaims(version.claimsJson) },
    playbookJson: asRecord(version.playbookJson),
    pipelineJson: {
      preset: typeof pipeline.preset === "string" ? pipeline.preset : "BALANCED",
      steps: Array.isArray(pipeline.steps) ? pipeline.steps : [],
      enabled: pipeline.enabled !== false,
    },
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function snapshotIcp(row: {
  name: string;
  industryWeights: Prisma.JsonValue;
  subNicheWeights: Prisma.JsonValue;
  priceLevelMin: number | null;
  priceLevelMax: number | null;
  minReviewCount: number | null;
  minRating: number | null;
  digitalMaturityFloor: number | null;
  highValueSignals: string[];
  negativeSignals: string[];
  locationFit: Prisma.JsonValue;
  meddpiccRequiredFields: string[];
  description: string | null;
  sourceJson: Prisma.JsonValue;
} | null): Record<string, unknown> {
  if (!row) return {};
  return {
    name: row.name,
    industryWeights: row.industryWeights,
    subNicheWeights: row.subNicheWeights,
    priceLevelMin: row.priceLevelMin,
    priceLevelMax: row.priceLevelMax,
    minReviewCount: row.minReviewCount,
    minRating: row.minRating,
    digitalMaturityFloor: row.digitalMaturityFloor,
    highValueSignals: row.highValueSignals,
    negativeSignals: row.negativeSignals,
    locationFit: row.locationFit,
    meddpiccRequiredFields: row.meddpiccRequiredFields,
    description: row.description,
    sourceJson: row.sourceJson,
  };
}

export async function snapshotLive(workspaceId: string): Promise<CalibrationSnapshot> {
  const [icp, packages, playbook, pipeline, active] = await Promise.all([
    prisma.idealCustomerProfile.findUnique({ where: { workspaceId } }),
    prisma.servicePackage.findMany({ where: { workspaceId }, orderBy: { sortOrder: "asc" } }),
    prisma.workspacePlaybook.findUnique({ where: { workspaceId } }),
    prisma.workspaceLeadPipeline.findUnique({ where: { workspaceId } }),
    prisma.workspaceCalibrationVersion.findFirst({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { claimsJson: true },
    }),
  ]);

  return {
    icpJson: snapshotIcp(icp),
    packagesJson: packages.map((pkg) => ({
      name: pkg.name,
      priceLabel: pkg.priceLabel,
      features: pkg.features,
      isPopular: pkg.isPopular,
      sortOrder: pkg.sortOrder,
    })),
    claimsJson: { claims: parseClaims(active?.claimsJson ?? { claims: [] }) },
    playbookJson: playbook
      ? {
          stages: playbook.stages,
          angles: playbook.angles,
          qualificationChecklist: playbook.qualificationChecklist,
          temperatureRules: playbook.temperatureRules,
          noShowRiskRules: playbook.noShowRiskRules,
        }
      : {},
    pipelineJson: pipeline
      ? { preset: pipeline.preset, steps: Array.isArray(pipeline.steps) ? pipeline.steps : [], enabled: pipeline.enabled }
      : { preset: "BALANCED", steps: [], enabled: true },
  };
}

async function writeLive(tx: Prisma.TransactionClient, workspaceId: string, snapshot: CalibrationSnapshot) {
  const icp = snapshot.icpJson;
  const icpData = {
    name: typeof icp.name === "string" && icp.name.trim() ? icp.name : "ICP",
    industryWeights: json(icp.industryWeights ?? {}),
    subNicheWeights: json(icp.subNicheWeights ?? {}),
    priceLevelMin: typeof icp.priceLevelMin === "number" ? icp.priceLevelMin : null,
    priceLevelMax: typeof icp.priceLevelMax === "number" ? icp.priceLevelMax : null,
    minReviewCount: typeof icp.minReviewCount === "number" ? icp.minReviewCount : null,
    minRating: typeof icp.minRating === "number" ? icp.minRating : null,
    digitalMaturityFloor: typeof icp.digitalMaturityFloor === "number" ? icp.digitalMaturityFloor : null,
    highValueSignals: Array.isArray(icp.highValueSignals) ? icp.highValueSignals.filter((item): item is string => typeof item === "string") : [],
    negativeSignals: Array.isArray(icp.negativeSignals) ? icp.negativeSignals.filter((item): item is string => typeof item === "string") : [],
    locationFit: json(icp.locationFit ?? {}),
    meddpiccRequiredFields: Array.isArray(icp.meddpiccRequiredFields) ? icp.meddpiccRequiredFields.filter((item): item is string => typeof item === "string") : [],
    description: typeof icp.description === "string" ? icp.description : null,
    sourceJson: json(icp.sourceJson ?? {}),
  };
  await tx.idealCustomerProfile.upsert({
    where: { workspaceId },
    create: { workspaceId, ...icpData, version: 1 },
    update: { ...icpData, version: { increment: 1 } },
  });

  await tx.servicePackage.deleteMany({ where: { workspaceId } });
  if (snapshot.packagesJson.length > 0) {
    await tx.servicePackage.createMany({
      data: snapshot.packagesJson.map((pkg, index) => ({
        workspaceId,
        name: typeof pkg.name === "string" && pkg.name.trim() ? pkg.name : `Paket ${index + 1}`,
        priceLabel: typeof pkg.priceLabel === "string" ? pkg.priceLabel : "",
        features: Array.isArray(pkg.features) ? pkg.features.filter((item): item is string => typeof item === "string") : [],
        isPopular: pkg.isPopular === true,
        sortOrder: typeof pkg.sortOrder === "number" ? pkg.sortOrder : index,
      })),
    });
  }

  const playbook = snapshot.playbookJson;
  const playbookData = {
    stages: json(playbook.stages ?? []),
    angles: json(playbook.angles ?? []),
    qualificationChecklist: json(playbook.qualificationChecklist ?? []),
    temperatureRules: json(playbook.temperatureRules ?? {}),
    noShowRiskRules: json(playbook.noShowRiskRules ?? {}),
  };
  await tx.workspacePlaybook.upsert({
    where: { workspaceId },
    create: { workspaceId, ...playbookData },
    update: playbookData,
  });

  const preset = PRESETS.has(snapshot.pipelineJson.preset as PipelinePreset)
    ? (snapshot.pipelineJson.preset as PipelinePreset)
    : "BALANCED";
  const pipelineData = {
    preset,
    steps: json(snapshot.pipelineJson.steps ?? []),
    enabled: snapshot.pipelineJson.enabled !== false,
  };
  await tx.workspaceLeadPipeline.upsert({
    where: { workspaceId },
    create: { workspaceId, ...pipelineData },
    update: pipelineData,
  });
}

export async function createDraft(input: {
  workspaceId: string;
  reason: string;
  snapshot: CalibrationSnapshot;
  actorUserId: string;
  actorRole: ControlRole;
}): Promise<{ id: string; version: number }> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason required");
  const [max, active] = await Promise.all([
    prisma.workspaceCalibrationVersion.aggregate({
      where: { workspaceId: input.workspaceId },
      _max: { version: true },
    }),
    prisma.workspaceCalibrationVersion.findFirst({
      where: { workspaceId: input.workspaceId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  const version = (max._max.version ?? 0) + 1;
  const created = await prisma.workspaceCalibrationVersion.create({
    data: {
      workspaceId: input.workspaceId,
      version,
      status: "DRAFT",
      icpJson: json(input.snapshot.icpJson),
      packagesJson: json(input.snapshot.packagesJson),
      claimsJson: json(input.snapshot.claimsJson),
      playbookJson: json(input.snapshot.playbookJson),
      pipelineJson: json(input.snapshot.pipelineJson),
      baseVersionId: active?.id ?? null,
      reason,
      createdByUserId: input.actorUserId,
    },
    select: { id: true, version: true },
  });
  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "calibration.draft",
    targetType: "WorkspaceCalibrationVersion",
    targetId: created.id,
    reason,
    beforeJson: null,
    afterJson: { version, status: "DRAFT" },
    outcome: "SUCCEEDED",
  });
  return created;
}

export async function activateCalibration(input: {
  workspaceId: string;
  versionId: string;
  actorUserId: string;
  actorRole: ControlRole;
  reason: string;
}): Promise<{ id: string }> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason required");
  const version = await prisma.workspaceCalibrationVersion.findFirst({
    where: { id: input.versionId, workspaceId: input.workspaceId },
  });
  if (!version) throw new NotFoundError("Calibration not found");
  if (version.status !== "DRAFT" && version.status !== "APPROVED") {
    throw new Error("only a draft or approved version can be activated");
  }
  if (input.actorUserId === version.createdByUserId) {
    throw new Error("activator must differ from author");
  }

  const snapshot = snapshotFromVersion(version);

  await prisma.$transaction(async (tx) => {
    await tx.workspaceCalibrationVersion.updateMany({
      where: { workspaceId: input.workspaceId, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });
    await writeLive(tx, input.workspaceId, snapshot);
    await tx.workspaceCalibrationVersion.updateMany({
      where: { id: version.id, workspaceId: input.workspaceId },
      data: { status: "ACTIVE", activatedAt: new Date(), activatedByUserId: input.actorUserId },
    });
  });

  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "calibration.activate",
    targetType: "WorkspaceCalibrationVersion",
    targetId: version.id,
    reason,
    beforeJson: { status: version.status },
    afterJson: { status: "ACTIVE", version: version.version },
    outcome: "SUCCEEDED",
  });
  return { id: version.id };
}

export async function rollbackCalibration(input: {
  workspaceId: string;
  actorUserId: string;
  actorRole: ControlRole;
  reason: string;
}): Promise<{ id: string }> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason required");
  const previous = await prisma.workspaceCalibrationVersion.findFirst({
    where: { workspaceId: input.workspaceId, status: "SUPERSEDED" },
    orderBy: { version: "desc" },
  });
  if (!previous) throw new Error("no previous version");
  const snapshot = snapshotFromVersion(previous);
  await prisma.$transaction(async (tx) => {
    await writeLive(tx, input.workspaceId, snapshot);
    await tx.workspaceCalibrationVersion.updateMany({
      where: { workspaceId: input.workspaceId, status: "ACTIVE" },
      data: { status: "ROLLED_BACK" },
    });
    await tx.workspaceCalibrationVersion.updateMany({
      where: { id: previous.id, workspaceId: input.workspaceId },
      data: { status: "ACTIVE", activatedAt: new Date(), activatedByUserId: input.actorUserId },
    });
  });
  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "calibration.rollback",
    targetType: "WorkspaceCalibrationVersion",
    targetId: previous.id,
    reason,
    beforeJson: { status: "SUPERSEDED" },
    afterJson: { status: "ACTIVE", version: previous.version },
    outcome: "SUCCEEDED",
  });
  return { id: previous.id };
}

export function calibrationChangeLines(before: CalibrationSnapshot, after: CalibrationSnapshot): string[] {
  return [
    ...diffValues(before.icpJson, after.icpJson).map((line) => line),
    ...diffValues({ packages: before.packagesJson }, { packages: after.packagesJson }),
    ...diffValues({ claims: before.claimsJson.claims.map((claim) => claim.text) }, { claims: after.claimsJson.claims.map((claim) => claim.text) }),
    ...diffValues(before.playbookJson, after.playbookJson),
    ...diffValues(before.pipelineJson, after.pipelineJson),
  ];
}

export async function listCalibrationVersions(workspaceId: string) {
  return prisma.workspaceCalibrationVersion.findMany({
    where: { workspaceId },
    orderBy: { version: "desc" },
    take: 20,
  });
}
