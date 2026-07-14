/**
 * Anthropic (Claude) client wrapper for the Head Agent.
 *
 * The Head Agent is the FineDine "üstten bakan beyin": it reads the
 * fully-prepared deterministic substrate (audit checklist, review
 * analysis, scores, triggers, FineDine module-fit, memory) and makes
 * the final account-level sales decision. Unlike the Gemini workers it
 * does NOT gather raw data or compute the deterministic scores — those
 * stay deterministic so the leads list ordering + grounding gate are
 * stable.
 *
 * This module is the ONLY place that talks to the Anthropic SDK. Keep
 * it server-only: it reads `ANTHROPIC_API_KEY` from `process.env`
 * directly (never a top-level `env` block in next.config — that would
 * leak the secret to the client bundle, see architecture.mdc rule §3).
 *
 * Resilience: the SDK has built-in exponential backoff for 429 / 529
 * (overloaded) / 5xx via `maxRetries`, plus a hard request `timeout`.
 * We surface a thin JSON helper on top that:
 *   - injects an abort-friendly timeout,
 *   - extracts + parses the JSON payload (Claude has no native
 *     responseSchema; we instruct + parse + repair-trim code fences),
 *   - returns token usage so the caller can record `costTokens` for the
 *     AgentRun meter.
 */
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

/**
 * Default model. Overridable via `ANTHROPIC_MODEL` so we can bump to a
 * newer Claude without a code change. Keep the alias form (no date
 * suffix) so Anthropic resolves the latest snapshot of the family.
 */
const DEFAULT_MODEL = "claude-sonnet-4-5";

/** Hard ceiling on a single Head Agent synthesis call. */
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set — Head Agent cannot run. Configure it (server-only) or keep CLAUDE_HEAD_AGENT off.",
    );
    this.name = "AnthropicNotConfiguredError";
  }
}

/** True when at least one Anthropic key is configured. */
export function isAnthropicConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.ANTHROPIC_API_KEY_1?.trim(),
  );
}

function getAnthropicKey(): string {
  const key =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY_1?.trim();
  if (!key) throw new AnthropicNotConfiguredError();
  return key;
}

export function getHeadAgentModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function getClient(timeoutMs: number): Anthropic {
  // The SDK is cheap to construct, but caching keeps the keep-alive
  // agent warm across calls within a single worker process.
  if (client) return client;
  client = new Anthropic({
    apiKey: getAnthropicKey(),
    maxRetries: DEFAULT_MAX_RETRIES,
    timeout: timeoutMs,
  });
  return client;
}

/** Test-only — drops the cached client so env changes take effect. */
export function _resetAnthropicClientForTests(): void {
  client = null;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  /** Sum, for the AgentRun `costTokens` meter. */
  totalTokens: number;
}

export interface ClaudeJsonResult<T> {
  data: T;
  usage: ClaudeUsage;
  /** Raw text the model returned (pre-parse), for debugging / telemetry. */
  raw: string;
}

/**
 * Pull the first JSON object/array out of a Claude text response.
 * Claude usually obeys "return ONLY JSON" but occasionally wraps it in
 * ```json fences or adds a sentence; we strip fences and slice from the
 * first `{`/`[` to the matching last `}`/`]`.
 */
function extractJson(text: string): string {
  let t = text.trim();
  // Strip a leading ```json / ``` fence and trailing ```
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  let start = -1;
  let openCh = "{";
  let closeCh = "}";
  if (firstObj === -1 && firstArr === -1) return t;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    openCh = "[";
    closeCh = "]";
  } else {
    start = firstObj;
  }
  const end = t.lastIndexOf(closeCh);
  if (start >= 0 && end > start) {
    return t.slice(start, end + 1);
  }
  void openCh;
  return t;
}

/**
 * Single Claude call that returns parsed JSON of shape `T`.
 *
 * @throws AnthropicNotConfiguredError when no key is set.
 * @throws Error (with `cause`) on timeout / parse failure — the Head
 *   Agent caller catches this and degrades to the deterministic v2
 *   brief, so a Claude hiccup never blocks the leads list.
 */
