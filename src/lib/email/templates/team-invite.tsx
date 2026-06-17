/**
 * Team invite — supplement to the Supabase invite email.
 *
 * Supabase Auth sends the password/magic link to activate the account.
 * This email arrives right after and gives the invitee context: who
 * invited them, which workspace, what role, what Revint does. It's
 * "branded" so the invite doesn't feel like a generic system email.
 */

import { Row, Section, Text } from "@react-email/components";
import { BaseEmail } from "./base";
import { getAppBaseUrl } from "../from";
import {
  Badge,
  Caption,
  GhostLink,
  H1,
  InfoCard,
  Lede,
  PrimaryButton,
  tokens,
} from "./_primitives";

interface TeamInviteEmailProps {
  inviterName: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  locale?: "tr" | "en";
}

const copy = {
  tr: {
    subject: (ws: string) => `${ws} seni takımına davet etti`,
    preview: "Revint workspace davetin hazır.",
    eyebrow: "Davet",
    heading: (ws: string) => `${ws} seni davet etti`,
    intro: (inviter: string, role: string) =>
      `${inviter}, Revint workspace'ine seni ${role} rolüyle ekledi. ` +
      "Hesabını aktifleştirmek için Supabase'den ayrı bir e-posta daha gelecek — oradaki linkle giriş yap, sonra aşağıdaki butondan workspace'e düş.",
    inviterLabel: "Davet eden",
    workspaceLabel: "Workspace",
    roleLabel: "Rol",
    ctaLabel: "Workspace'e git",
    secondaryLabel: "Ne yapabilirim?",
    roleName: {
      OWNER: "Sahip",
      ADMIN: "Admin",
      MEMBER: "Üye",
    } as const,
    what:
      "Revint, yerel servis işletmeleri için lead bulan ve her biri için kişiselleştirilmiş opener + site mockup'ı üreten bir satış pipeline aracı.",
  },
  en: {
    subject: (ws: string) => `You're invited to ${ws}`,
    preview: "Your Revint workspace invite is ready.",
    eyebrow: "Invitation",
    heading: (ws: string) => `You're invited to ${ws}`,
    intro: (inviter: string, role: string) =>
      `${inviter} added you to their Revint workspace as ${role}. ` +
      "You'll get a separate activation email from Supabase — open that link to set a password, then use the button below to jump into the workspace.",
    inviterLabel: "Invited by",
    workspaceLabel: "Workspace",
    roleLabel: "Role",
    ctaLabel: "Go to workspace",
    secondaryLabel: "What can I do?",
    roleName: {
      OWNER: "Owner",
      ADMIN: "Admin",
      MEMBER: "Member",
    } as const,
    what:
      "Revint is a sales pipeline tool for local service businesses — it surfaces leads and generates a personalized opener + site mockup for each one.",
  },
} as const;

function roleTone(role: "OWNER" | "ADMIN" | "MEMBER") {
  if (role === "OWNER") return "accent" as const;
  if (role === "ADMIN") return "success" as const;
  return "neutral" as const;
}

export function TeamInviteEmail({
  inviterName,
  workspaceName,
  role,
  locale = "en",
}: TeamInviteEmailProps) {
  const c = copy[locale];
  const baseUrl = getAppBaseUrl();
  const initial = (inviterName.trim()[0] || "?").toUpperCase();

  return (
    <BaseEmail preview={c.preview} tone="accent" lang={locale}>
      <Section style={{ marginBottom: "4px" }}>
        <Badge tone="accent">{c.eyebrow}</Badge>
      </Section>

      <H1>{c.heading(workspaceName)}</H1>
      <Lede>{c.intro(inviterName, c.roleName[role])}</Lede>

      <InfoCard>
        <Row>
          <td style={{ width: "44px", verticalAlign: "top", paddingRight: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: tokens.colors.accentSoft,
                color: tokens.colors.accent,
                fontSize: "15px",
                fontWeight: 700,
                lineHeight: "36px",
                textAlign: "center",
                fontFamily: tokens.font,
                border: `1px solid #E0E7FF`,
              }}
            >
              {initial}
            </div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Text
              style={{
                margin: 0,
                color: tokens.colors.textMuted,
                fontFamily: tokens.font,
                fontSize: "12px",
                fontWeight: 500,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {c.inviterLabel}
            </Text>
            <Text
              style={{
                margin: "2px 0 10px 0",
                color: tokens.colors.ink,
                fontFamily: tokens.font,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "22px",
              }}
            >
              {inviterName}
            </Text>

            <Row>
              <td style={{ paddingRight: "20px", verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: 0,
                    color: tokens.colors.textMuted,
                    fontFamily: tokens.font,
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {c.workspaceLabel}
                </Text>
                <Text
                  style={{
                    margin: "2px 0 0 0",
                    color: tokens.colors.text,
                    fontFamily: tokens.font,
                    fontSize: "14px",
                    fontWeight: 600,
                    lineHeight: "20px",
                  }}
                >
                  {workspaceName}
                </Text>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: 0,
                    color: tokens.colors.textMuted,
                    fontFamily: tokens.font,
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {c.roleLabel}
                </Text>
                <Text style={{ margin: "2px 0 0 0" }}>
                  <Badge tone={roleTone(role)}>{c.roleName[role]}</Badge>
                </Text>
              </td>
            </Row>
          </td>
        </Row>
      </InfoCard>

      <Section style={{ margin: "6px 0 16px 0" }}>
        <PrimaryButton href={`${baseUrl}/app/dashboard`} tone="accent">
          {c.ctaLabel}
        </PrimaryButton>
        <GhostLink href="https://revint.dev">{c.secondaryLabel} →</GhostLink>
      </Section>

      <Caption>{c.what}</Caption>
    </BaseEmail>
  );
}

TeamInviteEmail.buildSubject = (
  workspaceName: string,
  locale: "tr" | "en" = "en",
) => copy[locale].subject(workspaceName);
