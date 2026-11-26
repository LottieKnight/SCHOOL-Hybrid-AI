import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const hex = process.env.PHONE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("PHONE_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

// AES-256-GCM: random IV per call, authenticated encryption.
// Output format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
export function encryptPhone(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptPhone(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Encrypted phone value has unexpected format.");
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// HMAC-SHA256 of the normalised phone — deterministic, used for the UNIQUE constraint.
// Stored in phone_number_hash; never returned to clients.
export function hashPhone(plaintext: string): string {
  return createHmac("sha256", getKey()).update(plaintext).digest("hex");
}
