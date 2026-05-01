import type { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  getAgentRunsQueue,
  getAnalyzeQueue,
  getCrawlQueue,
  getDiscoveryQueue,
  getEmailVerificationQueue,
  getReviewAnalysisQueue,
} from "@/lib/queues";

export type WorkspaceQueueRemovalCounts = Record<string, number>;

/**
 * bullmq's published `.d.ts` surface omits several `QueueGetters` helpers that
 * exist at runtime — narrow structural typing instead of `any`.
 */
interface QueueJobListing {
  getJobs(
    types: string[],
    start?: number,
    end?: number,
    asc?: boolean,
  ): Promise<Array<{ data: Record<string, unknown>; remove(): Promise<void> } | null>>;
}

interface PipelineJob {
  data: Record<string, unknown>;
  remove(): Promise<void>;
}

function asListingQueue(queue: Queue): QueueJobListing {
  return queue as unknown as QueueJobListing;
}

type AgentRunsJobPayload = {
  type?: string;
  runId?: string;
  sessionId?: string;
  memoryId?: string;
  stateId?: string;
};

function inferAgentRunsPayloadType(data: AgentRunsJobPayload): string {
  if ("type" in data && typeof data.type === "string") return data.type;
  if ("runId" in data && typeof data.runId === "string") return "agent_run";
  return "unknown";
}

async function collectQueueJobs(queue: Queue): Promise<PipelineJob[]> {
  const states = ["waiting", "delayed", "paused", "prioritized"] as const;
  const out: PipelineJob[] = [];
  const q = asListingQueue(queue);
  for (const state of states) {
    const chunk = await q.getJobs([state], 0, -1, true);
    for (const job of chunk) {
      if (job) out.push(job);
    }
  }
  return out;
}

async function removeMatchingJobs(
  queue: Queue,
  matches: (job: PipelineJob) => boolean | Promise<boolean>,
): Promise<number> {
  let removed = 0;
  const jobs = await collectQueueJobs(queue);
  for (const job of jobs) {
    try {
      if (await matches(job)) {
        await job.remove();
        removed++;
      }
    } catch {
      // Lost a race with a worker picking up the job — acceptable.
    }
  }
  return removed;
}

/**
 * Drops BullMQ jobs that belong to `workspaceId` from ingestion + AI queues.
 * Does not touch repeatable `sequence_tick` (global cron) or other tenants' jobs.
 */
