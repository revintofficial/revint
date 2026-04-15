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
          actionButton: "bg-gradient-to-r from-[#0A84FF] to-[#007AFF] text-white rounded-lg text-xs font-medium",
          cancelButton: "rounded-lg text-xs font-medium",
          closeButton: "hover:opacity-100",
        },
        style: {
          background: "rgba(28, 28, 30, 0.95)",
          backdropFilter: "saturate(180%) blur(20px)",
          border: "0.5px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
          color: "#FFFFFF",
        },
      }}
    />
  );
}
