import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileSearch, Users } from "lucide-react";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/demo",
  title: "Book a 20-min walkthrough — LeadAC",
  description:
    "Send me your vertical and an ICP brief; I'll build a sample account graph live on the call. Walk away with a real account list either way — no signup required, no demo deck, no sales script.",
});

const EXPECT = [
  {
    icon: Clock,
    title: "20 minutes, no slide deck",
    body: "We run on your vertical and ICP brief, not a recorded demo. If you can't see the value in twenty minutes, the rest of the call won't change that.",
  },
  {
    icon: FileSearch,
    title: "A real sample account graph, on the call",
    body: "I open the app, type the ICP brief you sent, and walk through the enriched account list live. You see the same screens your SDRs and AEs would see day one.",
  },
  {
    icon: Users,
    title: "No sales script",
    body: "Mert (founder) takes the call, not an SDR. Honest answers about what works, what doesn't, and whether LeadAC is even the right fit for your GTM motion.",
  },
  {
    icon: CheckCircle2,
    title: "You leave with the list",
    body: "Whether or not you move forward, you keep the sample account list we built on the call. The point is that the work is done — your time isn't a sunk cost.",
  },
];

export default function DemoPage() {
  return (
    <main className="relative overflow-hidden isolate">
      {/* Brand-tinted glow at top so the page reads as part of the
          marketing surface rather than a generic form page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30) 0%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0) 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6 pt-32 md:pt-40 pb-24 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16">
          {/* LEFT: copy + form */}
          <div className="flex flex-col">
            <span
              className="self-start rounded-full px-4 py-1.5 mb-6 text-[11.5px] font-medium text-white/80"
              style={{
                background: "rgba(255,255,255,0.04)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.25)",
              }}
            >
              Walkthrough
            </span>

            <h1 className="text-[clamp(34px,5.4vw,68px)] leading-[1.02] tracking-[-0.03em] font-semibold text-white max-w-[18ch]">
              Send an ICP brief.{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, #FFFFFF 0%, hsl(var(--leadac-h) var(--leadac-s) 88%) 45%, hsl(var(--leadac-h) var(--leadac-s) 50%) 100%)",
                }}
              >
                I&apos;ll build the account graph live.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] md:text-[16.5px] text-white/65 leading-relaxed">
              The walkthrough is a live tour of the product on the vertical
              and ICP brief you send. I build a sample account graph on the
              call, you see the enriched list on screen, and you keep the
              list whether or not we end up working together.
            </p>

            <div className="mt-10">
              <DemoRequestForm />
            </div>

            <div className="mt-8 flex flex-col gap-2 text-[12.5px] text-white/45 leading-relaxed">
              <p>
                Prefer to email instead?{" "}
                <a
                  href="mailto:mert@leadacai.com"
                  className="text-white/70 underline-offset-4 hover:underline"
                >
                  mert@leadacai.com
                </a>
                . Same person, same inbox.
              </p>
              <p>
                Pricing isn&apos;t public yet — plans are being shaped with
                the first cohort of vertical SaaS GTM teams.{" "}
                <Link
                  href="/#waitlist"
                  className="text-white/70 underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  Join the waitlist
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </p>
            </div>
          </div>

          {/* RIGHT: what to expect */}
          <aside className="flex flex-col gap-6 lg:pt-4">
            <div
              className="rounded-2xl p-6 md:p-7 flex flex-col gap-1"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 60% / 0.14), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04))",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.28)",
              }}
            >
              <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/55">
                The promise
              </span>
              <p className="text-[16px] text-white leading-relaxed">
                You leave the call with a real sample account graph for your own vertical and ICP. Even if you never move forward, the list is yours.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/55">
                What the 20 minutes look like
              </span>
              <ul className="flex flex-col gap-3.5">
                {EXPECT.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="flex items-start gap-3 rounded-xl p-4"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 60%), hsl(var(--leadac-h) var(--leadac-s) 36%))",
                          color: "white",
                        }}
                        aria-hidden
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-white leading-tight mb-1">
                          {item.title}
                        </p>
                        <p className="text-[13px] text-white/60 leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div
              className="rounded-2xl p-5 md:p-6 flex flex-col gap-2"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/55">
                Who this isn&apos;t for
              </span>
              <p className="text-[13px] text-white/60 leading-relaxed">
                If your ICP is enterprise buyers, generic horizontal SaaS, or you don&apos;t sell into a defined local-business vertical, LeadAC isn&apos;t your tool — Apollo, Clay, or Gong are stronger there. We&apos;re built specifically for vertical and SMB SaaS GTM teams whose customers are local businesses: restaurants, dental, HVAC, plumbing, electrical, legal, fitness, beauty. If that&apos;s who your team sells to, this call will be useful.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
