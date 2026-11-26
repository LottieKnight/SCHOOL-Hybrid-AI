import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LicenseComplianceError,
  deriveLicenseFlags,
  enforceLicenseRules,
  validateCheckoutLicensing,
} from "../src/lib/license_rules.js";

test("license_rules derives required capability flags", () => {
  assert.deepEqual(deriveLicenseFlags("CC_BY_NC_ND"), {
    isCommercialAllowed: false,
    isDerivativeAllowed: false,
    requiresShareAlike: false,
    requiresAttribution: true,
  });
  assert.deepEqual(deriveLicenseFlags("PUBLIC_DOMAIN"), {
    isCommercialAllowed: true,
    isDerivativeAllowed: true,
    requiresShareAlike: false,
    requiresAttribution: false,
  });
});

test("license_rules enforces NC, ND, and SA adaptation constraints", () => {
  assert.throws(
    () => enforceLicenseRules({ license: "CC_BY_NC", priceCents: 5000 }),
    (error: unknown) => error instanceof LicenseComplianceError && error.code === "NC_PRICE_BLOCKED"
  );

  assert.throws(
    () => enforceLicenseRules({ license: "CC_BY_ND", isAdapted: true }),
    (error: unknown) => error instanceof LicenseComplianceError && error.code === "ND_ADAPTED_BLOCKED"
  );

  assert.throws(
    () => enforceLicenseRules({ license: "CC_BY_ND", isExcerpt: true }),
    (error: unknown) => error instanceof LicenseComplianceError && error.code === "ND_PARTIAL_BLOCKED"
  );

  assert.throws(
    () => enforceLicenseRules({ license: "CC_BY_SA", isAdapted: true, adaptedLicense: "CC_BY" }),
    (error: unknown) => error instanceof LicenseComplianceError && error.code === "SA_ADAPTED_LICENSE_MISMATCH"
  );

  const ok = enforceLicenseRules({
    license: "CC_BY_SA",
    isAdapted: true,
    adaptedLicense: "CC_BY_SA",
  });
  assert.equal(ok.flags.requiresShareAlike, true);
  assert.ok(ok.notes.some((note) => /same license/i.test(note)));
});

test("checkout licensing validation requires attribution for CC products", () => {
  assert.throws(
    () =>
      validateCheckoutLicensing([
        {
          title: "CC Reader",
          license: "CC_BY",
          priceCents: 0,
          attributionHtml: "",
        },
      ]),
    (error: unknown) => error instanceof LicenseComplianceError && error.code === "ATTRIBUTION_REQUIRED"
  );

  assert.doesNotThrow(() =>
    validateCheckoutLicensing([
      {
        title: "CC Reader",
        license: "CC_BY",
        priceCents: 0,
        attributionHtml: "<p>Author Name</p>",
      },
      {
        title: "Public Domain Reader",
        license: "PUBLIC_DOMAIN",
        priceCents: 5000,
      },
    ])
  );
});
