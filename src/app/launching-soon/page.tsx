import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeadAC is launching soon",
  description: "LeadAC is launching soon.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LaunchingSoonPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--leadac-bg)] px-6 text-center text-[var(--leadac-text-1)]">
      <p className="max-w-xl text-[17px] leading-7">
        LeadAC is launching soon. We are preparing the first release and will
        open access shortly.
      </p>
    </main>
  );
}
