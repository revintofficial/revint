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
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import IORedis from "ioredis";
import {
  verifyEmail,
  isVerificationConfigured,
  type EmailVerificationResult,
} from "../lib/email-verification";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface EmailVerificationJobData {
  leadId: string;
}

async function processEmailVerification(job: Job<EmailVerificationJobData>) {
  const { leadId } = job.data;

  if (!isVerificationConfigured()) {
    console.log(
      `[EmailVerification] ZEROBOUNCE_API_KEY not set, skipping ${leadId} (graceful degradation)`,
    );
    return { leadId, skipped: true };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId },
    select: { id: true, contactEmails: true },
  });

  if (!audit) {
    console.log(`[EmailVerification] No audit for ${leadId}, skipping`);
    return { leadId, skipped: true };
  }

  const emails = (audit.contactEmails as unknown as string[]) ?? [];
  if (emails.length === 0) {
    return { leadId, skipped: true, count: 0 };
  }

  console.log(`[EmailVerification] Verifying ${emails.length} email(s) for ${leadId}`);

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
  console.log(
    `[EmailVerification] Done ${leadId}: ${validCount}/${results.length} valid`,
  );

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
    console.log(`[EmailVerification] Job ${job.id} completed`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[EmailVerification] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
