"use client";

import React from "react";
import { Theme, LayerProvider } from "@astryxdesign/core";
import { useThemeStore, themeMap } from "@/lib/store/theme";
import { butterTheme } from "@astryxdesign/theme-butter";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeName, mode } = useThemeStore();

  return (
    <Theme theme={butterTheme} mode={mode}>
      <LayerProvider>{children}</LayerProvider>
    </Theme>
  );
}
