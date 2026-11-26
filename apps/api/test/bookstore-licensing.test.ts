import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LicensingRuleError,
  deriveLicenseFlags,
  validateLicensingRules,
} from "../src/lib/bookstore-licensing.js";

test("deriveLicenseFlags maps NC/ND/SA correctly", () => {
  assert.deepEqual(deriveLicenseFlags("CC_BY"), {
    nd_no_derivatives: false,
    nc_noncommercial: false,
    sa_sharealike: false,
  });

  assert.deepEqual(deriveLicenseFlags("CC_BY_NC_SA"), {
    nd_no_derivatives: false,
    nc_noncommercial: true,
    sa_sharealike: true,
  });

  assert.deepEqual(deriveLicenseFlags("CC_BY_ND"), {
    nd_no_derivatives: true,
    nc_noncommercial: false,
    sa_sharealike: false,
  });
});

test("validateLicensingRules blocks NC paid listings and printed sales", () => {
  assert.throws(
    () =>
      validateLicensingRules({
        license_type: "CC_BY_NC",
        price_cents: 1000,
        fulfillment_type: "LINK_ONLY",
      }),
    (error: unknown) =>
      error instanceof LicensingRuleError &&
      error.code === "NC_PRICE_BLOCKED" &&
      /NonCommercial/i.test(error.message)
  );

  assert.throws(
    () =>
      validateLicensingRules({
        license_type: "CC_BY_NC",
        price_cents: 0,
        fulfillment_type: "PRINT_ON_DEMAND",
      }),
    (error: unknown) => error instanceof LicensingRuleError && error.code === "NC_PRINT_BLOCKED"
  );
});

test("validateLicensingRules blocks ND adaptations and emits ND file warnings", () => {
  assert.throws(
    () =>
      validateLicensingRules({
        license_type: "CC_BY_ND",
        price_cents: 0,
        fulfillment_type: "LINK_ONLY",
        is_adapted: true,
      }),
    (error: unknown) => error instanceof LicensingRuleError && error.code === "ND_ADAPTED_BLOCKED"
  );

  const result = validateLicensingRules({
    license_type: "CC_BY_ND",
    price_cents: 0,
    fulfillment_type: "FILE_DOWNLOAD",
    storage_key: "book.pdf",
    file_type: "PDF",
  });
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0]!, /source_url/i);
  assert.match(result.warnings[1]!, /checksum/i);
});

test("validateLicensingRules emits ShareAlike and adaptation notes", () => {
  const result = validateLicensingRules({
    license_type: "CC_BY_SA",
    price_cents: 0,
    fulfillment_type: "LINK_ONLY",
    is_adapted: true,
    adapted_license_type: "CC_BY_SA",
  });
  assert.ok(result.notes.some((note) => /ShareAlike/i.test(note)));
  assert.ok(result.notes.some((note) => /indicate changes/i.test(note)));
});

test("validateLicensingRules requires same adapted license for ShareAlike", () => {
  assert.throws(
    () =>
      validateLicensingRules({
        license_type: "CC_BY_SA",
        price_cents: 0,
        fulfillment_type: "LINK_ONLY",
        is_adapted: true,
      }),
    (error: unknown) =>
      error instanceof LicensingRuleError && error.code === "SA_ADAPTED_LICENSE_REQUIRED"
  );

  assert.throws(
    () =>
      validateLicensingRules({
        license_type: "CC_BY_SA",
        price_cents: 0,
        fulfillment_type: "LINK_ONLY",
        is_adapted: true,
        adapted_license_type: "CC_BY",
      }),
    (error: unknown) =>
      error instanceof LicensingRuleError && error.code === "SA_ADAPTED_LICENSE_MISMATCH"
  );
});
