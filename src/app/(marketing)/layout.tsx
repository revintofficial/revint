import Script from "next/script";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getOptionalUser } from "@/lib/auth";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();
  const rewardfulKey = process.env.NEXT_PUBLIC_REWARDFUL_API_KEY;
  return (
    <div className="min-h-screen flex flex-col bg-black text-white relative overflow-x-clip">
      {rewardfulKey && (
        <>
          <Script id="rewardful-init" strategy="beforeInteractive">
            {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
          </Script>
          <Script
            src="https://r.wdfl.co/rw.js"
            data-rewardful={rewardfulKey}
            strategy="afterInteractive"
            async
          />
        </>
      )}
      <MarketingNav signedIn={!!session} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
