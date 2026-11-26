import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";

function getKey(): Buffer | null {
  const hex = config.phoneEncryptionKey;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

export function isKeyConfigured(): boolean {
  return getKey() !== null;
}

export function encryptPhone(plaintext: string): string {
  const key = getKey();
  if (!key) throw new Error("PHONE_ENCRYPTION_KEY is not configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptPhone(stored: string): string {
  const key = getKey();
  if (!key) throw new Error("PHONE_ENCRYPTION_KEY is not configured.");
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Encrypted phone value has unexpected format.");
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
}

export function hashPhone(plaintext: string): string {
  const key = getKey();
  if (!key) throw new Error("PHONE_ENCRYPTION_KEY is not configured.");
  return createHmac("sha256", key).update(plaintext).digest("hex");
}
