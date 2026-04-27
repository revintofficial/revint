/**
 * Returns the input path only if it's safe to redirect to (i.e. a same-origin
 * relative path under our app). Falls back to the provided default otherwise.
 *
 * Rejects:
 *  - Absolute URLs ("https://evil.com")
 *  - Protocol-relative URLs ("//evil.com")
 *  - Backslash variants ("/\evil.com")
 *  - Any path that doesn't start with a single "/"
 */
export function safeNextPath(
  input: string | null | undefined,
  fallback: string = "/app/dashboard",
): string {
  if (typeof input !== "string" || input.length === 0) return fallback;

  // Must start with exactly one forward slash followed by a non-slash/non-backslash.
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//") || input.startsWith("/\\")) return fallback;

  // Disallow embedded protocol indicators just in case.
  if (/^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(input)) return fallback;

  // Allow only paths that map to our application surface.
  if (!input.startsWith("/app") && !input.startsWith("/login") && !input.startsWith("/signup")) {
    return fallback;
  }
  return input;
}
