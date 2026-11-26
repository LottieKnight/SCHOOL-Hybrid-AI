import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import {
  decryptMessageBody,
  decryptMessageBodyForTest,
  encryptMessageBodyForTest,
  isEncryptedMessageBody,
} from "../src/lib/messageEncryption.js";

test("message encryption uses a versioned envelope and round-trips plaintext", () => {
  const key = randomBytes(32);
  const encrypted = encryptMessageBodyForTest("A learner's private study note", key);
  assert.equal(isEncryptedMessageBody(encrypted), true);
  assert.equal(decryptMessageBodyForTest(encrypted, key), "A learner's private study note");
});

test("message encryption rejects tampering", () => {
  const key = randomBytes(32);
  const encrypted = encryptMessageBodyForTest("do not alter", key);
  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => decryptMessageBodyForTest(tampered, key));
});

test("legacy plaintext remains readable during rolling backfill", () => {
  assert.equal(decryptMessageBody("legacy message"), "legacy message");
  assert.equal(decryptMessageBody(null), null);
});
