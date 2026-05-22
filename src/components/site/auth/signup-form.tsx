"use client";

import { Suspense } from "react";
import { AuthForm } from "./auth-form";

export function SignupForm() {
  return (
    <Suspense fallback={<div className="h-[480px] rounded-2xl border border-ink-3 bg-ink-1" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
