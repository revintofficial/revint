import Link from "next/link";
import { Zap } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer
      className="border-t mt-24"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(94, 106, 210, 0.16)",
                  border: "0.5px solid rgba(94, 106, 210, 0.3)",
                }}
              >
                <Zap className="w-3.5 h-3.5" style={{ color: "#A5B4FC" }} />
              </div>
              <span className="text-[14px] font-semibold tracking-tight">Lead Engine</span>
            </Link>
            <p className="text-[12.5px] text-white/45 leading-relaxed max-w-xs">
              Local businesses that need a new website, found and pitched in one tool.
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">Product</p>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/#how" className="text-white/65 hover:text-white">How it works</Link></li>
              <li><Link href="/#features" className="text-white/65 hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="text-white/65 hover:text-white">Pricing</Link></li>
              <li><Link href="/login" className="text-white/65 hover:text-white">Log in</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">For</p>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/for/agencies" className="text-white/65 hover:text-white">Outbound agencies</Link></li>
              <li><Link href="/for/specialists" className="text-white/65 hover:text-white">Vertical specialists</Link></li>
              <li><Link href="/for/smma" className="text-white/65 hover:text-white">New SMMA owners</Link></li>
              <li><Link href="/partners" className="text-white/65 hover:text-white">Partner program</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">Company</p>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/#faq" className="text-white/65 hover:text-white">FAQ</Link></li>
              <li><a href="mailto:hello@leadengine.app" className="text-white/65 hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/35 mb-3">Legal</p>
            <ul className="space-y-2 text-[12.5px]">
              <li><Link href="/legal/terms" className="text-white/65 hover:text-white">Terms</Link></li>
              <li><Link href="/legal/privacy" className="text-white/65 hover:text-white">Privacy</Link></li>
            </ul>
          </div>
        </div>

        <div
          className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[11.5px] text-white/35">
            © {new Date().getFullYear()} Lead Engine. All rights reserved.
          </p>
          <p className="text-[11.5px] text-white/35">
            Built with Next.js, Supabase, and Gemini.
          </p>
        </div>
      </div>
    </footer>
  );
}
