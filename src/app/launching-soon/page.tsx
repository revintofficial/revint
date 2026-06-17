import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Revint is launching soon",
  description: "Revint is launching soon.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LaunchingSoonPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--revint-bg)] px-6 text-center text-[var(--revint-text-1)]">
      <p className="max-w-xl text-[17px] leading-7">
        Revint is launching soon. We are preparing the first release and will
        open access shortly.
      </p>
    </main>
  );
}
