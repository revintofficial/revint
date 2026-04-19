/**
 * URL-safe slug from any string. ASCII-only output (no diacritics, no emoji),
 * lowercase, hyphen-separated, max 60 chars.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Append the last 6 chars of a cuid to a slug to disambiguate. Same business
 * name in the same city stays unique without a database lookup.
 */
export function slugWithSuffix(input: string, id: string): string {
  const base = slugify(input);
  const suffix = id.slice(-6).toLowerCase();
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * Pull the trailing 6-char id back out of a slug.
 */
export function extractIdSuffix(slug: string): string | null {
  const m = slug.match(/-([a-z0-9]{6})$/);
  return m ? m[1] : null;
}
