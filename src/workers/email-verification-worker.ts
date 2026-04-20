/**
 * P0.4 - Email verification worker.
 *
 * Triggered after a fresh website crawl populates `WebsiteAudit.contactEmails`.
 * Calls ZeroBounce per email, writes the per-email verification status into
 * `WebsiteAudit.contactEmailsVerified`. CSV export filters by verified=true
 * (default) so SDR's don't burn deliverability on bad addresses.
 *
 * Concurrency: 3 (ZeroBounce free tier 100/month, paid tier 5 req/sec).
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import {
  verifyEmail,
  isVerificationConfigured,
  type EmailVerificationResult,
} from "../lib/email-verification";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

interface EmailVerificationJobData {
  leadId: string;
}

async function processEmailVerification(job: Job<EmailVerificationJobData>) {
  const { leadId } = job.data;

  if (!isVerificationConfigured()) {
    logger.info("worker.email_verification.not_configured", { leadId });
    return { leadId, skipped: true };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId },
    select: { id: true, contactEmails: true },
  });

  if (!audit) {
    logger.info("worker.email_verification.no_audit", { leadId });
    return { leadId, skipped: true };
  }

  const emails = (audit.contactEmails as unknown as string[]) ?? [];
  if (emails.length === 0) {
    return { leadId, skipped: true, count: 0 };
  }

  logger.info("worker.email_verification.verifying", {
    leadId,
    count: emails.length,
  });

  const results: EmailVerificationResult[] = [];
  for (const email of emails) {
    if (typeof email !== "string" || !email.includes("@")) continue;
    const result = await verifyEmail(email);
    results.push(result);
    // Light rate-limiting; ZeroBounce paid tier allows 5/sec.
    await new Promise((r) => setTimeout(r, 250));
  }

  await prisma.websiteAudit.update({
    where: { id: audit.id },
    data: { contactEmailsVerified: results as unknown as object },
  });

  const validCount = results.filter((r) => r.verified).length;
  logger.info("worker.email_verification.done", {
    leadId,
    valid: validCount,
    total: results.length,
  });

  return { leadId, total: results.length, valid: validCount };
}

export function startEmailVerificationWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<EmailVerificationJobData>(
    "email-verification",
    processEmailVerification,
    {
      connection,
      concurrency: 3,
      limiter: { max: 5, duration: 1000 },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info("worker.email_verification.job_completed", { jobId: job.id, result });
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.email_verification.job_failed", { jobId: job?.id, err });
  });

  return worker;
}
