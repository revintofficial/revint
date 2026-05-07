import { RealtimeFeed } from "@/components/admin/realtime-feed";
import { getRealtimeSessions } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRealtimePage() {
  // Server-render the first frame so the page paints fast even on
  // a cold load; the client component takes over polling after mount.
  const initial = await getRealtimeSessions(100);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--leadac-text-1)]">
          Realtime
        </h1>
        <p className="mt-1 text-sm text-[var(--leadac-text-2)]">
          Visitors active in the last 5 minutes. Refreshes every 5 seconds.
        </p>
      </header>
      <RealtimeFeed
        initial={initial.map((s) => ({
          ...s,
          startedAt: s.startedAt.toISOString(),
          lastActivityAt: s.lastActivityAt.toISOString(),
          currentPageEnteredAt: s.currentPageEnteredAt
            ? s.currentPageEnteredAt.toISOString()
            : null,
        }))}
      />
    </div>
  );
}
