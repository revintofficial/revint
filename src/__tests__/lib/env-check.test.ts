import { describe, expect, it, vi } from "vitest";
import { checkEnv, validateEnvOnBoot } from "@/lib/env-check";

const WORKER_OK = {
  DATABASE_URL: "postgres://x",
  REDIS_URL: "redis://x",
  GEMINI_API_KEY_1: "k",
} as unknown as NodeJS.ProcessEnv;

describe("env-check", () => {
  it("accepts any alternative of a requirement", () => {
    expect(checkEnv("worker", WORKER_OK).missing).toEqual([]);
  });

  it("reports missing and blank vars", () => {
    const env = { ...WORKER_OK, REDIS_URL: "  " } as NodeJS.ProcessEnv;
    expect(checkEnv("worker", env).missing).toEqual(["REDIS_URL"]);
  });

  it("throws for workers in production, warns otherwise", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const prod = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(() => validateEnvOnBoot("worker", prod)).toThrow(/DATABASE_URL/);
    expect(() => validateEnvOnBoot("web", prod)).not.toThrow();
    expect(() => validateEnvOnBoot("worker", { NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
    expect(err).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
