import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "saedu-rq",
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000,
});

// Apply to useQuery calls that should survive app restarts (Learn catalog,
// module detail, past-papers filters). These are read-heavy and rarely change.
export const OFFLINE_CACHE = {
  gcTime: Infinity,
  staleTime: 24 * 60 * 60 * 1000,
} as const;
