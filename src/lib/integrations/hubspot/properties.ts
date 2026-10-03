/**
 * Revint canonical HubSpot custom properties (`revint_*`), provisioned
 * on both contacts and companies.
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
 * Fourteen canonical properties grouped by intent:
 *
 *   A. Skorlama / önceliklendirme (rollup) — `revint_sales_confidence`,
 *      `revint_lead_temperature`, `revint_today_priority`.
 *   B. Karar / pitch sinyalleri (intelligence) — `revint_recommended_angle`,
 *      `revint_next_best_action`, `revint_qualification_status`,
 *      `revint_no_show_risk`, `revint_detected_sub_niche`.
 *   C. Kanıt / provenance — `revint_evidence_summary`,
 *      `revint_source_conflicts`, `revint_do_not_pitch`,
 *      `revint_open_questions`, `revint_analyzed_at`, `revint_action_sheet_url`.
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
    name: "revint_do_not_pitch",
    label: "Revint Do Not Pitch",
    type: "string",
    fieldType: "textarea",
    description: "What the rep must not sell or say on this account, with the reason (existing tools, playbook bans).",
  },
  {
    name: "revint_open_questions",
    label: "Revint Open Questions",
    type: "string",
    fieldType: "textarea",
    description: "Facts the analysis could not see. Ask these on the call before pitching.",
  },
  {
    name: "revint_analyzed_at",
    label: "Revint Analyzed At",
    type: "datetime",
    fieldType: "date",
    description: "When this account was last analysed by Revint.",
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
 * CRM objects the 11 `revint_*` properties are provisioned on and written
 * to. Restaurants (FineDine's accounts) arrive in HubSpot as **Companies**;
 * contacts are the SDR's call target. Deals only get their stage moved
 * (`dealstage`), so they don't need the custom properties.
 */
export const REVINT_PROPERTY_OBJECT_TYPES = ["contacts", "companies"] as const;
export type RevintPropertyObjectType = (typeof REVINT_PROPERTY_OBJECT_TYPES)[number];

/**
 * Scope the connected HubSpot token MUST carry for contact property
 * provisioning. Kept for backwards compatibility — new code should use
 * `REQUIRED_WRITEBACK_SCOPES` / `missingWritebackScopes`.
 */
export const PROVISION_REQUIRED_SCOPE = "crm.schemas.contacts.write";

/**
 * Every scope the writeback pipeline needs end-to-end: create the
 * `revint_*` property definitions on contacts + companies (schemas.*.write)
 * and PATCH their values (objects.*.write). Without the schema-write
 * scopes every property create 403s — the exact production failure on
 * portal 148499892 where the connected app lacked write scope and nothing
 * was written back.
 */
export const REQUIRED_WRITEBACK_SCOPES = [
  "crm.objects.contacts.write",
  "crm.objects.companies.write",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.write",
] as const;

/** Required writeback scopes the token was NOT granted (empty = OK). */
export function missingWritebackScopes(
  scopes: readonly string[] | null | undefined,
): string[] {
  const granted = new Set(Array.isArray(scopes) ? scopes : []);
  return REQUIRED_WRITEBACK_SCOPES.filter((s) => !granted.has(s));
}

/** Whether a token's granted scopes allow provisioning + writeback. */
export function hasProvisionScope(
  scopes: readonly string[] | null | undefined,
): boolean {
  return missingWritebackScopes(scopes).length === 0;
}

/** `CrmConnection.lastError` code for a token missing writeback scopes. */
export function missingScopeErrorCode(missing: readonly string[]): string {
  return `missing_scope:${missing.join(",")}`;
}

/**
 * Property names that carry HOT/WARM/COLD or HIGH/MEDIUM/LOW enumeration
 * values. Enumeration writes with empty strings are rejected by HubSpot,
 * so writeback must drop these from the payload when the value is null.
 */
export const REVINT_ENUM_PROPERTY_NAMES = new Set<string>(
  REVINT_PROPERTIES.filter((p) => p.type === "enumeration").map((p) => p.name),
);

export interface ProvisionErrorDetail {
  objectType: RevintPropertyObjectType;
  /** Property name, or `*group*` for the property-group create. */
  name: string;
  status: number | null;
  message: string;
}

export interface ProvisionResult {
  /** `${objectType}.${name}` entries. */
  created: string[];
  skipped: string[];
  errors: string[];
  errorDetails: ProvisionErrorDetail[];
  /** Any HubSpot call answered 401/403 — the token lacks a scope. */
  missingScope: boolean;
  /** True only when every property exists on every object type. */
  ok: boolean;
}

function httpStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/**
 * Ensure the 11 `revint_*` properties exist on contacts AND companies.
 *
 * Honest by construction: "already exists" (listed, or a 409 on create)
 * counts as skipped; every other failure is returned in `errors` /
 * `errorDetails` with the HubSpot status + message, and `missingScope`
 * flips when HubSpot answers 401/403. Callers MUST NOT stamp
 * `propertiesProvisionedAt` unless `ok` is true.
 */
export async function ensureRevintProperties(
  client: HubspotClient,
  objectTypes: readonly RevintPropertyObjectType[] = REVINT_PROPERTY_OBJECT_TYPES,
): Promise<ProvisionResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const errorDetails: ProvisionErrorDetail[] = [];
  let missingScope = false;

  const noteScope = (err: unknown) => {
    const st = httpStatus(err);
    if (st === 401 || st === 403) missingScope = true;
  };

  for (const objectType of objectTypes) {
    // Listing is an optimisation — if it fails we fall back to "create
    // everything and treat 409 as existing", which is still correct.
    let existing = new Set<string>();
    try {
      const res = await client.listProperties(objectType);
      existing = new Set(res.results.map((p) => p.name));
    } catch (err) {
      noteScope(err);
    }

    try {
      await client.createPropertyGroup(objectType, {
        name: REVINT_PROPERTY_GROUP,
        label: "Revint",
        displayOrder: -1,
      });
    } catch (err) {
      // 409 = group exists (normal on reconnect). A 403 means the
      // property creates below will fail too; they record the error.
      noteScope(err);
    }

    for (const prop of REVINT_PROPERTIES) {
      const key = `${objectType}.${prop.name}`;
      if (existing.has(prop.name)) {
        skipped.push(key);
        continue;
      }
      try {
        await client.createProperty(objectType, {
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.fieldType,
          groupName: REVINT_PROPERTY_GROUP,
          description: prop.description,
          ...(prop.options ? { options: prop.options } : {}),
        });
        created.push(key);
      } catch (err) {
        if (httpStatus(err) === 409) {
          skipped.push(key);
          continue;
        }
        noteScope(err);
        errors.push(key);
        errorDetails.push({
          objectType,
          name: prop.name,
          status: httpStatus(err),
          message: errMessage(err),
        });
      }
    }
  }

  return {
    created,
    skipped,
    errors,
    errorDetails,
    missingScope,
    ok: errors.length === 0,
  };
}

/**
 * `CrmConnection.lastError` code for a provision result (null when ok).
 * Missing scope wins: that is the actionable fix ("reconnect with the
 * revint-app"), not the individual property names.
 */
export function provisionErrorCode(res: ProvisionResult): string | null {
  if (res.ok) return null;
  if (res.missingScope) return missingScopeErrorCode(REQUIRED_WRITEBACK_SCOPES);
  const first = res.errorDetails[0];
  return `property_provision_failed:${res.errors.join(",")}${
    first ? ` (${first.status ?? "?"}: ${first.message.slice(0, 200)})` : ""
  }`;
}
