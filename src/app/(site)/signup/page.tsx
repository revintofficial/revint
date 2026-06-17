import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SignupForm } from "@/components/site/auth/signup-form";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

/**
 * /signup — Supabase email + Google OAuth sign-up.
 *
 * Sales-led model — most teams hit /demo first. Self-serve sign-up is
 * here for the trickle of operators who want to poke at the dashboard
 * before booking. The CTA on every public page still points to /demo.
 */

const PATH = "/signup";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Create a Revint workspace",
  description:
    "Create your Revint workspace. Most teams start with a 20-minute demo first — the pilot fee covers the same evaluation with a live walkthrough.",
  index: false,
  follow: true,
});

export default function SignupPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Sign up", url: PATH },
        ])}
      />
      <section className="site-section pt-24 md:pt-32">
        <div className="site-container">
          <div className="mx-auto max-w-md">
            <div className="site-eyebrow mb-3">Create workspace</div>
            <h1 className="text-[32px] leading-tight tracking-tight text-paper-0 md:text-[40px]">
              Set up the workspace.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-paper-2">
              We&apos;re sales-led — most teams book a 20-minute demo first.
              If you want to poke at the dashboard before that, this is the
              door. The pilot fee starts the day you connect HubSpot.
            </p>
            <div className="mt-8">
              <SignupForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
