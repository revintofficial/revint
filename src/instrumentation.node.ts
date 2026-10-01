import { logger } from "@/lib/logger";
import { flushAppLogs, installConsoleCapture } from "@/lib/log-sink";
import { validateEnvOnBoot } from "@/lib/env-check";

installConsoleCapture();
// Web only warns on missing env; workers fail fast (see env-check.ts).
if (process.env.NEXT_PHASE !== "phase-production-build") {
  validateEnvOnBoot("web");
}

type RequestInfo = {
  path: string;
  method: string;
};

type RequestContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export async function captureRequestError(
  error: unknown,
  request: RequestInfo,
  context: RequestContext,
): Promise<void> {
  const digest =
    error && typeof error === "object" && "digest" in error
      ? (error as { digest?: unknown }).digest
      : undefined;
  logger.error("next.request_error", {
    err: error,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    digest,
  });
  await flushAppLogs();
}
