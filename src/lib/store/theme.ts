// stores/themeStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { butterTheme } from "@astryxdesign/theme-butter";
import { matchaTheme } from "@astryxdesign/theme-matcha";
import { neutralTheme } from "@astryxdesign/theme-neutral";
import { y2kTheme } from "@astryxdesign/theme-y2k/built";
import { loyaltyTheme } from "../themes/loyalty-theme";

export const themeMap = {
  y2k: y2kTheme,
  loyalty: loyaltyTheme,
  neutral: neutralTheme,
  butter: butterTheme,
  matcha: matchaTheme,
} as const;

export type ThemeName = keyof typeof themeMap;

export type ThemeMode = "light" | "dark" | "system";

interface ThemeStore {
  themeName: ThemeName;
  mode: ThemeMode;

  setThemeName: (name: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeName: "butter",
      mode: "system",

      setThemeName: (themeName) => set({ themeName }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "theme-store",
    },
  ),
);
