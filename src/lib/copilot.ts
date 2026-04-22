/**
 * P1.2 - AI sales co-pilot chat (server-side).
 *
 * Post-AI-Core: this file is a thin shell over `src/lib/ai-core/router.ts`.
 * All retrieval, Gemini function-calling, and tool execution live there.
 * Here we handle:
 *   - Per-tier daily quota (preserves existing Free 5 / Pro 50 / etc).
 *   - Persisting CopilotMessage rows (user + assistant) for audit.
 *   - Writing the turn into SemanticMemory as COPILOT_TURN so future
 *     turns can retrieve past conversation context semantically.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Plan } from "@/generated/prisma/client";
import { routerTurn } from "@/lib/ai-core/router";
import { upsertAndEmbed } from "@/lib/ai-core/memory";

const TIER_LIMITS: Record<Plan, number> = {
  FREE: 5,
  PRO: 50,
  PRO_TEAM: 200,
  AGENCY: 10_000,
};

export class CopilotQuotaExceeded extends Error {
  used: number;
  limit: number;
  constructor(used: number, limit: number) {
    super(`Co-pilot daily quota reached: ${used}/${limit}`);
    this.used = used;
    this.limit = limit;
  }
}

export interface CopilotTurnResult {
  reply: string;
  leadIds: string[];
  /**
   * Tool invocations the router made during this turn. UI surfaces
   * this as a small "what I did" strip under the assistant bubble so
   * users can verify the agent took the actions they expected.
   */
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
}

export async function sendCopilotMessage(input: {
  workspaceId: string;
  userId: string;
  workspacePlan: Plan;
  message: string;
}): Promise<CopilotTurnResult> {
  const limit = TIER_LIMITS[input.workspacePlan] ?? 5;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.copilotMessage.count({
    where: {
      workspaceId: input.workspaceId,
      role: "USER",
      createdAt: { gte: since },
    },
  });
  if (usedToday >= limit) {
    throw new CopilotQuotaExceeded(usedToday, limit);
  }

  // Route the turn through AI Core router (retrieval + function calling).
  const turn = await routerTurn({
    workspaceId: input.workspaceId,
    userId: input.userId,
    message: input.message,
  });

  // Persist the exchange. `leadIds` captures which leads the router
  // retrieved; UI links these as citations.
  await prisma.copilotMessage.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "USER",
      content: input.message,
      leadIds: turn.usedLeadIds,
      tokensIn: turn.tokensIn,
      tokensOut: 0,
    },
  });
  const asstRow = await prisma.copilotMessage.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "ASSISTANT",
      content: turn.reply,
      leadIds: turn.usedLeadIds,
      tokensIn: 0,
      tokensOut: turn.tokensOut,
    },
  });

  // Write the turn into SemanticMemory so "remember when we talked
  // about the dentist in Kadikoy?" works. Use a single concatenated
  // text to keep retrieval coherent (user question + assistant reply
  // as one chunk is more useful than two disconnected rows).
  try {
    const turnText = `Kullanici: ${input.message}\n\nAsistan: ${turn.reply}`;
    await upsertAndEmbed({
      workspaceId: input.workspaceId,
      kind: "COPILOT_TURN",
      text: turnText,
      refType: "copilot_turn",
      refId: asstRow.id,
      metadata: {
        userId: input.userId,
        leadIds: turn.usedLeadIds,
        toolCalls: turn.toolCalls.map((t) => t.name),
      },
    });
  } catch (err) {
    logger.warn("copilot.memory_write_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    reply: turn.reply,
    leadIds: turn.usedLeadIds,
    toolCalls: turn.toolCalls,
  };
}
