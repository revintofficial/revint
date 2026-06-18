import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OnboardingWizard } from "@/components/app/onboarding/onboarding-wizard";

/**
 * Calibration-first onboarding. The OWNER-only gate in
 * `src/app/app/layout.tsx` routes incomplete owners here. The wizard
 * hydrates from GET /api/onboarding/state, so a refresh resumes on the
 * right step. Wrapped in Suspense because the wizard reads useSearchParams.
 */
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}
