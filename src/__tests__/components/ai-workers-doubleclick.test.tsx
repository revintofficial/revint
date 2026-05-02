/**
 * H10 regression - "Run worker" + "Upgrade" buttons used to fire
 * duplicate POSTs on a rapid double click because React's `busy` state
 * commits asynchronously. The fix is a `useRef<Set>`/`useRef<bool>`
 * lock that's mutated synchronously inside the click handler so the
 * second click sees the in-flight flag before the first network call
 * even leaves.
 *
 * We test the H10 contract two ways:
 *   1. Functional - mount a tiny mirror component that uses the SAME
 *      `useRef` pattern + a stubbed fetch, fire 5 clicks in the same
 *      event-loop tick, assert fetch ran exactly once.
 *   2. Source-presence - grep both production files for the
 *      `useRef`/`.current.has`/`inflightRef.current = true` pattern so
 *      a refactor that drops the lock fails CI.
 */
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(() => {
  cleanup();
});

function MirrorTriggerButton({
  onFetch,
  workerKind = "WEBSITE_MOCKUP_GENERATOR",
}: {
  onFetch: () => Promise<void>;
  workerKind?: string;
}) {
  const inflightKindsRef = useRef<Set<string>>(new Set());
  const [running, setRunning] = useState<Set<string>>(new Set());

  const trigger = useCallback(async () => {
    if (inflightKindsRef.current.has(workerKind)) return;
    inflightKindsRef.current.add(workerKind);
    setRunning((prev) => new Set(prev).add(workerKind));
    try {
      await onFetch();
    } finally {
      inflightKindsRef.current.delete(workerKind);
    }
  }, [onFetch, workerKind]);

  return (
    <button data-testid="trigger" onClick={trigger}>
      {running.has(workerKind) ? "Running..." : "Run worker"}
    </button>
  );
}

function MirrorCheckoutButton({ onFetch }: { onFetch: () => Promise<void> }) {
  const checkoutInflightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  async function startCheckout() {
    if (checkoutInflightRef.current) return;
    checkoutInflightRef.current = true;
    setBusy(true);
    try {
      await onFetch();
    } finally {
      checkoutInflightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <button data-testid="checkout" onClick={startCheckout}>
      {busy ? "Loading..." : "Upgrade"}
    </button>
  );
}

describe("H10 - synchronous useRef lock pattern", () => {
  it("rapid 5x click on a worker trigger fires exactly 1 fetch", async () => {
    const fetchMock = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
    );
    render(<MirrorTriggerButton onFetch={fetchMock} />);
    const btn = screen.getByTestId("trigger");
    for (let i = 0; i < 5; i++) fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rapid 5x click on the upgrade button fires exactly 1 fetch", async () => {
    const fetchMock = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
    );
    render(<MirrorCheckoutButton onFetch={fetchMock} />);
    const btn = screen.getByTestId("checkout");
    for (let i = 0; i < 5; i++) fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("after the first fetch resolves, a subsequent click is allowed", async () => {
    let resolveFn: (() => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveFn = res;
        }),
    );
    render(<MirrorTriggerButton onFetch={fetchMock} />);
    const btn = screen.getByTestId("trigger");
    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFn?.();
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("H10 - production source contains the lock pattern", () => {
  it("ai-workers-panel.tsx still owns inflightKindsRef", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/app/ai-workers-panel.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/inflightKindsRef\s*=\s*useRef/);
    expect(src).toMatch(/inflightKindsRef\.current\.has\(/);
    expect(src).toMatch(/inflightKindsRef\.current\.add\(/);
    expect(src).toMatch(/inflightKindsRef\.current\.delete\(/);
  });

  it("upgrade-modal.tsx still owns checkoutInflightRef", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/app/upgrade-modal.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/checkoutInflightRef\s*=\s*useRef/);
    expect(src).toMatch(/checkoutInflightRef\.current/);
  });
});
