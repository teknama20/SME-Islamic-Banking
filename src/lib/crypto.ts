// Cryptographic primitives: password hashing, OTPs, content hashing,
// signature seals and per-tenant envelope keys for the evidence vault.
//
// In production MASTER_KEY lives in the bank's HSM / KMS and tenant keys are
// unwrapped there; here it is derived from an environment variable.
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

const DEV_MASTER_KEY = "dev-only-master-key-change-me-0123456789abcdef";

function masterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("MASTER_KEY must be set in production");
    return Buffer.from(DEV_MASTER_KEY);
  }
  return Buffer.from(key);
}

/** Derives an independent 256-bit key per tenant and purpose (HKDF-SHA256). */
export function tenantKey(tenantId: string, purpose: "files" | "seal" | "otp"): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.from(tenantId), Buffer.from(`sme-ib:${purpose}`), 32));
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// --- Passwords (scrypt, N=2^15) -------------------------------------------

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

/** Bank password policy: 10+ chars with upper, lower, digit and symbol. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain upper and lower case letters, a digit and a symbol.";
  }
  return null;
}

// --- OTPs -------------------------------------------------------------------

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(tenantId: string, challengeId: string, code: string): string {
  return createHmac("sha256", tenantKey(tenantId, "otp")).update(`${challengeId}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// --- Signature seals ---------------------------------------------------------

/**
 * Server-side seal binding a signature to the exact document hash, signer,
 * slot and time. Production deployments replace / complement this with a
 * PKI signature from the bank's CA (advanced electronic signature, ETO 2002).
 */
export function sealSignature(tenantId: string, parts: (string | number)[]): string {
  return createHmac("sha256", tenantKey(tenantId, "seal")).update(parts.join("|")).digest("hex");
}

// --- Evidence vault encryption (AES-256-GCM) ---------------------------------

export function encryptBuffer(tenantId: string, plain: Buffer): { data: Buffer; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tenantKey(tenantId, "files"), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { data, iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptBuffer(tenantId: string, data: Buffer, iv: string, authTag: string): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", tenantKey(tenantId, "files"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** Deterministic JSON (sorted keys) so hashes are reproducible. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
