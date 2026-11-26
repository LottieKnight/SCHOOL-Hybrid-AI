import { apiClient } from "./client";

export type WalletAccount = {
  userId: string;
  balanceCredits: number;
  currency: string;
  createdAt: string | null;
};

export type WalletLedgerEntry = {
  id: string;
  userId: string;
  type: "CREDIT" | "DEBIT";
  amountCredits: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type WalletBalanceResponse = {
  wallet: WalletAccount;
  pricing: {
    bundles?: Array<{
      id: string;
      title: string;
      description?: string;
      credits?: number;
      priceZar?: number;
    }>;
  };
};

export async function fetchWalletBalance() {
  const response = await apiClient.get<WalletBalanceResponse>("/wallet/balance");
  return response.data;
}

export async function fetchWalletLedger(limit = 10) {
  const response = await apiClient.get<{ entries: WalletLedgerEntry[]; limit: number }>("/wallet/ledger", {
    params: { limit },
  });
  return response.data;
}
