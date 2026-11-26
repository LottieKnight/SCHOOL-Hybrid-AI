import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";
const ENVELOPE_PREFIX = "smsg";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

type MessageEnvelope = {
  prefix: typeof ENVELOPE_PREFIX;
  version: typeof KEY_VERSION;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

function getKey(): Buffer {
  const raw = config.messageEncryptionKey.trim();
  if (!raw) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is required for message operations.");
  }

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MESSAGE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or 64-character hex).");
  }
  return key;
}

function encode(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function parseEnvelope(value: string): MessageEnvelope | null {
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== ENVELOPE_PREFIX || parts[1] !== KEY_VERSION) return null;
  const iv = decode(parts[2]);
  const tag = decode(parts[3]);
  const ciphertext = decode(parts[4]);
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) return null;
  return { prefix: ENVELOPE_PREFIX, version: KEY_VERSION, iv, tag, ciphertext };
}

export function isEncryptedMessageBody(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${ENVELOPE_PREFIX}.${KEY_VERSION}.`);
}

export function encryptMessageBody(value: string | null): string | null {
  if (value === null) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_PREFIX, KEY_VERSION, encode(iv), encode(tag), encode(ciphertext)].join(".");
}

export function decryptMessageBody(value: string | null): string | null {
  if (value === null || !isEncryptedMessageBody(value)) return value;
  const envelope = parseEnvelope(value);
  if (!envelope) throw new Error("Invalid encrypted message envelope.");
  const decipher = createDecipheriv(ALGORITHM, getKey(), envelope.iv);
  decipher.setAuthTag(envelope.tag);
  return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString("utf8");
}

export function encryptMessageBodyForTest(value: string, key: Buffer): string {
  if (key.length !== 32) throw new Error("Test message encryption keys must be 32 bytes.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [ENVELOPE_PREFIX, KEY_VERSION, encode(iv), encode(cipher.getAuthTag()), encode(ciphertext)].join(".");
}

export function decryptMessageBodyForTest(value: string, key: Buffer): string {
  if (key.length !== 32) throw new Error("Test message encryption keys must be 32 bytes.");
  const envelope = parseEnvelope(value);
  if (!envelope) throw new Error("Invalid encrypted message envelope.");
  const decipher = createDecipheriv(ALGORITHM, key, envelope.iv);
  decipher.setAuthTag(envelope.tag);
  return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString("utf8");
}
