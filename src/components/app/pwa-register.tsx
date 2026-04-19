/**
 * P0.6 - PWA service worker register.
 *
 * Production: registers /sw.js and clears stale caches.
 * Development: actively UNREGISTERS any previously installed SW + nukes its
 * caches. Without this, a SW installed in a previous prod build keeps
 * intercepting fetches in dev (cache-first responses, stale HTML, navigation
 * throttle from infinite redirect loops between auth pages and the app shell).
 *
 * Symptom this fixes: "Log in" or "Start free" click goes to a black screen
 * and Chrome logs `Throttling navigation to prevent the browser from hanging`.
 */

"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      // Defensive: if a previous prod build registered a SW, kill it now.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then((unregistered) => {
          if (unregistered.some(Boolean) && "caches" in window) {
            return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
          }
        })
        .catch(() => {
          // ignore - dev only cleanup, browser will handle on next reload
        });
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[PWA] SW registration failed:", err);
      });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
