"use client";

import { useEffect } from "react";

/**
 * When the URL hash matches `#lead-<id>`, scroll the matching DOM node into
 * view and briefly highlight it. Used by Shortlist and Pipeline pages so
 * deep-links from the command palette land on the right card.
 *
 * Requires the cards to render with `id={"lead-" + leadId}`.
 *
 * The `ready` flag should be set once the list has finished loading so we
 * don't run before the target node exists in the DOM.
 */
export function useScrollToLeadHash(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;

    function scrollToHash() {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith("#lead-")) return;
      const id = hash.slice(1);
      // Defer to next frame so freshly-mounted cards are in the DOM.
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-[#0A84FF]", "ring-offset-2", "ring-offset-black");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-[#0A84FF]", "ring-offset-2", "ring-offset-black");
        }, 2400);
      });
    }

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [ready]);
}
