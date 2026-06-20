/**
 * Revint canonical HubSpot custom contact properties (`revint_*`).
 *
 * On connect we provision these properties in the customer's portal so
 * the writeback pipeline can push Revint intelligence (temperature,
 * recommended angle, qualification status, risk, etc.) onto the HubSpot
 * contact — making Revint's signal visible inside the CRM the customer
 * already lives in, and powering the App Card.
 *
 * The names below are a **non-negotiable** stable contract shared with
 * `writeback.ts`, `field-map.ts`, and the App Card (`card-data` endpoint).
 * Renaming them in a customer's portal would orphan all historical data,
 * so they are versioned by intent: skorlama, decision/pitch, provenance.
 *
 * Provisioning is idempotent: we read existing property names first and
 * only create the missing ones. A customer who pre-created a property
 * with the same name shouldn't block the rest.
 */
import type { HubspotClient } from "./client";

export const REVINT_PROPERTY_GROUP = "revint";

export interface RevintPropertyDef {
  name: string;
  label: string;
  type: "string" | "number" | "enumeration" | "datetime";
  fieldType: "text" | "textarea" | "number" | "select" | "date";
  options?: Array<{ label: string; value: string }>;
  description: string;
}

/**
 * Eleven canonical properties grouped by intent:
 *
 *   A. Skorlama / önceliklendirme (rollup) — `revint_sales_confidence`,
 *      `revint_lead_temperature`, `revint_today_priority`.
 *   B. Karar / pitch sinyalleri (intelligence) — `revint_recommended_angle`,
 *      `revint_next_best_action`, `revint_qualification_status`,
 *      `revint_no_show_risk`, `revint_detected_sub_niche`.
 *   C. Kanıt / provenance — `revint_evidence_summary`,
 *      `revint_source_conflicts`, `revint_action_sheet_url`.
 */
export const REVINT_PROPERTIES: RevintPropertyDef[] = [
  // --- A. Skorlama / önceliklendirme ---------------------------------------
  {
    name: "revint_sales_confidence",
    label: "Revint Sales Confidence",
    type: "number",
    fieldType: "number",
    description:
      "0-100 deterministic Revint score — close probability weighted by data quality.",
  },
  {
    name: "revint_lead_temperature",
    label: "Revint Lead Temperature",
    type: "enumeration",
    fieldType: "select",
    description:
      "HOT / WARM / COLD — computed from inbound SLA, untouched hours and pain density.",
    options: [
      { label: "Hot", value: "HOT" },
      { label: "Warm", value: "WARM" },
      { label: "Cold", value: "COLD" },
    ],
  },
  {
    name: "revint_today_priority",
    label: "Revint Today Priority",
    type: "number",
    fieldType: "number",
    description:
      "Absolute call-order rank for the SDR's queue today (1 = call first).",
  },

  // --- B. Karar / pitch sinyalleri -----------------------------------------
  {
    name: "revint_recommended_angle",
    label: "Revint Recommended Angle",
    type: "string",
    fieldType: "text",
    description:
      "Best product angle to pitch (e.g. Order & Pay, QR Menu, Reservations).",
  },
  {
    name: "revint_next_best_action",
    label: "Revint Next Best Action",
    type: "string",
    fieldType: "textarea",
    description:
      "Single next action the SDR should take (channel, timing window, hook).",
  },
  {
    name: "revint_qualification_status",
    label: "Revint Qualification Status",
    type: "string",
    fieldType: "text",
    description:
      "Smart qualification roll-up — qualified / in_progress / info_only / not_started.",
  },
  {
    name: "revint_no_show_risk",
    label: "Revint No-show Risk",
    type: "enumeration",
    fieldType: "select",
    description: "HIGH / MEDIUM / LOW risk that a booked demo won't happen.",
    options: [
      { label: "High", value: "HIGH" },
      { label: "Medium", value: "MEDIUM" },
      { label: "Low", value: "LOW" },
    ],
  },
  {
    name: "revint_detected_sub_niche",
    label: "Revint Detected Sub-niche",
    type: "string",
    fieldType: "text",
    description:
      "Title-Case sub-niche slug verified by Revint (e.g. fnb-cafe-bakery, fnb-fine-dining).",
  },

  // --- C. Kanıt / provenance -----------------------------------------------
  {
    name: "revint_evidence_summary",
    label: "Revint Evidence Summary",
    type: "string",
    fieldType: "textarea",
    description:
      "Combined evidence trail (Gemini + deterministic audit) that justifies the score.",
  },
  {
    name: "revint_source_conflicts",
    label: "Revint Source Conflicts",
    type: "string",
    fieldType: "textarea",
    description:
      "Disagreements between Google Places / Openmart / HubSpot (location, phone, name).",
  },
  {
    name: "revint_action_sheet_url",
    label: "Revint Action Sheet",
    type: "string",
    fieldType: "text",
    description: "Deep link to the Revint Action Sheet for this lead.",
  },
];

export const REVINT_PROPERTY_NAMES = REVINT_PROPERTIES.map((p) => p.name);

/**
 * Scope the connected HubSpot token MUST carry for property provisioning
 * to succeed. Without it, `createContactProperty` returns 403 and every
 * property silently lands in `errors[]` — the exact failure that made the
 * smoke test report a connection with no Revint fields. Callers should
 * guard on this before attempting provisioning and surface a clear
 * "reconnect with the right app" error instead of a false success.
 */
export const PROVISION_REQUIRED_SCOPE = "crm.schemas.contacts.write";

/** Whether a token's granted scopes allow custom-property provisioning. */
export function hasProvisionScope(
  scopes: readonly string[] | null | undefined,
): boolean {
  return Array.isArray(scopes) && scopes.includes(PROVISION_REQUIRED_SCOPE);
}

/**
 * Property names that carry HOT/WARM/COLD or HIGH/MEDIUM/LOW enumeration
 * values. Enumeration writes with empty strings are rejected by HubSpot,
 * so writeback must drop these from the payload when the value is null.
 */
export const REVINT_ENUM_PROPERTY_NAMES = new Set<string>(
  REVINT_PROPERTIES.filter((p) => p.type === "enumeration").map((p) => p.name),
);

/**
 * Ensure the `revint_*` properties exist in the portal. Returns the list
 * of newly-created property names. Best-effort: a failure to create one
 * property logs and continues. Includes a property-group create attempt
 * so the fields land in a dedicated "Revint" group instead of
 * `contactinformation`.
 */
export async function ensureRevintProperties(
  client: HubspotClient,
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  let existing: Set<string>;
  try {
    const res = await client.listContactProperties();
    existing = new Set(res.results.map((p) => p.name));
  } catch {
    existing = new Set();
  }

  // Best-effort group create. A 4xx because the group already exists is
  // expected on reconnect; we ignore the result either way.
  try {
    await client.createContactPropertyGroup({
      name: REVINT_PROPERTY_GROUP,
      label: "Revint",
      displayOrder: -1,
    });
  } catch {
    // group probably exists already — ignore.
  }

  for (const prop of REVINT_PROPERTIES) {
    if (existing.has(prop.name)) {
      skipped.push(prop.name);
      continue;
    }
    try {
      await client.createContactProperty({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        fieldType: prop.fieldType,
        groupName: REVINT_PROPERTY_GROUP,
        description: prop.description,
        ...(prop.options ? { options: prop.options } : {}),
      });
      created.push(prop.name);
    } catch {
      errors.push(prop.name);
    }
  }

  return { created, skipped, errors };
}
