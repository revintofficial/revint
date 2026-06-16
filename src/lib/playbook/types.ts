/**
 * FineDine v1 update — configurable workspace sales playbook.
 *
 * The `WorkspacePlaybook` row stores five JSON columns whose shapes are
 * defined here. The playbook drives the Lead Detail Action Sheet:
 *   - `stages`    → the playbook stage chip + stage picker, and the
 *                   HubSpot pipeline/stage mapping (field-map.ts).
 *   - `angles`    → the "FineDine Angle Card" (pitch this / don't pitch).
 *   - `qualificationChecklist` → the qualification block.
 *   - `temperatureRules` / `noShowRiskRules` → computed Hot/Warm/Cold
 *     badge + no-show risk.
 *
 * FineDine is the first seed (see `FINEDINE_PLAYBOOK` below and
 * `scripts/seed-finedine-playbook.ts`). The shapes are intentionally
 * permissive (everything optional past the key/label) so a future
 * playbook editor UI can grow them without a schema migration.
 */

export type RiskLevel = "low" | "medium" | "high";

export interface PlaybookStage {
  /** Stable key persisted on `Lead.playbookStageKey` (e.g. "attempting"). */
  key: string;
  label: string;
  /** One-line meaning shown in the stage picker tooltip. */
  meaning?: string;
  /** Suggested next action copy for this stage. */
  nextAction?: string;
  /** Render / progression order (ascending). */
  order: number;
  /** HubSpot pipeline + stage ids this maps onto (field-map.ts). */
  hubspotPipelineId?: string;
  hubspotStageId?: string;
  /** Marks the stage that means "qualified" for temperature rules. */
  isQualified?: boolean;
  /** Marks terminal lost / no-show stages (pull out of today's queue). */
  isTerminal?: boolean;
}

export interface PlaybookAngle {
  key: string;
  label: string;
  /** When this angle is the right pitch. */
  whenToPitch?: string;
  /** When to explicitly NOT pitch this angle. */
  whenNotToPitch?: string;
  /**
   * Signal keys that make this angle relevant (e.g. "no_online_ordering",
   * "no_reservation_system", "low_rating"). The NBA worker matches lead
   * evidence against these to pick the best angle.
   */
  triggers?: string[];
}

export interface PlaybookChecklistItem {
  key: string;
  label: string;
  /** Whether this item must be true for the lead to count as qualified. */
  requiredForQualified: boolean;
}

export interface TemperatureRule {
  /** Inclusive upper bound (hours since inbound) for this band, if any. */
  maxHoursSinceInbound?: number;
  /** Dispositions that pin the lead into this band. */
  dispositions?: string[];
  /** Whether reaching a qualified stage forces this band. */
  whenQualified?: boolean;
  /** Free-form note surfaced in the UI tooltip. */
  note?: string;
}

export interface TemperatureRules {
  hot?: TemperatureRule;
  warm?: TemperatureRule;
  cold?: TemperatureRule;
}

export interface NoShowRiskRules {
  /** Factor keys that raise no-show risk, with their weights. */
  factors?: Array<{ key: string; label: string; weight: number }>;
  /** Score thresholds → risk level. */
  thresholds?: { medium: number; high: number };
}

export interface PlaybookShape {
  stages: PlaybookStage[];
  angles: PlaybookAngle[];
  qualificationChecklist: PlaybookChecklistItem[];
  temperatureRules: TemperatureRules;
  noShowRiskRules: NoShowRiskRules;
}

/**
 * FineDine beta seed playbook. Stages mirror the inbound SDR motion
 * (New Inbound → Attempting → Connected → Qualified → Meeting Booked →
 * No-show / Lost). Angles are FineDine's product surfaces. Checklist is
 * the inbound qualification gate.
 */
