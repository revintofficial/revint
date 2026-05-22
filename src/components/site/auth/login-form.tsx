"use client";

import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export function LoginForm() {
  return (
    <Suspense fallback={<div className="h-[420px] rounded-2xl border border-ink-3 bg-ink-1" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
