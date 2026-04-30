import { requireWorkspaceAdmin } from "@/lib/auth";
import { OfferForm } from "@/components/app/offer-form";

export default async function OfferSettingsPage() {
  await requireWorkspaceAdmin();
  return <OfferForm canEdit={true} />;
}
