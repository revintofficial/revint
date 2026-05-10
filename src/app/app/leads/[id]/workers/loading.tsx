/**
 * Lead Detail v2 — Phase 6 loading boundary for /workers.
 *
 * Renders a minimal skeleton so the breadcrumb + heading still
 * frame the page during navigation. Avoids any data fetching
 * (per Next.js 16 loading.tsx contract).
 */
export default function LeadWorkersLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6"
      data-testid="lead-workers-loading"
    >
      <div
        className="h-3 w-40 animate-pulse rounded"
        style={{ background: "hsl(0 0% 100% / 0.06)" }}
      />
      <div
        className="h-6 w-56 animate-pulse rounded"
        style={{ background: "hsl(0 0% 100% / 0.06)" }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl"
            style={{ background: "hsl(0 0% 100% / 0.04)" }}
          />
        ))}
      </div>
    </div>
  );
}
