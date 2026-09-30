import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-errors";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/auth";
import { requireControlRole, type ControlRole } from "@/lib/control/roles";

export async function readControlBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function controlString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === "string" ? body[key] : "";
}

export function withControlAuth<T extends unknown[]>(
  minimumRole: ControlRole,
  handler: (actor: Awaited<ReturnType<typeof requireControlRole>>, ...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      const actor = await requireControlRole(minimumRole);
      return await handler(actor, ...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
      if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
      return internalError("control.handler", error);
    }
  };
}
