/**
 * Phase 3 component test — `ReviewVelocityBadge`.
 *
 * Pins the threshold matrix from PLAN §4 Phase 3 demo-able outcome:
 *   - deltaPct ≥ +50%  → render surge pill
 *   - deltaPct ≤ -30%  → render dip pill
 *   - dead zone        → render nothing
 *   - low total volume → render nothing
 * Plus the Phase 8 promotion path (`promoted` prop swaps tone).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReviewVelocityBadge } from "@/components/app/lead-detail-v2/ReviewVelocityBadge";
import type { ReviewVelocity } from "@/lib/lead-detail/review-velocity";

const COPY = {
  surgeTemplate: "+{deltaPct}% reviews / 30d",
  dipTemplate: "-{deltaPct}% reviews / 30d",
  surgeAriaTemplate: "Review volume surge {deltaPct} percent",
  dipAriaTemplate: "Review volume dip {deltaPct} percent",
};

function velocity(partial: Partial<ReviewVelocity>): ReviewVelocity {
  return {
    recentCount30d: 10,
    priorCount30d: 5,
    deltaPct: 100,
    recent30dAvgRating: 4.5,
    prior30dAvgRating: 4.0,
    ratingDelta: 0.5,
    ...partial,
  };
}

describe("ReviewVelocityBadge", () => {
  it("renders nothing when velocity is null", () => {
    const { container } = render(
      <ReviewVelocityBadge velocity={null} copy={COPY} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when total volume is below the floor", () => {
    const { container } = render(
      <ReviewVelocityBadge
        velocity={velocity({ recentCount30d: 2, priorCount30d: 2 })}
        copy={COPY}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders SURGE pill when deltaPct ≥ +50%", () => {
    render(
      <ReviewVelocityBadge
        velocity={velocity({ deltaPct: 120, recentCount30d: 11, priorCount30d: 5 })}
        copy={COPY}
      />,
    );
    const pill = screen.getByTestId("review-velocity-badge");
    expect(pill.dataset.kind).toBe("surge");
    expect(pill.textContent).toContain("+120% reviews / 30d");
  });

  it("renders DIP pill when deltaPct ≤ -30%", () => {
    render(
      <ReviewVelocityBadge
        velocity={velocity({ deltaPct: -45, recentCount30d: 4, priorCount30d: 8 })}
        copy={COPY}
      />,
    );
    const pill = screen.getByTestId("review-velocity-badge");
    expect(pill.dataset.kind).toBe("dip");
    expect(pill.textContent).toContain("-45% reviews / 30d");
  });

  it("renders nothing in the dead zone (-29% .. +49%)", () => {
    const { container } = render(
      <ReviewVelocityBadge
        velocity={velocity({ deltaPct: 17, recentCount30d: 7, priorCount30d: 6 })}
        copy={COPY}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("upgrades to 'trigger' tone when promoted=true", () => {
    render(
      <ReviewVelocityBadge
        velocity={velocity({ deltaPct: 80, recentCount30d: 9, priorCount30d: 5 })}
        promoted={true}
        copy={COPY}
      />,
    );
    const pill = screen.getByTestId("review-velocity-badge");
    expect(pill.dataset.promoted).toBe("true");
    expect(pill.dataset.kind).toBe("surge");
  });
});
