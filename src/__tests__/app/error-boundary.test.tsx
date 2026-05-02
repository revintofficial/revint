/**
 * M21 regression - the app shipped without a top-level error.tsx
 * or not-found.tsx. Any uncaught render error in a public route
 * fell through to Next's default white error page (no brand, no
 * recovery action). 404s served a similarly bare default. The fix
 * adds 4 files: root error.tsx, root not-found.tsx, app/error.tsx,
 * app/not-found.tsx.
 *
 * This test renders each of them with React Test Renderer and
 * asserts the user-facing recovery UI exists. Functional RTL
 * would need Next's full router/metadata stubs; the contract
 * here is "the boundary renders, has a heading + a recovery
 * affordance", which is what a manual smoke test would catch.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import RootError from "@/app/error";
import RootNotFound from "@/app/not-found";
import AppError from "@/app/app/error";
import AppNotFound from "@/app/app/not-found";

describe("M21 - root error boundary", () => {
  it("renders a heading + Try again button + Go home link", () => {
    const reset = vi.fn();
    render(
      <RootError
        error={Object.assign(new Error("boom"), { digest: "test_digest_1" })}
        reset={reset}
      />,
    );
    expect(screen.getByRole("heading")).toBeTruthy();
    const retry = screen.getByRole("button", { name: /try again/i });
    expect(retry).toBeTruthy();
    expect(screen.getByRole("link", { name: /go home/i })).toBeTruthy();

    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does NOT show the digest in production", () => {
    // The digest is internal/debug-only; users seeing it on a
    // public page would leak our error-grouping cookies. The
    // component only renders it when NODE_ENV !== "production".
    const before = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      render(
        <RootError
          error={Object.assign(new Error("boom"), { digest: "secret_digest" })}
          reset={vi.fn()}
        />,
      );
      expect(screen.queryByText(/secret_digest/)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      void before;
    }
  });
});

describe("M21 - root not-found", () => {
  it("renders a 404 heading + back-home link", () => {
    render(<RootNotFound />);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("link", { name: /back home/i })).toBeTruthy();
  });
});

describe("M21 - product subtree error boundary", () => {
  it("renders a recovery card with Try again + Dashboard link", () => {
    const reset = vi.fn();
    render(
      <AppError
        error={Object.assign(new Error("subtree"), { digest: "d2" })}
        reset={reset}
      />,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeTruthy();
  });
});

describe("M21 - product subtree not-found", () => {
  it("renders a 404 + dashboard + leads links", () => {
    render(<AppNotFound />);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view leads/i })).toBeTruthy();
  });
});
