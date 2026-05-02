import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guards for any place in the app where we accept a user-supplied URL
 * and turn around and `fetch()` it from the server.
 *
 * Protections:
 *  - protocol allowlist (http / https only)
 *  - explicit reject of common metadata / link-local / loopback / RFC1918
 *    targets and shorthand variants
 *  - DNS resolution + per-address private-range check (defends against
 *    "127.0.0.1.nip.io" style hostnames and DNS rebinding by checking the
 *    address right before fetch)
 *
 * Returns a parsed URL on success, or throws an Error with a user-safe
 * message. The error message is intentionally vague (no internal detail)
 * because the caller forwards it to clients.
 */

export class UrlGuardError extends Error {
  constructor(message = "URL is not allowed") {
    super(message);
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIPv4(addr: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) return false;
  const [a, b] = addr.split(".").map((p) => Number(p));
  if ([a, b].some((n) => Number.isNaN(n))) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UrlGuardError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlGuardError("Only http/https URLs are allowed");
  }

  // L7 - reject URLs that carry credentials in the authority part
  // (`https://user:pass@host/`). They are a frequent SSRF /
  // credential-leak shape:
  //   - "http://attacker.example@internal-host/" is parsed by lots of
  //     middleware as host=attacker.example (the userinfo is
  //     attacker.example, host is internal-host). Some clients route
  //     differently, so the same URL can mean two different things.
  //   - Credentials in the URL get logged, cached, and forwarded in
  //     Referer headers; rejecting them at the gate means the rest
  //     of the app can assume URLs in our DB and prompts are clean.
  // We check the raw fields rather than the formatted URL because
  // `URL` decodes percent-encoded credentials transparently.
  if (parsed.username || parsed.password) {
    throw new UrlGuardError("URLs with embedded credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) throw new UrlGuardError("Invalid URL");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UrlGuardError("Hostname is not allowed");
  }
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new UrlGuardError("Hostname is not allowed");
  }

  // If the host is an IP literal, validate before any DNS round trip.
  const ipKind = isIP(hostname);
  if (ipKind === 4 && isPrivateIPv4(hostname)) {
    throw new UrlGuardError("Private addresses are not allowed");
  }
  if (ipKind === 6 && isPrivateIPv6(hostname)) {
    throw new UrlGuardError("Private addresses are not allowed");
  }
  if (ipKind === 0) {
    // Resolve to addresses and check each. We use the system resolver to
    // catch DNS-rebinding-style names that point to 127.0.0.1 / 169.254.x.x.
    try {
      const addrs = await lookup(hostname, { all: true });
      for (const a of addrs) {
        if (a.family === 4 && isPrivateIPv4(a.address)) {
          throw new UrlGuardError("Private addresses are not allowed");
        }
        if (a.family === 6 && isPrivateIPv6(a.address)) {
          throw new UrlGuardError("Private addresses are not allowed");
        }
      }
    } catch (err) {
      if (err instanceof UrlGuardError) throw err;
      throw new UrlGuardError("Hostname could not be resolved");
    }
  }

  return parsed;
}
