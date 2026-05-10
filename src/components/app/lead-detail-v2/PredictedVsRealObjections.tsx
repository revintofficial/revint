"use client";

/**
 * PredictedVsRealObjections — three-bucket diff renderer for the v2
 * HISTORY block.
 *
 *   - predicted-and-real      ✓ green if rebuttal landed
 *   - predicted-not-real      gray skipped
 *   - real-only               surfaced with a TODO note for inline
 *                             `[+ rebuttal]` capture (Phase 2 ships
 *                             read-only — no rebuttal POST endpoint
 *                             exists yet; the spec lets us defer that
 *                             to phase 3).
 */

import type { ReactNode } from "react";
import { CheckCircle2, MinusCircle, AlertCircle } from "lucide-react";

import type { ObjectionDiff } from "@/lib/lead-detail/derive-objection-diff";

export interface PredictedVsRealObjectionsCopy {
  emptyDiff: string;
  predictedAndRealHeading: string;
  predictedNotRealHeading: string;
  realOnlyHeading: string;
  rebuttalLanded: string;
  rebuttalSkipped: string;
  rebuttalMissing: string;
  noRebuttal: string;
}

export interface PredictedVsRealObjectionsProps {
  data: ObjectionDiff;
  copy: PredictedVsRealObjectionsCopy;
}

export function PredictedVsRealObjections({
  data,
  copy,
}: PredictedVsRealObjectionsProps): ReactNode {
  const empty =
    data.predictedAndReal.length === 0 &&
    data.predictedNotReal.length === 0 &&
    data.realOnly.length === 0;

  if (empty) {
    return (
      <p
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
        data-testid="predicted-vs-real-empty"
      >
        {copy.emptyDiff}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="predicted-vs-real">
      {data.predictedAndReal.length > 0 ? (
        <Section
          heading={copy.predictedAndRealHeading}
          tone="var(--leadac-success)"
        >
          {data.predictedAndReal.map((row, idx) => (
            <Row
              key={`pp-${idx}`}
              icon={<CheckCircle2 aria-hidden className="h-3.5 w-3.5" />}
              tone="var(--leadac-success)"
              text={`PREDICTED "${row.predicted}" → REAL "${row.real.text}"`}
              hint={
                row.real.rebuttalUsed
                  ? copy.rebuttalLanded
                  : copy.rebuttalMissing
              }
            />
          ))}
        </Section>
      ) : null}
      {data.predictedNotReal.length > 0 ? (
        <Section
          heading={copy.predictedNotRealHeading}
          tone="var(--leadac-text-3)"
        >
          {data.predictedNotReal.map((row, idx) => (
            <Row
              key={`pn-${idx}`}
              icon={<MinusCircle aria-hidden className="h-3.5 w-3.5" />}
              tone="var(--leadac-text-3)"
              text={`PREDICTED "${row.predicted}" → REAL ✗`}
              hint={copy.rebuttalSkipped}
            />
          ))}
        </Section>
      ) : null}
      {data.realOnly.length > 0 ? (
        <Section
          heading={copy.realOnlyHeading}
          tone="var(--leadac-warning)"
        >
          {data.realOnly.map((row) => (
            <Row
              key={`ro-${row.id}`}
              icon={<AlertCircle aria-hidden className="h-3.5 w-3.5" />}
              tone="var(--leadac-warning)"
              text={`REAL (new) "${row.text}"`}
              hint={row.rebuttalUsed ?? copy.noRebuttal}
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  heading,
  tone,
  children,
}: {
  heading: string;
  tone: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="space-y-1">
      <h4
        className="text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: tone }}
      >
        {heading}
      </h4>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Row({
  icon,
  tone,
  text,
  hint,
}: {
  icon: ReactNode;
  tone: string;
  text: string;
  hint: string;
}): ReactNode {
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{
          color: tone,
          background: "color-mix(in srgb, " + tone + " 18%, transparent)",
        }}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span style={{ color: "var(--leadac-text-1)" }}>{text}</span>
        <span style={{ color: "var(--leadac-text-3)" }} className="text-[11px]">
          {hint}
        </span>
      </div>
    </li>
  );
}
