export const SUPPORTED_LICENSES = [
  "CC_BY",
  "CC_BY_SA",
  "CC_BY_ND",
  "CC_BY_NC",
  "CC_BY_NC_SA",
  "CC_BY_NC_ND",
  "PUBLIC_DOMAIN",
  "ALL_RIGHTS_RESERVED",
] as const;

export type SupportedLicense = (typeof SUPPORTED_LICENSES)[number];

export type LicenseDerivedFlags = {
  isCommercialAllowed: boolean;
  isDerivativeAllowed: boolean;
  requiresShareAlike: boolean;
  requiresAttribution: boolean;
};

export type LicenseRuleInput = {
  license: SupportedLicense;
  priceCents?: number;
  isAdapted?: boolean;
  adaptedLicense?: SupportedLicense | null;
  isExcerpt?: boolean;
  isPartialProduct?: boolean;
};

export type CheckoutLicenseLineInput = {
  title?: string;
  license: SupportedLicense;
  priceCents: number;
  attributionHtml?: string | null;
  isAdapted?: boolean;
  adaptedLicense?: SupportedLicense | null;
  isExcerpt?: boolean;
  isPartialProduct?: boolean;
};

export class LicenseComplianceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LicenseComplianceError";
  }
}

export function deriveLicenseFlags(license: SupportedLicense): LicenseDerivedFlags {
  const nc = license.includes("_NC");
  const nd = license.includes("_ND");
  const sa = license.includes("_SA");
  const cc = license.startsWith("CC_");

  if (license === "PUBLIC_DOMAIN") {
    return {
      isCommercialAllowed: true,
      isDerivativeAllowed: true,
      requiresShareAlike: false,
      requiresAttribution: false,
    };
  }

  if (license === "ALL_RIGHTS_RESERVED") {
    return {
      isCommercialAllowed: true,
      isDerivativeAllowed: false,
      requiresShareAlike: false,
      requiresAttribution: false,
    };
  }

  return {
    isCommercialAllowed: !nc,
    isDerivativeAllowed: !nd,
    requiresShareAlike: sa,
    requiresAttribution: cc,
  };
}

export function isCreativeCommonsLicense(license: SupportedLicense) {
  return license.startsWith("CC_");
}

export function enforceLicenseRules(input: LicenseRuleInput) {
  const flags = deriveLicenseFlags(input.license);
  const warnings: string[] = [];
  const notes: string[] = [];
  const priceCents = Math.max(0, Math.floor(input.priceCents ?? 0));
  const isAdapted = Boolean(input.isAdapted);
  const isExcerpt = Boolean(input.isExcerpt);
  const isPartialProduct = Boolean(input.isPartialProduct);

  if (!flags.isCommercialAllowed && priceCents > 0) {
    throw new LicenseComplianceError(
      "NC_PRICE_BLOCKED",
      "NonCommercial resources may not be sold. Set price to 0."
    );
  }

  if (!flags.isDerivativeAllowed && isAdapted) {
    throw new LicenseComplianceError(
      "ND_ADAPTED_BLOCKED",
      "NoDerivatives resources cannot be marked as adapted."
    );
  }

  if (!flags.isDerivativeAllowed && (isExcerpt || isPartialProduct)) {
    throw new LicenseComplianceError(
      "ND_PARTIAL_BLOCKED",
      "NoDerivatives resources cannot be split into excerpts or partial products."
    );
  }

  if (flags.requiresShareAlike && isAdapted) {
    if (!input.adaptedLicense) {
      throw new LicenseComplianceError(
        "SA_ADAPTED_LICENSE_REQUIRED",
        "Adapted ShareAlike resources must declare an adapted_license."
      );
    }
    if (input.adaptedLicense !== input.license) {
      throw new LicenseComplianceError(
        "SA_ADAPTED_LICENSE_MISMATCH",
        "Adapted ShareAlike resources must use the same license as the original."
      );
    }
    notes.push("ShareAlike applies: adapted work must be published under the same license.");
  }

  if (isAdapted) {
    notes.push("Adapted resource: indicate changes made from the original.");
  }

  if (flags.requiresAttribution) {
    notes.push("Attribution is required when redistributing this resource.");
  }

  if (!flags.isCommercialAllowed) {
    warnings.push("Non-commercial - not for sale");
  }

  return { flags, warnings, notes };
}

export function validateCheckoutLicensing(lines: CheckoutLicenseLineInput[]) {
  const warnings: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const result = enforceLicenseRules({
      license: line.license,
      priceCents: line.priceCents,
      isAdapted: line.isAdapted,
      adaptedLicense: line.adaptedLicense,
      isExcerpt: line.isExcerpt,
      isPartialProduct: line.isPartialProduct,
    });
    warnings.push(...result.warnings.map((w) => (line.title ? `${line.title}: ${w}` : w)));
    notes.push(...result.notes.map((n) => (line.title ? `${line.title}: ${n}` : n)));

    if (isCreativeCommonsLicense(line.license)) {
      const attribution = String(line.attributionHtml ?? "").trim();
      if (!attribution) {
        throw new LicenseComplianceError(
          "ATTRIBUTION_REQUIRED",
          `Attribution is required for ${line.title || "Creative Commons products"} before checkout.`
        );
      }
    }
  }

  return { warnings, notes };
}
