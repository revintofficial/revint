import { LensAssignList } from "@/components/admin/control-lens-panel";
import { ControlFrame } from "@/components/admin/control-frame";
import { ForbiddenError } from "@/lib/auth";
import { listLensHolders } from "@/lib/control/assign-lens";
import { requireControlRole } from "@/lib/control/roles";

export default async function LensesPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { workspaceId } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <LensesBody workspaceId={workspaceId} /> : null}
    </ControlFrame>
  );
}

async function LensesBody({ workspaceId }: { workspaceId: string }) {
  try {
    await requireControlRole("ADMIN");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <p className="text-sm text-[var(--revint-text-2)]">Mercek atamak Yönetici işidir.</p>;
    }
    throw error;
  }

  const people = await listLensHolders();
  const assigned = people.some((person) => person.lens !== null);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Mercekler</h1>
      {!assigned && (
        <p className="text-sm text-[var(--revint-text-2)]">
          Henüz mercek atanmadı. Yönetici burada Teknik, Alan ve Satış atar. Atama olmadan İnceleme&apos;de hüküm kaydedilmez.
        </p>
      )}
      {people.length > 0 && <LensAssignList workspaceId={workspaceId} people={people} />}
    </section>
  );
}
