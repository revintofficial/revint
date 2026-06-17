/**
 * Central "from"/"reply-to" configuration for transactional email.
 *
 * Production defaults to revint.dev. The values can be overridden per
 * environment via EMAIL_FROM / EMAIL_REPLY_TO so staging or preview deploys
 * can send from a distinct address without touching code.
 */

const DEFAULT_FROM = "Revint <noreply@revint.dev>";
const DEFAULT_REPLY_TO = "hello@revint.dev";

export function getFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export function getReplyToAddress(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;
}

/**
 * Dev-only redirect: when EMAIL_DEV_REDIRECT is set (e.g. your personal
 * address), every sendEmail() call routes there instead of the real
 * recipient. Lets you exercise templates end-to-end without spamming real
 * users. Ignored in production.
 */
export function getDevRedirect(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const v = process.env.EMAIL_DEV_REDIRECT?.trim();
  return v && v.includes("@") ? v : null;
}

/**
 * Public base URL used in email links (CTAs, magic links, unsubscribe).
 * Prefers NEXT_PUBLIC_APP_URL, falls back to VERCEL_URL in preview deploys,
 * then localhost for dev.
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
