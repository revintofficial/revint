/**
 * One-shot admin endpoint that swaps every installed portal from the
 * Legacy CRM Card view id to the new App Card view id without user
 * disruption (HubSpot's documented zero-downtime migration path —
 * `POST /crm/v3/extensions/cards-dev/{appId}/views/migrate`).
 *
 * Run this exactly once, AFTER:
 *   1. `hs project upload` has shipped a verified build that contains
 *      the new App Card.
 *   2. The build has been promoted to the public app in the HubSpot
 *      Developer UI.
 *   3. A developer test account confirms the new card renders.
 *
 * If the app is marketplace-listed, the developer must delete the
 * `hs-release-app-cards` feature flag in the Developer UI before this
 * endpoint will succeed (HubSpot's API rejects the swap while the flag
 * is set).
 *
 * Auth model: this is **NOT** a customer-facing endpoint. It uses a
 * HubSpot Developer Account API key (or app-level access token) tied to
 * Revint's developer account, not a customer's OAuth connection. The
 * route is gated by Revint admin auth (`requireWorkspaceAdminApi`) so a
 * customer can never invoke it.
 *
 * Body:
 *   {
 *     "appId": number,
 *     "legacyCrmCardId": "...",
 *     "appCardIds": ["..."]
 *   }
 */
import { NextResponse } from "next/server";

import {
  requireWorkspaceAdminApi,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface MigratePayload {
  appId: number;
  legacyCrmCardId: string;
  appCardIds: string[];
}

export async function POST(request: Request) {
  try {
    await requireWorkspaceAdminApi();

    const devKey = process.env.HUBSPOT_DEVELOPER_API_KEY;
    if (!devKey) {
      return NextResponse.json(
        {
          error: "developer_key_missing",
          message:
            "HUBSPOT_DEVELOPER_API_KEY must be set in the Revint backend env. This is the developer-account API key, not a customer OAuth token.",
        },
        { status: 503 },
      );
    }

    let body: MigratePayload;
    try {
      body = (await request.json()) as MigratePayload;
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    if (
      !body.appId ||
      !body.legacyCrmCardId ||
      !Array.isArray(body.appCardIds) ||
      body.appCardIds.length === 0
    ) {
      return NextResponse.json(
        {
          error: "missing_fields",
          required: ["appId", "legacyCrmCardId", "appCardIds[]"],
        },
        { status: 400 },
      );
    }

    const url = `https://api.hubapi.com/crm/v3/extensions/cards-dev/${body.appId}/views/migrate?hapikey=${encodeURIComponent(devKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legacyCrmCardId: body.legacyCrmCardId,
        appCardIds: body.appCardIds,
      }),
      cache: "no-store",
    });

    const text = await res.text();
    const json = text ? safeJson(text) : null;

    if (!res.ok) {
      logger.error("api.hubspot.migrate_card.failed", {
        status: res.status,
        body: text,
      });
      return NextResponse.json(
        {
          error: "hubspot_migrate_failed",
          status: res.status,
          detail: json ?? text,
        },
        { status: 502 },
      );
    }

    logger.info("api.hubspot.migrate_card.ok", {
      appId: body.appId,
      legacyCrmCardId: body.legacyCrmCardId,
      appCardIds: body.appCardIds,
    });
    return NextResponse.json({ ok: true, result: json });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    logger.error("api.hubspot.migrate_card.error", { err });
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
