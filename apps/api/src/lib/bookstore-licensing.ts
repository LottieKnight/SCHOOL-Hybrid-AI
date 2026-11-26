import {
  deriveLicenseFlags as deriveBaseLicenseFlags,
  enforceLicenseRules,
  LicenseComplianceError,
  SUPPORTED_LICENSES,
  type SupportedLicense,
} from "./license_rules.js";

export const LICENSE_TYPES = [...SUPPORTED_LICENSES, "OTHER"] as const;

export type BookstoreLicenseType = (typeof LICENSE_TYPES)[number];

export const FULFILLMENT_TYPES = [
  "LINK_ONLY",
  "FILE_DOWNLOAD",
  "PRINT_ON_DEMAND",
  "SHIP_FROM_SUPPLIER",
] as const;

export type BookstoreFulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export type DerivedLicenseFlags = {
  nd_no_derivatives: boolean;
  nc_noncommercial: boolean;
  sa_sharealike: boolean;
};

export type LicensingValidationInput = {
  license_type: BookstoreLicenseType;
  price_cents: number;
  is_adapted?: boolean;
  adapted_license_type?: Exclude<BookstoreLicenseType, "OTHER"> | null;
  fulfillment_type: BookstoreFulfillmentType;
  storage_key?: string | null;
  file_type?: "PDF" | "EPUB" | "ZIP" | "LINK_ONLY" | null;
  checksum?: string | null;
  source_url?: string | null;
  is_excerpt?: boolean;
  is_partial_product?: boolean;
};

export type LicensingValidationResult = {
  flags: DerivedLicenseFlags;
  warnings: string[];
  notes: string[];
};

export class LicensingRuleError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function deriveLicenseFlags(licenseType: BookstoreLicenseType): DerivedLicenseFlags {
  if (licenseType === "OTHER" || licenseType === "PUBLIC_DOMAIN" || licenseType === "ALL_RIGHTS_RESERVED") {
    return {
      nd_no_derivatives: false,
      nc_noncommercial: false,
      sa_sharealike: false,
    };
  }
  const base = deriveBaseLicenseFlags(licenseType as SupportedLicense);
  return {
    nd_no_derivatives: licenseType.includes("_ND"),
    nc_noncommercial: !base.isCommercialAllowed,
    sa_sharealike: base.requiresShareAlike,
  };
}

export function validateLicensingRules(input: LicensingValidationInput): LicensingValidationResult {
  const flags = deriveLicenseFlags(input.license_type);
  const warnings: string[] = [];
  const notes: string[] = [];
  const isAdapted = Boolean(input.is_adapted);

  if (input.license_type !== "OTHER") {
    try {
      const result = enforceLicenseRules({
        license: input.license_type as SupportedLicense,
        priceCents: input.price_cents,
        isAdapted,
        adaptedLicense:
          input.adapted_license_type
            ? (input.adapted_license_type as SupportedLicense)
            : null,
        isExcerpt: input.is_excerpt,
        isPartialProduct: input.is_partial_product,
      });
      warnings.push(...result.warnings);
      notes.push(...result.notes);
    } catch (error) {
      if (error instanceof LicenseComplianceError) {
        throw new LicensingRuleError(error.code, error.message);
      }
      throw error;
    }
  }

  if (flags.nc_noncommercial && ["PRINT_ON_DEMAND", "SHIP_FROM_SUPPLIER"].includes(input.fulfillment_type)) {
    throw new LicensingRuleError("NC_PRINT_BLOCKED", "NonCommercial licenses cannot be sold as printed copies.");
  }

  if (flags.nd_no_derivatives && (input.storage_key || (input.file_type && input.file_type !== "LINK_ONLY"))) {
    if (!input.source_url) {
      warnings.push("CC BY-ND file entries should include source_url to prove original-source redistribution.");
    }
    if (!input.checksum) {
      warnings.push("CC BY-ND file entries should include checksum for unmodified file verification.");
    }
  }
  return { flags, warnings, notes };
}

export function isCommerciallySellable(licenseType: BookstoreLicenseType) {
  return !deriveLicenseFlags(licenseType).nc_noncommercial;
}
