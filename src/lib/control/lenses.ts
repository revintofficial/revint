import type { ReviewLens } from "@/generated/prisma/client";
export const LENSES: ReviewLens[] = ["TECHNICAL", "DOMAIN", "SALES"];
export const LENS_LABELS: Record<ReviewLens, string> = { TECHNICAL: "Teknik", DOMAIN: "Alan", SALES: "Satış" };
type LensRowLike = { lens: string | null; createdAt: Date | string; source?: string | null };
/** Only LENS-source rows count. SDR and ADJUDICATION rows carry lens = null; a row read without `source` is treated as a lens row. */
function isLensRow(r: LensRowLike): boolean {
 return r.lens != null && (r.source == null || r.source === "LENS");
}
export function currentLensReviews<T extends LensRowLike>(reviews: T[]): T[] {
 return LENSES.flatMap(lens => {
   const latest = reviews.filter(r => isLensRow(r) && r.lens === lens).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
   return latest ? [latest] : [];
 });
}
export function missingLenses(reviews: LensRowLike[]): ReviewLens[] {
 const present = new Set(currentLensReviews(reviews).map(r => r.lens));
 return LENSES.filter(lens => !present.has(lens));
}
