/**
 * Steel session factory.
 *
 * Spins up a cloud Chromium tuned for video capture: 16:9 native resolution
 * at 2x DPR, no proxy, no captcha solving, no ad blocking (we control the
 * pages). Connects Playwright over CDP and returns the live page handle.
 *
 * The session viewer URL is logged so you can watch the recording happen
 * in the Steel dashboard while iterating on a scenario.
 */
import Steel from "steel-sdk";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { requireEnv } from "./env-check";

export interface SessionHandle {
  steel: Steel;
  sessionId: string;
  sessionViewerUrl: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  release: () => Promise<void>;
}

export interface SessionOptions {
  /** Width in CSS pixels. Default 1920 (16:9 master). */
  width?: number;
  /** Height in CSS pixels. Default 1080. */
  height?: number;
  /** Device pixel ratio. Default 2 for retina-quality screencast. */
  dpr?: number;
  /** Session timeout in ms. Default 10 minutes. */
  timeoutMs?: number;
  /** Region. Default closest to the user (lax for US-West, fra for EU). */
  region?: "lax" | "ord" | "iad" | "scl" | "fra" | "nrt";
}

export async function createSession(opts: SessionOptions = {}): Promise<SessionHandle> {
  const env = requireEnv();
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const dpr = opts.dpr ?? 2;
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;

  const steel = new Steel({ steelAPIKey: env.steelApiKey });

  console.log(`[steel] requesting session ${width}x${height} @${dpr}x...`);
  const session = await steel.sessions.create({
    sessionTimeout: timeoutMs,
    dimensions: { width, height },
    deviceConfig: { deviceScaleFactor: dpr },
    blockAds: false,
    solveCaptcha: false,
    region: opts.region,
  });

  console.log(`[steel] session ${session.id} live`);
  console.log(`[steel] viewer: ${session.sessionViewerUrl}`);

  // Steel returns the websocket URL without the API key query param,
  // but connectOverCDP needs it appended for auth. Append safely whether
  // or not other params are already present.
  const wsUrl = session.websocketUrl.includes("?")
    ? `${session.websocketUrl}&apiKey=${env.steelApiKey}`
    : `${session.websocketUrl}?apiKey=${env.steelApiKey}`;

  const browser = await chromium.connectOverCDP(wsUrl);
  const context = browser.contexts()[0]!;
  const page = (await context.pages())[0] ?? (await context.newPage());

  // Disable Playwright's default test-mode timeouts for video work.
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);

  return {
    steel,
    sessionId: session.id,
    sessionViewerUrl: session.sessionViewerUrl,
    browser,
    context,
    page,
    release: async () => {
      try {
        await browser.close();
      } catch {
        // Ignored — session is already being released by Steel.
      }
      await steel.sessions.release(session.id).catch(() => undefined);
      console.log(`[steel] session ${session.id} released`);
    },
  };
}
