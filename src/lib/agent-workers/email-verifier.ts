/**
 * EMAIL_VERIFIER worker wrapper for AI Core.
 *
 * Runs ZeroBounce against each contact email previously extracted by
 * WEBSITE_AUDITOR. Idempotent: the audit row's
 * `contactEmailsVerified` column is overwritten on every run.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  verifyEmail,
  isVerificationConfigured,
  type EmailVerificationResult,
} from "@/lib/email-verification";
import type {
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("EMAIL_VERIFIER requires a lead context");
  const leadId = ctx.lead.id;

  if (!isVerificationConfigured()) {
    logger.info("agent_workers.email_verifier.not_configured", { leadId });
    return { output: { skipped: true, reason: "zerobounce_not_configured" }, costTokens: 0 };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId },
    select: { id: true, contactEmails: true },
  });

  if (!audit) {
    return { output: { skipped: true, reason: "no_audit" }, costTokens: 0 };
  }

  const emails = (audit.contactEmails as unknown as string[]) ?? [];
  if (emails.length === 0) {
    return { output: { skipped: true, reason: "no_emails", count: 0 }, costTokens: 0 };
  }

  const results: EmailVerificationResult[] = [];
  for (const email of emails) {
    if (typeof email !== "string" || !email.includes("@")) continue;
    const result = await verifyEmail(email);
    results.push(result);
    await new Promise((r) => setTimeout(r, 250));
  }

  await prisma.websiteAudit.update({
    where: { id: audit.id },
    data: { contactEmailsVerified: results as unknown as object },
  });

  const validCount = results.filter((r) => r.verified).length;
  logger.info("agent_workers.email_verifier.done", {
    leadId,
    total: results.length,
    valid: validCount,
  });

  return {
    output: { total: results.length, valid: validCount, results },
    costTokens: 0,
  };
};
