/**
 * AI Core - copilot router (Gemini function-calling).
 *
 * When the user sends a message to the copilot, this module:
 *   1. Semantically retrieves relevant memory (leads, past turns,
 *      workspace offer, personas).
 *   2. Calls Gemini with a fixed tool manifest.
 *   3. If the model calls tools, executes them and loops once more
 *      so the final text reply can reference tool results.
 *   4. Returns `{ reply, toolCalls[], usedLeadIds[] }` to the caller
 *      which then persists the turn + emits any follow-up events.
 *
 * Tool set (deliberately small; each tool is cheap, observable, and
 * cannot do destructive work):
 *
 *   - search_leads        deterministic SQL filter
 *   - semantic_search     memory.query over LEAD_PROFILE
 *   - start_pitch_pack    emits `user_one_click_pitch`
 *   - start_deep_research emits `user_deep_research`
 *   - find_lookalikes     k-NN over LEAD_PROFILE from a won lead
 *
 * The router never writes AgentRun rows itself; any work it schedules
 * routes through the event bus so auditability stays intact.
 */
import {
  GoogleGenerativeAI,
  SchemaType,
  type Tool,
  type GenerateContentResult,
} from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { query as memoryQuery } from "./memory";
import { embed } from "./embed";
import type { MemoryHit } from "@/lib/agent-workers/types";

export interface RouterTurnInput {
  workspaceId: string;
  userId: string;
  message: string;
  /**
   * Optional lead context. When a copilot session originates from a
   * lead detail page we pre-scope retrieval to that lead.
   */
  leadId?: string | null;
}

export interface RouterTurnResult {
  reply: string;
  toolCalls: ToolCallLog[];
  usedLeadIds: string[];
  hitsCount: number;
  tokensIn: number;
  tokensOut: number;
}

export interface ToolCallLog {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

const MODEL_NAME = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the Leadac AI workspace co-pilot. The user is an outbound salesperson — typically an agency operator, freelancer or SDR.
You know their lead list, their mockups, their opportunity scores and their review-intelligence data.

The RETRIEVED CONTEXT block you receive contains a semantic pull from this user's workspace: lead summaries, excerpts from past conversation turns and their "my offer" context. When you answer, rely ONLY on what is in that context. Do not invent facts.

Tools:
- search_leads: deterministic filter over leads (city, hasWebsite, opportunityScore, etc.).
- semantic_search_leads: free-text semantic search for the nearest leads.
- start_pitch_pack: kicks off the mockup + opener + video-script chain for one lead (only when the user explicitly asks).
- start_deep_research: kicks off the Apify enrichment chain for one lead (only when the user explicitly asks; cost ~$1-2).
- find_lookalikes: returns leads similar to a given WON lead.

Rules:
- Understand the request first. Do not assume. If something is ambiguous, ask a single clarifying question.
- Keep replies short: at most 5 bullets or 4 short paragraphs.
- Refer to leads by index, e.g. "Lead 1", "Lead 2".
- Never auto-run a tool. Always confirm ("want me to do X?") before calling one.
- Match the user's language; default to English otherwise.
- If you don't know, say "I don't know".`;

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(key);
}

const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_leads",
        description:
          "Deterministic SQL search. Use when user asks for a specific filter like 'show me clinics in Kadikoy with no website'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            hasWebsite: { type: SchemaType.BOOLEAN },
            minOpportunityScore: { type: SchemaType.NUMBER },
            borough: { type: SchemaType.STRING },
            primaryType: { type: SchemaType.STRING },
            limit: { type: SchemaType.NUMBER },
          },
          required: [],
        },
      },
      {
        name: "semantic_search_leads",
        description:
          "Free-text semantic search over all leads. Use when user asks something fuzzy like 'leads where reviewers complain about waiting times'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING },
            topK: { type: SchemaType.NUMBER },
          },
          required: ["query"],
        },
      },
      {
        name: "start_pitch_pack",
        description:
          "Starts a one-click pitch pack (mockup + opener + video script) for a single lead. Only call when user explicitly confirms.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            leadId: { type: SchemaType.STRING },
          },
          required: ["leadId"],
        },
      },
      {
        name: "start_deep_research",
        description:
          "Starts Apify-backed deep enrichment (Google Maps deep, website crawl, Instagram, SERP, competitor ads). Cost ~$1-2. Only call when user explicitly confirms.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            leadId: { type: SchemaType.STRING },
          },
          required: ["leadId"],
        },
      },
      {
        name: "find_lookalikes",
        description:
          "Finds leads semantically similar to a given lead (typically a WON lead).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            leadId: { type: SchemaType.STRING },
            topK: { type: SchemaType.NUMBER },
          },
          required: ["leadId"],
        },
      },
    ],
  },
];