export async function removeWorkspaceJobsFromPipelineQueues(
  workspaceId: string,
): Promise<WorkspaceQueueRemovalCounts> {
  const leadRows = await prisma.lead.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const workspaceLeadIds = new Set(leadRows.map((r) => r.id));

  const discoveryQueue = getDiscoveryQueue();
  const crawlQueue = getCrawlQueue();
  const analyzeQueue = getAnalyzeQueue();
  const reviewAnalysisQueue = getReviewAnalysisQueue();
  const emailVerificationQueue = getEmailVerificationQueue();
  const agentRunsQueue = getAgentRunsQueue();

  const discoveryRemoved = await removeMatchingJobs(discoveryQueue, (job) => {
    const d = job.data as { workspaceId?: string };
    return d.workspaceId === workspaceId;
  });

  const crawlRemoved = await removeMatchingJobs(crawlQueue, (job) => {
    const d = job.data as { leadId?: string };
    return Boolean(d.leadId && workspaceLeadIds.has(d.leadId));
  });

  const analyzeRemoved = await removeMatchingJobs(analyzeQueue, (job) => {
    const d = job.data as { leadId?: string };
    return Boolean(d.leadId && workspaceLeadIds.has(d.leadId));
  });

  const reviewRemoved = await removeMatchingJobs(reviewAnalysisQueue, (job) => {
    const d = job.data as { leadId?: string };
    return Boolean(d.leadId && workspaceLeadIds.has(d.leadId));
  });

  const emailRemoved = await removeMatchingJobs(
    emailVerificationQueue,
    (job) => {
      const d = job.data as { leadId?: string };
      return Boolean(d.leadId && workspaceLeadIds.has(d.leadId));
    },
  );

  const agentJobs = await collectQueueJobs(agentRunsQueue);
  const agentRunJobs: PipelineJob[] = [];
  const advanceJobs: PipelineJob[] = [];
  const embedJobs: PipelineJob[] = [];
  const sequenceStepJobs: PipelineJob[] = [];

  for (const job of agentJobs) {
    const data = job.data as AgentRunsJobPayload;
    const t = inferAgentRunsPayloadType(data);
    if (t === "sequence_tick") continue;
    if (t === "unknown") continue;
    if (t === "agent_run") agentRunJobs.push(job);
    else if (t === "orchestrator_advance") advanceJobs.push(job);
    else if (t === "embed") embedJobs.push(job);
    else if (t === "sequence_step") sequenceStepJobs.push(job);
  }

  const runIds = [
    ...new Set(
      agentRunJobs
        .map((j) => (j.data as AgentRunsJobPayload).runId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const sessionIds = [
    ...new Set(
      advanceJobs
        .map((j) => (j.data as AgentRunsJobPayload).sessionId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const memoryIds = [
    ...new Set(
      embedJobs
        .map((j) => (j.data as AgentRunsJobPayload).memoryId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const stateIds = [
    ...new Set(
      sequenceStepJobs
        .map((j) => (j.data as AgentRunsJobPayload).stateId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const [matchingRuns, matchingSessions, matchingMemories, matchingStates] =
    await Promise.all([
      runIds.length
        ? prisma.agentRun.findMany({
            where: { workspaceId, id: { in: runIds } },
            select: { id: true },
          })
        : [],
      sessionIds.length
        ? prisma.plannerSession.findMany({
            where: { workspaceId, id: { in: sessionIds } },
            select: { id: true },
          })
        : [],
      memoryIds.length
        ? prisma.semanticMemory.findMany({
            where: { workspaceId, id: { in: memoryIds } },
            select: { id: true },
          })
        : [],
      stateIds.length
        ? prisma.leadSequenceState.findMany({
            where: { workspaceId, id: { in: stateIds } },
            select: { id: true },
          })
        : [],
    ]);

  const runOk = new Set(matchingRuns.map((r) => r.id));
  const sessionOk = new Set(matchingSessions.map((s) => s.id));
  const memoryOk = new Set(matchingMemories.map((m) => m.id));
  const stateOk = new Set(matchingStates.map((s) => s.id));

  let agentRunsRemoved = 0;
  const tryRemove = async (job: PipelineJob, ok: boolean) => {
    if (!ok) return;
    try {
      await job.remove();
      agentRunsRemoved++;
    } catch {
      /* raced */
    }
  };

  await Promise.all([
    ...agentRunJobs.map((job) => {
      const id = (job.data as AgentRunsJobPayload).runId;
      return tryRemove(job, Boolean(id && runOk.has(id)));
    }),
    ...advanceJobs.map((job) => {
      const id = (job.data as AgentRunsJobPayload).sessionId;
      return tryRemove(job, Boolean(id && sessionOk.has(id)));
    }),
    ...embedJobs.map((job) => {
      const id = (job.data as AgentRunsJobPayload).memoryId;
      return tryRemove(job, Boolean(id && memoryOk.has(id)));
    }),
    ...sequenceStepJobs.map((job) => {
      const id = (job.data as AgentRunsJobPayload).stateId;
      return tryRemove(job, Boolean(id && stateOk.has(id)));
    }),
  ]);

  return {
    discovery: discoveryRemoved,
    crawl: crawlRemoved,
    analyze: analyzeRemoved,
    reviewAnalysis: reviewRemoved,
    emailVerification: emailRemoved,
    agentRuns: agentRunsRemoved,
  };
}

/**
 * Clears stuck pipeline columns on `Lead` so the live strip reflects reality
 * after cancel — avoids orphaned PENDING/CRAWLING/ANALYZING rows with no queue consumer.
 */
export async function resetWorkspaceLeadPipelineColumns(workspaceId: string): Promise<{
  leadsCrawlReset: number;
  leadsNoWebsiteCrawlCleared: number;
  leadsAnalyzeReset: number;
  leadsReviewAnalysisReset: number;
}> {
  const [crawlReset, noWebsiteCrawlClear, analyzeReset, reviewReset] =
    await Promise.all([
    prisma.lead.updateMany({
      where: {
        workspaceId,
        crawlStatus: { in: ["PENDING", "CRAWLING"] },
        hasWebsite: true,
      },
      data: { crawlStatus: "FAILED" },
    }),
    prisma.lead.updateMany({
      where: {
        workspaceId,
        crawlStatus: { in: ["PENDING", "CRAWLING"] },
        hasWebsite: false,
      },
      data: { crawlStatus: "NO_WEBSITE" },
    }),
    prisma.lead.updateMany({
      where: {
        workspaceId,
        analyzeStatus: { in: ["PENDING", "ANALYZING"] },
      },
      data: { analyzeStatus: "FAILED" },
    }),
    prisma.lead.updateMany({
      where: {
        workspaceId,
        reviewAnalysisStatus: { in: ["PENDING", "ANALYZING"] },
      },
      data: { reviewAnalysisStatus: "FAILED" },
    }),
  ]);

  return {
    leadsCrawlReset: crawlReset.count,
    leadsNoWebsiteCrawlCleared: noWebsiteCrawlClear.count,
    leadsAnalyzeReset: analyzeReset.count,
    leadsReviewAnalysisReset: reviewReset.count,
  };
}

/**
 * Nuclear option: clears **every tenant's** queued ingestion + AI jobs in one
 * pass. Retains repeatable `sequence_tick` on `agent-runs` so sequence cron
 * keeps scheduling (ticks no-op if nothing is due).
 *
 * Intended only for `POST /api/admin/pipeline/cancel-all-global` behind a
 * server secret — never call from product UI.
 */
export async function removeAllPendingJobsFromPipelineQueuesGlobally(): Promise<WorkspaceQueueRemovalCounts> {
  const discoveryQueue = getDiscoveryQueue();
  const crawlQueue = getCrawlQueue();
  const analyzeQueue = getAnalyzeQueue();
  const reviewAnalysisQueue = getReviewAnalysisQueue();
  const emailVerificationQueue = getEmailVerificationQueue();
  const agentRunsQueue = getAgentRunsQueue();

  const discoveryRemoved = await removeMatchingJobs(discoveryQueue, () => true);
  const crawlRemoved = await removeMatchingJobs(crawlQueue, () => true);
  const analyzeRemoved = await removeMatchingJobs(analyzeQueue, () => true);
  const reviewRemoved = await removeMatchingJobs(reviewAnalysisQueue, () => true);
  const emailRemoved = await removeMatchingJobs(
    emailVerificationQueue,
    () => true,
  );

  const agentRunsRemoved = await removeMatchingJobs(
    agentRunsQueue,
    (job) =>
      inferAgentRunsPayloadType(job.data as AgentRunsJobPayload) !==
      "sequence_tick",
  );

  return {
    discovery: discoveryRemoved,
    crawl: crawlRemoved,
    analyze: analyzeRemoved,
    reviewAnalysis: reviewRemoved,
    emailVerification: emailRemoved,
    agentRuns: agentRunsRemoved,
  };
}

/** Cross-tenant stuck-column reset — pairs with global queue wipe + AgentRun cancel. */
export async function resetAllLeadPipelineColumnsGlobally(): Promise<{
  leadsCrawlReset: number;
  leadsNoWebsiteCrawlCleared: number;
  leadsAnalyzeReset: number;
  leadsReviewAnalysisReset: number;
}> {
  const [crawlReset, noWebsiteCrawlClear, analyzeReset, reviewReset] =
    await Promise.all([
      prisma.lead.updateMany({
        where: {
          crawlStatus: { in: ["PENDING", "CRAWLING"] },
          hasWebsite: true,
        },
        data: { crawlStatus: "FAILED" },
      }),
      prisma.lead.updateMany({
        where: {
          crawlStatus: { in: ["PENDING", "CRAWLING"] },
          hasWebsite: false,
        },
        data: { crawlStatus: "NO_WEBSITE" },
      }),
      prisma.lead.updateMany({
        where: {
          analyzeStatus: { in: ["PENDING", "ANALYZING"] },
        },
        data: { analyzeStatus: "FAILED" },
      }),
      prisma.lead.updateMany({
        where: {
          reviewAnalysisStatus: { in: ["PENDING", "ANALYZING"] },
        },
        data: { reviewAnalysisStatus: "FAILED" },
      }),
    ]);

  return {
    leadsCrawlReset: crawlReset.count,
    leadsNoWebsiteCrawlCleared: noWebsiteCrawlClear.count,
    leadsAnalyzeReset: analyzeReset.count,
    leadsReviewAnalysisReset: reviewReset.count,
  };
}