export const FINEDINE_PLAYBOOK: PlaybookShape = {
  stages: [
    {
      key: "new_inbound",
      label: "New Inbound",
      meaning: "Just arrived from HubSpot, never touched.",
      nextAction: "Call within the first hour while intent is hot.",
      order: 0,
    },
    {
      key: "attempting",
      label: "Attempting",
      meaning: "Outreach started, not yet connected.",
      nextAction: "Re-attempt; vary time-of-day and channel.",
      order: 1,
    },
    {
      key: "connected",
      label: "Connected",
      meaning: "Spoke with a human at the venue.",
      nextAction: "Run qualification; identify decision maker + need.",
      order: 2,
    },
    {
      key: "qualified",
      label: "Qualified",
      meaning: "Fit + need + timing confirmed.",
      nextAction: "Book the demo.",
      order: 3,
      isQualified: true,
    },
    {
      key: "meeting_booked",
      label: "Meeting Booked",
      meaning: "Demo scheduled.",
      nextAction: "Send confirmation + reminder to cut no-show risk.",
      order: 4,
      isQualified: true,
    },
    {
      key: "no_show",
      label: "No-show",
      meaning: "Missed the booked demo.",
      nextAction: "Re-engage with a low-friction reschedule.",
      order: 5,
      isTerminal: false,
    },
    {
      key: "lost",
      label: "Lost",
      meaning: "Not pursuing — out of scope, no budget, or opted out.",
      nextAction: "Archive; revisit on a trigger.",
      order: 6,
      isTerminal: true,
    },
  ],
  angles: [
    {
      key: "qr_menu",
      label: "QR Menu",
      whenToPitch: "Paper menus, no contactless ordering, high table turnover.",
      whenNotToPitch: "Fine-dining venue that views QR as cheapening the experience.",
      triggers: ["no_online_ordering", "high_volume", "casual_dining"],
    },
    {
      key: "order_and_pay",
      label: "Order & Pay",
      whenToPitch: "Understaffed, long wait times, want to lift table turnover.",
      whenNotToPitch: "Venue whose differentiator is attentive table service.",
      triggers: ["understaffed", "high_volume", "slow_service_reviews"],
    },
    {
      key: "ai_menu_builder",
      label: "AI Menu Builder",
      whenToPitch: "Frequent menu changes, multi-location consistency needs.",
      whenNotToPitch: "Tiny single-location with a static menu.",
      triggers: ["multi_location", "frequent_menu_changes"],
    },
    {
      key: "reservation",
      label: "Reservation",
      whenToPitch: "No booking system, takes reservations by phone, waitlist pain.",
      whenNotToPitch: "Walk-in-only counter-service spot.",
      triggers: ["no_reservation_system", "phone_only_booking", "reservations_in_reviews"],
    },
    {
      key: "crm_loyalty",
      label: "CRM / Loyalty",
      whenToPitch: "Strong repeat trade, wants to own the guest relationship.",
      whenNotToPitch: "Pure tourist-trade venue with no repeat customers.",
      triggers: ["repeat_customers", "high_rating", "many_reviews"],
    },
    {
      key: "multi_language",
      label: "Multi-language",
      whenToPitch: "Tourist area, international clientele, multilingual reviews.",
      whenNotToPitch: "Hyper-local venue with a single-language audience.",
      triggers: ["tourist_area", "multilingual_reviews"],
    },
    {
      key: "website",
      label: "Website",
      whenToPitch: "No website, or an outdated / broken site.",
      whenNotToPitch: "Already has a strong, modern, conversion-ready site.",
      triggers: ["no_website", "outdated_website", "broken_website"],
    },
    {
      key: "multi_location",
      label: "Multi-location",
      whenToPitch: "Chain or group wanting one system across venues.",
      whenNotToPitch: "Single independent location.",
      triggers: ["multi_location", "is_group_brand"],
    },
  ],
  qualificationChecklist: [
    { key: "decision_maker", label: "Speaking with the decision maker", requiredForQualified: true },
    { key: "need", label: "Clear need / pain identified", requiredForQualified: true },
    { key: "timing", label: "Timing to act (this quarter)", requiredForQualified: true },
    { key: "budget", label: "Budget fit / price not a blocker", requiredForQualified: false },
    { key: "next_step", label: "Concrete next step agreed", requiredForQualified: true },
    { key: "demo_interest", label: "Interested in a demo", requiredForQualified: false },
    { key: "info_only", label: "Just gathering info (disqualifier)", requiredForQualified: false },
  ],
  temperatureRules: {
    hot: {
      maxHoursSinceInbound: 2,
      dispositions: ["ANSWERED_INTERESTED", "BOOKED_MEETING"],
      whenQualified: true,
      note: "Fresh inbound or active interest — call now.",
    },
    warm: {
      maxHoursSinceInbound: 48,
      dispositions: ["VOICEMAIL", "NO_ANSWER"],
      note: "Engaged recently or mid-attempt — keep the cadence.",
    },
    cold: {
      dispositions: ["ANSWERED_NOT_INTERESTED", "OPTED_OUT", "WRONG_NUMBER"],
      note: "Stale or declined — low priority.",
    },
  },
  noShowRiskRules: {
    factors: [
      { key: "no_confirmation", label: "No confirmation sent", weight: 30 },
      { key: "booked_far_out", label: "Demo booked > 7 days out", weight: 20 },
      { key: "single_touch", label: "Only one prior touch", weight: 20 },
      { key: "prior_no_show", label: "Previous no-show", weight: 40 },
      { key: "low_engagement", label: "Low engagement signals", weight: 15 },
    ],
    thresholds: { medium: 30, high: 60 },
  },
};
