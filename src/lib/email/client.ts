/**
 * Resend singleton. Reads RESEND_API_KEY from the environment at first call.
 *
 * In dev (NODE_ENV !== "production"), if the key is missing the client is
 * replaced with a stub that logs the payload instead of hitting the API —
 * so local development works without credentials. In production the absence
 * of the key is a hard error so we never silently drop a transactional email.
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";

export interface EmailStub {
  emails: {
    send: (payload: Record<string, unknown>) => Promise<{
      data: { id: string } | null;
      error: null;
    }>;
  };
}

let cached: Resend | EmailStub | null = null;

function buildStub(): EmailStub {
  return {
    emails: {
      send: async (payload) => {
        logger.info("email.dev_stub", {
          to: payload.to,
          subject: payload.subject,
          from: payload.from,
          hasReact: !!payload.react,
          hasHtml: !!payload.html,
        });
        return { data: { id: `dev_${Date.now()}` }, error: null };
      },
    },
  };
}

export function getResend(): Resend | EmailStub {
  if (cached) return cached;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY is not set. Transactional email cannot be sent. " +
          "Set it in your environment (Vercel / .env.production) or disable the code path.",
      );
    }
    logger.warn("email.no_api_key_dev_stub", {
      hint: "Set RESEND_API_KEY in .env to send real emails in dev.",
    });
    cached = buildStub();
    return cached;
  }

  cached = new Resend(key);
  return cached;
}

export function resetResendClient(): void {
  cached = null;
}
