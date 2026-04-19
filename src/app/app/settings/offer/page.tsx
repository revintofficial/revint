import { requireUser } from "@/lib/auth";
import { OfferForm } from "@/components/app/offer-form";

export default async function OfferSettingsPage() {
  const session = await requireUser();
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  return <OfferForm canEdit={canEdit} />;
}
