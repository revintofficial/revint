/**
 * FineDine v1 update — HubSpot API client with automatic token refresh.
 *
 * A `HubspotClient` wraps a single workspace's `CrmConnection`. It
 * decrypts the access token, transparently refreshes it (and persists
 * the new token, encrypted) when within the expiry skew, and exposes
 * thin typed wrappers over the CRM v3 endpoints we use: contacts,
 * companies, deals, owners, engagements, and property schemas.
 *
 * Multi-tenant: the client is always constructed from a `workspaceId`
 * via `getHubspotClient`, which scopes the `CrmConnection` lookup. Never
 * construct one from a request-supplied token.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { refreshHubspotToken } from "./oauth";

const API_BASE = "https://api.hubapi.com";
const REFRESH_SKEW_MS = 5 * 60_000; // refresh 5 min before expiry

export class HubspotNotConnectedError extends Error {
  constructor(message = "HubSpot is not connected for this workspace") {
    super(message);
  }
}

interface ConnectionRow {
  id: string;
  workspaceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  portalId: string | null;
}

export interface HubspotObject {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export class HubspotClient {
  private accessToken: string;
  private expiresAt: Date | null;

  constructor(
    private prisma: PrismaClient,
    private conn: ConnectionRow,
  ) {
    this.accessToken = decryptSecret(conn.accessToken);
    this.expiresAt = conn.expiresAt;
  }

  get portalId(): string | null {
    return this.conn.portalId;
  }

  private async ensureToken(): Promise<void> {
    const expiringSoon =
      !this.expiresAt || this.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
    if (!expiringSoon) return;
    if (!this.conn.refreshToken) return; // can't refresh; let the call 401

    const refresh = decryptSecret(this.conn.refreshToken);
    const tok = await refreshHubspotToken(refresh);
    this.accessToken = tok.access_token;
    this.expiresAt = new Date(Date.now() + tok.expires_in * 1000);
    await this.prisma.crmConnection.update({
      where: { id: this.conn.id },
      data: {
        accessToken: encryptSecret(tok.access_token),
        refreshToken: encryptSecret(tok.refresh_token),
        expiresAt: this.expiresAt,
        status: "ACTIVE",
        lastError: null,
      },
    });
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    await this.ensureToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = new Error(
        `HubSpot ${init?.method ?? "GET"} ${path} → ${res.status}: ${text}`,
      ) as Error & { status?: number; body?: unknown };
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json as T;
  }

  // ---- Reads -------------------------------------------------------------

  getContact(id: string, properties: string[]): Promise<HubspotObject> {
    const q = properties.length ? `?properties=${properties.join(",")}` : "";
    return this.request(`/crm/v3/objects/contacts/${id}${q}`);
  }

  getCompany(id: string, properties: string[]): Promise<HubspotObject> {
    const q = properties.length ? `?properties=${properties.join(",")}` : "";
    return this.request(`/crm/v3/objects/companies/${id}${q}`);
  }

  getDeal(id: string, properties: string[]): Promise<HubspotObject> {
    const q = properties.length ? `?properties=${properties.join(",")}` : "";
    return this.request(`/crm/v3/objects/deals/${id}${q}`);
  }

  getOwner(id: string): Promise<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }> {
    return this.request(`/crm/v3/owners/${id}`);
  }

  /** Associations: e.g. fetch the companies/deals linked to a contact. */
  getAssociations(
    objectType: string,
    objectId: string,
    toObjectType: string,
  ): Promise<{ results: Array<{ toObjectId: string; id?: string }> }> {
    return this.request(
      `/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}`,
    );
  }

  /**
   * Page through all contacts (used by the one-time import / backfill).
   * `after` is the opaque cursor from `paging.next.after`; omit it for
   * the first page. HubSpot caps `limit` at 100.
   */
  listContacts(
    properties: string[],
    after?: string,
    limit = 100,
  ): Promise<{
    results: HubspotObject[];
    paging?: { next?: { after: string } };
  }> {
    const params = new URLSearchParams({ limit: String(Math.min(limit, 100)) });
    if (properties.length) params.set("properties", properties.join(","));
    if (after) params.set("after", after);
    return this.request(`/crm/v3/objects/contacts?${params.toString()}`);
  }

  /** Page through all companies (import / backfill). */
  listCompanies(
    properties: string[],
    after?: string,
    limit = 100,
  ): Promise<{
    results: HubspotObject[];
    paging?: { next?: { after: string } };
  }> {
    const params = new URLSearchParams({ limit: String(Math.min(limit, 100)) });
    if (properties.length) params.set("properties", properties.join(","));
    if (after) params.set("after", after);
    return this.request(`/crm/v3/objects/companies?${params.toString()}`);
  }

  searchContacts(
    filters: Array<{ propertyName: string; operator: string; value: string }>,
    properties: string[],
    limit = 1,
  ): Promise<{ total: number; results: HubspotObject[] }> {
    return this.request(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties,
        limit,
      }),
    });
  }

  // ---- Writes ------------------------------------------------------------

  updateContact(
    id: string,
    properties: Record<string, string>,
  ): Promise<HubspotObject> {
    return this.request(`/crm/v3/objects/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
  }

  updateDeal(
    id: string,
    properties: Record<string, string>,
  ): Promise<HubspotObject> {
    return this.request(`/crm/v3/objects/deals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
  }

  /**
   * Create a CRM v3 "note" engagement and associate it to a contact.
   * Used by writeback to log a call/disposition note. `associations`
   * uses the default note→contact association type id (202).
   */
  createNote(
    body: string,
    contactId: string,
    timestampMs: number = Date.now(),
  ): Promise<HubspotObject> {
    return this.request(`/crm/v3/objects/notes`, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: String(timestampMs),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 202,
              },
            ],
          },
        ],
      }),
    });
  }

  /**
   * Log a call engagement against a contact. `disposition` is HubSpot's
   * call outcome; `body` carries the rep note.
   */
  createCall(
    args: {
      contactId: string;
      body: string;
      durationMs?: number;
      timestampMs?: number;
      title?: string;
    },
  ): Promise<HubspotObject> {
    return this.request(`/crm/v3/objects/calls`, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_call_body: args.body,
          hs_timestamp: String(args.timestampMs ?? Date.now()),
          hs_call_title: args.title ?? "LeadAC call",
          ...(args.durationMs ? { hs_call_duration: String(args.durationMs) } : {}),
        },
        associations: [
          {
            to: { id: args.contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 194,
              },
            ],
          },
        ],
      }),
    });
  }

  // ---- Property schema (provisioning) -----------------------------------

  listContactProperties(): Promise<{ results: Array<{ name: string }> }> {
    return this.request(`/crm/v3/properties/contacts`);
  }

  createContactProperty(def: Record<string, unknown>): Promise<unknown> {
    return this.request(`/crm/v3/properties/contacts`, {
      method: "POST",
      body: JSON.stringify(def),
    });
  }

  /** Pipelines + stages for the deals object (field-map seeding). */
  listDealPipelines(): Promise<{
    results: Array<{
      id: string;
      label: string;
      stages: Array<{ id: string; label: string; displayOrder: number }>;
    }>;
  }> {
    return this.request(`/crm/v3/pipelines/deals`);
  }
}

/**
 * Construct a `HubspotClient` for a workspace. Throws
 * `HubspotNotConnectedError` when there is no active connection.
 */
export async function getHubspotClient(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<HubspotClient> {
  const conn = await prisma.crmConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
    select: {
      id: true,
      workspaceId: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      portalId: true,
      status: true,
    },
  });
  if (!conn || conn.status === "REVOKED") {
    throw new HubspotNotConnectedError();
  }
  return new HubspotClient(prisma, conn);
}

/** Whether a workspace has an active HubSpot connection (no throw). */
export async function isHubspotConnected(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<boolean> {
  const conn = await prisma.crmConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
    select: { status: true },
  });
  return !!conn && conn.status !== "REVOKED";
}
