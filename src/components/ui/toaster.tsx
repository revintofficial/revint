"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "rounded-xl text-white",
          title: "text-sm font-semibold",
          description: "text-sm",
          actionButton: "bg-gradient-to-r from-(--leadac-500) to-(--leadac-600) text-white rounded-lg text-xs font-medium",
          cancelButton: "rounded-lg text-xs font-medium",
          closeButton: "hover:opacity-100",
        },
        style: {
          background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.95)",
          backdropFilter: "saturate(180%) blur(20px)",
          border: "0.5px solid hsl(0 0% 100% / 0.12)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
          color: "var(--leadac-text-1)",
        },
      }}
    />
  );
}
