import Link from "next/link";
import Image from "next/image";

export function MarketingFooter({
  hidePublicAuth = false,
}: {
  hidePublicAuth?: boolean;
}) {
  return (
    <footer
      className="border-t mt-24"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Image
                src="/logo.png"
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 object-contain"
              />
              <span className="text-[14px] font-semibold tracking-tight">Revint</span>
            </Link>
            <p className="text-[12.5px] text-white/45 leading-relaxed max-w-xs">
              Revint — revenue intelligence for local business sales.
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">
              Product
            </p>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <Link href="/#platform" className="text-white/65 hover:text-white">
                  Platform
                </Link>
              </li>
              <li>
                <Link href="/demo" className="text-white/65 hover:text-white">
                  Book a walkthrough
                </Link>
              </li>
              <li>
                <Link href="/#waitlist" className="text-white/65 hover:text-white">
                  Waitlist
                </Link>
              </li>
              {!hidePublicAuth && (
                <li>
                  <Link href="/login" className="text-white/65 hover:text-white">
                    Log in
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">
              Company
            </p>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <Link href="/#faq" className="text-white/65 hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:hello@revint.dev" className="text-white/65 hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/partners" className="text-white/65 hover:text-white">
                  Partners
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">
              Legal
            </p>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <Link href="/legal/terms" className="text-white/65 hover:text-white">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-white/65 hover:text-white">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11.5px] text-white/35">
            © {new Date().getFullYear()} Revint. All rights reserved.
          </p>
          <p className="text-[11.5px] text-white/35">
            Built with Next.js, Supabase, and Gemini.
          </p>
        </div>
      </div>
    </footer>
  );
}
