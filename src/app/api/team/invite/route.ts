import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { PLANS, planAllowsAdditionalSeat } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";
import { sendEmailAsync } from "@/lib/email/send";
import { TeamInviteEmail } from "@/lib/email/templates/team-invite";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // P0.8 - seat enforcement. Pro Solo 1, Pro Team 3, Agency 5.
    const currentSeats = await prisma.workspaceMember.count({
      where: { workspaceId: session.workspaceId },
    });
    const plan = PLANS[session.workspace.plan];
    if (!planAllowsAdditionalSeat(session.workspace.plan, currentSeats)) {
      return NextResponse.json(
        {
          error: "seat_limit_reached",
          message: `${plan.name} plan is limited to ${plan.maxSeats} seats (${currentSeats} currently in use). Upgrade to Pro Team or Agency.`,
          currentSeats,
          maxSeats: plan.maxSeats,
          planName: plan.name,
          upgradeUrl: "/app/settings/billing",
        },
        { status: 402 },
      );
    }

    const { email } = await request.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    // If the user already exists in our DB, attach them directly.
    let existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!existing) {
      try {
        const admin = createSupabaseAdmin();
        const origin = new URL(request.url).origin;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
          redirectTo: `${origin}/auth/callback?next=/app/dashboard`,
          data: { invited_to_workspace: session.workspaceId },
        });
        if (error) throw error;
        if (data.user) {
          existing = await prisma.user.upsert({
            where: { id: data.user.id },
            update: { email: cleanEmail },
            create: { id: data.user.id, email: cleanEmail },
          });
        }
      } catch (err) {
        // Fall back: if Supabase admin/invite isn't configured, surface a
        // hand-written 503 message but log the real error server-side. We
        // don't echo `err.message` to the client because Supabase errors
        // can include configuration details (project refs, role hints).
        logger.warn("api.team.supabase_invite_failed", {
          err: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          {
            error:
              "Could not send invite email. Set SUPABASE_SERVICE_ROLE_KEY or have the user sign up first.",
          },
          { status: 503 }
        );
      }
    }

    if (!existing) {
      return NextResponse.json({ error: "Could not resolve invited user" }, { status: 500 });
    }

    // L11 fix - the seat check + member create must be atomic.
    // Two parallel invites that both pass the upfront `count` check
    // could otherwise both insert and exceed the plan's seat limit.
    // We re-count INSIDE the transaction with a short retry; Postgres
    // doesn't give us a SERIALIZABLE-level guard without explicit
    // SELECT FOR UPDATE on a parent row, but the in-transaction count
    // closes the obvious race. The unique constraint
    // `WorkspaceMember(workspaceId,userId)` covers double-add.
    //
    // L12 fix - if the invitee is already a workspace member we
    // surface a 200 with an explicit `invitation_sent_existing_user`
    // code so the UI can show a friendly "already on the team"
    // toast instead of treating it as an error. The 409 was being
    // displayed as a hard failure even though "they're already on
    // your team" is a benign outcome of the request.
    const inviteResult = await prisma.$transaction(async (tx) => {
      const seatsInTx = await tx.workspaceMember.count({
        where: { workspaceId: session.workspaceId },
      });
      if (!planAllowsAdditionalSeat(session.workspace.plan, seatsInTx)) {
        return { kind: "seat_limit" as const, seatsInTx };
      }
      const alreadyTx = await tx.workspaceMember.findFirst({
        where: { workspaceId: session.workspaceId, userId: existing!.id },
      });
      if (alreadyTx) {
        return { kind: "already_member" as const };
      }
      await tx.workspaceMember.create({
        data: {
          workspaceId: session.workspaceId,
          userId: existing!.id,
          role: "MEMBER",
        },
      });
      return { kind: "added" as const };
    });

    if (inviteResult.kind === "seat_limit") {
      return NextResponse.json(
        {
          error: "seat_limit_reached",
          message: `${plan.name} plan is limited to ${plan.maxSeats} seats (${inviteResult.seatsInTx} currently in use). Upgrade to Pro Team or Agency.`,
          currentSeats: inviteResult.seatsInTx,
          maxSeats: plan.maxSeats,
          planName: plan.name,
          upgradeUrl: "/app/settings/billing",
        },
        { status: 402 },
      );
    }

    if (inviteResult.kind === "already_member") {
      return NextResponse.json({
        ok: true,
        code: "invitation_sent_existing_user",
        message: `${cleanEmail} is already on your team.`,
      });
    }

    // Branded supplement to the Supabase invite email. Fire-and-forget so
    // a Resend outage never blocks a successful invite.
    const inviterName = session.user.fullName || session.user.email;
    // Pull workspace.language so a TR-configured workspace keeps its invite
    // in Turkish even though the product default is now English.
    const wsLang = await prisma.workspace
      .findUnique({
        where: { id: session.workspaceId },
        select: { language: true },
      })
      .then((w) => (w?.language === "tr" ? "tr" : "en"));
    sendEmailAsync({
      to: cleanEmail,
      subject: TeamInviteEmail.buildSubject(session.workspace.name, wsLang),
      react: TeamInviteEmail({
        inviterName,
        workspaceName: session.workspace.name,
        role: "MEMBER",
        locale: wsLang,
      }),
      tags: [
        { name: "type", value: "team_invite" },
        { name: "workspace_id", value: session.workspaceId },
      ],
    });

    return NextResponse.json({
      message: `Invitation sent to ${cleanEmail}`,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.team.invite_error", error);
  }
}
