/**
 * P1.1 - Email accounts settings page.
 * Lists connected Gmail/Outlook accounts; lets user connect/disconnect.
 */

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailAccountsPanel } from "@/components/app/email-accounts-panel";

export default async function EmailAccountsPage() {
  const session = await requireUser();
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId: session.workspaceId },
    select: {
      id: true,
      provider: true,
      email: true,
      dailyLimit: true,
      sentToday: true,
      replyAttributionEnabled: true,
      lastInboxSyncAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <EmailAccountsPanel
      accounts={accounts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        lastInboxSyncAt: a.lastInboxSyncAt?.toISOString() ?? null,
      }))}
    />
  );
}
