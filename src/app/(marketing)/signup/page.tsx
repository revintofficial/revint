import { Suspense } from "react";
import { AuthForm } from "@/components/marketing/auth-form";

export const metadata = {
  title: "Sign up — Lead Engine",
};

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