export async function routerTurn(input: RouterTurnInput): Promise<RouterTurnResult> {
  const toolCalls: ToolCallLog[] = [];

  // 1. Retrieve context -----------------------------------------------
  const qv = await embed(input.message);
  const [leadHits, turnHits, offerHits] = await Promise.all([
    memoryQuery({
      workspaceId: input.workspaceId,
      kinds: ["LEAD_PROFILE"],
      vector: qv,
      topK: 20,
    }),
    memoryQuery({
      workspaceId: input.workspaceId,
      kinds: ["COPILOT_TURN"],
      vector: qv,
      topK: 6,
    }),
    memoryQuery({
      workspaceId: input.workspaceId,
      kinds: ["WORKSPACE_OFFER", "WORKSPACE_PERSONA"],
      vector: qv,
      topK: 4,
    }),
  ]);

  const allHits = [...leadHits, ...turnHits, ...offerHits];
  const usedLeadIds = uniq(
    leadHits.map((h) => h.leadId).filter((x): x is string => !!x),
  );

  // 2. Assemble context block ----------------------------------------
  const contextBlock = formatContext(leadHits, turnHits, offerHits);

  // 3. Call Gemini with tools ----------------------------------------
  const model = getClient().getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 1200, temperature: 0.4 },
    tools: TOOLS,
  });

  const firstPrompt = `## RETRIEVED CONTEXT
${contextBlock}

---
User message:
${input.message}`;

  const chat = model.startChat({ history: [] });
  let response = await chat.sendMessage(firstPrompt);

  // Function-calling loop. Gemini may emit multiple tool calls in one
  // response; we execute them all then send a functionResponse back.
  // Cap at 3 round trips so a misbehaving model cannot spin.
  let reply = "";
  for (let i = 0; i < 3; i++) {
    const fns = extractFunctionCalls(response);
    if (fns.length === 0) {
      reply = response.response.text().trim();
      break;
    }
    const fnResults: Array<{ name: string; response: Record<string, unknown> }> = [];
    for (const fn of fns) {
      const out = await executeTool(fn.name, fn.args, {
        workspaceId: input.workspaceId,
        userId: input.userId,
      });
      toolCalls.push({ name: fn.name, args: fn.args, result: out });
      fnResults.push({ name: fn.name, response: { result: out } });
    }
    response = await chat.sendMessage(
      fnResults.map((r) => ({ functionResponse: { name: r.name, response: r.response } })),
    );
  }

  if (!reply) {
    reply = response.response.text().trim() || "Sorry, I couldn't generate an answer.";
  }

  const tokensIn = Math.ceil((firstPrompt.length + JSON.stringify(toolCalls).length) / 4);
  const tokensOut = Math.ceil(reply.length / 4);

  logger.info("router.turn", {
    workspaceId: input.workspaceId,
    userId: input.userId,
    hits: allHits.length,
    toolCalls: toolCalls.length,
    tokensIn,
    tokensOut,
  });

  return {
    reply,
    toolCalls,
    usedLeadIds,
    hitsCount: allHits.length,
    tokensIn,
    tokensOut,
  };
}

// ---------- helpers ----------

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function extractFunctionCalls(
  response: GenerateContentResult,
): Array<{ name: string; args: Record<string, unknown> }> {
  const parts = response.response.candidates?.[0]?.content?.parts ?? [];
  const out: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const p of parts) {
    const fn = (p as { functionCall?: { name?: string; args?: Record<string, unknown> } }).functionCall;
    if (fn?.name) {
      out.push({ name: fn.name, args: (fn.args ?? {}) as Record<string, unknown> });
    }
  }
  return out;
}

function formatContext(
  leadHits: MemoryHit[],
  turnHits: MemoryHit[],
  offerHits: MemoryHit[],
): string {
  const parts: string[] = [];
  if (leadHits.length > 0) {
    parts.push("### Relevant leads");
    leadHits.forEach((h, i) => {
      const meta = h.metadata ?? {};
      const score = meta.opportunityScore ?? "-";
      const status = meta.status ?? "-";
      parts.push(
        `Lead ${i + 1} (${h.leadId ?? "?"}): score ${score} · ${status}\n${truncate(h.text, 400)}`,
      );
    });
  }
  if (turnHits.length > 0) {
    parts.push("### Relevant past conversation");
    turnHits.forEach((h) => {
      parts.push(`- ${truncate(h.text, 300)}`);
    });
  }
  if (offerHits.length > 0) {
    parts.push("### Workspace offer / personas");
    offerHits.forEach((h) => {
      parts.push(`- ${truncate(h.text, 400)}`);
    });
  }
  if (parts.length === 0) {
    return "(No relevant context retrieved. You may still answer questions about how the platform works.)";
  }
  return parts.join("\n\n");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 3) + "...";
}

