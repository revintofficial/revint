import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/nav";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { requireControlRole } from "@/lib/control/roles";

export const dynamic = "force-dynamic";

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireControlRole("VIEWER");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login?next=/admin/control");
    if (error instanceof ForbiddenError) {
      return <div className="min-h-screen bg-[var(--revint-bg)] p-8 text-[var(--revint-text-1)]"><h1 className="text-xl font-semibold">Bu sayfayı görmek için kontrol yetkisi gerekir.</h1></div>;
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-[var(--revint-bg)] text-[var(--revint-text-1)] flex">
      <AdminNav showMarketing={false} />
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
