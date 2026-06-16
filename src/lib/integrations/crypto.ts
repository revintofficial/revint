/**
 * FineDine v1 update — at-rest encryption for CRM OAuth tokens.
 *
 * `CrmConnection.accessToken` / `refreshToken` are encrypted with
 * AES-256-GCM before being persisted. This is the security improvement
 * called out in the plan: `EmailAccount` stores OAuth tokens in
 * plaintext, but a leaked DB snapshot of HubSpot tokens grants write
 * access to a customer's entire CRM, so we encrypt them.
 *
 * Key: `CRM_TOKEN_ENCRYPTION_KEY` env var — a 32-byte key encoded as
 * hex (64 chars) or base64. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Graceful degradation: if the key is not set (local dev) we store the
 * value in plaintext. A discriminator prefix (`enc:v1:` for ciphertext,
 * raw otherwise) lets `decryptSecret` handle both shapes, so a workspace
 * connected before the key was configured still decrypts cleanly, and
 * rotating from plaintext → encrypted is seamless on the next refresh.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null | undefined;

function loadKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.CRM_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  let key: Buffer;
  // Accept hex (64 chars) or base64.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      "CRM_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (hex or base64).",
    );
  }
  cachedKey = key;
  return key;
}

/** Whether at-rest encryption is active (key configured). */
export function isCrmTokenEncryptionEnabled(): boolean {
  return loadKey() !== null;
}

/**
 * Encrypt a secret for storage. Returns `enc:v1:<iv>.<tag>.<ct>` (all
 * base64) when a key is configured; otherwise returns the raw value
 * unchanged (dev fallback).
 */
export function encryptSecret(plain: string): string {
  const key = loadKey();
  if (!key) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/**
 * Decrypt a stored secret. Handles both ciphertext (with the `enc:v1:`
 * prefix) and legacy plaintext values transparently.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = loadKey();
  if (!key) {
    throw new Error(
      "CRM token is encrypted but CRM_TOKEN_ENCRYPTION_KEY is not set — cannot decrypt.",
    );
  }
  const body = stored.slice(PREFIX.length);
  const [ivB64, tagB64, ctB64] = body.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed encrypted CRM token.");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
