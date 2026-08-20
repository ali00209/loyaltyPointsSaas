"use client";

import React from "react";
import { Theme, LayerProvider } from "@astryxdesign/core";
import { useThemeStore, themeMap, type ThemeName } from "@/lib/store/theme";
import { butterTheme } from "@astryxdesign/theme-butter";

const FALLBACK: ThemeName = "butter";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeName, mode } = useThemeStore();
  const theme = themeMap[themeName] ?? themeMap[FALLBACK];

  return (
    <Theme theme={theme} mode={mode}>
      <LayerProvider>{children}</LayerProvider>
    </Theme>
  );
}
