// src/lib/site-capture/store.ts
/**
 * Persists a capture: one row per lead, replaced on every audit. Every
 * query carries the workspace id. Raw HTML is never written.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SiteCaptureResult } from "./types";

/** Plain JSON without NUL characters (Postgres jsonb rejects \u0000). */
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value).replace(/\\u0000/g, "")) as Prisma.InputJsonValue;
}

export async function saveSiteCapture(args: {
  workspaceId: string;
  leadId: string;
  capture: SiteCaptureResult;
}): Promise<void> {
  const { workspaceId, leadId, capture } = args;
  await prisma.$transaction([
    // Cascades to the pages of the previous capture.
    prisma.siteCapture.deleteMany({ where: { leadId, workspaceId } }),
    prisma.siteCapture.create({
      data: {
        workspaceId,
        leadId,
        rootUrl: capture.rootUrl,
        status: capture.status,
        startedAt: new Date(capture.startedAt),
        durationMs: Math.round(capture.durationMs),
        pageCount: capture.pages.length,
        sitemapUrlCount: capture.sitemapUrlCount,
        ledger: json(capture.ledger),
        pages: {
          create: capture.pages.map((p) => ({
            workspaceId,
            url: p.url,
            finalUrl: p.finalUrl,
            type: p.type,
            source: p.source,
            httpStatus: p.httpStatus,
            title: p.title,
            text: p.text,
            links: json(p.links),
            embeds: json(p.embeds),
            jsonLd: json(p.jsonLd),
            thirdPartyRequests: json(p.thirdPartyRequests),
            needsOcr: p.needsOcr,
          })),
        },
      },
    }),
  ]);
}
