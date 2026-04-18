import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";

export class QuotaExceededError extends Error {
  status = 402;
  kind: "leads" | "ai";
  used: number;
  limit: number;
  planName: string;

  constructor(kind: "leads" | "ai", used: number, limit: number, planName: string) {
    super(
      kind === "leads"
        ? `Lead quota reached (${used}/${limit} on ${planName}).`
        : `AI credit quota reached (${used}/${limit} on ${planName}).`
    );
    this.kind = kind;
    this.used = used;
    this.limit = limit;
    this.planName = planName;
  }

  toResponse() {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        kind: this.kind,
        used: this.used,
        limit: this.limit,
        planName: this.planName,
        upgradeUrl: "/app/settings/billing",
        message: this.message,
      },
      { status: 402 }
    );
  }
}

/**
 * Returns the workspace's current usage and limits. Resets the cycle counters
 * lazily if more than 30 days have passed since `cycleResetAt` (used for the
 * Free plan, which has no Stripe webhook to reset it).
 */
export async function getUsage(workspaceId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  const plan = PLANS[ws.plan];
  const now = new Date();
  const cycleAgeMs = now.getTime() - ws.cycleResetAt.getTime();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  if (ws.plan === "FREE" && cycleAgeMs > THIRTY_DAYS) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        leadsCreatedThisCycle: 0,
        aiCreditsUsedThisCycle: 0,
        cycleResetAt: now,
      },
    });
    return {
      plan,
      leadsUsed: 0,
      aiUsed: 0,
      leadsRemaining: plan.leadsPerCycle,
      aiRemaining: plan.aiCreditsPerCycle,
    };
  }

  return {
    plan,
    leadsUsed: ws.leadsCreatedThisCycle,
    aiUsed: ws.aiCreditsUsedThisCycle,
    leadsRemaining: Math.max(0, plan.leadsPerCycle - ws.leadsCreatedThisCycle),
    aiRemaining: Math.max(0, plan.aiCreditsPerCycle - ws.aiCreditsUsedThisCycle),
  };
}

export async function assertCanCreateLeads(workspaceId: string, n: number) {
  const usage = await getUsage(workspaceId);
  if (usage.leadsUsed + n > usage.plan.leadsPerCycle) {
    throw new QuotaExceededError(
      "leads",
      usage.leadsUsed,
      usage.plan.leadsPerCycle,
      usage.plan.name
    );
  }
}

export async function recordLeadsCreated(workspaceId: string, n: number) {
  if (n <= 0) return;
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { leadsCreatedThisCycle: { increment: n } },
  });
}

export async function assertCanUseAi(workspaceId: string, credits = 1) {
  const usage = await getUsage(workspaceId);
  if (usage.aiUsed + credits > usage.plan.aiCreditsPerCycle) {
    throw new QuotaExceededError(
      "ai",
      usage.aiUsed,
      usage.plan.aiCreditsPerCycle,
      usage.plan.name
    );
  }
}

export async function recordAiUsed(workspaceId: string, credits = 1) {
  if (credits <= 0) return;
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { aiCreditsUsedThisCycle: { increment: credits } },
  });
}
