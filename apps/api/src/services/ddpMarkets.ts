// Deep-Dropped-Price (DDP) market catalogue.
//
// Maps a stable market key to a display name used by the DDP calculator route
// (marketplaceEconomics.ts). Registry is intentionally empty by default so an
// explicit `?market=` filter returns no selection while the full catalogue is
// still returned — callers treat a missing entry as "no special market".
export type DdpMarket = { key: string; name: string };

const DDP_MARKETS: Record<string, { name: string }> = {};

export function getDdpMarketByKey(key: string): { name: string } | null {
  return DDP_MARKETS[key] ?? null;
}

export function listDdpMarkets(): DdpMarket[] {
  return Object.entries(DDP_MARKETS).map(([key, value]) => ({ key, name: value.name }));
}