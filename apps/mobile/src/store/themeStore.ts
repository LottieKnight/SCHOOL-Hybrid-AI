import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeName = "scholar" | "light" | "obsidian" | "vanta";
export type InstitutionCode = "NWU" | "UCT" | "UJ" | "WITS" | "UP" | null;

type ThemeStore = {
  theme: ThemeName;
  institution: InstitutionCode;
  setTheme: (t: ThemeName) => void;
  setInstitution: (i: InstitutionCode) => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "scholar",
      institution: null,
      setTheme: (theme) => set({ theme }),
      setInstitution: (institution) => set({ institution }),
    }),
    { name: "saedu-theme", storage: createJSONStorage(() => AsyncStorage) }
  )
);
