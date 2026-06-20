/**
 * Small, table-based HTML shell for routes that send raw Resend HTML instead
 * of React Email components. Keep this aligned with templates/_primitives.tsx.
 */

const colors = {
  bg: "#FCFBF8",
  surface: "#FDFBF7",
  surfaceAlt: "#F5F1E9",
  border: "#C1C0D8",
  borderSoft: "#E6E1EF",
  ink: "#1A1547",
  body: "#3A3663",
  muted: "#605C84",
  faint: "#84819C",
  accent: "#1F1291",
  teal: "#38919F",
  royalBlue: "#1363EC",
} as const;

export function escapeEmailHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BrandedEmailHtmlInput {
  title: string;
  bodyHtml: string;
  eyebrow?: string;
  preheader?: string;
  rows?: Array<[label: string, value: string]>;
  footerHtml?: string;
}

export function brandedEmailHtml({
  title,
  bodyHtml,
  eyebrow = "Revint",
  preheader,
  rows,
  footerHtml,
}: BrandedEmailHtmlInput): string {
  const rowHtml = rows?.length
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:22px 0 0 0;background:${colors.surfaceAlt};border:1px solid ${colors.borderSoft};border-radius:12px;">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:9px 16px;color:${colors.muted};font-size:13px;line-height:20px;font-weight:600;vertical-align:top;white-space:nowrap;width:38%;border-bottom:1px solid ${colors.borderSoft};">${escapeEmailHtml(label)}</td>
            <td style="padding:9px 16px;color:${colors.ink};font-size:13px;line-height:20px;font-weight:600;vertical-align:top;border-bottom:1px solid ${colors.borderSoft};">${escapeEmailHtml(value)}</td>
          </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const footer = footerHtml
    ? `
      <div style="margin-top:22px;background:${colors.surfaceAlt};border:1px solid ${colors.borderSoft};border-radius:12px;padding:14px 16px;color:${colors.muted};font-size:13px;line-height:20px;">
        ${footerHtml}
      </div>`
    : "";

  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(
    preheader ?? title,
  )}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background:${colors.bg};">
  <tr>
    <td align="center" style="padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:${colors.surface};border:1px solid ${colors.border};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(26,21,71,0.04),0 16px 42px rgba(26,21,71,0.08);">
        <tr>
          <td style="height:3px;background:${colors.accent};background-image:linear-gradient(90deg,${colors.accent} 0%,${colors.royalBlue} 58%,${colors.teal} 100%);font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 28px 30px 28px;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${colors.muted};font-weight:700;">
              ${escapeEmailHtml(eyebrow)}
            </div>
            <h1 style="margin:18px 0 12px 0;font-size:28px;line-height:1.15;color:${colors.ink};font-weight:700;letter-spacing:-0.02em;">
              ${escapeEmailHtml(title)}
            </h1>
            <div style="font-size:15px;line-height:1.65;color:${colors.body};">
              ${bodyHtml}
            </div>
            ${rowHtml}
            ${footer}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:${colors.ink};">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#C1C0D8;">
              <strong style="color:#FFFFFF;">Revint</strong> - Operational revenue intelligence for SMB markets
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}
