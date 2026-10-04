// src/lib/site-capture/store.ts
/**
 * Persists a capture: one row per lead, replaced on every audit. Every
 * query carries the workspace id. Raw HTML is never written.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SiteCaptureResult } from "./types";

/** Removes real NUL characters (Postgres text and jsonb both reject them). */
function stripNul(s: string): string {
  return s.replace(/\u0000/g, "");
}

/** Walks a plain-JSON value, stripping NUL from every string and object key. */
function clean(value: unknown): unknown {
  if (typeof value === "string") return stripNul(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[stripNul(k)] = clean(v);
    return out;
  }
  return value;
}

/**
 * Plain JSON without NUL characters. The JSON.stringify round trip first gives
 * JSON semantics (undefined dropped, Dates as strings, ...); the walk then cleans
 * the parsed strings, so escaped text such as a literal "\\u0000" is untouched.
 */
function json(value: unknown): Prisma.InputJsonValue {
  const plain: unknown = JSON.parse(JSON.stringify(value ?? null));
  return clean(plain) as Prisma.InputJsonValue;
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
            title: p.title === null ? null : stripNul(p.title),
            text: stripNul(p.text),
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
