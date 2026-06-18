"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Package, ArrowRightCircle, X, Plug, Search } from "lucide-react";
import type { LeadListItem } from "./useLeadsQuery";
import { trackOnboarding } from "@/lib/analytics/onboarding";

/**
 * Contextual post-onboarding tutorial overlaid on the real Leads list.
 * Explains the three signals Revint calibrated for (ICP fit, recommended
 * package, next best action), surfaces a HubSpot-skipped empty state, and
 * fires `first_analyzed_lead_visible` the moment an analyzed lead appears.
 */
export function OnboardingTutorial({
  leads,
  loading,
  hubspotSkipped,
  onDismiss,
}: {
  leads: LeadListItem[];
  loading: boolean;
  hubspotSkipped: boolean;
  onDismiss: () => void;
}) {
  const firedRef = useRef(false);

  const hasAnalyzedLead = leads.some(
    (l) => l.salesOpportunity != null || l.salesConfidence != null,
  );

  useEffect(() => {
    if (hasAnalyzedLead && !firedRef.current) {
      firedRef.current = true;
      trackOnboarding("first_analyzed_lead_visible");
    }
  }, [hasAnalyzedLead]);

  const isEmpty = !loading && leads.length === 0;

  return (
    <Card className="border-(--revint-500)/30 bg-(--revint-500)/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-(--revint-text-1)">
              {isEmpty ? "Your workspace is calibrated" : "Here's what Revint calibrated for you"}
            </h3>
            <p className="text-[12.5px] text-(--revint-text-2) mt-0.5">
              {isEmpty
                ? "Bring in leads and Revint will score and route each one automatically."
                : "Every lead below is scored against your ICP and matched to the right package."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label="Dismiss tutorial"
            className="text-white/40 hover:text-white/70 shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {isEmpty ? (
          <div className="flex flex-col sm:flex-row gap-2">
            {hubspotSkipped && (
              <Button asChild variant="outline" className="flex-1">
                <Link href="/app/onboarding?step=4">
                  <Plug className="w-4 h-4" /> Connect / import HubSpot
                </Link>
              </Button>
            )}
            <Button asChild className="flex-1">
              <Link href="/app/discovery">
                <Search className="w-4 h-4" /> Discover leads manually
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TutorialSignal
              icon={<Target className="w-4 h-4" />}
              title="ICP fit"
              detail="How well each lead matches the customer profile you confirmed."
            />
            <TutorialSignal
              icon={<Package className="w-4 h-4" />}
              title="Recommended package"
              detail="The service tier Revint suggests pitching, based on the lead's signals."
            />
            <TutorialSignal
              icon={<ArrowRightCircle className="w-4 h-4" />}
              title="Next best action"
              detail="The single move to make next — open a lead to see the full brief."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TutorialSignal({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-(--revint-300) text-[13px] font-medium">
        {icon}
        {title}
      </div>
      <p className="text-[11.5px] text-(--revint-text-3) mt-1 leading-snug">{detail}</p>
    </div>
  );
}
