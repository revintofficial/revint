/** Delivery marketplaces (commission) versus a venue's own ordering. */
import { orderingVendorFor } from "@/lib/restaurant-vendors";

const MARKETPLACES: Array<[RegExp, string]> = [
  [/deliveroo/i, "Deliveroo"],
  [/uber[\s-]?eats/i, "Uber Eats"],
  // Uber Eats' Singular short links (eats.sng.link/...) 302 to ubereats.com.
  [/\beats\.sng\.link\b/i, "Uber Eats"],
  [/just[\s-]?eat/i, "Just Eat"],
  [/doordash/i, "DoorDash"],
  [/grubhub/i, "Grubhub"],
  [/\bwolt\b/i, "Wolt"],
  [/foodpanda/i, "foodpanda"],
  [/yemeksepeti/i, "Yemeksepeti"],
  [/\bgetir\b/i, "Getir"],
  [/talabat/i, "Talabat"],
  [/trendyol/i, "Trendyol Yemek"],
];

/** Marketplace name for a URL or a label; `null` when it is not one. */
export function deliveryPlatformFor(text: string): string | null {
  for (const [re, name] of MARKETPLACES) if (re.test(text)) return name;
  return null;
}

/** White-label ordering vendors: the venue owns the order, no marketplace. */
export function isDirectOrderingHost(host: string): boolean {
  return orderingVendorFor(host) !== null || /(^|\.)order\.store$/i.test(host);
}
