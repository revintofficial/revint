import { describe, expect, it } from "vitest";
import {
  buildAppLogFilter,
  capLogFields,
  clipEvent,
  normaliseLogLevel,
  normaliseLogQuery,
  normaliseLogSource,
  retentionCutoff,
  shouldPersistLogs,
  sourceLabel,
  summarizeLogFields,
  scrubLogText,
  APP_LOG_RETENTION_MS,
} from "@/lib/app-log";

describe("app log drain helpers", () => {
  it("does not persist during tests", () => {
    expect(shouldPersistLogs()).toBe(false);
  });

  it("keeps a 48 hour window", () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    expect(retentionCutoff(now).toISOString()).toBe(
      new Date(now.getTime() - APP_LOG_RETENTION_MS).toISOString(),
    );
    expect(APP_LOG_RETENTION_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("summarizes error objects and plain messages", () => {
    expect(
      summarizeLogFields({
        err: { name: "Error", message: "connection reset" },
      }),
    ).toBe("connection reset");
    expect(summarizeLogFields({ message: "queue stalled" })).toBe(
      "queue stalled",
    );
    expect(summarizeLogFields({ leadId: "abc" })).toBeNull();
  });

  it("caps oversized field payloads", () => {
    const fields = { blob: "x".repeat(9_000) };
    const capped = capLogFields(fields);
    expect(capped.truncated).toBe(true);
    expect(String(capped.preview).length).toBeLessThanOrEqual(8_000);
    expect(capLogFields({ leadId: "abc" })).toEqual({ leadId: "abc" });
  });

  it("clips event names and ignores unknown filters", () => {
    expect(clipEvent(`evt.${"a".repeat(300)}`).length).toBe(200);
    expect(normaliseLogLevel("error")).toBe("error");
    expect(normaliseLogLevel("fatal")).toBeNull();
    expect(normaliseLogSource("worker")).toBe("worker");
    expect(normaliseLogSource("vercel")).toBeNull();
    expect(normaliseLogQuery("  gemini  ")).toBe("gemini");
  });

  it("builds a retention-scoped filter with search", () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    const filter = buildAppLogFilter({
      level: "warn",
      source: "web",
      q: "email.send",
      now,
    });
    expect(filter.level).toBe("warn");
    expect(filter.source).toBe("web");
    expect(filter.createdAt.gte.toISOString()).toBe(
      retentionCutoff(now).toISOString(),
    );
    expect(filter.OR).toEqual([
      { event: { contains: "email.send", mode: "insensitive" } },
      { message: { contains: "email.send", mode: "insensitive" } },
    ]);
  });

  it("labels the two runtimes the founder switches between", () => {
    expect(sourceLabel("web")).toBe("Vercel");
    expect(sourceLabel("web", "local")).toBe("App (local)");
    expect(sourceLabel("worker")).toBe("Railway");
    expect(sourceLabel("worker", "local")).toBe("Worker (local)");
  });

  it("scrubs database passwords and secret keys from stored text", () => {
    expect(
      scrubLogText("postgres://user:supersecret@db.example:5432/app"),
    ).toBe("postgres://user:***@db.example:5432/app");
    expect(scrubLogText("key sk_live_abc123")).toBe("key [redacted]");
  });
});
