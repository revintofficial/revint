/**
 * Polled CDP screenshot recorder.
 *
 * Why polling instead of Page.startScreencast:
 *   - startScreencast only emits frames when the renderer dirties the
 *     compositor. A static page emits nothing after the first paint, which
 *     is exactly the wrong behaviour for filming a UI that's intentionally
 *     idle for parts of the take.
 *   - Page.captureScreenshot is on-demand: we ask, we get a frame. By
 *     looping at the target FPS we get a guaranteed-cadence sequence.
 *
 * Throughput on Steel (US-East): ~25-50 fps for 1920x1080 PNG, depending
 * on instance load. Below 30fps we hit a small risk of frame drops, but
 * Remotion can interpolate between sparse frames if needed.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Page } from "playwright";

export interface RecordHandle {
  outDir: string;
  framesWritten: () => number;
  stop: () => Promise<number>;
}

interface RecordOptions {
  /** Target frames per second. With Steel network latency JPEG @1080p hits ~12-15fps reliably. */
  fps?: number;
  /** Image format. JPEG is 5-10x faster over the wire than PNG; quality 92 is broadcast-clean. */
  format?: "png" | "jpeg";
  /** JPEG quality (0-100), ignored for PNG. */
  quality?: number;
  /** Concurrent in-flight CDP screenshot calls. Higher = better RTT masking, but uses more browser CPU. */
  concurrency?: number;
}

export async function startRecording(
  page: Page,
  outDir: string,
  options: RecordOptions = {},
): Promise<RecordHandle> {
  const fps = options.fps ?? 15;
  const format = options.format ?? "jpeg";
  const quality = options.quality ?? 92;
  const concurrency = options.concurrency ?? 3;

  await fs.mkdir(outDir, { recursive: true });

  const cdp = await page.context().newCDPSession(page);

  let frames = 0;
  let stopped = false;
  const pending = new Set<Promise<void>>();

  const interval = Math.max(1000 / fps, 16);
  console.log(
    `[rec] streaming → ${outDir} @${fps}fps target (${format}, c=${concurrency})`,
  );

  const grab = async () => {
    if (stopped) return;
    const idx = frames++;
    const t0 = Date.now();
    try {
      const result = await cdp.send("Page.captureScreenshot", {
        format,
        quality: format === "jpeg" ? quality : undefined,
        captureBeyondViewport: false,
        fromSurface: true,
      });
      const buf = Buffer.from(result.data, "base64");
      const filepath = path.join(
        outDir,
        `frame_${String(idx).padStart(5, "0")}.${format}`,
      );
      await fs.writeFile(filepath, buf);
      const dt = Date.now() - t0;
      if (idx % 15 === 0) {
        process.stdout.write(
          `\r[rec] frame ${String(idx).padStart(4, "0")} (last grab ${dt}ms, in-flight ${pending.size})    `,
        );
      }
    } catch (e) {
      if (!stopped) {
        console.error(`\n[rec] grab ${idx} failed:`, (e as Error).message);
      }
    }
  };

  let timer: NodeJS.Timeout | null = setInterval(() => {
    if (pending.size >= concurrency) return; // back-pressure
    const p = grab();
    pending.add(p);
    p.finally(() => pending.delete(p));
  }, interval);

  return {
    outDir,
    framesWritten: () => frames,
    stop: async () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      await Promise.all(Array.from(pending));
      await cdp.detach().catch(() => undefined);
      process.stdout.write("\n");
      console.log(`[rec] stopped after ${frames} frames`);
      return frames;
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
