import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/auth";
import { getRequestRedis } from "@/lib/redis";
import { WORKER_HEARTBEAT_KEY } from "@/workers/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 1500;

/**
 * Minimal health probe: DB (`SELECT 1`) + Redis (`PING`), each bounded by
 * a short timeout so the probe itself never hangs.
 *
 * Unauthenticated callers get a bare `{ ok }` with 200 or 503. Operators
 * listed in HEALTH_ADMIN_EMAILS (comma-separated) get a verbose payload,
 * including the age of the last worker heartbeat (see
 * src/workers/heartbeat.ts). Nothing about the environment is revealed to
 * anonymous clients.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function checkDb(): Promise<boolean> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<{ ok: boolean; workerHeartbeatAgeSec: number | null }> {
  try {
    const redis = getRequestRedis();
    const pong = await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    let workerHeartbeatAgeSec: number | null = null;
    try {
      const raw = await withTimeout(redis.get(WORKER_HEARTBEAT_KEY), CHECK_TIMEOUT_MS);
      if (raw) {
        const ts = Date.parse((JSON.parse(raw) as { ts?: string }).ts ?? "");
        if (Number.isFinite(ts)) workerHeartbeatAgeSec = Math.round((Date.now() - ts) / 1000);
      }
    } catch {
      workerHeartbeatAgeSec = null;
    }
    return { ok: pong === "PONG", workerHeartbeatAgeSec };
  } catch {
    return { ok: false, workerHeartbeatAgeSec: null };
  }
}

export async function GET() {
  const adminEmails = (process.env.HEALTH_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const [dbOk, redis] = await Promise.all([checkDb(), checkRedis()]);
  const ok = dbOk && redis.ok;
  const status = ok ? 200 : 503;

  let isAdmin = false;
  if (adminEmails.length > 0) {
    try {
      const session = await getOptionalUser();
      isAdmin = session !== null && adminEmails.includes(session.user.email.toLowerCase());
    } catch {
      isAdmin = false;
    }
  }

  if (!isAdmin) {
    // Opaque response. Uptime checks should look at the HTTP status.
    return NextResponse.json({ ok }, { status });
  }

  return NextResponse.json(
    {
      ok,
      db: dbOk ? "ok" : "unreachable",
      redis: redis.ok ? "ok" : "unreachable",
      workerHeartbeatAgeSec: redis.workerHeartbeatAgeSec,
      ts: new Date().toISOString(),
    },
    { status },
  );
}
