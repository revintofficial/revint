/**
 * P0.4 - Email verification katmanı.
 *
 * ZeroBounce entegrasyonu (karar §7.1: ZeroBounce, $0.0008/email at scale,
 * NeverBounce'tan 10x ucuz volume büyüdükçe).
 *
 * Şu sınıflandırma için kullanılır:
 *   - "valid"      → verified=true, CSV export'a girer (default)
 *   - "invalid"    → verified=false, CSV export'a girmez
 *   - "catch-all"  → verified=false (riskli, opt-in raw mode'da görünür)
 *   - "spamtrap"   → verified=false (kesinlikle gönderme)
 *   - "unknown"    → verified=false (provider cevap veremedi)
 *
 * NOT: API key boşsa graceful degradation - tüm email'leri "unknown" işaretle
 * ve worker silently skip etsin. Bu sayede dev/test ortamında engel olmaz.
 *
 * Test API key: zerobounce.net hesabında ayda 100 free verification var.
 * Production için ZEROBOUNCE_API_KEY env var'ı set edilmeli.
 */

const ZEROBOUNCE_API_BASE = "https://api.zerobounce.net/v2";

export type VerificationStatus =
  | "valid"
  | "invalid"
  | "catch-all"
  | "spamtrap"
  | "abuse"
  | "do_not_mail"
  | "unknown";

export interface EmailVerificationResult {
  email: string;
  verified: boolean;
  status: VerificationStatus;
  subStatus?: string | null;
  verifiedAt: string;
  freeMail?: boolean;
  rawProvider?: string;
}

interface ZeroBounceResponse {
  address: string;
  status:
    | "valid"
    | "invalid"
    | "catch-all"
    | "unknown"
    | "spamtrap"
    | "abuse"
    | "do_not_mail";
  sub_status?: string;
  free_email?: boolean;
  did_you_mean?: string | null;
  account?: string;
  domain?: string;
  domain_age_days?: string;
  smtp_provider?: string;
  mx_record?: string;
}

export class EmailVerificationConfigError extends Error {
  constructor(message = "ZeroBounce API key not set") {
    super(message);
  }
}

export function isVerificationConfigured(): boolean {
  return !!process.env.ZEROBOUNCE_API_KEY?.trim();
}

/**
 * Verify a single email via ZeroBounce. Returns "unknown" if API not configured.
 * Throws on network/auth errors; returns "unknown" on parse errors.
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const apiKey = process.env.ZEROBOUNCE_API_KEY?.trim();
  const now = new Date().toISOString();

  if (!apiKey) {
    return { email, verified: false, status: "unknown", verifiedAt: now };
  }

  const url = `${ZEROBOUNCE_API_BASE}/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[EmailVerification] ZeroBounce returned ${res.status} for ${email}`);
      return { email, verified: false, status: "unknown", verifiedAt: now };
    }

    const data = (await res.json()) as ZeroBounceResponse;

    return {
      email,
      verified: data.status === "valid",
      status: data.status as VerificationStatus,
      subStatus: data.sub_status ?? null,
      verifiedAt: now,
      freeMail: data.free_email,
      rawProvider: data.smtp_provider,
    };
  } catch (err) {
    console.warn(`[EmailVerification] Failed for ${email}:`, err);
    return { email, verified: false, status: "unknown", verifiedAt: now };
  }
}

/**
 * Verify a batch of emails sequentially. ZeroBounce supports a paid bulk endpoint,
 * but for the launch we keep it simple and rate-limit ourselves to ~5 req/sec.
 */
export async function verifyEmailBatch(
  emails: string[],
): Promise<EmailVerificationResult[]> {
  const out: EmailVerificationResult[] = [];
  for (const email of emails) {
    const result = await verifyEmail(email);
    out.push(result);
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

/**
 * Default-safe filter: returns only emails that came back "valid" from the
 * verifier. Used by CSV export and direct email send.
 *
 * If `allowRaw` is true (Pro Team / Agency tier opt-in), returns all emails
 * including unknowns and catch-alls.
 */
export function filterVerifiedEmails(
  results: EmailVerificationResult[],
  options: { allowRaw?: boolean } = {},
): string[] {
  if (options.allowRaw) {
    return results.map((r) => r.email);
  }
  return results.filter((r) => r.verified && r.status === "valid").map((r) => r.email);
}
