/**
 * EN dictionary stub — phase 1 default locale.
 *
 * Keep this small: we only prep the shape so phase 2 can drop in a
 * sibling `src/i18n/tr/common.ts` without any key surprises.
 *
 * New entries should be added alphabetically. Every addition to this file
 * is a contract — a key missing in `tr/common.ts` after phase 2 flips on
 * is a bug that the CI seo:validate step will catch.
 */

export const common = {
  nav: {
    pricing: "Pricing",
    forAgencies: "For agencies",
    forSmma: "For SMMA",
    forSpecialists: "For specialists",
    blog: "Blog",
    glossary: "Glossary",
    tools: "Tools",
    login: "Log in",
    signup: "Sign up",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    status: "Status",
    about: "About",
  },
  cta: {
    getStarted: "Get started",
    bookDemo: "Book a demo",
    seePricing: "See pricing",
  },
} as const;

type _Raw = typeof common;
type Widen<T> = T extends string
  ? string
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<Widen<U>>
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type CommonDictionary = Widen<_Raw>;
