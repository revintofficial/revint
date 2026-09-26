export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
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

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: RequestContext,
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const mod = await import("./instrumentation.node");
    await mod.captureRequestError(error, request, context);
  }
}
