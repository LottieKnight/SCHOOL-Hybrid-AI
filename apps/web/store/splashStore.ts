import { create } from "zustand";

const SPLASH_VISITED_KEY = "school:splash:visited";
const SPLASH_SESSION_KEY = "school:splash:session";

type SplashState = {
  isFirstVisit: boolean;
  dismissed: boolean;
  dismiss: () => void;
  hydrate: () => void;
};

export const useSplashStore = create<SplashState>((set) => ({
  isFirstVisit: true,
  dismissed: false,

  dismiss: () => {
    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      /* SSR or private browsing */
    }
    set({ dismissed: true });
  },

  hydrate: () => {
    try {
      const sessionSeen = sessionStorage.getItem(SPLASH_SESSION_KEY);
      if (sessionSeen) {
        set({ isFirstVisit: false, dismissed: true });
        return;
      }

      const everVisited = localStorage.getItem(SPLASH_VISITED_KEY);
      if (!everVisited) {
        localStorage.setItem(SPLASH_VISITED_KEY, "1");
        set({ isFirstVisit: true });
      } else {
        set({ isFirstVisit: false });
      }
    } catch {
      /* SSR — default to full splash */
      set({ isFirstVisit: true });
    }
  },
}));