// ---------- tool implementations ----------

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { workspaceId: string; userId: string },
): Promise<unknown> {
  try {
    switch (name) {
      case "search_leads":
        return await toolSearchLeads(ctx.workspaceId, args);
      case "semantic_search_leads":
        return await toolSemanticSearch(ctx.workspaceId, args);
      case "start_pitch_pack":
        return await toolStartPitch(ctx.workspaceId, ctx.userId, args);
      case "start_deep_research":
        return await toolStartDeepResearch(ctx.workspaceId, ctx.userId, args);
      case "find_lookalikes":
        return await toolLookalikes(ctx.workspaceId, args);
      default:
        return { error: `unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function toolSearchLeads(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ leads: unknown[] }> {
  const limit = clampInt(args.limit, 1, 50, 10);
  const hasWebsite = typeof args.hasWebsite === "boolean" ? args.hasWebsite : undefined;
  const minScore = typeof args.minOpportunityScore === "number" ? args.minOpportunityScore : undefined;
  const borough = typeof args.borough === "string" ? args.borough : undefined;
  const primaryType = typeof args.primaryType === "string" ? args.primaryType : undefined;

  const leads = await prisma.lead.findMany({
    where: {
      workspaceId,
      ...(hasWebsite !== undefined ? { hasWebsite } : {}),
      ...(borough ? { borough: { contains: borough, mode: "insensitive" } } : {}),
      ...(primaryType ? { primaryType: { contains: primaryType, mode: "insensitive" } } : {}),
      ...(minScore !== undefined
        ? { salesOpportunity: { opportunityScore: { gte: minScore } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      businessName: true,
      borough: true,
      rating: true,
      hasWebsite: true,
      salesOpportunity: { select: { opportunityScore: true, status: true } },
    },
  });

  return { leads };
}

async function toolSemanticSearch(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ hits: unknown[] }> {
  const q = typeof args.query === "string" ? args.query : "";
  const topK = clampInt(args.topK, 1, 25, 10);
  if (!q) return { hits: [] };

  const hits = await memoryQuery({
    workspaceId,
    kinds: ["LEAD_PROFILE"],
    text: q,
    topK,
  });
  return {
    hits: hits.map((h) => ({
      leadId: h.leadId,
      similarity: h.similarity,
      text: truncate(h.text, 260),
      metadata: h.metadata,
    })),
  };
}

async function toolStartPitch(
  workspaceId: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<{ sessionId: string } | { error: string }> {
  const leadId = typeof args.leadId === "string" ? args.leadId : "";
  if (!leadId) return { error: "leadId required" };

  // Verify lead belongs to workspace (cross-tenant guard).
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true },
  });
  if (!lead || lead.workspaceId !== workspaceId) {
    return { error: "lead not found in workspace" };
  }

  const { emit } = await import("./events");
  const sessionId = await emit("user_one_click_pitch", { workspaceId, userId, leadId });
  return { sessionId };
}

async function toolStartDeepResearch(
  workspaceId: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<{ sessionId: string } | { error: string }> {
  const leadId = typeof args.leadId === "string" ? args.leadId : "";
  if (!leadId) return { error: "leadId required" };

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true },
  });
  if (!lead || lead.workspaceId !== workspaceId) {
    return { error: "lead not found in workspace" };
  }

  const { emit } = await import("./events");
  const sessionId = await emit("user_deep_research", { workspaceId, userId, leadId });
  return { sessionId };
}

async function toolLookalikes(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ lookalikes: unknown[] }> {
  const leadId = typeof args.leadId === "string" ? args.leadId : "";
  const topK = clampInt(args.topK, 1, 20, 10);
  if (!leadId) return { lookalikes: [] };

  // Find this lead's LEAD_PROFILE row; use its text as a query.
  const profile = await prisma.semanticMemory.findFirst({
    where: {
      workspaceId,
      kind: "LEAD_PROFILE",
      refType: "lead",
      refId: leadId,
    },
    select: { id: true, text: true },
  });
  if (!profile) return { lookalikes: [] };

  // Query semantic memory with the profile text, exclude the source lead.
  const hits = await memoryQuery({
    workspaceId,
    kinds: ["LEAD_PROFILE"],
    text: profile.text,
    topK: topK + 1,
  });
  return {
    lookalikes: hits
      .filter((h) => h.leadId && h.leadId !== leadId)
      .slice(0, topK)
      .map((h) => ({
        leadId: h.leadId,
        similarity: h.similarity,
        metadata: h.metadata,
      })),
  };
}

function clampInt(v: unknown, lo: number, hi: number, def: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}
