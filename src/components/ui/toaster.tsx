"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "bg-white/90 backdrop-blur-2xl border border-white/30 shadow-[0_16px_48px_rgba(0,0,0,0.12)] rounded-xl text-slate-900",
          title: "text-sm font-semibold",
          description: "text-sm text-slate-500",
          actionButton:
            "bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg text-xs font-medium",
          cancelButton: "bg-slate-100 text-slate-600 rounded-lg text-xs font-medium",
          closeButton: "text-slate-400 hover:text-slate-600",
        },
      }}
    />
  );
}
