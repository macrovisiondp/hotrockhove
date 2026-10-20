import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "./env";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = env().SETTINGS_ENCRYPTION_KEY;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must decode to 32 bytes");
  return buf;
}

/** AES-256-GCM encryption for admin-managed credentials stored in the database. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, data]).toString("base64");
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) throw new Error("Value is not an encrypted secret");
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv(ALGO, key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Keyed hash so IP addresses can be correlated for abuse detection without storing them. */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", key()).update(value).digest("hex").slice(0, 32);
}

export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}
