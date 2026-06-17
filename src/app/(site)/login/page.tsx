import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { LoginForm } from "@/components/site/auth/login-form";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

/**
 * /login — Supabase email + Google OAuth sign-in.
 *
 * brand-assets §3.3 row "/login": single column, minimal chrome, no
 * marketing illustrations. The instrument-panel ink-1 card sits inside
 * the site layout so the nav + footer stay visible.
 */

const PATH = "/login";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Sign in to Revint",
  description:
    "Sign in with email or Google. New to Revint? The pilot starts at $500 for 30 days — book a 20-minute demo first.",
  index: false,
  follow: true,
});

export default function LoginPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Sign in", url: PATH },
        ])}
      />
      <section className="site-section pt-24 md:pt-32">
        <div className="site-container">
          <div className="mx-auto max-w-md">
            <div className="site-eyebrow mb-3">Sign in</div>
            <h1 className="text-[32px] leading-tight tracking-tight text-paper-0 md:text-[40px]">
              Welcome back.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-paper-2">
              Sign in with the email or Google account you signed up with.
              The same credentials open every workspace you belong to.
            </p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
