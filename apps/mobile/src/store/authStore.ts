import { create } from "zustand";
import { clearAuthToken, getAuthToken, setAuthToken } from "../lib/auth/tokenStore";
import { fetchSession, login as loginApi, logout as logoutApi, register as registerApi, type MobileUser } from "../lib/api/auth";

type AuthState = {
  user: MobileUser | null;
  token: string | null;
  isHydrated: boolean;
  isLoading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

async function storeToken(token: string | null) {
  if (token) {
    await setAuthToken(token);
    return;
  }
  await clearAuthToken();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isHydrated: false,
  isLoading: false,

  login: async (input) => {
    set({ isLoading: true });
    try {
      const envelope = await loginApi(input);
      const token = envelope.token ?? null;
      if (token) await storeToken(token);
      set({ user: envelope.user, token, isLoading: false, isHydrated: true });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (input) => {
    set({ isLoading: true });
    try {
      const envelope = await registerApi(input);
      const token = envelope.token ?? null;
      if (token) await storeToken(token);
      set({ user: envelope.user, token, isLoading: false, isHydrated: true });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const token = get().token;
    try {
      if (token) {
        await logoutApi();
      }
    } catch {
      // ignore network errors on logout
    } finally {
      await storeToken(null);
      set({ user: null, token: null });
    }
  },

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const token = await getAuthToken();
      if (!token) {
        set({ user: null, token: null, isHydrated: true, isLoading: false });
        return;
      }
      const session = await fetchSession();
      set({ user: session.user, token, isHydrated: true, isLoading: false });
    } catch {
      await storeToken(null);
      set({ user: null, token: null, isHydrated: true, isLoading: false });
    }
  },
}));
