// src/lib/restaurant-vendors.ts
/**
 * Host fingerprints for restaurant software a venue's links or redirects
 * land on: digital / QR menu vendors and white-label ordering vendors.
 * Marketplaces (commission delivery apps) live in `delivery-platforms.ts`.
 *
 * Each entry was seen on a real lead site during the 2026-10 website-audit
 * eval, or is the vendor's documented customer-facing host. See
 * docs/research/2026-10-03-website-audit-research.md.
 */

interface Vendor {
  name: string;
  /** Host (and its subdomains). */
  hosts: string[];
}

const MENU_VENDORS: Vendor[] = [
  { name: "FineDine", hosts: ["finedinemenu.com"] },
  { name: "Menuzade", hosts: ["menuzade.com.tr", "menuzade.com"] },
  { name: "MenuTiger", hosts: ["menutiger.com"] },
  { name: "Mr Yum", hosts: ["mryum.com"] },
  { name: "me&u", hosts: ["meandu.app", "meandu.com"] },
  { name: "Sunday", hosts: ["sundayapp.io", "sundayapp.com"] },
  { name: "Qlub", hosts: ["qlub.io", "qlub.cloud"] },
  { name: "Yoello", hosts: ["yoello.com"] },
  { name: "PlumQR", hosts: ["plumqr.com"] },
];

const ORDERING_VENDORS: Vendor[] = [
  { name: "Flipdish", hosts: ["flipdish.com", "flipdish.io"] },
  { name: "GloriaFood", hosts: ["gloriafood.com", "foodbooking.com"] },
  { name: "Slerp", hosts: ["slerp.com"] },
  { name: "OrderYOYO", hosts: ["orderyoyo.com"] },
  { name: "Oddle", hosts: ["oddle.me"] },
  { name: "Orderswift", hosts: ["orderswift.com"] },
  { name: "Storekit", hosts: ["storekit.com"] },
  { name: "Vita Mojo", hosts: ["vmos.io", "vitamojo.com"] },
  { name: "Toast", hosts: ["toasttab.com"] },
  { name: "Square Online", hosts: ["square.site"] },
  { name: "Mobi2Go", hosts: ["mobi2go.com"] },
  // sun-d.io/<id> 302s to sundayapp.io/click-and-collect/... (Purezza).
  { name: "Sunday", hosts: ["sun-d.io", "sundayapp.io"] },
];

function hostIn(host: string, hosts: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return hosts.some((v) => h === v || h.endsWith(`.${v}`));
}

/** Digital / QR menu vendor for a host, or `null`. */
export function menuVendorFor(host: string): string | null {
  return MENU_VENDORS.find((v) => hostIn(host, v.hosts))?.name ?? null;
}

/** White-label ordering vendor for a host (the venue owns the order), or `null`. */
export function orderingVendorFor(host: string): string | null {
  return ORDERING_VENDORS.find((v) => hostIn(host, v.hosts))?.name ?? null;
}
