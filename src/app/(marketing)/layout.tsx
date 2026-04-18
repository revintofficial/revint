import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { getOptionalUser } from "@/lib/auth";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();
  return (
    <div className="min-h-screen flex flex-col bg-black text-white relative overflow-x-hidden">
      <MarketingNav signedIn={!!session} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
