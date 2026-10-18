// Evidence vault: files are hashed (SHA-256 of plaintext), encrypted with the
// tenant's AES-256-GCM key and written under STORAGE_DIR. In production this
// is backed by WORM object storage (e.g. S3 Object Lock) in-country.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredFile } from "@prisma/client";
import { decryptBuffer, encryptBuffer, randomToken, sha256 } from "./crypto";
import type { Tx } from "./db";
import { RuleError } from "./rbac";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
]);

function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

export async function storeFile(
  tx: Tx,
  opts: { tenantId: string; uploadedById: string; buffer: Buffer; originalName: string; mimeType: string },
): Promise<StoredFile> {
  if (opts.buffer.length === 0) throw new RuleError("Empty file.");
  if (opts.buffer.length > MAX_UPLOAD_BYTES) throw new RuleError("File exceeds the 50 MB limit.");
  if (!ALLOWED_MIME.has(opts.mimeType)) throw new RuleError(`File type ${opts.mimeType || "unknown"} is not permitted.`);

  const hash = sha256(opts.buffer);
  const { data, iv, authTag } = encryptBuffer(opts.tenantId, opts.buffer);
  const storageKey = path.join(opts.tenantId, hash.slice(0, 2), `${hash}-${randomToken(6)}.bin`);
  const full = path.join(storageRoot(), storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx" });

  return tx.storedFile.create({
    data: {
      tenantId: opts.tenantId,
      sha256: hash,
      size: opts.buffer.length,
      mimeType: opts.mimeType,
      originalName: opts.originalName.slice(0, 200),
      storageKey,
      iv,
      authTag,
      uploadedById: opts.uploadedById,
    },
  });
}

/** Decrypts and integrity-checks a stored file. */
export async function loadFile(file: StoredFile): Promise<Buffer> {
  const data = await readFile(path.join(storageRoot(), file.storageKey));
  const plain = decryptBuffer(file.tenantId, data, file.iv, file.authTag);
  if (sha256(plain) !== file.sha256) throw new Error("Stored file failed integrity verification.");
  return plain;
}