export async function callClaudeJson<T>(args: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  label?: string;
}): Promise<ClaudeJsonResult<T>> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const label = args.label ?? "head_agent";
  const anthropic = getClient(timeoutMs);

  let msg: Anthropic.Messages.Message;
  try {
    msg = await anthropic.messages.create({
      model: getHeadAgentModel(),
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: args.temperature ?? 0.2,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });
  } catch (err) {
    logger.warn("ai_core.head_agent.claude_call_failed", {
      label,
      err: err instanceof Error ? err.message : String(err),
    });
    throw err instanceof Error ? err : new Error(String(err));
  }

  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const usage: ClaudeUsage = {
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    totalTokens: msg.usage.input_tokens + msg.usage.output_tokens,
  };

  let data: T;
  try {
    data = JSON.parse(extractJson(raw)) as T;
  } catch (err) {
    logger.warn("ai_core.head_agent.json_parse_failed", {
      label,
      rawHead: raw.slice(0, 300),
    });
    throw new Error(`${label}: failed to parse Claude JSON`, { cause: err });
  }

  return { data, usage, raw };
}

// ---------------------------------------------------------------------------
// Agentic tool-use loop (Option B)
// ---------------------------------------------------------------------------

export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeToolLoopResult {
  /** Final assistant text (post tool use) — caller parses JSON from it. */
  finalText: string;
  usage: ClaudeUsage;
  /** Number of model turns taken (1 = answered without tools). */
  rounds: number;
  /** Tool names called, in order (for telemetry). */
  toolCalls: string[];
}

function addUsage(into: ClaudeUsage, msg: Anthropic.Messages.Message): void {
  into.inputTokens += msg.usage.input_tokens;
  into.outputTokens += msg.usage.output_tokens;
  into.totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
}

/**
 * Run a bounded Claude tool-use loop. Claude may call the provided
 * read-only tools across up to `maxRounds` turns; `executeTool` runs
 * each call and the result is fed back. When the model stops requesting
 * tools (or the round budget is exhausted) we force a final tool-free
 * turn so it must answer. Token usage is summed across every turn.
 *
 * @throws AnthropicNotConfiguredError when no key is set.
 * @throws Error on transport failure — caller degrades gracefully.
 */
export async function runClaudeToolLoop(args: {
  system: string;
  initialUser: string;
  tools: ClaudeToolDef[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  maxRounds?: number;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  label?: string;
}): Promise<ClaudeToolLoopResult> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRounds = args.maxRounds ?? 5;
  const label = args.label ?? "head_agent_loop";
  const anthropic = getClient(timeoutMs);
  const model = getHeadAgentModel();
  const tools = args.tools as unknown as Anthropic.Tool[];

  const usage: ClaudeUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const toolCalls: string[] = [];
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: args.initialUser },
  ];

  let rounds = 0;
  let lastText = "";

  for (let i = 0; i < maxRounds; i++) {
    rounds++;
    let msg: Anthropic.Messages.Message;
    try {
      msg = await anthropic.messages.create({
        model,
        max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: args.temperature ?? 0.2,
        system: args.system,
        tools,
        messages,
      });
    } catch (err) {
      logger.warn("ai_core.head_agent.loop_call_failed", {
        label,
        round: rounds,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err instanceof Error ? err : new Error(String(err));
    }
    addUsage(usage, msg);

    lastText = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (msg.stop_reason !== "tool_use") {
      return { finalText: lastText, usage, rounds, toolCalls };
    }

    // Record the assistant turn (must precede the tool_result user turn).
    messages.push({ role: "assistant", content: msg.content });

    const toolUses = msg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      toolCalls.push(tu.name);
      let resultText: string;
      try {
        const out = await args.executeTool(
          tu.name,
          (tu.input ?? {}) as Record<string, unknown>,
        );
        resultText = JSON.stringify(out ?? null);
      } catch (err) {
        resultText = JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: resultText,
      });
    }
    messages.push({ role: "user", content: results });
  }

  // Round budget exhausted while still requesting tools — force a final
  // tool-free turn so the model must commit to an answer.
  messages.push({
    role: "user",
    content:
      "You have gathered enough data. Do NOT call any more tools. Return the final decision JSON now.",
  });
  try {
    const finalMsg = await anthropic.messages.create({
      model,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: args.temperature ?? 0.2,
      system: args.system,
      messages,
    });
    addUsage(usage, finalMsg);
    rounds++;
    lastText = finalMsg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    logger.warn("ai_core.head_agent.loop_final_failed", {
      label,
      err: err instanceof Error ? err.message : String(err),
    });
    throw err instanceof Error ? err : new Error(String(err));
  }

  return { finalText: lastText, usage, rounds, toolCalls };
}

/** Parse a JSON object/array of shape `T` out of free Claude text. */
export function parseClaudeJson<T>(text: string, label = "head_agent"): T {
  try {
    return JSON.parse(extractJson(text)) as T;
  } catch (err) {
    logger.warn("ai_core.head_agent.json_parse_failed", {
      label,
      rawHead: text.slice(0, 300),
    });
    throw new Error(`${label}: failed to parse Claude JSON`, { cause: err });
  }
}
