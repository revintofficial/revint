/**
 * INBOX_REPLY_ATTRIBUTOR worker.
 *
 * Phase 1 stub: reads the lead's current SalesOpportunity.status and
 * returns it. The learning-loop's memory write actually happens in
 * the `__WRITE_OPENER_OUTCOME__` sentinel that runs AFTER this step,
 * reading the same status the attributor just validated.
 *
 * Full Phase 2 behavior will pull inbound Gmail / Outlook messages,
 * match them to sent openers via thread id + message-id, update the
 * status column accordingly, then emit this chain. For now the API
 * endpoint `/api/leads/:id/mark-outcome` (see route) lets users
 * manually flag a lead as "interested" / "lost" and trigger the
 * learning loop.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AgentWorkerOutput, AgentWorkerRun } from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("INBOX_REPLY_ATTRIBUTOR requires a lead context");

  const opp = await prisma.salesOpportunity.findUnique({
    where: { leadId: ctx.lead.id },
    select: { status: true, personalizedFirstMessage: true },
  });

  logger.info("inbox_reply_attributor.read", {
    leadId: ctx.lead.id,
    status: opp?.status ?? null,
    hasOpener: !!opp?.personalizedFirstMessage,
  });

  return {
    output: {
      status: opp?.status ?? null,
      hasOpener: !!opp?.personalizedFirstMessage,
    },
    costTokens: 0,
  };
};
