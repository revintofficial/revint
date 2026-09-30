import type { ReviewLens } from "@/generated/prisma/client";
export const LENSES: ReviewLens[] = ["TECHNICAL", "DOMAIN", "SALES"];
export const LENS_LABELS: Record<ReviewLens, string> = { TECHNICAL: "Teknik", DOMAIN: "Alan", SALES: "Satış" };
export function currentLensReviews<T extends { lens: string | null; createdAt: Date | string }>(reviews: T[]): T[] {
 return LENSES.flatMap(lens => {
   const latest = reviews.filter(r => r.lens === lens).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
   return latest ? [latest] : [];
 });
}
export function missingLenses(reviews: { lens: string | null; createdAt: Date | string }[]): ReviewLens[] {
 const present = new Set(currentLensReviews(reviews).map(r => r.lens));
 return LENSES.filter(lens => !present.has(lens));
}
