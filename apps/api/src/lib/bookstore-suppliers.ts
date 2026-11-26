export const BOOKSTORE_SUPPLIER_TYPES = [
  "OER_PROVIDER",
  "POD_PRINTER",
  "WHOLESALER",
  "PUBLISHER_DIRECT",
  "PLATFORM_PARTNER",
] as const;

export type BookstoreSupplierType = (typeof BOOKSTORE_SUPPLIER_TYPES)[number];

export type BookstoreSupplier = {
  id: string;
  name: string;
  supplierType: BookstoreSupplierType;
  providerCode: string;
  contactEmail?: string | null;
  apiBaseUrl?: string | null;
  website?: string | null;
  termsUrl?: string | null;
  notes?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type SupplierSyncContext = {
  providerCode: string;
  supplierType: BookstoreSupplierType;
  triggeredByUserId: string;
};

export type SupplierSyncResult = {
  ok: boolean;
  syncedCount: number;
  warnings: string[];
  message: string;
};

export interface BookstoreSupplierAdapter {
  supplierType: BookstoreSupplierType;
  syncCatalog(context: SupplierSyncContext): Promise<SupplierSyncResult>;
}

export type SupplierImportFormat = "CSV" | "ONIX" | "MANUAL";

export type SupplierImportJob = {
  id: string;
  supplierId?: string | null;
  supplierType: BookstoreSupplierType;
  importFormat: SupplierImportFormat;
  status: "queued" | "running" | "completed" | "failed";
  sourceRef?: string | null;
  result?: Record<string, unknown>;
  createdAt: string;
};

export function createSupplierSyncStubAdapter(
  supplierType: BookstoreSupplierType
): BookstoreSupplierAdapter {
  return {
    supplierType,
    async syncCatalog(context) {
      return {
        ok: true,
        syncedCount: 0,
        warnings: [],
        message: `Supplier sync for ${supplierType} (${context.providerCode}) is intentionally stubbed until provider feed integration is implemented.`,
      };
    },
  };
}
