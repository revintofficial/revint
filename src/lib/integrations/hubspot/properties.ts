/**
 * FineDine v1 update — `leadac_*` HubSpot custom contact properties.
 *
 * On connect we provision these properties in the customer's portal so
 * Phase 4 writeback can push LeadAC intelligence (temperature, best
 * angle, next action, qualification, risk, fit) onto the HubSpot contact
 * — making LeadAC's signal visible inside the CRM the customer already
 * lives in, and powering the Phase 5 CRM Card.
 *
 * Provisioning is idempotent: we read existing property names first and
 * only create the missing ones. Property names are the stable contract
 * with field-map.ts + the CRM card.
 */
import type { HubspotClient } from "./client";

export const LEADAC_PROPERTY_GROUP = "leadac";

export interface LeadacPropertyDef {
  name: string;
  label: string;
  type: "string" | "number" | "enumeration" | "datetime";
  fieldType: "text" | "number" | "select" | "date";
  options?: Array<{ label: string; value: string }>;
  description: string;
}

export const LEADAC_PROPERTIES: LeadacPropertyDef[] = [
  {
    name: "leadac_temperature",
    label: "LeadAC Temperature",
    type: "enumeration",
    fieldType: "select",
    description: "Hot/Warm/Cold priority computed by LeadAC.",
    options: [
      { label: "Hot", value: "HOT" },
      { label: "Warm", value: "WARM" },
      { label: "Cold", value: "COLD" },
    ],
  },
  {
    name: "leadac_recommended_angle",
    label: "LeadAC Recommended Angle",
    type: "string",
    fieldType: "text",
    description: "Best product angle to pitch (from the workspace playbook).",
  },
  {
    name: "leadac_next_best_action",
    label: "LeadAC Next Best Action",
    type: "string",
    fieldType: "text",
    description: "The single next action LeadAC recommends.",
  },
  {
    name: "leadac_qualification_status",
    label: "LeadAC Qualification Status",
    type: "string",
    fieldType: "text",
    description: "qualified / in_progress / info_only / not_started.",
  },
  {
    name: "leadac_qualification_risk",
    label: "LeadAC Qualification Risk",
    type: "string",
    fieldType: "text",
    description: "low / medium / high qualification risk.",
  },
  {
    name: "leadac_no_show_risk",
    label: "LeadAC No-show Risk",
    type: "string",
    fieldType: "text",
    description: "low / medium / high no-show risk for booked demos.",
  },
  {
    name: "leadac_fit_score",
    label: "LeadAC Fit Score",
    type: "number",
    fieldType: "number",
    description: "0-100 ICP fit score.",
  },
  {
    name: "leadac_lead_priority",
    label: "LeadAC Lead Priority",
    type: "number",
    fieldType: "number",
    description: "0-100 rolled-up sales confidence / priority.",
  },
  {
    name: "leadac_evidence_summary",
    label: "LeadAC Evidence Summary",
    type: "string",
    fieldType: "text",
    description: "One-line evidence summary behind the recommendation.",
  },
  {
    name: "leadac_last_analyzed_date",
    label: "LeadAC Last Analyzed",
    type: "datetime",
    fieldType: "date",
    description: "When LeadAC last analyzed this lead.",
  },
  {
    name: "leadac_next_follow_up_date",
    label: "LeadAC Next Follow-up",
    type: "datetime",
    fieldType: "date",
    description: "Recommended next follow-up date.",
  },
  {
    name: "leadac_lead_sheet_url",
    label: "LeadAC Lead Sheet",
    type: "string",
    fieldType: "text",
    description: "Deep link to the LeadAC lead sheet.",
  },
];

export const LEADAC_PROPERTY_NAMES = LEADAC_PROPERTIES.map((p) => p.name);

/**
 * Ensure the `leadac_*` properties exist in the portal. Returns the list
 * of newly-created property names. Best-effort: a failure to create one
 * property logs and continues (a customer who pre-created a property
 * with the same name shouldn't block the rest).
 *
 * Function name keeps the post-rename brand (`ensureRevintProperties`)
 * while the actual HubSpot property keys are still `leadac_*` because
 * renaming them in a customer's portal would orphan all historical data.
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

  for (const prop of LEADAC_PROPERTIES) {
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
        groupName: "contactinformation",
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
