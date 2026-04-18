import { Suspense } from "react";
import { AuthForm } from "@/components/marketing/auth-form";

export const metadata = {
  title: "Log in — Lead Engine",
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
