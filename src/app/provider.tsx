"use client";

import { appTheme } from "@/themes/appTheme";
import { LayerProvider, Theme } from "@astryxdesign/core";
import { neutralTheme } from "@astryxdesign/theme-neutral";
import { y2kTheme } from "@astryxdesign/theme-y2k";
import { butterTheme } from "@astryxdesign/theme-butter";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Theme theme={butterTheme}>
      <LayerProvider>{children}</LayerProvider>
    </Theme>
  );
}
